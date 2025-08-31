import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import StatusModal from "../components/status_modal";
import { FaArrowLeft, FaSave, FaCheckCircle, FaCircle, FaExclamationTriangle } from "react-icons/fa";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const UpsertCurriculum = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [formData, setFormData] = useState({
    curriculum_name: "",
    school_year_id: "",
    is_active: true,
  });
  const [schoolYears, setSchoolYears] = useState([]);
  const [usedSchoolYears, setUsedSchoolYears] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusModal, setStatusModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "info",
  });

  // confirm state for toggle
  const [confirm, setConfirm] = useState({ show: false, nextValue: null });

  const authHeaders = () => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const handleUnauthorized = () => {
    setStatusModal({
      show: true,
      title: "Unauthorized",
      message: "Please log in.",
      variant: "danger",
    });
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 900);
  };

  const checkToken = () => {
    if (!token) {
      handleUnauthorized();
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!checkToken()) return;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/school-year/all-school-years`, {
          headers: authHeaders(),
        });
        if (res.status === 401) return handleUnauthorized();
        const data = await res.json();
        if (data?.success) setSchoolYears(data.schoolYears || []);
      } catch {
        setStatusModal({
          show: true,
          title: "Error",
          message: "Failed to load school years.",
          variant: "danger",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mark used school years (so each SY can have at most one curriculum)
  useEffect(() => {
    if (!checkToken()) return;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/curriculum/view-all-curriculums`, {
          headers: authHeaders(),
        });
        if (res.status === 401) return handleUnauthorized();
        const data = await res.json();
        if (data?.success && Array.isArray(data.data)) {
          const used = data.data
            .filter((c) => !isEdit || c.curriculum_id !== Number(id))
            .map((c) => c.school_year_id);
          setUsedSchoolYears(used);
        }
      } catch {
        /* no-op */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  // Load existing (edit)
  useEffect(() => {
    if (!isEdit || !checkToken()) return;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/curriculum/view-curriculum/${id}`, {
          headers: authHeaders(),
        });
        if (res.status === 401) return handleUnauthorized();
        const data = await res.json();
        if (!data?.success || !data?.data) throw new Error("Failed to fetch curriculum.");
        setFormData({
          curriculum_name: data.data.curriculum_name || "",
          school_year_id: data.data.school_year_id || "",
          is_active: Boolean(data.data.is_active),
        });
      } catch {
        setStatusModal({
          show: true,
          title: "Error",
          message: "Failed to load curriculum.",
          variant: "danger",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  // ---- Toggle UX (confirm on activate) ----
  const openConfirmToggle = (nextVal) => setConfirm({ show: true, nextValue: nextVal });
  const commitToggle = (nextVal) => {
    setConfirm({ show: false, nextValue: null });
    setFormData((p) => ({ ...p, is_active: nextVal }));
  };
  const handleToggleClick = () => {
    const nextVal = !formData.is_active;
    if (nextVal) openConfirmToggle(true);
    else commitToggle(false);
  };
  const handleToggleKey = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleToggleClick();
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    // Only the switch uses confirm flow; ignore direct checkbox toggling
    if (name === "is_active") return;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.curriculum_name.trim() || !formData.school_year_id) {
      return setStatusModal({
        show: true,
        title: "Check fields",
        message: "Curriculum name and school year are required.",
        variant: "warning",
      });
    }
    if (!checkToken()) return;

    setLoading(true);
    try {
      const endpoint = isEdit
        ? `${BASE_URL}/curriculum/update-curriculum/${id}`
        : `${BASE_URL}/curriculum/create-curriculum`;

      const res = await fetch(endpoint, {
        method: isEdit ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(formData),
      });
      if (res.status === 401) return handleUnauthorized();
      const result = await res.json();
      if (!result?.success) throw new Error(result?.message || "Save failed.");

      setStatusModal({
        show: true,
        title: "Success",
        message: result?.message || "Saved.",
        variant: "success",
      });
      setTimeout(() => navigate("/curriculum"), 900);
    } catch (err) {
      setStatusModal({
        show: true,
        title: "Error",
        message: err.message || "Failed to save curriculum.",
        variant: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-xxl my-4">
      {/* tiny CSS for premium toggle */}
      <style>{`
        .cur-toggle {
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
        .cur-thumb {
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
        .cur-toggle.active { --bg: #19875422; }
        .cur-toggle.inactive { --bg: #adb5bd33; }
        .cur-toggle.active .cur-thumb { --x: calc(var(--w) - var(--h)); }
        .cur-toggle:focus-visible { box-shadow: 0 0 0 4px rgba(88,111,255,0.25); }
        .cur-dot { width: 6px; height: 6px; border-radius: 999px; }
      `}</style>

      <StatusModal
        {...statusModal}
        onHide={() => setStatusModal((s) => ({ ...s, show: false }))}
      />

      {/* lightweight confirm modal */}
      {confirm.show && (
        <div className="modal fade show" style={{ display: "block" }} aria-modal="true" role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 shadow-sm">
              <div className="modal-header bg-success text-white rounded-top-4">
                <h6 className="modal-title fw-semibold">Activate this Curriculum?</h6>
                <button type="button" className="btn-close btn-close-white" onClick={() => setConfirm({ show: false, nextValue: null })} />
              </div>
              <div className="modal-body">
                Activating a curriculum will make it available for assignments and references tied to the selected school year. Proceed?
              </div>
              <div className="modal-footer">
                <button className="btn btn-light border" onClick={() => setConfirm({ show: false, nextValue: null })}>Cancel</button>
                <button className="btn btn-success" onClick={() => commitToggle(confirm.nextValue)}>Set Active</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          {/* Header — consistent with other pages */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
            <h4 className="fw-bold mb-0">
              {isEdit ? "Edit Curriculum" : "Create Curriculum"}
            </h4>
            <div className="d-flex gap-2 flex-nowrap">
              <button
                type="button"
                className="btn btn-light border d-flex align-items-center gap-2 px-3"
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft /> Back
              </button>
            </div>
          </div>

          {/* subtle helper if inactive */}
          {isEdit && !formData.is_active && (
            <div className="alert alert-warning d-flex align-items-start gap-2 py-2" role="alert">
              <FaExclamationTriangle className="mt-1" />
              <div className="small">
                This curriculum is currently <strong>inactive</strong>. Activate it when ready for use.
              </div>
            </div>
          )}

          {/* Form — Row1: 1 field (full), Row2: 2 fields */}
          <form onSubmit={handleSubmit} noValidate className="row g-3 g-lg-4">
            {/* Row 1: Curriculum Name */}
            <div className="col-12">
              <label htmlFor="curriculum_name" className="form-label fw-semibold">
                Curriculum Name
              </label>
              <input
                type="text"
                id="curriculum_name"
                name="curriculum_name"
                className="form-control"
                placeholder="e.g., K–12 Core 2026"
                value={formData.curriculum_name}
                onChange={handleChange}
                autoComplete="off"
                required
                aria-describedby="curNameHelp"
                maxLength={128}
              />
              <div id="curNameHelp" className="form-text">
                A clear, unique name (e.g., <strong>K–12 Core 2026</strong>).
              </div>
            </div>

            {/* Row 2: School Year + Status */}
            <div className="col-md-6">
              <label htmlFor="school_year_id" className="form-label fw-semibold">
                School Year
              </label>
              <select
                id="school_year_id"
                name="school_year_id"
                className="form-select"
                value={formData.school_year_id}
                onChange={handleChange}
                required
                aria-describedby="syHelp"
              >
                <option value="" disabled>
                  Select school year…
                </option>
                {schoolYears.map((sy) => {
                  const isUsed =
                    usedSchoolYears.includes(sy.school_year_id) &&
                    (!isEdit || sy.school_year_id !== Number(formData.school_year_id));
                  const label =
                    sy.start_year && sy.end_year
                      ? `${sy.start_year} - ${sy.end_year}${isUsed ? " (Used)" : ""}`
                      : "Unknown Year";
                  return (
                    <option
                      key={sy.school_year_id}
                      value={sy.school_year_id}
                      disabled={isUsed}
                    >
                      {label}
                    </option>
                  );
                })}
              </select>
              <div id="syHelp" className="form-text">
                Each school year can have only one curriculum. “(Used)” means it’s taken.
              </div>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="is_active_switch">
                Curriculum Status
              </label>
              <div className="d-flex align-items-center justify-content-between border rounded-3 p-3">
                <div className="me-3">
                  <span className={`badge d-inline-flex align-items-center gap-2 ${formData.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                    <FaCircle size={7} />
                    {formData.is_active ? "Active" : "Inactive"}
                  </span>
                  <div className="text-muted small mt-1">
                    Toggle to activate immediately or keep as draft.
                  </div>
                </div>

                {/* Accessible custom switch (no extra PATCH; writes to form state) */}
                <div
                  id="is_active_switch"
                  className={`cur-toggle ${formData.is_active ? "active" : "inactive"} ${loading ? "pe-none opacity-75" : ""}`}
                  role="switch"
                  aria-checked={formData.is_active}
                  aria-label="Toggle curriculum active"
                  tabIndex={0}
                  onClick={handleToggleClick}
                  onKeyDown={handleToggleKey}
                >
                  <div className="cur-thumb">
                    <FaCheckCircle size={12} className={formData.is_active ? "" : "opacity-0"} />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="col-12 d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-light border"
                onClick={() => navigate("/curriculum")}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-dark d-flex align-items-center gap-2"
                disabled={loading}
              >
                {loading && (
                  <span className="spinner-border spinner-border-sm" role="status" />
                )}
                <FaSave /> {isEdit ? "Save Changes" : "Create Curriculum"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Non-blocking processing pill */}
      {loading && (
        <div className="position-fixed bottom-0 start-50 translate-middle-x mb-3 px-3 py-2 d-inline-flex align-items-center gap-2 bg-body border rounded-pill shadow-sm">
          <span className="spinner-border spinner-border-sm" role="status" />
          <span>Processing…</span>
        </div>
      )}
    </div>
  );
};

export default UpsertCurriculum;
