import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import StatusModal from "../components/status_modal";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const GradeLevelList = () => {
  const [gradeLevels, setGradeLevels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusModal, setStatusModal] = useState({ show: false, title: "", message: "", variant: "info" });
  const [selectedId, setSelectedId] = useState(null);

  const token = sessionStorage.getItem("token");
  const navigate = useNavigate();

  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: "Unauthorized", message: "Access denied. Please log in.", variant: "danger" });
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 1500);
  };

  const checkToken = () => {
    if (!token) handleUnauthorized();
    return !!token;
  };

  const fetchGradeLevels = async () => {
    if (!checkToken()) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/grade-levels`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setGradeLevels(data.data || []);
      else setGradeLevels([]);
    } catch (err) {
      console.error(err);
      setStatusModal({ show: true, title: "Error", message: "❌ Failed to load grade levels.", variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGradeLevels();
  }, []);

  const createGradeLevel = () => {
    if (!checkToken()) return;
    navigate("/grade_level/create");
  };

  const editGradeLevel = (id) => {
    if (!checkToken()) return;
    navigate(`/grade_level/edit/${id}`);
  };

  const deleteGradeLevel = (id) => {
    setSelectedId(id);
  };

  return (
    <div className="container my-4">
      <div className="card border shadow-sm rounded-4">
        {/* Header */}
        <div className="card-header bg-white border-0 rounded-top-4 d-flex justify-content-between align-items-center flex-wrap gap-2 py-3 px-3">
          <h5 className="fw-bold text-dark mb-0">Grade Levels</h5>
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1 px-3 py-2" onClick={createGradeLevel}>
            <FaPlus /> Create Grade Level
          </button>
        </div>

        {/* Table */}
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="text-dark py-3 px-2">Code</th>
                    <th className="text-dark py-3 px-2">Name</th>
                    <th className="text-dark py-3 px-2">Order</th>
                    <th className="text-dark text-center py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeLevels.length > 0 ? (
                    gradeLevels
                      .sort((a, b) => a.grade_order - b.grade_order)
                      .map((grade) => (
                        <tr key={grade.grade_level_id}>
                          <td className="fw-semibold py-2 px-2">{grade.grade_code}</td>
                          <td className="py-2 px-2">{grade.grade_name}</td>
                          <td className="py-2 px-2">{grade.grade_order}</td>
                          <td className="text-end py-2 px-2">
                            <div className="d-inline-flex gap-2">
                              <button
                                className="btn btn-outline-primary btn-sm d-flex align-items-end gap-1 px-2 py-1"
                                onClick={() => editGradeLevel(grade.grade_level_id)}
                              >
                                <FaEdit /> Edit
                              </button>
                              <button
                                className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 px-2 py-1"
                                onClick={() => deleteGradeLevel(grade.grade_level_id)}
                              >
                                <FaTrash /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center text-muted py-4">
                        No grade levels found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Status Modal */}
      <StatusModal {...statusModal} onHide={() => setStatusModal({ ...statusModal, show: false })} />
    </div>
  );
};

export default GradeLevelList;
