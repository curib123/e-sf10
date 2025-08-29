import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate } from "react-router-dom";
import StatusModal from "../components/status_modal";
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const SchoolYearList = () => {
  const navigate = useNavigate();
  const token = sessionStorage.getItem("token");

  const [schoolYears, setSchoolYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusModal, setStatusModal] = useState({ show: false, title: "", message: "", variant: "info" });
  const [selectedId, setSelectedId] = useState(null);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : undefined,
  });

  const checkToken = () => {
    if (!token) {
      setStatusModal({ show: true, title: "Unauthorized", message: "Please login to continue.", variant: "danger" });
      setTimeout(() => navigate("/login"), 1500);
      return false;
    }
    return true;
  };

  const fetchSchoolYears = async () => {
    if (!checkToken()) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/school-year/all-school-years`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setSchoolYears(data.schoolYears || []);
      else setStatusModal({ show: true, title: "Error", message: "⚠️ Failed to load school years!", variant: "danger" });
    } catch {
      setStatusModal({ show: true, title: "Error", message: "⚠️ Something went wrong!", variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchoolYears();
  }, []);

  const handleDelete = async () => {
    if (!selectedId || !checkToken()) return;
    try {
      const res = await fetch(`${BASE_URL}/school-year/delete-school-year/${selectedId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      setStatusModal({
        show: true,
        title: data.success ? "Success" : "Error",
        message: data.message,
        variant: data.success ? "success" : "danger",
      });
      if (data.success) setSchoolYears(prev => prev.filter(sy => sy.school_year_id !== selectedId));
    } catch {
      setStatusModal({ show: true, title: "Error", message: "⚠️ Something went wrong!", variant: "danger" });
    } finally {
      setSelectedId(null);
    }
  };

  return (
    <div className="container my-4">
      <div className="card shadow-sm border rounded-4">
        <div className="card-body p-4">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h4 className="fw-semibold text-dark mb-0">School Years</h4>
            <button className="btn btn-primary rounded-3 d-flex align-items-center" onClick={() => navigate("/school_year/create")}>
              <FaPlus className="me-2" /> Add New
            </button>
          </div>

          {/* Loader / Table */}
          {loading ? (
            <div className="text-center py-3 text-muted">⏳ Loading...</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-hover align-middle mb-0" style={{ borderRadius: "0.5rem", overflow: "hidden" }}>
                <thead className="table-light">
                  <tr>
                    <th className="text-dark">Start Year</th>
                    <th className="text-dark">End Year</th>
                    <th className="text-dark">Status</th>
                    <th className="text-dark text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolYears.length > 0 ? (
                    schoolYears.map(sy => (
                      <tr key={sy.school_year_id}>
                        <td>{sy.start_year}</td>
                        <td>{sy.end_year}</td>
                        <td>
                          <span className={`badge rounded-pill px-3 py-2 ${sy.is_active ? "bg-success" : "bg-secondary"}`}>
                            {sy.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="text-end">
                          <div className="d-inline-flex">
                            <button
                              className="btn btn-sm btn-outline-primary me-2 d-flex align-items-center"
                              onClick={() => navigate(`/school_year/edit/${sy.school_year_id}`)}
                            >
                              <FaEdit className="me-1" /> Edit 
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger d-flex align-items-center"
                              onClick={() => setSelectedId(sy.school_year_id)}
                            >
                              <FaTrash className="me-1" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center text-muted py-3">No school years found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {selectedId && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{ zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 rounded-4 shadow">
                <div className="modal-header border-0">
                  <h5 className="modal-title fw-semibold">Delete School Year</h5>
                  <button type="button" className="btn-close" onClick={() => setSelectedId(null)} />
                </div>
                <div className="modal-body">
                  <p className="mb-0 text-muted">
                    Are you sure you want to delete this school year? This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer border-0">
                  <button type="button" className="btn btn-light rounded-3" onClick={() => setSelectedId(null)}>Cancel</button>
                  <button type="button" className="btn btn-danger rounded-3" onClick={handleDelete}>Yes, Delete</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Status Modal */}
      <StatusModal {...statusModal} onHide={() => setStatusModal({ ...statusModal, show: false })} />
    </div>
  );
};

export default SchoolYearList;
