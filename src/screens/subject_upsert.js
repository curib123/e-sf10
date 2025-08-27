import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

const BASE_URL = "http://localhost:3001/esf10";

const UpsertSubject = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const token = sessionStorage.getItem("token");

  const [formData, setFormData] = useState({
    subject_code: "",
    subject_name: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : undefined,
  });

  // Fetch subject info in edit mode
  useEffect(() => {
    if (!isEdit) return;

    const fetchSubject = async () => {
      try {
        const res = await fetch(`${BASE_URL}/subjects/view-subject/${id}`, {
          method: "GET",
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!data.success || !data.data) throw new Error("Failed to fetch subject");

        const s = data.data;
        setFormData({
          subject_code: s.subject_code || "",
          subject_name: s.subject_name || "",
          description: s.description || "",
        });
      } catch (err) {
        console.error("Edit fetch error:", err);
      }
    };

    fetchSubject();
  }, [isEdit, id]);

  // Handle form changes
  const handleChange = ({ target }) => {
    const { name, value } = target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!formData.subject_code.trim() || !formData.subject_name.trim()) {
      return setMessage({ type: "error", text: "Subject code and name are required." });
    }

    setLoading(true);
    try {
      const endpoint = isEdit
        ? `${BASE_URL}/subjects/update-subject/${id}`
        : `${BASE_URL}/subjects/create-subject`;

      const res = await fetch(endpoint, {
        method: isEdit ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      if (!result.success) throw new Error(result.message);

      setMessage({ type: "success", text: "Subject saved successfully." });
      setTimeout(() => navigate("/subjects"), 1500);
    } catch (err) {
      console.error("Error saving subject:", err);
      setMessage({ type: "error", text: err.message || "Failed to save subject." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5 d-flex justify-content-center">
      <div className="card shadow-lg border-0 w-100" style={{ maxWidth: 1200 }}>
        <div className="card-body p-4">
          <h3 className="text-center mb-4 fw-bold">
            {isEdit ? "Update Subject" : "Create Subject"}
          </h3>

          {message && (
            <div
              className={`alert alert-dismissible fade show ${
                message.type === "success" ? "alert-success" : "alert-danger"
              }`}
              role="alert"
            >
              {message.text}
              <button type="button" className="btn-close" onClick={() => setMessage(null)}></button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="needs-validation">
            {/* Subject Code */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Subject Code</label>
              <input
                type="text"
                name="subject_code"
                value={formData.subject_code}
                onChange={handleChange}
                className="form-control rounded-3 shadow-sm"
                placeholder="Enter subject code"
                required
              />
            </div>

            {/* Subject Name */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Subject Name</label>
              <input
                type="text"
                name="subject_name"
                value={formData.subject_name}
                onChange={handleChange}
                className="form-control rounded-3 shadow-sm"
                placeholder="Enter subject name"
                required
              />
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="form-control rounded-3 shadow-sm"
                rows={3}
                placeholder="Brief subject description"
              />
            </div>

            {/* Buttons */}
            <div className="d-flex justify-content-between">
              <button
                type="button"
                className="btn btn-light border rounded-3"
                onClick={() => navigate(-1)}
                disabled={loading}
              >
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
  );
};

export default UpsertSubject;
