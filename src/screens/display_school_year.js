import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { checkToken } from "../components/token_checker";
import { useNavigate } from "react-router-dom";

const DisplaySchoolYear = () => {
  const navigate = useNavigate();
  const [schoolYears, setSchoolYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const token = sessionStorage.getItem("token");

  // 🔑 Check token + fetch list
  useEffect(() => {
    checkToken();
    fetchSchoolYears();
  }, []);

  const fetchSchoolYears = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        "http://localhost:3001/esf10/school-year/all-school-years",
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
      if (data.success) {
        setSchoolYears(data.schoolYears || []);
      } else {
        setResponse({ success: false, message: "⚠️ Failed to load school years!" });
      }
    } catch {
      setResponse({ success: false, message: "⚠️ Something went wrong!" });
    } finally {
      setLoading(false);
    }
  };

  // 🗑 Delete handler
  const handleDelete = async () => {
    if (!selectedId) return;

    try {
      const res = await fetch(
        `http://localhost:3001/esf10/school-year/delete-school-year/${selectedId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
      setResponse(data);

      if (data.success) {
        setSchoolYears((prev) => prev.filter((sy) => sy.school_year_id !== selectedId));
      }
    } catch {
      setResponse({ success: false, message: "⚠️ Something went wrong!" });
    } finally {
      setSelectedId(null);
    }
  };

  // 🕒 Auto-dismiss alert
  useEffect(() => {
    if (response) {
      const timer = setTimeout(() => setResponse(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [response]);

  return (
    <div className="container py-5">
      <div className="card shadow-sm border-0 rounded-4">
        <div className="card-body p-4">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h4 className="fw-semibold mb-0"> School Years</h4>
            <button
              className="btn btn-primary rounded-3"
              onClick={() => navigate("/school_year/create")}
            >
               Add New
            </button>
          </div>

          {/* Loader */}
          {loading ? (
            <div className="text-center py-3 text-muted">⏳ Loading...</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Start Year</th>
                    <th>End Year</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolYears.length > 0 ? (
                    schoolYears.map((sy) => (
                      <tr key={sy.school_year_id}>
                        <td>{sy.start_year}</td>
                        <td>{sy.end_year}</td>
                        <td>
                          <span
                            className={`badge rounded-pill px-3 py-2 ${
                              sy.is_active ? "bg-success" : "bg-secondary"
                            }`}
                          >
                            {sy.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-primary me-2"
                            onClick={() => navigate(`/school_year/edit/${sy.school_year_id}`)}
                          >
                             Edit
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => setSelectedId(sy.school_year_id)}
                          >
                             Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center text-muted py-3">
                        No school years found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Response Alert */}
          {response && (
            <div
              className={`alert mt-3 fade show border-0 rounded-3 ${
                response.success ? "alert-success" : "alert-danger"
              }`}
              role="alert"
            >
              {response.message}
            </div>
          )}
        </div>
      </div>

     {/* Delete Confirmation Modal */}
{selectedId && (
  <>
    {/* Overlay (backdrop) */}
    <div
      className="modal-backdrop fade show"
      style={{ zIndex: 1040 }}
    ></div>

    {/* Modal */}
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      role="dialog"
      style={{ zIndex: 1050 }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 rounded-4 shadow">
          <div className="modal-header border-0">
            <h5 className="modal-title fw-semibold">Delete School Year</h5>
            <button
              type="button"
              className="btn-close"
              onClick={() => setSelectedId(null)}
            />
          </div>
          <div className="modal-body">
            <p className="mb-0 text-muted">
              Are you sure you want to delete this school year? This action
              cannot be undone.
            </p>
          </div>
          <div className="modal-footer border-0">
            <button
              type="button"
              className="btn btn-light rounded-3"
              onClick={() => setSelectedId(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger rounded-3"
              onClick={handleDelete}
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </>
)}

    </div>
  );
};

export default DisplaySchoolYear;
