import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import StatusModal from "../components/status_modal";
import { FaArrowLeft, FaSave } from "react-icons/fa";

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
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
      <StatusModal
        {...statusModal}
        onHide={() => setStatusModal((s) => ({ ...s, show: false }))}
      />

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

          {/* Form — Row1: 1 field (full width), Row2: 2 fields (columns) */}
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
              <label className="form-label fw-semibold" htmlFor="is_active">
                Curriculum Status
              </label>
              <div className="d-flex align-items-center justify-content-between border rounded-3 p-3">
                <div className="me-3">
                  <div className="fw-semibold mb-1">
                    {formData.is_active ? "Active" : "Inactive"}
                  </div>
                  <div className="text-muted small">
                    Toggle to activate immediately or keep as draft.
                  </div>
                </div>
                <div className="form-check form-switch m-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="is_active"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                  />
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
