import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusModal from "../components/status_modal";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaPlus,
  FaSearch,
  FaSync,
  FaChevronDown,
  FaChevronUp,
  FaTrash,
  FaTimes,
} from "react-icons/fa";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

// Minimal request helper (kept simple; adds Bearer if token exists)
const request = async (endpoint, method = "GET", token, body = null) => {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });
  return res.json();
};

export default function AssignSubjectsTable() {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [assignSubjects, setAssignSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [selectedGradeId, setSelectedGradeId] = useState(0);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({}); // { [grade_level_id]: boolean }

  // pagination (over grade groups)
  const itemsPerPage = 5;
  const [currentPage, setCurrentPage] = useState(1);

  // modals
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "danger",
  });
  const [confirmDelete, setConfirmDelete] = useState(null); // {subject_id, grade_level_id}

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Load grade levels
  useEffect(() => {
    (async () => {
      try {
        const data = await request("grade-levels", "GET", token);
        if (data?.success) {
          const sorted = [...(data.data || [])].sort(
            (a, b) => (a.grade_order ?? 0) - (b.grade_order ?? 0)
          );
          setGradeLevels(sorted);
        }
      } catch {
        setModal({
          show: true,
          title: "Error",
          message: "Failed to load grade levels.",
          variant: "danger",
        });
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
          const gradeInfo =
            gradeLevels.find((g) => g.grade_level_id === selectedGradeId) || {};
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
          setExpanded({ [selectedGradeId]: true });
        } else {
          const normalized = (data.data || []).map((grade) => ({
            grade_level_id: grade.grade_level_id,
            grade_name: grade.grade_name,
            grade_code: grade.grade_code,
            subjects: (grade.subjects || []).map((s) => ({
              subject_id: s.subject_id,
              subject_code: s.subject_code,
              subject_name: s.subject_name,
              description: s.description,
              is_required: s.is_required,
              units: Number(s.units),
            })),
          }));
          setAssignSubjects(normalized);
          // expand first page by default
          const firstPageIds = normalized
            .slice(0, itemsPerPage)
            .reduce((acc, g) => ({ ...acc, [g.grade_level_id]: true }), {});
          setExpanded(firstPageIds);
        }
      } else {
        setAssignSubjects([]);
      }
    } catch {
      setModal({
        show: true,
        title: "Error",
        message: "Failed to load subjects.",
        variant: "danger",
      });
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
              ? {
                  ...grade,
                  subjects: grade.subjects.filter(
                    (s) => s.subject_id !== subject_id
                  ),
                }
              : grade
          )
        );
        setModal({
          show: true,
          title: "Success",
          message: data.message || "Deleted.",
          variant: "success",
        });
      } else {
        setModal({
          show: true,
          title: "Error",
          message: data?.message || "Cannot delete subject assignment.",
          variant: "danger",
        });
      }
    } catch {
      setModal({
        show: true,
        title: "Error",
        message: "An error occurred while deleting.",
        variant: "danger",
      });
    } finally {
      setConfirmDelete(null);
    }
  };

  // Filter subjects by search query (client-side)
  const filtered = useMemo(() => {
    if (!debouncedQ) return assignSubjects;
    return assignSubjects.map((g) => ({
      ...g,
      subjects: g.subjects.filter((s) => {
        const text = `${s.subject_code ?? ""} ${s.subject_name ?? ""} ${
          s.description ?? ""
        }`.toLowerCase();
        return text.includes(debouncedQ);
      }),
    }));
  }, [assignSubjects, debouncedQ]);

  // Pagination over grade groups (not subject rows)
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const pageStart = (currentPage - 1) * itemsPerPage;
  const pageSlice = filtered.slice(pageStart, pageStart + itemsPerPage);

  // Skeleton rows for loading state
  const Skeleton = () => (
    <div className="card border-0 shadow-sm rounded-4 mb-4">
      <div className="card-header bg-body-tertiary rounded-top-4 py-3 px-4">
        <span className="placeholder col-4"></span>
      </div>
      <div className="card-body p-0">
        <div className="p-3">
          <div className="placeholder-glow">
            <span className="placeholder col-12 mb-2"></span>
            <span className="placeholder col-10 mb-2"></span>
            <span className="placeholder col-8"></span>
          </div>
        </div>
      </div>
    </div>
  );

  const toggleExpand = (id) =>
    setExpanded((e) => ({ ...e, [id]: !e[id] }));

  // convenience
  const showingFrom = (pageStart + 1);
  const showingTo = Math.min(pageStart + itemsPerPage, filtered.length);

  return (
    <div className="container-xxl my-4">
      {/* Header */}
      <div className="row mb-3">
        <div className="col-12">
          <h4 className="fw-bold mb-0">Assigned Subjects</h4>
          <p className="text-muted mb-0">
            View and manage subjects assigned per grade level.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-3 p-lg-4">
          <div className="row g-2 align-items-stretch">
            {/* Filters */}
            <div className="col-12 col-lg-7 d-flex gap-2">
              <select
                className="form-select rounded-3"
                value={selectedGradeId}
                onChange={(e) => setSelectedGradeId(Number(e.target.value))}
                disabled={gradeLevels.length === 0}
                style={{ minWidth: 220 }}
                aria-label="Filter by grade level"
              >
                <option value={0}>All Grades</option>
                {gradeLevels.map((g) => (
                  <option key={g.grade_level_id} value={g.grade_level_id}>
                    {g.grade_name} {g.grade_code ? `(${g.grade_code})` : ""}
                  </option>
                ))}
              </select>

              <div className="input-group">
                <span className="input-group-text bg-transparent">
                  <FaSearch />
                </span>
                <input
                  className="form-control"
                  placeholder="Search code, name, or description…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search subjects"
                />
                {q && (
                  <button
                    type="button"
                    className="btn btn-light border"
                    onClick={() => setQ("")}
                    title="Clear search"
                  >
                    <FaTimes />
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="col-12 col-lg-5 d-flex gap-2 justify-content-lg-end">
              <button
                className="btn btn-light border d-flex align-items-center gap-2"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                title="Refresh"
              >
                {refreshing ? (
                  <span className="spinner-border spinner-border-sm" role="status" />
                ) : (
                  <FaSync />
                )}
                Refresh
              </button>
              <button
                className="btn btn-dark d-flex align-items-center gap-2 px-3"
                onClick={() => navigate(`/assign-subject-per-year-level/assign`)}
              >
                <FaPlus /> Assign Subject
              </button>
            </div>
          </div>

          {/* Small stats */}
          <div className="d-flex align-items-center gap-2 mt-3 small text-muted">
            {!loading && (
              <>
                <span>
                  Showing <strong>{showingFrom}-{showingTo}</strong> of{" "}
                  <strong>{filtered.length}</strong> grade
                  {filtered.length === 1 ? "" : "s"}
                </span>
                <span className="vr" />
                <span>
                  Page <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <>
          <Skeleton />
          <Skeleton />
        </>
      ) : pageSlice.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body text-center p-5">
            <div className="display-6">🗂️</div>
            <h5 className="mt-2 mb-1">No subjects found</h5>
            <p className="text-muted small mb-4">
              Try a different grade filter or search term.
            </p>
            <button
              className="btn btn-dark d-inline-flex align-items-center gap-2 px-3"
              onClick={() => navigate(`/assign-subject-per-year-level/assign`)}
            >
              <FaPlus /> Assign Subject
            </button>
          </div>
        </div>
      ) : (
        pageSlice.map((grade) => {
          const isOpen = !!expanded[grade.grade_level_id];
          return (
            <div
              key={grade.grade_level_id}
              className="card border-0 shadow-sm rounded-4 mb-4"
            >
              {/* Collapsible header */}
              <button
                className="card-header d-flex justify-content-between align-items-center bg-body-tertiary rounded-top-4 py-3 px-4 border-0 w-100 text-start"
                onClick={() => toggleExpand(grade.grade_level_id)}
              >
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-semibold">
                    {grade.grade_name}{" "}
                    {grade.grade_code ? `(${grade.grade_code})` : ""}
                  </span>
                  <span className="badge text-bg-light">
                    {grade.subjects.length}{" "}
                    {grade.subjects.length === 1 ? "subject" : "subjects"}
                  </span>
                </div>
                {isOpen ? <FaChevronUp /> : <FaChevronDown />}
              </button>

              {/* Table */}
              {isOpen && (
                <div className="card-body p-0">
                  {grade.subjects.length === 0 ? (
                    <div className="text-center text-muted py-4">
                      No subjects in this grade.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: 120 }} className="text-center">Code</th>
                            <th style={{ minWidth: 240 }}>Name</th>
                            <th>Description</th>
                            <th style={{ width: 120 }} className="text-center">Required</th>
                            <th style={{ width: 100 }} className="text-center">Units</th>
                            <th style={{ width: 160 }} className="text-end">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grade.subjects.map((s) => (
                            <tr key={s.subject_id} className="border-top">
                              <td className="text-center fw-medium">
                                <span className="badge text-bg-secondary">
                                  {s.subject_code}
                                </span>
                              </td>
                              <td className="fw-semibold">{s.subject_name}</td>
                              <td className="text-truncate" style={{ maxWidth: 560 }}>
                                {s.description || <span className="text-muted">—</span>}
                              </td>
                              <td className="text-center">
                                <span
                                  className={`badge ${
                                    s.is_required
                                      ? "text-bg-success"
                                      : "text-bg-secondary"
                                  }`}
                                >
                                  {s.is_required ? "Yes" : "No"}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className="badge text-bg-light">{s.units}</span>
                              </td>
                              <td className="text-end">
                                <button
                                  className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-2 px-3"
                                  onClick={() =>
                                    setConfirmDelete({
                                      subject_id: s.subject_id,
                                      grade_level_id: grade.grade_level_id,
                                    })
                                  }
                                >
                                  <FaTrash /> Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-3 d-flex justify-content-center">
          <ul className="pagination mb-0">
            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
              <button
                className="page-link"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
            </li>
            {Array.from({ length: totalPages }).map((_, i) => (
              <li
                key={i}
                className={`page-item ${currentPage === i + 1 ? "active" : ""}`}
              >
                <button className="page-link" onClick={() => setCurrentPage(i + 1)}>
                  {i + 1}
                </button>
              </li>
            ))}
            <li
              className={`page-item ${
                currentPage === totalPages ? "disabled" : ""
              }`}
            >
              <button
                className="page-link"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
              >
                Next
              </button>
            </li>
          </ul>
        </nav>
      )}

      {/* Delete Confirm Modal (compact) */}
      {confirmDelete && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} />
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            role="dialog"
            style={{ zIndex: 1050 }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 rounded-4 shadow">
                <div className="modal-header border-0">
                  <h5 className="modal-title fw-semibold">Remove Subject</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setConfirmDelete(null)}
                  />
                </div>
                <div className="modal-body">
                  <p className="mb-0 text-muted">
                    Are you sure you want to remove this subject from the grade?
                    This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer border-0">
                  <button
                    type="button"
                    className="btn btn-light px-3"
                    onClick={() => setConfirmDelete(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger px-3"
                    onClick={handleDelete}
                  >
                    Yes, Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <StatusModal
        {...modal}
        onHide={() => setModal((m) => ({ ...m, show: false }))}
      />
    </div>
  );
}
