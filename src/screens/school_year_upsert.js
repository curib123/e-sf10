import React, { useEffect, useMemo, useRef, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { checkToken } from "../components/token_checker";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaSave, FaCheckCircle, FaCircle, FaExclamationTriangle } from "react-icons/fa";
import StatusModal from "../components/status_modal";

// Single Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

/** Lightweight confirm modal (Bootstrap) */
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

const SchoolYearUpsert = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [formData, setFormData] = useState({ start_year: "", end_year: "" });
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "danger",
  });

  // confirm state
  const [confirm, setConfirm] = useState({
    show: false,
    nextValue: null, // true to activate, false to deactivate
  });

  const inFlight = useRef(false);

  const authHeaders = () => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const showModal = (variant, title, message) =>
    setModal({ show: true, title, message, variant });

  const handleUnauthorized = () => {
    sessionStorage.removeItem("token");
    showModal("danger", "Unauthorized", "Please login to continue.");
    setTimeout(() => navigate("/login"), 900);
  };

  const apiFetch = async (path, options = {}) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error("Unauthorized");
    }
    return res;
  };

  // Load existing (Edit)
  useEffect(() => {
    checkToken();
    if (!isEdit || !token) return;

    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await apiFetch(`/school-year/school-year/${id}`, { signal: ctrl.signal });
        const data = await res.json();
        if (data?.success && data?.schoolYear) {
          const sy = data.schoolYear;
          setFormData({
            start_year: sy.start_year ?? "",
            end_year: sy.end_year ?? "",
          });
          setIsActive(sy.is_active === 1);
        } else {
          showModal("danger", "Failed", "Could not load the school year.");
        }
      } catch (err) {
        if (err.name !== "AbortError" && err.message !== "Unauthorized") {
          showModal("danger", "Error", "Something went wrong.");
        }
      }
    })();

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id, token]);

  // Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    const v = value.replace(/[^\d]/g, "").slice(0, 4); // only digits, 4 chars
    setFormData((prev) => {
      const next = { ...prev, [name]: v };
      if (name === "start_year" && v.length === 4) {
        const n = parseInt(v, 10);
        if (!Number.isNaN(n)) next.end_year = String(n + 1);
      }
      return next;
    });
  };

  const validate = () => {
    const s = String(formData.start_year).trim();
    const e = String(formData.end_year).trim();
    const sNum = parseInt(s, 10);
    const eNum = parseInt(e, 10);

    if (!s || !e) return [false, "Complete all fields."];
    if (s.length !== 4 || e.length !== 4) return [false, "Use 4-digit years."];
    if (!Number.isInteger(sNum) || !Number.isInteger(eNum)) return [false, "Years must be numbers."];
    if (eNum !== sNum + 1) return [false, "End year must be start year + 1."];
    if (sNum < 1990 || sNum > 2100) return [false, "Enter a valid range (1990–2100)."];
    return [true, { start_year: sNum, end_year: eNum }];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || inFlight.current) return;

    const [ok, payloadOrMsg] = validate();
    if (!ok) return showModal("warning", "Check fields", payloadOrMsg);

    setLoading(true);
    inFlight.current = true;
    try {
      const path = isEdit
        ? `/school-year/update-school-year/${id}`
        : `/school-year/create-school-year`;
      const method = isEdit ? "PUT" : "POST";

      const res = await apiFetch(path, { method, body: JSON.stringify(payloadOrMsg) });
      const data = await res.json().catch(() => ({}));
      const success = data?.success ?? res.ok;

      if (success) {
        showModal("success", "Saved", data?.message || (isEdit ? "Updated." : "Created."));
        if (isEdit) setTimeout(() => navigate(-1), 900);
        else setFormData({ start_year: "", end_year: "" });
      } else {
        showModal("danger", "Failed", data?.message || "Request failed.");
      }
    } catch (err) {
      if (err.message !== "Unauthorized") showModal("danger", "Error", "Something went wrong.");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  // --- Toggle UX ---
  const openConfirmToggle = (nextVal) => {
    // Only confirm when turning ON by default; change to always if you prefer
    setConfirm({
      show: true,
      nextValue: nextVal,
    });
  };

  const commitToggle = async (nextVal) => {
    setConfirm({ show: false, nextValue: null });
    if (!isEdit || toggleLoading) return;

    const prev = isActive;
    // optimistic
    setIsActive(nextVal);
    setToggleLoading(true);

    try {
      const res = await apiFetch(`/school-year/school-year/${id}/set-active`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: nextVal ? 1 : 0 }),
      });
      const data = await res.json().catch(() => ({}));
      const success = data?.success ?? res.ok;

      if (success) {
        showModal("success", "Updated", data?.message || "Status changed.");
      } else {
        setIsActive(prev); // rollback
        showModal("danger", "Failed", data?.message || "Toggle failed.");
      }
    } catch {
      setIsActive(prev); // rollback
      showModal("danger", "Error", "Toggle failed.");
    } finally {
      setToggleLoading(false);
    }
  };

  const handleToggleClick = () => {
    const nextVal = !isActive;
    // Ask for confirmation when activating; deactivate is direct
    if (nextVal) openConfirmToggle(true);
    else commitToggle(false);
  };

  const handleToggleKey = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleToggleClick();
    }
  };

  const previewSY =
    String(formData.start_year).trim().length === 4 &&
    String(formData.end_year).trim().length === 4
      ? `${formData.start_year}–${formData.end_year}`
      : "—";

  return (
    <div className="container-xxl my-4">
      {/* tiny CSS to polish the switch */}
      <style>{`
        .sy-toggle {
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
        .sy-thumb {
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
        .sy-toggle.active { --bg: #19875422; }
        .sy-toggle.inactive { --bg: #adb5bd33; }
        .sy-toggle.active .sy-thumb { --x: calc(var(--w) - var(--h)); }
        .sy-toggle:focus-visible { box-shadow: 0 0 0 4px rgba(88,111,255,0.25); }
        .sy-dot {
          width: 6px; height: 6px; border-radius: 999px;
        }
      `}</style>

      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />
      <ConfirmModal
        show={confirm.show}
        onCancel={() => setConfirm({ show: false, nextValue: null })}
        onConfirm={() => commitToggle(confirm.nextValue)}
        title={confirm.nextValue ? "Activate this School Year?" : "Change Active Status"}
        body={
          confirm.nextValue
            ? "Only one school year should be active at a time. Proceed to set this school year as active?"
            : "Proceed to change the active status?"
        }
        confirmLabel={confirm.nextValue ? "Set Active" : "Confirm"}
        confirmVariant={confirm.nextValue ? "success" : "primary"}
      />

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          {/* Header */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
            <h4 className="fw-bold mb-0">{isEdit ? "Edit School Year" : "Create School Year"}</h4>

            <div className="d-flex align-items-center gap-3">
              {isEdit && (
                <div className="d-flex align-items-center gap-2">
                  <span className={`badge d-inline-flex align-items-center gap-2 ${isActive ? "text-bg-success" : "text-bg-secondary"}`}>
                    <FaCircle size={7} />
                    {isActive ? "Active" : "Inactive"}
                  </span>

                  {/* Accessible custom switch */}
                  <div
                    className={`sy-toggle ${isActive ? "active" : "inactive"} ${toggleLoading ? "pe-none opacity-75" : ""}`}
                    role="switch"
                    aria-checked={isActive}
                    aria-label="Toggle school year active"
                    tabIndex={0}
                    onClick={handleToggleClick}
                    onKeyDown={handleToggleKey}
                  >
                    <div className="sy-thumb">
                      {toggleLoading ? (
                        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                      ) : (
                        <FaCheckCircle size={12} className={isActive ? "" : "opacity-0"} />
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

          {/* subtle helper when editable + currently inactive */}
          {isEdit && !isActive && (
            <div className="alert alert-warning d-flex align-items-start gap-2 py-2" role="alert">
              <FaExclamationTriangle className="mt-1" />
              <div className="small">
                This school year is currently <strong>inactive</strong>. Activate it when it becomes the official working year.
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="row g-3 g-lg-4">
            {/* Row 1: Start Year */}
            <div className="col-12">
              <label htmlFor="start_year" className="form-label fw-semibold">Start Year</label>
              <input
                type="text"
                inputMode="numeric"
                className="form-control"
                id="start_year"
                name="start_year"
                placeholder="e.g., 2027"
                value={formData.start_year}
                onChange={handleChange}
                required
                aria-describedby="startHelp"
                maxLength={4}
              />
              <div id="startHelp" className="form-text">
                Enter a 4-digit year. End Year will auto-fill to Start + 1.
              </div>
            </div>

            {/* Row 2: End Year + Preview */}
            <div className="col-md-6">
              <label htmlFor="end_year" className="form-label fw-semibold">End Year</label>
              <input
                type="text"
                inputMode="numeric"
                className="form-control"
                id="end_year"
                name="end_year"
                placeholder="e.g., 2028"
                value={formData.end_year}
                onChange={handleChange}
                required
                aria-describedby="endHelp"
                maxLength={4}
              />
              <div id="endHelp" className="form-text">Must be exactly Start Year + 1.</div>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">Preview</label>
              <input className="form-control" value={previewSY} readOnly aria-describedby="previewHelp" />
              <div id="previewHelp" className="form-text">Read-only display of the School Year range.</div>
            </div>

            {/* Actions */}
            <div className="col-12 d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-light border"
                onClick={() => navigate(-1)}
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
                <FaSave /> {isEdit ? "Save Changes" : "Create School Year"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Non-blocking progress pill */}
      {loading && (
        <div className="position-fixed bottom-0 start-50 translate-middle-x mb-3 px-3 py-2 d-inline-flex align-items-center gap-2 bg-body border rounded-pill shadow-sm">
          <span className="spinner-border spinner-border-sm" role="status" />
          <span>Processing…</span>
        </div>
      )}
    </div>
  );
};

export default SchoolYearUpsert;
