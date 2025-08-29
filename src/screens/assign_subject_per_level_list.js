import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import StatusModal from "../components/status_modal";
import "bootstrap/dist/css/bootstrap.min.css";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

// Helper function to make API requests
const request = async (endpoint, method = "GET", token, body = null) => {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: body ? JSON.stringify(body) : null,
  });
  return res.json();
};

const AssignSubjectsTable = () => {
  const [gradeLevels, setGradeLevels] = useState([]);
  const [assignSubjects, setAssignSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGradeId, setSelectedGradeId] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });
  const itemsPerPage = 5;

  const navigate = useNavigate();
  const token = sessionStorage.getItem("token");

  // Fetch grade levels
  useEffect(() => {
    const fetchGradeLevels = async () => {
      try {
        const data = await request("grade-levels", "GET", token);
        if (data.success) setGradeLevels(data.data);
      } catch (err) {
        console.error(err);
        setModal({ show: true, title: "Error", message: "Failed to load grade levels.", variant: "danger" });
      }
    };
    fetchGradeLevels();
  }, [token]);

  // Fetch subjects per grade (automatic)
  useEffect(() => {
    const fetchSubjects = async () => {
      setLoading(true);
      try {
        const endpoint = selectedGradeId
          ? `subject-grade-levels/by-grade-level/${selectedGradeId}`
          : "subject-grade-levels";
        const data = await request(endpoint, "GET", token);

        if (data.success) {
          if (selectedGradeId) {
            const gradeInfo = gradeLevels.find((g) => g.grade_level_id === selectedGradeId) || {};
            setAssignSubjects([
              {
                grade_level_id: selectedGradeId,
                grade_name: gradeInfo.grade_name || "",
                grade_code: gradeInfo.grade_code || "",
                subjects: data.data.map((subj) => ({
                  subject_id: subj.subject_id,
                  subject_code: subj.subject.subject_code,
                  subject_name: subj.subject.subject_name,
                  description: subj.subject.description,
                  is_required: subj.is_required,
                  units: Number(subj.units),
                })),
              },
            ]);
          } else {
            setAssignSubjects(
              data.data.map((grade) => ({
                grade_level_id: grade.grade_level_id,
                grade_name: grade.grade_name,
                grade_code: grade.grade_code,
                subjects: grade.subjects.map((subj) => ({
                  subject_id: subj.subject_id,
                  subject_code: subj.subject_code,
                  subject_name: subj.subject_name,
                  description: subj.description,
                  is_required: subj.is_required,
                  units: Number(subj.units),
                })),
              }))
            );
          }
        }
      } catch (err) {
        console.error(err);
        setModal({ show: true, title: "Error", message: "Failed to load subjects.", variant: "danger" });
      } finally {
        setLoading(false);
        setCurrentPage(1);
      }
    };
    fetchSubjects();
  }, [selectedGradeId, gradeLevels, token]);

  // Delete subject assignment
  const handleDelete = async (subject_id, grade_level_id) => {
    try {
      const data = await request(`subject-grade-levels/delete/${subject_id}/${grade_level_id}`, "DELETE", token);
      if (data.success) {
        setAssignSubjects((prev) =>
          prev.map((grade) =>
            grade.grade_level_id === grade_level_id
              ? { ...grade, subjects: grade.subjects.filter((s) => s.subject_id !== subject_id) }
              : grade
          )
        );
        setModal({ show: true, title: "Success", message: data.message, variant: "success" });
      } else {
        setModal({
          show: true,
          title: "Error",
          message: data.message || "Cannot delete subject assignment.",
          variant: "danger",
        });
      }
    } catch (err) {
      console.error(err);
      setModal({ show: true, title: "Error", message: "An error occurred while deleting.", variant: "danger" });
    }
  };

  const paginatedGrades = assignSubjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(assignSubjects.length / itemsPerPage);

  if (loading)
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );

  return (
    <div className="container">
     

      {/* Dropdown & Button */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <select
          className="form-select form-select-sm"
          style={{ minWidth: "200px" }}
          value={selectedGradeId}
          onChange={(e) => setSelectedGradeId(Number(e.target.value))}
          disabled={gradeLevels.length === 0}
        >
          <option value={0}>All Grades</option>
          {gradeLevels.map((grade) => (
            <option key={grade.grade_level_id} value={grade.grade_level_id}>
              {grade.grade_name} ({grade.grade_code})
            </option>
          ))}
        </select>

        <button
          className="btn btn-primary btn-sm"
          style={{ minWidth: "150px" }}
          onClick={() => navigate(`/assign-subject-per-year-level/assign`)}
        >
          Assign Subject
        </button>
      </div>

      {/* Tables */}
      {paginatedGrades.length === 0 ? (
        <div className="text-center py-5 text-muted">No subjects found.</div>
      ) : (
        paginatedGrades.map((grade) => (
          <div key={grade.grade_level_id} className="mb-4">
            <div className="card border-0 overflow-hidden">
              <div
                className="card-header bg-primary text-light d-flex justify-content-between align-items-center"
                data-bs-toggle="collapse"
                data-bs-target={`#grade-${grade.grade_level_id}`}
                style={{ cursor: "pointer" }}
              >
                <span className="fw-bold">{grade.grade_name} ({grade.grade_code})</span>
                <span className="badge bg-light text-primary">{grade.subjects.length} subjects</span>
              </div>

              <div className="collapse show" id={`grade-${grade.grade_level_id}`}>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-bordered align-middle mb-0">
                      <thead>
                        <tr>
                          <th className="text-center fw-semibold">Code</th>
                          <th className="text-dark">Name</th>
                          <th className="text-dark">Description</th>
                          <th className="text-center text-dark">Required</th>
                          <th className="text-center text-dark">Units</th>
                          <th className="text-center text-dark">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grade.subjects.map((subj) => (
                          <tr key={subj.subject_id}>
                            <td className="fw-semibold text-center">{subj.subject_code}</td>
                            <td>{subj.subject_name}</td>
                            <td>{subj.description || "-"}</td>
                            <td className="text-center">
                              <span className={`badge px-2 py-1 ${subj.is_required ? "bg-success" : "bg-secondary"}`}>
                                {subj.is_required ? "Yes" : "No"}
                              </span>
                            </td>
                            <td className="text-center">{subj.units}</td>
                            <td className="text-center">
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(subj.subject_id, grade.grade_level_id)}
                              >
                                Delete Subject
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-4">
          <ul className="pagination justify-content-center shadow-sm rounded-3 p-2">
            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setCurrentPage(currentPage - 1)}>Previous</button>
            </li>
            {Array.from({ length: totalPages }, (_, i) => (
              <li key={i + 1} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
              </li>
            ))}
            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setCurrentPage(currentPage + 1)}>Next</button>
            </li>
          </ul>
        </nav>
      )}

      {/* Status Modal */}
      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />
    </div>
  );
};

export default AssignSubjectsTable;
