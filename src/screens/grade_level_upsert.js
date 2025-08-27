import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate, useParams } from "react-router-dom";

const UpsertGradeLevel = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    grade_code: "",
    grade_name: "",
    grade_order: "",
  });

  const [initialData, setInitialData] = useState(null); // store initial fetched data
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const token = sessionStorage.getItem("token");

  // 🔑 Fetch grade level data if editing
  useEffect(() => {
    if (isEdit && token) {
      const fetchGradeLevel = async () => {
        try {
          const res = await fetch(
            `http://localhost:3001/esf10/grade-levels/${id}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (!res.ok) throw new Error("Failed to fetch grade level");

          const data = await res.json();
          const grade = data.data ?? data;

          if (grade.grade_code) {
            const initial = {
              grade_code: grade.grade_code || "",
              grade_name: grade.grade_name || "",
              grade_order: grade.grade_order?.toString() || "",
            };
            setFormData(initial);
            setInitialData(initial); // save for comparison
          } else {
            setResponse({
              success: false,
              message: "❌ Failed to load grade level!",
            });
          }
        } catch (err) {
          console.error("⚠️ Fetch error:", err);
          setResponse({
            success: false,
            message: "⚠️ Something went wrong while fetching grade level!",
          });
        }
      };

      fetchGradeLevel();
    }
  }, [id, isEdit, token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "grade_order"
          ? value === ""
            ? ""
            : Number(value)
          : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.grade_code || !formData.grade_name || formData.grade_order === "") {
      setResponse({ success: false, message: "⚠️ Please fill all fields!" });
      return;
    }

    // ✅ Check if anything changed before updating
    if (
      isEdit &&
      initialData &&
      formData.grade_code === initialData.grade_code &&
      formData.grade_name === initialData.grade_name &&
      formData.grade_order === initialData.grade_order
    ) {
      setResponse({ success: false, message: "⚠️ No changes detected!" });
      return;
    }

    setLoading(true);

    try {
      const url = isEdit
        ? `http://localhost:3001/esf10/grade-levels/update/${id}`
        : "http://localhost:3001/esf10/grade-levels/create";

      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : undefined,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      setResponse({
        success: data.success,
        message:
          data.message ||
          (isEdit ? "✅ Grade level updated successfully!" : "✅ Grade level created successfully!"),
      });

      if (data.success && !isEdit) {
        setFormData({ grade_code: "", grade_name: "", grade_order: "" });
      }
    } catch (err) {
      setResponse({ success: false, message: "⚠️ Something went wrong!" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (response) {
      const timer = setTimeout(() => setResponse(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [response]);

  return (
    <div className="container py-5">
      {/* Title & Subtitle */}
      <div className="text-center mb-4">
        <h2 className="fw-bold text-primary">
          {isEdit ? "✏️ Update Grade Level" : "📘 Create Grade Level"}
        </h2>
        <p className="text-muted mb-0">
          {isEdit
            ? "Edit the grade level information below."
            : "Fill in the details to create a new grade level."}
        </p>
      </div>

      {/* Form Card */}
      <div className="row justify-content-center">
        <div className="col-lg-8 col-md-10">
          <div className="card shadow-lg border-0 rounded-4">
            <div className="card-body p-5">
              <form onSubmit={handleSubmit} className="needs-validation" noValidate>
                <div className="form-floating mb-3">
                  <input
                    type="text"
                    className="form-control"
                    id="grade_code"
                    name="grade_code"
                    placeholder="G1"
                    value={formData.grade_code}
                    onChange={handleChange}
                    required
                  />
                  <label htmlFor="grade_code">Grade Code</label>
                </div>

                <div className="form-floating mb-3">
                  <input
                    type="text"
                    className="form-control"
                    id="grade_name"
                    name="grade_name"
                    placeholder="Grade 1"
                    value={formData.grade_name}
                    onChange={handleChange}
                    required
                  />
                  <label htmlFor="grade_name">Grade Name</label>
                </div>

                <div className="form-floating mb-4">
                  <input
                    type="number"
                    className="form-control"
                    id="grade_order"
                    name="grade_order"
                    placeholder="1"
                    value={formData.grade_order}
                    onChange={handleChange}
                    required
                  />
                  <label htmlFor="grade_order">Grade Order</label>
                </div>

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
                      ? "Update Grade Level"
                      : "Create Grade Level"}
                  </button>
                </div>
              </form>

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

export default UpsertGradeLevel;
