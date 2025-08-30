import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaArrowLeft, FaSave } from "react-icons/fa";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const joinUrl = (path = "") => `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

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
  });

  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [status, setStatus] = useState({ show: false, title: "", message: "", variant: "info" });
  const inFlight = useRef(false);

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
    if (isNaN(d)) return "";
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
        const res = await apiFetch(`/teachers/${id}`, { signal: ac.signal }); // ✅ GET with Bearer
        const data = await res.json().catch(() => ({}));
        if (!data?.success || !data?.data) throw new Error("Failed to load teacher.");
        const t = data.data;
        setForm({
          first_name: t.first_name || "",
          middle_name: t.middle_name || "",
          last_name: t.last_name || "",
          extension_name: t.extension_name || "",
          teacher_address: t.teacher_address || "",
          date_of_birth: toYMD(t.date_of_birth),
          email: t.email || "",
          contact_number: t.contact_number || "",
          is_active: Boolean(t.is_active),
        });
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

    const base = {
      first_name: first,
      middle_name: form.middle_name.trim(),
      last_name: last,
      extension_name: form.extension_name.trim(),
      teacher_address: form.teacher_address.trim(),
      date_of_birth: dob,
      email,
      contact_number: phone,
    };
    return isEdit ? { ...base, is_active: Boolean(form.is_active) } : base;
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
      const res = await apiFetch(path, { method, body: JSON.stringify(payload) }); // ✅ Bearer on create/update
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

  const handleToggleActive = async () => {
    if (!isEdit || toggling) return;
    setToggling(true);
    try {
      const res = await apiFetch(`/teachers/toggle-status/${id}`, { method: "PATCH" }); // ✅ Bearer on toggle
      const data = await res.json().catch(() => ({}));
      const success = data?.success ?? res.ok;
      if (success) {
        setForm((f) => ({ ...f, is_active: !f.is_active }));
        showStatus("success", "Status updated", data?.message || "Teacher status changed.");
      } else {
        throw new Error(data?.message || "Toggle failed.");
      }
    } catch (err) {
      showStatus("danger", "Error", err.message || "Toggle failed.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="container-xxl my-4">
      <StatusModal {...status} onHide={onHideStatus} />

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          {/* Header */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
            <h4 className="fw-bold mb-0">{isEdit ? "Edit Teacher" : "Create Teacher"}</h4>
            <div className="d-flex align-items-center gap-3">
              {isEdit && (
                <div className="d-flex align-items-center gap-2">
                  <span className={`badge ${form.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                    {form.is_active ? "Active" : "Inactive"}
                  </span>
                  <div className="form-check form-switch m-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="activeSwitch"
                      checked={form.is_active}
                      onChange={handleToggleActive}
                      disabled={toggling}
                    />
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

          {/* Form — Row1: 1 field, Row2+: 2 columns per row */}
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
                placeholder="e.g., michael.delacruz@example.com"
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
                rows={1}   // normal input height
                value={form.teacher_address}
                onChange={handleChange}
                aria-describedby="addrHelp"
                maxLength={255}
              />
              <div id="addrHelp" className="form-text">Street, city/municipality.</div>
            </div>

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
