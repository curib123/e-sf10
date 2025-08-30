import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StatusModal from "../components/status_modal";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const icons = {
  success: <FaCheckCircle size={24} />,
  danger: <FaTimesCircle size={24} />,
  warning: <FaExclamationTriangle size={24} />,
  info: <FaInfoCircle size={24} />,
};

const UpsertSubject = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [formData, setFormData] = useState({ subject_code: "", subject_name: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "info", icon: icons.info });

  const inFlight = useRef(false);

  const showModal = (variant, title, message) =>
    setModal({ show: true, title, message, variant, icon: icons[variant] });

  const handleUnauthorized = () => {
    sessionStorage.removeItem("token");
    setModal({ show: true, title: "Unauthorized", message: "Please login to continue.", variant: "danger", icon: icons.danger });
    setTimeout(() => navigate("/login"), 900);
  };

  const authHeaders = () => {
    const h = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  };

  const apiFetch = async (path, options = {}) => {
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
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
        const res = await apiFetch(`/subjects/view-subject/${id}`, { signal: ctrl.signal });
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
      const endpoint = isEdit ? `/subjects/update-subject/${id}` : `/subjects/create-subject`;
      const method = isEdit ? "PUT" : "POST";
      const res = await apiFetch(endpoint, { method, body: JSON.stringify(payload) });
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
    <div className="container-xxl py-5">
      {/* Wider centered column with Bootstrap grid only */}
      <div className="row justify-content-center">
        <div className="col-12 col-lg-10 col-xl-9 col-xxl-8">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4 p-lg-5">
              <h4 className="fw-bold mb-4">{isEdit ? "Edit Subject" : "New Subject"}</h4>

              {/* Vertical inputs */}
              <form onSubmit={handleSubmit} noValidate className="d-flex flex-column gap-3">
                <div className="form-floating">
                  <input
                    type="text"
                    id="subject_code"
                    name="subject_code"
                    className="form-control form-control-lg"
                    placeholder="SUBJ-101"
                    value={formData.subject_code}
                    onChange={handleChange}
                    autoComplete="off"
                    maxLength={32}
                    required
                  />
                  <label htmlFor="subject_code">Subject Code</label>
                </div>

                <div className="form-floating">
                  <input
                    type="text"
                    id="subject_name"
                    name="subject_name"
                    className="form-control form-control-lg"
                    placeholder="Algebra I"
                    value={formData.subject_name}
                    onChange={handleChange}
                    autoComplete="off"
                    maxLength={128}
                    required
                  />
                  <label htmlFor="subject_name">Subject Name</label>
                </div>

                <div className="form-floating">
                  <textarea
                    id="description"
                    name="description"
                    className="form-control form-control-lg"
                    placeholder="Brief description"
                    style={{ height: "140px" }}
                    value={formData.description}
                    onChange={handleChange}
                  />
                  <label htmlFor="description">Description (optional)</label>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-2">
                  <button
                    type="button"
                    className="btn btn-light btn-lg rounded-3"
                    onClick={() => navigate(-1)}
                    disabled={loading}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg rounded-3 px-4"
                    disabled={loading}
                  >
                    {loading && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                    {isEdit ? "Save" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

   
      {loading && (
        <div className="position-fixed bottom-0 start-50 translate-middle-x mb-3 px-3 py-2 d-inline-flex align-items-center gap-2 bg-body border rounded-pill shadow-sm">
          <span className="spinner-border spinner-border-sm" role="status" />
          <span>Processing…</span>
        </div>
      )}

      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />
    </div>
  );
};

export default UpsertSubject;
