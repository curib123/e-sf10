import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaInfoCircle } from "react-icons/fa";
import StatusModal from "../components/status_modal"; // your modal component

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const GradeLevelUpsert = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const token = sessionStorage.getItem("token");

  const [formData, setFormData] = useState({
    grade_code: "",
    grade_name: "",
    grade_order: "",
  });
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusModal, setStatusModal] = useState({ show: false, title: "", message: "", variant: "info", icon: null });

  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: "Unauthorized", message: "Please login to continue.", variant: "danger", icon: <FaTimesCircle size={24} /> });
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 1500);
  };

  useEffect(() => {
    if (!isEdit || !token) return;

    const fetchGradeLevel = async () => {
      try {
        const res = await fetch(`${BASE_URL}/grade-levels/${id}`, { headers: { Authorization: `Bearer ${token}` } });

        if (res.status === 401) return handleUnauthorized();
        if (!res.ok) throw new Error("Failed to fetch grade level");

        const data = await res.json();
        const grade = data.data ?? data;

        if (!grade.grade_code) throw new Error("Grade level data invalid");

        const initial = {
          grade_code: grade.grade_code || "",
          grade_name: grade.grade_name || "",
          grade_order: grade.grade_order?.toString() || "",
        };

        setFormData(initial);
        setInitialData(initial);
      } catch (err) {
        setStatusModal({ show: true, title: "Error", message: err.message, variant: "danger", icon: <FaTimesCircle size={24} /> });
      }
    };

    fetchGradeLevel();
  }, [id, isEdit, token, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "grade_order" ? (value === "" ? "" : Number(value)) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return handleUnauthorized();

    if (!formData.grade_code || !formData.grade_name || formData.grade_order === "") {
      return setStatusModal({ show: true, title: "Warning", message: "Please fill all fields!", variant: "warning", icon: <FaExclamationTriangle size={24} /> });
    }

    if (isEdit && initialData &&
      formData.grade_code === initialData.grade_code &&
      formData.grade_name === initialData.grade_name &&
      formData.grade_order === initialData.grade_order
    ) {
      return setStatusModal({ show: true, title: "Info", message: "No changes detected!", variant: "info", icon: <FaInfoCircle size={24} /> });
    }

    setLoading(true);
    try {
      const url = isEdit ? `${BASE_URL}/grade-levels/update/${id}` : `${BASE_URL}/grade-levels/create`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });

      if (res.status === 401) return handleUnauthorized();

      const data = await res.json();
      setStatusModal({
        show: true,
        title: data.success ? "Success" : "Error",
        message: data.message || (isEdit ? "Grade level updated!" : "Grade level created!"),
        variant: data.success ? "success" : "danger",
        icon: data.success ? <FaCheckCircle size={24} /> : <FaTimesCircle size={24} />,
      });

      if (data.success && !isEdit) setFormData({ grade_code: "", grade_name: "", grade_order: "" });
    } catch (err) {
      setStatusModal({ show: true, title: "Error", message: "Something went wrong!", variant: "danger", icon: <FaTimesCircle size={24} /> });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="text-center mb-4">
        <h2 className="fw-bold text-primary">{isEdit ? "Update Grade Level" : "Create Grade Level"}</h2>
        <p className="text-muted mb-0">{isEdit ? "Edit the grade level information below." : "Fill in the details to create a new grade level."}</p>
      </div>

      <div className="row justify-content-center">
        <div className="col-lg-8 col-md-10">
          <div className="card shadow-lg border-0 rounded-4">
            <div className="card-body p-5">
              <form onSubmit={handleSubmit} noValidate>
                <div className="form-floating mb-3">
                  <input type="text" className="form-control" id="grade_code" name="grade_code" placeholder="G1" value={formData.grade_code} onChange={handleChange} required />
                  <label htmlFor="grade_code">Grade Code</label>
                </div>

                <div className="form-floating mb-3">
                  <input type="text" className="form-control" id="grade_name" name="grade_name" placeholder="Grade 1" value={formData.grade_name} onChange={handleChange} required />
                  <label htmlFor="grade_name">Grade Name</label>
                </div>

                <div className="form-floating mb-4">
                  <input type="number" className="form-control" id="grade_order" name="grade_order" placeholder="1" value={formData.grade_order} onChange={handleChange} required />
                  <label htmlFor="grade_order">Grade Order</label>
                </div>

                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-secondary w-50 fw-semibold rounded-3" onClick={() => navigate(-1)}>⬅ Back</button>
                  <button type="submit" className="btn btn-primary w-50 fw-semibold rounded-3" disabled={loading}>
                    {loading ? (isEdit ? "Updating..." : "Creating...") : isEdit ? "Update Grade Level" : "Create Grade Level"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <StatusModal
        {...statusModal}
        onHide={() => setStatusModal({ ...statusModal, show: false })}
      />
    </div>
  );
};

export default GradeLevelUpsert;
