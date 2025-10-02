import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FaArrowLeft,
  FaSave,
} from 'react-icons/fa';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

export default function GradeLevelUpsert() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [formData, setFormData] = useState({
    grade_code: "",
    grade_name: "",
    grade_order: "",
  });
  const [initialData, setInitialData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ show: false, title: "", message: "", variant: "info" });
  const inFlight = useRef(false);

  // confirm-leave modal state
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const pendingLeaveAction = useRef(null); // () => void

  const showStatus = (variant, title, message) =>
    setStatus({ show: true, title, message, variant });

  const handleUnauthorized = () => {
    showStatus("danger", "Unauthorized", "Please login to continue.");
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 800);
  };

  const apiFetch = async (path, options = {}) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error("Unauthorized");
    }
    return res;
  };

  useEffect(() => {
    if (!isEdit || !token) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`/grade-levels/${id}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error("Failed to fetch grade level");
        const data = await res.json();
        const grade = data.data ?? data;

        const initial = {
          grade_code: grade.grade_code || "",
          grade_name: grade.grade_name || "",
          grade_order:
            grade.grade_order === 0 || grade.grade_order
              ? String(grade.grade_order)
              : "",
        };
        setFormData(initial);
        setInitialData(initial);
      } catch (err) {
        if (err.name !== "AbortError" && err.message !== "Unauthorized") {
          showStatus("danger", "Error", err.message || "Something went wrong.");
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [isEdit, id, token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const v = name === "grade_order" ? value.replace(/[^\d]/g, "").slice(0, 3) : value;
    setFormData((prev) => ({ ...prev, [name]: v }));
  };

  const validate = () => {
    const code = formData.grade_code.trim();
    const name = formData.grade_name.trim();
    const orderStr = String(formData.grade_order).trim();

    if (!code || !name || orderStr === "")
      return showStatus("warning", "Missing info", "Please complete all fields."), null;

    const orderNum = Number(orderStr);
    if (!Number.isInteger(orderNum) || orderNum < 0)
      return showStatus("warning", "Invalid order", "Use a whole number (0+)."), null;

    return { grade_code: code, grade_name: name, grade_order: orderNum };
  };

  const noChanges = (payload) =>
    isEdit &&
    initialData &&
    payload.grade_code === initialData.grade_code &&
    payload.grade_name === initialData.grade_name &&
    String(payload.grade_order) === String(initialData.grade_order);

  // ----- Dirty check & leave guards -----
  const blankInitial = { grade_code: "", grade_name: "", grade_order: "" };
  const getBaseline = () => (initialData || (isEdit ? blankInitial : blankInitial));
  const isDirty = () => {
    const base = getBaseline();
    return (
      formData.grade_code !== base.grade_code ||
      formData.grade_name !== base.grade_name ||
      String(formData.grade_order) !== String(base.grade_order)
    );
  };

  // Warn on browser/tab close if dirty
  useEffect(() => {
    const handler = (e) => {
      if (isDirty()) {
        e.preventDefault();
        e.returnValue = ""; // required for Chrome
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [formData, initialData]);

  // Unified leave function with confirm modal
  const requestLeave = (leaveFn) => {
    if (!isDirty()) {
      leaveFn();
      return;
    }
    pendingLeaveAction.current = leaveFn;
    setShowConfirmLeave(true);
  };

  const confirmLeave = () => {
    setShowConfirmLeave(false);
    const fn = pendingLeaveAction.current;
    pendingLeaveAction.current = null;
    if (typeof fn === "function") fn();
  };

  const cancelLeave = () => {
    setShowConfirmLeave(false);
    pendingLeaveAction.current = null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return handleUnauthorized();
    if (loading || inFlight.current) return;

    const payload = validate();
    if (!payload) return;
    if (noChanges(payload)) return showStatus("info", "No changes", "Nothing to save.");

    setLoading(true);
    inFlight.current = true;
    try {
      const path = isEdit ? `/grade-levels/update/${id}` : `/grade-levels/create`;
      const method = isEdit ? "PUT" : "POST";
      const res = await apiFetch(path, { method, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      const success = data?.success ?? res.ok;

      if (success) {
        showStatus("success", "Saved", data?.message || (isEdit ? "Updated." : "Created."));
        if (!isEdit) {
          setFormData({ grade_code: "", grade_name: "", grade_order: "" });
          setInitialData(null);
        } else {
          setInitialData({
            grade_code: payload.grade_code,
            grade_name: payload.grade_name,
            grade_order: String(payload.grade_order),
          });
        }
      } else {
        showStatus("danger", "Error", data?.message || "Request failed.");
      }
    } catch (err) {
      if (err.message !== "Unauthorized")
        showStatus("danger", "Error", "Something went wrong.");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  if (loading && !initialData && isEdit) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border" role="status" />
      </div>
    );
  }

  return (
    <div className="container-xxl my-4">
      <StatusModal {...status} onHide={() => setStatus((s) => ({ ...s, show: false }))} />

      {/* Leave confirm modal */}
      {showConfirmLeave && (
        <div className="modal d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,.4)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4">
              <div className="modal-header">
                <h5 className="modal-title">Discard changes?</h5>
                <button type="button" className="btn-close" onClick={cancelLeave} />
              </div>
              <div className="modal-body">
                You have unsaved changes. If you leave this page, your edits will be lost.
              </div>
              <div className="modal-footer">
                <button className="btn btn-light border" onClick={cancelLeave}>Stay</button>
                <button className="btn btn-danger" onClick={confirmLeave}>Discard & Go Back</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          {/* Header */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
            <h4 className="fw-bold mb-0">
              {isEdit ? "Edit Grade Level" : "Create Grade Level"}
            </h4>
            <div className="d-flex gap-2 flex-nowrap">
              <button
                type="button"
                className="btn btn-light border d-flex align-items-center gap-2 px-3"
                onClick={() => requestLeave(() => navigate(-1))}
              >
                <FaArrowLeft /> Back
              </button>
            </div>
          </div>

          {/* Form layout: 1 field above, 2 fields below */}
          <form onSubmit={handleSubmit} className="row g-3 g-lg-4">
            {/* Row 1: Name */}
            <div className="col-12">
              <label htmlFor="grade_name" className="form-label fw-semibold">
                Name
              </label>
              <input
                id="grade_name"
                name="grade_name"
                className="form-control"
                placeholder="e.g., Grade 1"
                value={formData.grade_name}
                onChange={handleChange}
                maxLength={64}
                required
              />
              <div className="form-text">Full display name (e.g., <strong>Grade 1</strong>).</div>
            </div>

            {/* Row 2: Code + Order */}
            <div className="col-md-6">
              <label htmlFor="grade_code" className="form-label fw-semibold">
                Code
              </label>
              <input
                id="grade_code"
                name="grade_code"
                className="form-control"
                placeholder="e.g., G1"
                value={formData.grade_code}
                onChange={handleChange}
                maxLength={16}
                required
              />
              <div className="form-text">Short identifier (letters/numbers).</div>
            </div>

            <div className="col-md-6">
              <label htmlFor="grade_order" className="form-label fw-semibold">
                Order
              </label>
              <input
                id="grade_order"
                name="grade_order"
                inputMode="numeric"
                className="form-control"
                placeholder="e.g., 1"
                value={formData.grade_order}
                onChange={handleChange}
                required
              />
              <div className="form-text">Sort order (whole number, 0+).</div>
            </div>

            {/* Actions */}
            <div className="col-12 d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-light border"
                onClick={() => requestLeave(() => navigate(-1))}
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
                <FaSave /> {isEdit ? "Save Changes" : "Create Grade Level"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
