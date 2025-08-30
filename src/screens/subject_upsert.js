import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StatusModal from "../components/status_modal";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaArrowLeft, FaSave } from "react-icons/fa";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

export default function UpsertSubject() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [formData, setFormData] = useState({
    subject_code: "",
    subject_name: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "info",
  });

  const inFlight = useRef(false);

  const showModal = (variant, title, message) =>
    setModal({ show: true, title, message, variant });

  const handleUnauthorized = () => {
    sessionStorage.removeItem("token");
    showModal("danger", "Unauthorized", "Please login to continue.");
    setTimeout(() => navigate("/login"), 900);
  };

  const authHeaders = () => {
    const h = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
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

  // Fetch subject (edit mode)
  useEffect(() => {
    if (!isEdit || !token) return;
    const ctrl = new AbortController();

    (async () => {
      try {
        const res = await apiFetch(`/subjects/view-subject/${id}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error("Failed to load subject.");
        const data = await res.json().catch(() => ({}));
        const s = data?.data;
        if (!data?.success || !s) throw new Error("Subject not found.");
        setFormData({
          subject_code: s.subject_code || "",
          subject_name: s.subject_name || "",
          description: s.description || "",
        });
      } catch (err) {
        if (err.name !== "AbortError" && err.message !== "Unauthorized") {
          showModal("danger", "Error", err.message || "Failed to load subject.");
        }
      }
    })();

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id, token]);

  const handleChange = ({ target: { name, value } }) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  const validate = () => {
    const code = formData.subject_code.trim();
    const name = formData.subject_name.trim();
    if (!code || !name) {
      showModal("warning", "Missing info", "Subject code and name are required.");
      return null;
    }
    return {
      subject_code: code,
      subject_name: name,
      description: formData.description.trim(),
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || inFlight.current) return;

    const payload = validate();
    if (!payload) return;

    setLoading(true);
    inFlight.current = true;
    try {
      const endpoint = isEdit
        ? `/subjects/update-subject/${id}`
        : `/subjects/create-subject`;
      const method = isEdit ? "PUT" : "POST";
      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      const success = result?.success ?? res.ok;

      if (success) {
        showModal("success", "Success", result?.message || "Subject saved.");
        setTimeout(() => navigate("/subjects"), 900);
      } else {
        throw new Error(result?.message || "Failed to save subject.");
      }
    } catch (err) {
      if (err.message !== "Unauthorized") {
        showModal("danger", "Error", err.message || "Failed to save subject.");
      }
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  return (
    <div className="container-xxl my-4">
      <StatusModal
        {...modal}
        onHide={() => setModal((m) => ({ ...m, show: false }))}
      />

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          {/* Header — consistent with other screens */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
            <h4 className="fw-bold mb-0">
              {isEdit ? "Edit Subject" : "Create Subject"}
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

          {/* Form — Row1: 1 field (full width), Row2: 2 fields (columns) */}
          <form onSubmit={handleSubmit} noValidate className="row g-3 g-lg-4">
            {/* Row 1: Subject Name */}
            <div className="col-12">
              <label htmlFor="subject_name" className="form-label fw-semibold">
                Subject Name
              </label>
              <input
                type="text"
                id="subject_name"
                name="subject_name"
                className="form-control"
                placeholder="e.g., Algebra I"
                value={formData.subject_name}
                onChange={handleChange}
                autoComplete="off"
                maxLength={128}
                required
                aria-describedby="nameHelp"
              />
              <div id="nameHelp" className="form-text">
                Full display name shown to users. Example: <strong>Algebra I</strong>.
              </div>
            </div>

            {/* Row 2: Subject Code (left) + Description (right) */}
            <div className="col-md-6">
              <label htmlFor="subject_code" className="form-label fw-semibold">
                Subject Code
              </label>
              <input
                type="text"
                id="subject_code"
                name="subject_code"
                className="form-control"
                placeholder="e.g., MATH-101"
                value={formData.subject_code}
                onChange={handleChange}
                autoComplete="off"
                maxLength={32}
                required
                aria-describedby="codeHelp"
              />
              <div id="codeHelp" className="form-text">
                Short unique code (letters/numbers/dashes). Example: <strong>MATH-101</strong>.
              </div>
            </div>

          <div className="col-md-6">
  <label htmlFor="description" className="form-label fw-semibold">
    Description <span className="text-muted">(optional)</span>
  </label>
  <textarea
    id="description"
    name="description"
    className="form-control"
    placeholder="Brief overview, topics, or notes…"
    rows={1} // 👈 makes it same height as normal input
    value={formData.description}
    onChange={handleChange}
    aria-describedby="descHelp"
  />
  <div id="descHelp" className="form-text">
    Keep it concise (1–2 sentences). You can edit this later.
  </div>
</div>

         

            {/* Actions */}
            <div className="col-12 d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-light border"
                onClick={() => navigate("/subjects")}
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
                <FaSave /> {isEdit ? "Save Changes" : "Create Subject"}
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
