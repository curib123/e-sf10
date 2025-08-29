import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { checkToken } from "../components/token_checker";
import { useNavigate, useParams } from "react-router-dom";
import StatusModal from "../components/status_modal";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const SchoolYearUpsert = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({ start_year: "", end_year: "" });
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });

  const token = sessionStorage.getItem("token");
  const authHeaders = () => ({ "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : undefined });

  // Fetch data if editing
  useEffect(() => {
    checkToken();

    if (!isEdit) return;

    const fetchSchoolYear = async () => {
      try {
        const res = await fetch(`${BASE_URL}/school-year/school-year/${id}`, { headers: authHeaders() });
        const data = await res.json();
        if (data.success && data.schoolYear) {
          setFormData({
            start_year: data.schoolYear.start_year || "",
            end_year: data.schoolYear.end_year || "",
          });
          setIsActive(data.schoolYear.is_active === 1);
        } else {
          setModal({ show: true, title: "❌ Failed", message: "Failed to load school year!", variant: "danger" });
        }
      } catch (err) {
        setModal({ show: true, title: "⚠️ Error", message: "Something went wrong!", variant: "danger" });
      }
    };

    fetchSchoolYear();
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "start_year" && value) {
      setFormData((prev) => ({ ...prev, end_year: parseInt(value) + 1 }));
    }
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = isEdit
        ? `${BASE_URL}/school-year/update-school-year/${id}`
        : `${BASE_URL}/school-year/create-school-year`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify({
          start_year: parseInt(formData.start_year),
          end_year: parseInt(formData.end_year),
        }),
      });

      const data = await res.json();
      setModal({ show: true, title: data.success ? "✅ Success" : "❌ Failed", message: data.message, variant: data.success ? "success" : "danger" });

      if (data.success) {
        if (isEdit) setTimeout(() => navigate(-1), 1200);
        else setFormData({ start_year: "", end_year: "" });
      }
    } catch (err) {
      setModal({ show: true, title: "⚠️ Error", message: "Something went wrong!", variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  // Toggle Active Status
  const handleToggleActive = async () => {
    setToggleLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/school-year/school-year/${id}/set-active`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ is_active: !isActive ? 1 : 0 }),
      });
      const data = await res.json();
      setModal({ show: true, title: data.success ? "✅ Success" : "❌ Failed", message: data.message, variant: data.success ? "success" : "danger" });
      if (data.success) setIsActive((prev) => !prev);
    } catch (err) {
      setModal({ show: true, title: "⚠️ Error", message: "Toggle failed!", variant: "danger" });
    } finally {
      setToggleLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />

      <div className="row justify-content-center">
        <div className="col-lg-6 col-md-8">
          <div className="card shadow-lg border-0 rounded-4">
            <div className="card-body p-5">
              <h3 className="text-center mb-4 fw-bold">{isEdit ? "Edit School Year" : "Create School Year"}</h3>

              <form onSubmit={handleSubmit} className="needs-validation" noValidate>
                <div className="form-floating mb-3">
                  <input type="number" className="form-control" id="start_year" name="start_year" placeholder="2027" value={formData.start_year} onChange={handleChange} required />
                  <label htmlFor="start_year">Start Year</label>
                </div>

                <div className="form-floating mb-3">
                  <input type="number" className="form-control" id="end_year" name="end_year" placeholder="2028" value={formData.end_year} onChange={handleChange} required />
                  <label htmlFor="end_year">End Year</label>
                </div>

                {isEdit && (
                  <div className="border rounded-3 p-3 bg-light d-flex justify-content-between align-items-center m-3">
                    <span className="fw-semibold">School Year Status</span>
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" id="toggleActive" checked={isActive} onChange={handleToggleActive} disabled={toggleLoading} />
                      <label className="form-check-label ms-2" htmlFor="toggleActive">{toggleLoading ? "Updating..." : isActive ? "Active" : "Inactive"}</label>
                    </div>
                  </div>
                )}

                <div className="d-flex gap-2 mb-4">
                  <button type="button" className="btn btn-secondary w-50 py-2 fw-semibold rounded-3" onClick={() => navigate(-1)}>⬅ Back</button>
                  <button type="submit" className="btn btn-primary w-50 py-2 fw-semibold rounded-3" disabled={loading}>{loading ? (isEdit ? "Updating..." : "Creating...") : isEdit ? "Update School Year" : "Create School Year"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchoolYearUpsert;
