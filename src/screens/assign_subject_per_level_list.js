import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusModal from "../components/status_modal";
import "bootstrap/dist/css/bootstrap.min.css";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

// Minimal request helper
const request = async (endpoint, method = "GET", token, body = null) => {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });
  return res.json();
};

const AssignSubjectsTable = () => {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [assignSubjects, setAssignSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [selectedGradeId, setSelectedGradeId] = useState(0);
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // pagination (over grade groups)
  const itemsPerPage = 5;
  const [currentPage, setCurrentPage] = useState(1);

  // modals
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });
  const [confirmDelete, setConfirmDelete] = useState(null); // {subject_id, grade_level_id}

  // Load grade levels
  useEffect(() => {
    (async () => {
      try {
        const data = await request("grade-levels", "GET", token);
        if (data?.success) setGradeLevels(data.data || []);
      } catch {
        setModal({ show: true, title: "Error", message: "Failed to load grade levels.", variant: "danger" });
      }
    })();
  }, [token]);

  // Load subjects per grade (depends on selected grade)
  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const endpoint = selectedGradeId
        ? `subject-grade-levels/by-grade-level/${selectedGradeId}`
        : "subject-grade-levels";
      const data = await request(endpoint, "GET", token);

      if (data?.success) {
        if (selectedGradeId) {
          const gradeInfo = gradeLevels.find((g) => g.grade_level_id === selectedGradeId) || {};
          setAssignSubjects([
            {
              grade_level_id: selectedGradeId,
              grade_name: gradeInfo?.grade_name || "",
              grade_code: gradeInfo?.grade_code || "",
              subjects: (data.data || []).map((subj) => ({
                subject_id: subj.subject_id,
                subject_code: subj.subject?.subject_code,
                subject_name: subj.subject?.subject_name,
                description: subj.subject?.description,
                is_required: subj.is_required,
                units: Number(subj.units),
              })),
            },
          ]);
        } else {
          setAssignSubjects(
            (data.data || []).map((grade) => ({
              grade_level_id: grade.grade_level_id,
              grade_name: grade.grade_name,
              grade_code: grade.grade_code,
              subjects: (grade.subjects || []).map((subj) => ({
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
      } else {
        setAssignSubjects([]);
      }
    } catch {
      setModal({ show: true, title: "Error", message: "Failed to load subjects.", variant: "danger" });
    } finally {
      setLoading(false);
      setCurrentPage(1);
    }
  };

  useEffect(() => {
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGradeId, gradeLevels]);

  // Refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAssignments();
    setRefreshing(false);
  };

  // Delete subject assignment
  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const { subject_id, grade_level_id } = confirmDelete;
      const data = await request(
        `subject-grade-levels/delete/${subject_id}/${grade_level_id}`,
        "DELETE",
        token
      );
      if (data?.success) {
        setAssignSubjects((prev) =>
          prev.map((grade) =>
            grade.grade_level_id === grade_level_id
              ? { ...grade, subjects: grade.subjects.filter((s) => s.subject_id !== subject_id) }
              : grade
          )
        );
        setModal({ show: true, title: "Success", message: data.message || "Deleted.", variant: "success" });
      } else {
        setModal({
          show: true,
          title: "Error",
          message: data?.message || "Cannot delete subject assignment.",
          variant: "danger",
        });
      }
    } catch {
      setModal({ show: true, title: "Error", message: "An error occurred while deleting.", variant: "danger" });
    } finally {
      setConfirmDelete(null);
    }
  };

  // Filter subjects by search query (client-side)
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return assignSubjects;
    return assignSubjects.map((g) => ({
      ...g,
      subjects: g.subjects.filter((s) => {
        const text = `${s.subject_code ?? ""} ${s.subject_name ?? ""} ${s.description ?? ""}`.toLowerCase();
        return text.includes(term);
      }),
    }));
  }, [assignSubjects, q]);

  // Pagination over grade groups (not subject rows)
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const pageStart = (currentPage - 1) * itemsPerPage;
  const pageSlice = filtered.slice(pageStart, pageStart + itemsPerPage);

  return (
    <div className="container-xxl my-4">
      {/* Toolbar */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-4">
          <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-lg-between gap-3">
            <h4 className="fw-bold mb-0">Assigned Subjects by Grade</h4>
            <div className="d-flex flex-column flex-md-row align-items-stretch gap-2">
              <div className="d-flex gap-2">
                <select
                  className="form-select"
                  value={selectedGradeId}
                  onChange={(e) => setSelectedGradeId(Number(e.target.value))}
                  disabled={gradeLevels.length === 0}
                  style={{ minWidth: 220 }}
                >
                  <option value={0}>All Grades</option>
                  {gradeLevels.map((g) => (
                    <option key={g.grade_level_id} value={g.grade_level_id}>
                      {g.grade_name} ({g.grade_code})
                    </option>
                  ))}
                </select>

                <div className="input-group">
                  <span className="input-group-text">Search</span>
                  <input
                    className="form-control"
                    placeholder="Code, name, or description"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </div>

              <div className="d-flex gap-2">
                <button
                  className="btn btn-primary d-flex align-items-center gap-2 px-3"
                  onClick={() => navigate(`/assign-subject-per-year-level/assign`)}
                >
                  Assign Subject
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-5 text-muted">⏳ Loading…</div>
      ) : pageSlice.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body text-center p-5">
            <div className="mb-2">No subjects found</div>
            <p className="text-muted small mb-4">Try a different grade filter or search term.</p>
            <button
              className="btn btn-primary d-inline-flex align-items-center gap-2 px-3"
              onClick={() => navigate(`/assign-subject-per-year-level/assign`)}
            >
              Assign Subject
            </button>
          </div>
        </div>
      ) : (
        pageSlice.map((grade) => (
          <div key={grade.grade_level_id} className="card border-0 shadow-sm rounded-4 mb-4">
            {/* Collapsible header */}
            <div
              className="card-header d-flex justify-content-between align-items-center bg-primary text-white rounded-top-4"
              data-bs-toggle="collapse"
              data-bs-target={`#grade-${grade.grade_level_id}`}
              style={{ cursor: "pointer" }}
            >
              <span className="fw-semibold">
                {grade.grade_name} ({grade.grade_code})
              </span>
              <span className="badge bg-light text-primary">
                {grade.subjects.length} {grade.subjects.length === 1 ? "subject" : "subjects"}
              </span>
            </div>

            {/* Table */}
            <div id={`grade-${grade.grade_level_id}`} className="collapse show">
              <div className="card-body p-0">
                {grade.subjects.length === 0 ? (
                  <div className="text-center text-muted py-4">No subjects in this grade.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="text-center">Code</th>
                          <th>Name</th>
                          <th>Description</th>
                          <th className="text-center">Required</th>
                          <th className="text-center">Units</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grade.subjects.map((s) => (
                          <tr key={s.subject_id}>
                            <td className="text-center fw-medium">{s.subject_code}</td>
                            <td>{s.subject_name}</td>
                            <td className="text-truncate" style={{ maxWidth: 560 }}>
                              {s.description || "-"}
                            </td>
                            <td className="text-center">
                              <span className={`badge ${s.is_required ? "text-bg-success" : "text-bg-secondary"}`}>
                                {s.is_required ? "Yes" : "No"}
                              </span>
                            </td>
                            <td className="text-center">{s.units}</td>
                            <td className="text-end">
                              <button
                                className="btn btn-sm btn-outline-danger px-3"
                                onClick={() => setConfirmDelete({ subject_id: s.subject_id, grade_level_id: grade.grade_level_id })}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-3 d-flex justify-content-center">
          <ul className="pagination mb-0">
            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                Previous
              </button>
            </li>
            {Array.from({ length: totalPages }).map((_, i) => (
              <li key={i} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage(i + 1)}>
                  {i + 1}
                </button>
              </li>
            ))}
            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </button>
            </li>
          </ul>
        </nav>
      )}

      {/* Delete Confirm Modal (Bootstrap utilities) */}
      {confirmDelete && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} />
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{ zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 rounded-4 shadow">
                <div className="modal-header border-0">
                  <h5 className="modal-title fw-semibold">Remove Subject</h5>
                  <button type="button" className="btn-close" onClick={() => setConfirmDelete(null)} />
                </div>
                <div className="modal-body">
                  <p className="mb-0 text-muted">
                    Are you sure you want to remove this subject from the grade? This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer border-0">
                  <button type="button" className="btn btn-light px-3" onClick={() => setConfirmDelete(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-danger px-3" onClick={handleDelete}>
                    Yes, Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />
    </div>
  );
};

export default AssignSubjectsTable;
