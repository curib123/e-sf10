import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { checkToken } from "../components/token_checker";
import { useNavigate, useParams } from "react-router-dom";

const UpsertSchoolYear = () => {
  const navigate = useNavigate();
  const { id } = useParams(); 
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    start_year: "",
    end_year: "",
  });

  const [isActive, setIsActive] = useState(false); // ✅ separate state for toggle
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  const token = sessionStorage.getItem("token");

  // 🔑 Check token + fetch data if editing
  useEffect(() => {
    checkToken();

    if (isEdit) {
      const fetchSchoolYear = async () => {
        try {
          const res = await fetch(
            `http://localhost:3001/esf10/school-year/school-year/${id}`,
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            }
          );
          const data = await res.json();

          if (data.success && data.schoolYear) {
            setFormData({
              start_year: data.schoolYear.start_year || "",
              end_year: data.schoolYear.end_year || "",
            });
            setIsActive(data.schoolYear.is_active === 1); // ✅ store toggle separately
          } else {
            setResponse({ success: false, message: "❌ Failed to load school year!" });
          }
        } catch (err) {
          setResponse({ success: false, message: "⚠️ Something went wrong!" });
        }
      };

      fetchSchoolYear();
    }
  }, [id, isEdit, token]);

  // 📌 Input change handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "start_year" && value) {
      setFormData((prev) => ({
        ...prev,
        start_year: value,
        end_year: parseInt(value) + 1,
      }));
    }
  };

  // 📌 Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = isEdit
        ? `http://localhost:3001/esf10/school-year/update-school-year/${id}`
        : "http://localhost:3001/esf10/school-year/create-school-year";

      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          start_year: parseInt(formData.start_year),
          end_year: parseInt(formData.end_year),
        }),
      });

      const data = await res.json();
      setResponse(data);

      if (data.success && !isEdit) {
        setFormData({ start_year: "", end_year: "" });
      }
    } catch (err) {
      setResponse({ success: false, message: "⚠️ Something went wrong!" });
    } finally {
      setLoading(false);
    }
  };

  // 📌 Toggle Active Status (PATCH)
  const handleToggleActive = async () => {
    setToggleLoading(true);
    try {
      const res = await fetch(
        `http://localhost:3001/esf10/school-year/school-year/${id}/set-active`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      setResponse(data);

      if (data.success) {
        setIsActive(true); // ✅ once toggled, it becomes active
      }
    } catch (err) {
      setResponse({ success: false, message: "⚠️ Toggle failed!" });
    } finally {
      setToggleLoading(false);
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
        <div className="col-lg-6 col-md-8">
          <div className="card shadow-lg border-0 rounded-4">
            <div className="card-body p-5">
              <h3 className="text-center mb-4 fw-bold">
                {isEdit ? " Edit School Year" : "Create School Year"}
              </h3>

              {/* FORM */}
              <form onSubmit={handleSubmit} className="needs-validation" noValidate>
                {/* Start Year */}
                <div className="form-floating mb-3">
                  <input
                    type="number"
                    className="form-control"
                    id="start_year"
                    name="start_year"
                    placeholder="2027"
                    value={formData.start_year}
                    onChange={handleChange}
                    required
                  />
                  <label htmlFor="start_year">Start Year</label>
                </div>

                {/* End Year */}
                <div className="form-floating mb-3">
                  <input
                    type="number"
                    className="form-control"
                    id="end_year"
                    name="end_year"
                    placeholder="2028"
                    value={formData.end_year}
                    onChange={handleChange}
                    required
                  />
                  <label htmlFor="end_year">End Year</label>
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
                      ? "Update School Year"
                      : "Create School Year"}
                  </button>
                </div>
              </form>

              {/* Toggle only for Edit */}
              {isEdit && (
                <div className="mt-4 text-center">
                  <button
                    onClick={handleToggleActive}
                    className={`btn ${isActive ? "btn-success" : "btn-outline-success"} w-100 py-2 fw-semibold rounded-3`}
                    disabled={toggleLoading || isActive}
                  >
                    {toggleLoading
                      ? "Activating..."
                      : isActive
                      ? "✅ Active School Year"
                      : "Set as Active"}
                  </button>
                </div>
              )}

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

export default UpsertSchoolYear;
