import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { checkToken } from "../components/token_checker";
import { useNavigate, useParams } from "react-router-dom";

const UpsertSubject = () => {
  const navigate = useNavigate();
  const { id } = useParams(); 
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    subject_code: "",
    subject_name: "",
    description: "",
    grade_level: "",
  });

  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const token = sessionStorage.getItem("token"); // ✅ Grab token once

  // 🔑 Check token + fetch data if editing
  useEffect(() => {
    checkToken();

    if (isEdit) {
      const fetchSubject = async () => {
        try {
          const res = await fetch(
            `http://localhost:3001/esf10/subjects/view-subject/${id}`,
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            }
          );
          const data = await res.json();

          if (data.success && data.data) {
            setFormData({
              subject_code: data.data.subject_code || "",
              subject_name: data.data.subject_name || "",
              description: data.data.description || "",
              grade_level: data.data.grade_level || "",
            });
          } else {
            setResponse({ success: false, message: "❌ Failed to load subject!" });
          }
        } catch (err) {
          setResponse({ success: false, message: "⚠️ Something went wrong!" });
        }
      };

      fetchSubject();
    }
  }, [id, isEdit, token]);

  // 📌 Input change handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 📌 Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = isEdit
        ? `http://localhost:3001/esf10/subjects/update-subject/${id}`
        : "http://localhost:3001/esf10/subjects/create-subject";

      const method = isEdit ? "PUT" : "POST";

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // ✅ Always use token
      };

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      setResponse(data);

      if (data.success && !isEdit) {
        // Reset form on successful CREATE
        setFormData({
          subject_code: "",
          subject_name: "",
          description: "",
          grade_level: "",
        });
      }
    } catch (err) {
      setResponse({ success: false, message: "⚠️ Something went wrong!" });
    } finally {
      setLoading(false);
    }
  };

  // 🕒 Auto-dismiss alert
  useEffect(() => {
    if (response) {
      const timer = setTimeout(() => setResponse(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [response]);

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-8 col-md-10">
          <div className="card shadow-lg border-0 rounded-4">
            <div className="card-body p-5">
              <h3 className="text-center mb-4 fw-bold">
                {isEdit ? "✏️ Edit Subject" : "📘 Create Subject"}
              </h3>

              {/* FORM */}
              <form onSubmit={handleSubmit} className="needs-validation" noValidate>
                {/* Subject Code */}
                <div className="form-floating mb-3">
                  <input
                    type="text"
                    className="form-control"
                    id="subject_code"
                    name="subject_code"
                    placeholder="MATH101"
                    value={formData.subject_code}
                    onChange={handleChange}
                    required
                  />
                  <label htmlFor="subject_code">Subject Code</label>
                </div>

                {/* Subject Name */}
                <div className="form-floating mb-3">
                  <input
                    type="text"
                    className="form-control"
                    id="subject_name"
                    name="subject_name"
                    placeholder="Mathematics 101"
                    value={formData.subject_name}
                    onChange={handleChange}
                    required
                  />
                  <label htmlFor="subject_name">Subject Name</label>
                </div>

                {/* Description */}
                <div className="form-floating mb-3">
                  <textarea
                    className="form-control"
                    id="description"
                    name="description"
                    placeholder="Enter description"
                    style={{ height: "120px" }}
                    value={formData.description}
                    onChange={handleChange}
                    required
                  />
                  <label htmlFor="description">Description</label>
                </div>

                {/* Grade Level */}
                <div className="form-floating mb-4">
                  <select
                    className="form-select"
                    id="grade_level"
                    name="grade_level"
                    value={formData.grade_level}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Grade</option>
                    {[
                      "Kindergarten",
                      "Grade 1",
                      "Grade 2",
                      "Grade 3",
                      "Grade 4",
                      "Grade 5",
                      "Grade 6",
                      "Grade 7",
                      "Grade 8",
                      "Grade 9",
                      "Grade 10",
                    ].map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="grade_level">Grade Level</label>
                </div>

                {/* Buttons */}
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary w-50 py-2 fw-semibold rounded-3"
                    onClick={() => navigate(-1)}
                  >
                    ⬅ Back
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary w-50 py-2 fw-semibold rounded-3"
                    disabled={loading}
                  >
                    {loading
                      ? isEdit
                        ? "Updating..."
                        : "Creating..."
                      : isEdit
                      ? "Update Subject"
                      : "Create Subject"}
                  </button>
                </div>
              </form>

              {/* Response Message */}
              {response && (
                <div
                  className={`alert mt-4 fade show ${
                    response.success ? "alert-success" : "alert-danger"
                  }`}
                  role="alert"
                >
                  {response.message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpsertSubject;
