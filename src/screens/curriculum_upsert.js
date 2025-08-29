import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import StatusModal from "../components/status_modal";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const UpsertCurriculum = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const token = sessionStorage.getItem("token");

  const [formData, setFormData] = useState({
    curriculum_name: "",
    school_year_id: "",
    is_active: true,
  });
  const [schoolYears, setSchoolYears] = useState([]);
  const [usedSchoolYears, setUsedSchoolYears] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusModal, setStatusModal] = useState({ show: false, title: "", message: "", variant: "info" });

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : undefined,
  });

  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: "Unauthorized", message: "Please log in.", variant: "danger" });
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 1500);
  };

  const checkToken = () => {
    if (!token) {
      handleUnauthorized();
      return false;
    }
    return true;
  };

  // Fetch school years
  useEffect(() => {
    if (!checkToken()) return;
    const fetchSchoolYears = async () => {
      try {
        const res = await fetch(`${BASE_URL}/school-year/all-school-years`, { headers: authHeaders() });
        const data = await res.json();
        if (data.success) setSchoolYears(data.schoolYears || []);
      } catch (err) {
        console.error(err);
        setStatusModal({ show: true, title: "Error", message: "Failed to load school years.", variant: "danger" });
      }
    };
    fetchSchoolYears();
  }, []);

  // Fetch all curriculums to mark used school years
  useEffect(() => {
    if (!checkToken()) return;
    const fetchCurriculums = async () => {
      try {
        const res = await fetch(`${BASE_URL}/curriculum/view-all-curriculums`, { headers: authHeaders() });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const used = data.data
            .filter(c => !isEdit || c.curriculum_id !== Number(id))
            .map(c => c.school_year_id);
          setUsedSchoolYears(used);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchCurriculums();
  }, [isEdit, id]);

  // Fetch curriculum if editing
  useEffect(() => {
    if (!isEdit || !checkToken()) return;
    const fetchCurriculum = async () => {
      try {
        const res = await fetch(`${BASE_URL}/curriculum/view-curriculum/${id}`, { headers: authHeaders() });
        const data = await res.json();
        if (!data.success || !data.data) throw new Error("Failed to fetch curriculum");
        setFormData({
          curriculum_name: data.data.curriculum_name || "",
          school_year_id: data.data.school_year_id || "",
          is_active: Boolean(data.data.is_active),
        });
      } catch (err) {
        console.error(err);
        setStatusModal({ show: true, title: "Error", message: "Failed to load curriculum.", variant: "danger" });
      }
    };
    fetchCurriculum();
  }, [isEdit, id]);

  const handleChange = ({ target }) => {
    const { name, value, type, checked } = target;
    setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.curriculum_name.trim() || !formData.school_year_id) {
      return setStatusModal({ show: true, title: "Error", message: "Curriculum name and school year are required.", variant: "danger" });
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
      const result = await res.json();
      if (!result.success) throw new Error(result.message);

      setStatusModal({ show: true, title: "Success", message: result.message || "Curriculum saved successfully.", variant: "success" });
      setTimeout(() => navigate("/curriculum"), 1500);
    } catch (err) {
      console.error(err);
      setStatusModal({ show: true, title: "Error", message: err.message || "Failed to save curriculum.", variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5">
      <div className="text-center mb-4">
        <h2 className="fw-bold text-primary">{isEdit ? "Update Curriculum" : "Create Curriculum"}</h2>
        <p className="text-muted mb-0">{isEdit ? "Edit the curriculum details." : "Fill in the curriculum details."}</p>
      </div>

      <div className="d-flex justify-content-center">
        <div className="card shadow-lg border-0 w-100" style={{ maxWidth: 1000 }}>
          <div className="card-body p-5">
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label fw-semibold">Curriculum Name</label>
                <input
                  type="text"
                  name="curriculum_name"
                  value={formData.curriculum_name}
                  onChange={handleChange}
                  className="form-control rounded-3 shadow-sm"
                  placeholder="Enter curriculum name"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">School Year</label>
                <select
                  name="school_year_id"
                  value={formData.school_year_id}
                  onChange={handleChange}
                  className="form-select rounded-3 shadow-sm"
                  required
                >
                  <option value="">-- Select School Year --</option>
                  {schoolYears.map(sy => {
                    const isUsed = usedSchoolYears.includes(sy.school_year_id) && (!isEdit || sy.school_year_id !== Number(formData.school_year_id));
                    return (
                      <option key={sy.school_year_id} value={sy.school_year_id} disabled={isUsed}>
                        {sy.start_year && sy.end_year ? `${sy.start_year} - ${sy.end_year}${isUsed ? " (Used)" : ""}` : "Unknown Year"}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-check mb-3">
                <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="form-check-input" id="is_active" />
                <label className="form-check-label fw-semibold" htmlFor="is_active">Active</label>
              </div>

              <div className="d-flex justify-content-between">
                <button type="button" className="btn btn-light border rounded-3" onClick={() => navigate(-1)} disabled={loading}>
                  ⬅ Back
                </button>
                <button type="submit" className="btn btn-primary rounded-3 px-4" disabled={loading}>
                  {loading ? "Saving..." : isEdit ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <StatusModal {...statusModal} onHide={() => setStatusModal({ ...statusModal, show: false })} />
    </div>
  );
};

export default UpsertCurriculum;
