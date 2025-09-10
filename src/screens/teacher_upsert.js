import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaArrowLeft, FaSave, FaCheckCircle, FaCircle, FaExclamationTriangle, FaEye, FaEyeSlash } from "react-icons/fa";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const joinUrl = (path = "") => `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

/** Lightweight confirm modal */
const ConfirmModal = ({ show, onCancel, onConfirm, title, body, confirmLabel = "Confirm", confirmVariant = "primary" }) => {
  if (!show) return null;
  return (
    <div className="modal fade show" style={{ display: "block" }} aria-modal="true" role="dialog">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content rounded-4 shadow-sm">
          <div className={`modal-header bg-${confirmVariant} text-white rounded-top-4`}>
            <h6 className="modal-title fw-semibold">{title}</h6>
            <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onCancel} />
          </div>
          <div className="modal-body">
            <p className="mb-0">{body}</p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-light border" onClick={onCancel}>Cancel</button>
            <button className={`btn btn-${confirmVariant}`} onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function UpsertTeacher() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    extension_name: "",
    teacher_address: "",
    date_of_birth: "",
    email: "",
    contact_number: "",
    is_active: true,
    password: "", // used only on CREATE per API
  });

  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [status, setStatus] = useState({ show: false, title: "", message: "", variant: "info" });
  const inFlight = useRef(false);

  // confirm state for toggle
  const [confirm, setConfirm] = useState({ show: false, nextValue: null });

  const showStatus = (variant, title, message) =>
    setStatus({ show: true, title, message, variant });
  const onHideStatus = () => setStatus((s) => ({ ...s, show: false }));

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const handleUnauthorized = () => {
    sessionStorage.removeItem("token");
    showStatus("danger", "Unauthorized", "Please login to continue.");
    setTimeout(() => navigate("/login"), 900);
  };

  async function apiFetch(path, { method = "GET", headers = {}, body, signal } = {}) {
    if (!token) {
      handleUnauthorized();
      throw new Error("Missing authorization token.");
    }
    const res = await fetch(joinUrl(path), {
      method,
      headers: { ...authHeaders(), ...headers },
      body,
      signal,
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error("Unauthorized");
    }
    return res;
  }

  // helpers
  const toYMD = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let v = value;
    if (name === "contact_number") v = value.replace(/[^\d+]/g, "").slice(0, 15);
    setForm((f) => ({ ...f, [name]: v }));
  };

  // load teacher (edit)
  useEffect(() => {
    if (!isEdit || !token) return;
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`/teachers/${id}`, { signal: ac.signal });
        const data = await res.json().catch(() => ({}));
        if (!data?.success || !data?.data) throw new Error("Failed to load teacher.");
        const t = data.data;
        setForm((f) => ({
          ...f,
          first_name: t.first_name || "",
          middle_name: t.middle_name || "",
          last_name: t.last_name || "",
          extension_name: t.extension_name || "",
          teacher_address: t.teacher_address || "",
          date_of_birth: toYMD(t.date_of_birth),
          email: t.email || "",
          contact_number: t.contact_number || "",
          is_active: Boolean(t.is_active),
          password: "", // never prefill on edit
        }));
      } catch (err) {
        if (err.message !== "Unauthorized" && err.name !== "AbortError") {
          showStatus("danger", "Error", err.message || "Unable to load teacher.");
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id, token]);

  // validation
  const validate = () => {
    const first = form.first_name.trim();
    const last = form.last_name.trim();
    const email = form.email.trim();
    const dob = form.date_of_birth.trim();
    const phone = form.contact_number.trim();

    if (!first || !last || !email || !dob || !phone) {
      showStatus("warning", "Check fields", "First name, last name, email, contact number, and date of birth are required.");
      return null;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      showStatus("warning", "Invalid email", "Please enter a valid email address.");
      return null;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      showStatus("warning", "Invalid contact", "Contact number seems too short.");
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      showStatus("warning", "Invalid date", "Date of birth must be in YYYY-MM-DD format.");
      return null;
    }

    // API: POST /teachers/create requires password
    if (!isEdit) {
      const pwd = form.password.trim();
      if (!pwd) {
        showStatus("warning", "Password required", "Please set an initial password for this teacher.");
        return null;
      }
      if (pwd.length < 8) {
        showStatus("warning", "Weak password", "Password must be at least 8 characters.");
        return null;
      }
    }

    const base = {
      first_name: first,
      middle_name: form.middle_name.trim(),
      last_name: last,
      extension_name: form.extension_name.trim(),
      teacher_address: form.teacher_address.trim(),
      date_of_birth: dob, // "YYYY-MM-DD"
      email,
      contact_number: phone,
    };
    // PUT may include is_active (bool or 0/1). We'll send boolean.
    return isEdit ? { ...base, is_active: Boolean(form.is_active) } : { ...base, password: form.password.trim() };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || inFlight.current) return;

    const payload = validate();
    if (!payload) return;

    setLoading(true);
    inFlight.current = true;
    try {
      const path = isEdit ? `/teachers/update/${id}` : `/teachers/create`;
      const method = isEdit ? "PUT" : "POST";
      const res = await apiFetch(path, { method, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      const success = data?.success ?? res.ok;

      if (success) {
        showStatus("success", isEdit ? "Updated" : "Created", data?.message || "Success.");
        setTimeout(() => navigate("/teacher"), 900);
      } else {
        throw new Error(data?.message || "Save failed.");
      }
    } catch (err) {
      if (err.message !== "Unauthorized") {
        showStatus("danger", "Error", err.message || "Failed to save teacher.");
      }
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  // --- Toggle UX ---
  const openConfirmToggle = (nextVal) => setConfirm({ show: true, nextValue: nextVal });
  const commitToggle = async (nextVal) => {
    setConfirm({ show: false, nextValue: null });
    if (!isEdit || toggling) return;

    const prev = form.is_active;
    setForm((f) => ({ ...f, is_active: nextVal })); // optimistic
    setToggling(true);

    try {
      const res = await apiFetch(`/teachers/toggle-status/${id}`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      const success = data?.success ?? res.ok;
      if (success) {
        showStatus("success", "Status updated", data?.message || "Teacher status changed.");
      } else {
        setForm((f) => ({ ...f, is_active: prev })); // rollback
        showStatus("danger", "Failed", data?.message || "Toggle failed.");
      }
    } catch (err) {
      setForm((f) => ({ ...f, is_active: prev })); // rollback
      showStatus("danger", "Error", err.message || "Toggle failed.");
    } finally {
      setToggling(false);
    }
  };

  const handleToggleClick = () => {
    const nextVal = !form.is_active;
    // Ask confirmation when ACTIVATING (per your UX); deactivate immediately
    if (nextVal) openConfirmToggle(true);
    else commitToggle(false);
  };

  const handleToggleKey = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleToggleClick();
    }
  };

  return (
    <div className="container-xxl my-4">
      {/* tiny CSS to polish the switch */}
      <style>{`
        .ux-toggle {
          --h: 28px;
          --w: 52px;
          width: var(--w);
          height: var(--h);
          position: relative;
          display: inline-flex;
          align-items: center;
          border-radius: var(--h);
          border: 1px solid rgba(0,0,0,.08);
          background: var(--bg, #e9ecef);
          transition: background .25s ease, box-shadow .25s ease;
          cursor: pointer;
          user-select: none;
          outline: none;
        }
        .ux-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: calc(var(--h) - 4px);
          height: calc(var(--h) - 4px);
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,.08);
          transform: translateX(var(--x, 0));
          transition: transform .25s ease;
          display: grid;
          place-items: center;
        }
        .ux-toggle.active { --bg: #19875422; }
        .ux-toggle.inactive { --bg: #adb5bd33; }
        .ux-toggle.active .ux-thumb { --x: calc(var(--w) - var(--h)); }
        .ux-toggle:focus-visible { box-shadow: 0 0 0 4px rgba(88,111,255,0.25); }
      `}</style>

      <StatusModal {...status} onHide={onHideStatus} />
      <ConfirmModal
        show={confirm.show}
        onCancel={() => setConfirm({ show: false, nextValue: null })}
        onConfirm={() => commitToggle(confirm.nextValue)}
        title={confirm.nextValue ? "Activate this Teacher?" : "Change Active Status"}
        body={
          confirm.nextValue
            ? "Activating a teacher enables assignments and visibility across the system. Proceed to set this teacher as active?"
            : "Proceed to change the active status?"
        }
        confirmLabel={confirm.nextValue ? "Set Active" : "Confirm"}
        confirmVariant={confirm.nextValue ? "success" : "primary"}
      />

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          {/* Header */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
            <h4 className="fw-bold mb-0">{isEdit ? "Edit Teacher" : "Create Teacher"}</h4>
            <div className="d-flex align-items-center gap-3">
              {isEdit && (
                <div className="d-flex align-items-center gap-2">
                  <span className={`badge d-inline-flex align-items-center gap-2 ${form.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                    <FaCircle size={7} /> {form.is_active ? "Active" : "Inactive"}
                  </span>
                  {/* Accessible custom switch */}
                  <div
                    className={`ux-toggle ${form.is_active ? "active" : "inactive"} ${toggling ? "pe-none opacity-75" : ""}`}
                    role="switch"
                    aria-checked={form.is_active}
                    aria-label="Toggle teacher active"
                    tabIndex={0}
                    onClick={handleToggleClick}
                    onKeyDown={handleToggleKey}
                  >
                    <div className="ux-thumb">
                      {toggling ? (
                        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                      ) : (
                        <FaCheckCircle size={12} className={form.is_active ? "" : "opacity-0"} />
                      )}
                    </div>
                  </div>
                </div>
              )}
              <button
                type="button"
                className="btn btn-light border d-flex align-items-center gap-2 px-3"
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft /> Back
              </button>
            </div>
          </div>

          {/* subtle helper when inactive */}
          {isEdit && !form.is_active && (
            <div className="alert alert-warning d-flex align-items-start gap-2 py-2" role="alert">
              <FaExclamationTriangle className="mt-1" />
              <div className="small">
                This teacher is currently <strong>inactive</strong>. Activate to allow assignments and visibility.
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="row g-3 g-lg-4">
            {/* Row 1 */}
            <div className="col-12">
              <label htmlFor="first_name" className="form-label fw-semibold">First Name</label>
              <input
                id="first_name"
                name="first_name"
                className="form-control"
                placeholder="e.g., Michael"
                value={form.first_name}
                onChange={handleChange}
                required
                aria-describedby="firstHelp"
                maxLength={64}
              />
              <div id="firstHelp" className="form-text">Given name as it appears on records.</div>
            </div>

            {/* Row 2 */}
            <div className="col-md-6">
              <label htmlFor="last_name" className="form-label fw-semibold">Last Name</label>
              <input
                id="last_name"
                name="last_name"
                className="form-control"
                placeholder="e.g., Doblas"
                value={form.last_name}
                onChange={handleChange}
                required
                aria-describedby="lastHelp"
                maxLength={64}
              />
              <div id="lastHelp" className="form-text">Family name / surname.</div>
            </div>
            <div className="col-md-6">
              <label htmlFor="middle_name" className="form-label fw-semibold">Middle Name</label>
              <input
                id="middle_name"
                name="middle_name"
                className="form-control"
                placeholder="e.g., A."
                value={form.middle_name}
                onChange={handleChange}
                aria-describedby="middleHelp"
                maxLength={64}
              />
              <div id="middleHelp" className="form-text">Optional (may use initial).</div>
            </div>

            {/* Row 3 */}
            <div className="col-md-6">
              <label htmlFor="extension_name" className="form-label fw-semibold">Extension</label>
              <input
                id="extension_name"
                name="extension_name"
                className="form-control"
                placeholder="e.g., Jr., Sr., III"
                value={form.extension_name}
                onChange={handleChange}
                aria-describedby="extHelp"
                maxLength={16}
              />
              <div id="extHelp" className="form-text">Optional suffix (if applicable).</div>
            </div>
            <div className="col-md-6">
              <label htmlFor="date_of_birth" className="form-label fw-semibold">Date of Birth</label>
              <input
                id="date_of_birth"
                name="date_of_birth"
                type="date"
                className="form-control"
                placeholder="YYYY-MM-DD"
                value={form.date_of_birth}
                onChange={handleChange}
                required
                aria-describedby="dobHelp"
              />
              <div id="dobHelp" className="form-text">Use format YYYY-MM-DD.</div>
            </div>

            {/* Row 4 */}
            <div className="col-md-6">
              <label htmlFor="email" className="form-label fw-semibold">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-control"
                placeholder="e.g., michael.doblas@example.com"
                value={form.email}
                onChange={handleChange}
                required
                aria-describedby="emailHelp"
                maxLength={128}
              />
              <div id="emailHelp" className="form-text">We’ll send notifications here.</div>
            </div>
            <div className="col-md-6">
              <label htmlFor="contact_number" className="form-label fw-semibold">Contact Number</label>
              <input
                id="contact_number"
                name="contact_number"
                className="form-control"
                placeholder="e.g., 09171234567"
                value={form.contact_number}
                onChange={handleChange}
                required
                aria-describedby="contactHelp"
                maxLength={15}
              />
              <div id="contactHelp" className="form-text">Digits only. PH mobile starts with 09…</div>
            </div>

            {/* Row 5 */}
            <div className="col-12">
              <label htmlFor="teacher_address" className="form-label fw-semibold">Address</label>
              <textarea
                id="teacher_address"
                name="teacher_address"
                className="form-control"
                placeholder="e.g., 789 Main Street, Quezon City"
                rows={1}
                value={form.teacher_address}
                onChange={handleChange}
                aria-describedby="addrHelp"
                maxLength={255}
              />
              <div id="addrHelp" className="form-text">Street, city/municipality.</div>
            </div>

            {/* Row 6: Password (CREATE only, per API) */}
            {!isEdit && (
              <div className="col-md-6">
                <label htmlFor="password" className="form-label fw-semibold">Initial Password</label>
                <div className="input-group">
                  <input
                    id="password"
                    name="password"
                    type={showPwd ? "text" : "password"}
                    className="form-control"
                    placeholder="e.g., SecurePass123!"
                    value={form.password}
                    onChange={handleChange}
                    required
                    aria-describedby="pwdHelp"
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowPwd((v) => !v)}
                    title={showPwd ? "Hide" : "Show"}
                  >
                    {showPwd ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                <div id="pwdHelp" className="form-text">
                  At least 8 characters. This is required by <code>POST /teachers/create</code>.
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="col-12 d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-light border"
                onClick={() => navigate("/teacher")}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-dark d-flex align-items-center gap-2"
                disabled={loading}
              >
                {loading && <span className="spinner-border spinner-border-sm" role="status" />}
                <FaSave /> {isEdit ? "Save Changes" : "Create Teacher"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Processing pill */}
      {loading && (
        <div className="position-fixed bottom-0 start-50 translate-middle-x mb-3 px-3 py-2 d-inline-flex align-items-center gap-2 bg-body border rounded-pill shadow-sm">
          <span className="spinner-border spinner-border-sm" role="status" />
          <span>Processing…</span>
        </div>
      )}
    </div>
  );
}
