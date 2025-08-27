import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

const AssignSubjectsTable = () => {
  const [gradeLevels, setGradeLevels] = useState([]);
  const [assignSubjects, setAssignSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGradeId, setSelectedGradeId] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [message, setMessage] = useState({ text: "", type: "" }); // Inline message
  const itemsPerPage = 5;

  const navigate = useNavigate();
  const token = sessionStorage.getItem("token");

  const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  });

  // Fetch grade levels
  useEffect(() => {
    const fetchGradeLevels = async () => {
      try {
        const res = await fetch("http://localhost:3001/esf10/grade-levels", {
          headers: getHeaders(),
        });
        const data = await res.json();
        if (data.success) setGradeLevels(data.data);
      } catch (err) {
        console.error("Error fetching grade levels:", err);
        setMessage({ text: "Failed to load grade levels.", type: "danger" });
      }
    };
    fetchGradeLevels();
  }, [token]);

  // Fetch subjects per grade
  useEffect(() => {
    const fetchSubjects = async () => {
      setLoading(true);
      try {
        const endpoint =
          selectedGradeId && selectedGradeId !== 0
            ? `http://localhost:3001/esf10/subject-grade-levels/by-grade-level/${selectedGradeId}`
            : "http://localhost:3001/esf10/subject-grade-levels/";

        const res = await fetch(endpoint, { headers: getHeaders() });
        const data = await res.json();

        if (data.success) {
          if (selectedGradeId && selectedGradeId !== 0) {
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
        console.error("Error fetching subjects:", err);
        setMessage({ text: "Failed to load subjects.", type: "danger" });
      } finally {
        setLoading(false);
        setCurrentPage(1);
      }
    };

    fetchSubjects();
  }, [selectedGradeId, gradeLevels, token]);

  const handleDelete = async (subject_id, grade_level_id) => {
    try {
      const res = await fetch(
        `http://localhost:3001/esf10/subject-grade-levels/delete/${subject_id}/${grade_level_id}`,
        { method: "DELETE", headers: getHeaders() }
      );
      const data = await res.json();
      if (data.success) {
        setAssignSubjects((prev) =>
          prev.map((grade) =>
            grade.grade_level_id === grade_level_id
              ? { ...grade, subjects: grade.subjects.filter((s) => s.subject_id !== subject_id) }
              : grade
          )
        );
        setMessage({ text: data.message, type: "success" });
      } else {
        setMessage({ text: data.message || "Cannot delete subject grade level assignment as it is being used in curriculum", type: "danger" });
      }
    } catch (err) {
      console.error("Delete error:", err);
      setMessage({ text: "An error occurred while deleting.", type: "danger" });
    }
  };

  const paginatedGrades = assignSubjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(assignSubjects.length / itemsPerPage);

  if (loading)
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );

  return (
    <div className="container my-5">
     

      {/* Page Title */}
      <div className="text-center mb-4">
        <h3 className="fw-bold text-primary mb-2">Assign Subjects to Grade Level</h3>
        <p className="text-muted mb-0">View, search, and manage all subjects assigned to each grade level.</p>
      </div>

 {/* Inline message */}
      {message.text && (
        <div className={`alert alert-${message.type} text-center`} role="alert">
          {message.text}
        </div>
      )}
      
      {/* Dropdown & Button Row */}
      <div className="d-flex align-items-center gap-2 mb-3">
        {/* Grade Level Dropdown */}
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

        {/* Assign Subject Button */}
        <button
          className="btn btn-primary btn-sm"
          style={{ minWidth: "150px" }}
          onClick={() => navigate(`/assign-subject-per-year-level/assign`)}
        >
          Assign Subject
        </button>
      </div>

      {/* Subject Tables */}
      {paginatedGrades.length === 0 ? (
        <div className="text-center py-5 text-muted">No subjects found.</div>
      ) : (
        paginatedGrades.map((grade) => (
          <div key={grade.grade_level_id} className="mb-4">
            <div className="card shadow-sm border-0 overflow-hidden">
              <div
                className="card-header bg-primary text-light d-flex justify-content-between align-items-center"
                data-bs-toggle="collapse"
                data-bs-target={`#grade-${grade.grade_level_id}`}
                style={{ cursor: "pointer" }}
              >
                <span className="fw-bold">
                  {grade.grade_name} ({grade.grade_code})
                </span>
                <span className="badge bg-light text-primary">{grade.subjects.length} subjects</span>
              </div>

              <div className="collapse show" id={`grade-${grade.grade_level_id}`}>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="text-center">Code</th>
                          <th>Name</th>
                          <th>Description</th>
                          <th className="text-center">Required</th>
                          <th className="text-center">Units</th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grade.subjects.map((subj) => (
                          <tr key={subj.subject_id}>
                            <td className="fw-semibold text-center">{subj.subject_code}</td>
                            <td>{subj.subject_name}</td>
                            <td>{subj.description || "-"}</td>
                            <td className="text-center">
                              <span
                                className={`badge px-2 py-1 ${
                                  subj.is_required ? "bg-success" : "bg-secondary"
                                }`}
                              >
                                {subj.is_required ? "Yes" : "No"}
                              </span>
                            </td>
                            <td className="text-center">{subj.units}</td>
                            <td className="text-center">
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(subj.subject_id, grade.grade_level_id)}
                              >
                                Delete
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
              <button className="page-link" onClick={() => setCurrentPage(currentPage - 1)}>
                Previous
              </button>
            </li>
            {Array.from({ length: totalPages }, (_, i) => (
              <li key={i + 1} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage(i + 1)}>
                  {i + 1}
                </button>
              </li>
            ))}
            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setCurrentPage(currentPage + 1)}>
                Next
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
};

export default AssignSubjectsTable;
