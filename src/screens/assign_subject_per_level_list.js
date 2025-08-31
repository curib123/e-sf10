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

// Minimal request helper
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

// Simple loading skeleton
const Skeleton = () => (
  <div className="card border-0 shadow-sm rounded-4 mb-3">
    <div className="card-body">
      <div className="placeholder-glow">
        <span className="placeholder col-4 mb-2 d-block"></span>
        <span className="placeholder col-8 d-block"></span>
      </div>
    </div>
  </div>
);

export default function AssignSubjectsTable() {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);

  // Data
  const [gradeLevels, setGradeLevels] = useState([]);
  const [assignSubjects, setAssignSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI
  const [selectedGradeId, setSelectedGradeId] = useState(
    Number(sessionStorage.getItem("asg.simple.selectedGradeId") || 0)
  );
  const [q, setQ] = useState(sessionStorage.getItem("asg.simple.q") || "");
  const [debouncedQ, setDebouncedQ] = useState((sessionStorage.getItem("asg.simple.q") || "").toLowerCase());
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({}); // {[grade_level_id]: boolean}

  // Modal
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });
  const [confirmDelete, setConfirmDelete] = useState(null); // {subject_id, grade_level_id}

  // Persist + debounce
  useEffect(() => {
    sessionStorage.setItem("asg.simple.q", q);
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    sessionStorage.setItem("asg.simple.selectedGradeId", String(selectedGradeId || 0));
  }, [selectedGradeId]);

  // Load grade levels
  useEffect(() => {
    (async () => {
      try {
        const resp = await request("grade-levels", "GET", token);
        if (resp?.success) {
          const sorted = [...(resp.data || [])].sort(
            (a, b) => (a.grade_order ?? 0) - (b.grade_order ?? 0)
          );
          setGradeLevels(sorted);
        }
      } catch {
        setModal({ show: true, title: "Error", message: "Failed to load grade levels.", variant: "danger" });
      }
    })();
  }, [token]);

  // Load assignments
  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const endpoint = selectedGradeId
        ? `subject-grade-levels/by-grade-level/${selectedGradeId}`
        : "subject-grade-levels";
      const data = await request(endpoint, "GET", token);

      if (data?.success) {
        if (selectedGradeId) {
          const ginfo = gradeLevels.find((g) => g.grade_level_id === selectedGradeId) || {};
          setAssignSubjects([
            {
              grade_level_id: selectedGradeId,
              grade_name: ginfo?.grade_name || "",
              grade_code: ginfo?.grade_code || "",
              subjects: (data.data || []).map((s) => ({
                subject_id: s.subject_id,
                subject_code: s.subject?.subject_code,
                subject_name: s.subject?.subject_name,
                description: s.subject?.description,
                is_required: s.is_required,
                units: Number(s.units),
              })),
            },
          ]);
          setExpanded({ [selectedGradeId]: true });
        } else {
          const normalized = (data.data || []).map((g) => ({
            grade_level_id: g.grade_level_id,
            grade_name: g.grade_name,
            grade_code: g.grade_code,
            subjects: (g.subjects || []).map((s) => ({
              subject_id: s.subject_id,
              subject_code: s.subject_code,
              subject_name: s.subject_name,
              description: s.description,
              is_required: s.is_required,
              units: Number(s.units),
            })),
          }));
          setAssignSubjects(normalized);
          // expand only the first group for a simple default
          if (normalized[0]) setExpanded({ [normalized[0].grade_level_id]: true });
        }
      } else {
        setAssignSubjects([]);
      }
    } catch {
      setModal({ show: true, title: "Error", message: "Failed to load subjects.", variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGradeId, gradeLevels]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAssignments();
    setRefreshing(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const { subject_id, grade_level_id } = confirmDelete;
      const resp = await request(
        `subject-grade-levels/delete/${subject_id}/${grade_level_id}`,
        "DELETE",
        token
      );
      if (resp?.success) {
        setAssignSubjects((prev) =>
          prev.map((g) =>
            g.grade_level_id === grade_level_id
              ? { ...g, subjects: g.subjects.filter((s) => s.subject_id !== subject_id) }
              : g
          )
        );
        setModal({ show: true, title: "Success", message: resp.message || "Deleted.", variant: "success" });
      } else {
        setModal({ show: true, title: "Error", message: resp?.message || "Cannot delete.", variant: "danger" });
      }
    } catch {
      setModal({ show: true, title: "Error", message: "An error occurred while deleting.", variant: "danger" });
    } finally {
      setConfirmDelete(null);
    }
  };

  // Filter (client-side, minimal)
  const filtered = assignSubjects.map((g) => ({
    ...g,
    subjects: g.subjects.filter((s) => {
      if (!debouncedQ) return true;
      const text = `${s.subject_code ?? ""} ${s.subject_name ?? ""} ${s.description ?? ""}`.toLowerCase();
      return text.includes(debouncedQ);
    }),
  }));

  const toggleExpand = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  return (
    <div className="container-xxl my-4">
      {/* Title */}
      <div className="mb-3">
        <h4 className="fw-bold mb-1">Assigned Subjects</h4>
        <p className="text-muted mb-0">Minimal view to manage subjects per grade level.</p>
      </div>

      {/* Toolbar (simple) */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-3 p-lg-4">
          <div className="d-flex flex-wrap gap-2 align-items-stretch">
            <select
              className="form-select"
              style={{ minWidth: 220 }}
              value={selectedGradeId}
              onChange={(e) => setSelectedGradeId(Number(e.target.value))}
              disabled={gradeLevels.length === 0}
              aria-label="Filter by grade level"
            >
              <option value={0}>All Grades</option>
              {gradeLevels.map((g) => (
                <option key={g.grade_level_id} value={g.grade_level_id}>
                  {g.grade_name} {g.grade_code ? `(${g.grade_code})` : ""}
                </option>
              ))}
            </select>

            <div className="input-group" style={{ flex: "1 1 300px" }}>
              <span className="input-group-text bg-transparent">
                <FaSearch />
              </span>
              <input
                className="form-control"
                placeholder="Search by code, name, or description…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button className="btn btn-light border" onClick={() => setQ("")} title="Clear">
                  <FaTimes />
                </button>
              )}
            </div>

            <button
              className="btn btn-light border d-inline-flex align-items-center gap-2"
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              {refreshing ? (
                <span className="spinner-border spinner-border-sm" role="status" />
              ) : (
                <FaSync />
              )}
              Refresh
            </button>

            <button
              className="btn btn-dark d-inline-flex align-items-center gap-2"
              onClick={() => navigate(`/assign-subject-per-year-level/assign`)}
            >
              <FaPlus /> Assign Subject
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <>
          <Skeleton />
          <Skeleton />
        </>
      ) : filtered.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body text-center p-5">
            <div className="display-6">🗂️</div>
            <h5 className="mt-2 mb-1">No subjects found</h5>
            <p className="text-muted small mb-4">Try a different grade filter or search.</p>
            <button
              className="btn btn-dark d-inline-flex align-items-center gap-2"
              onClick={() => navigate(`/assign-subject-per-year-level/assign`)}
            >
              <FaPlus /> Assign Subject
            </button>
          </div>
        </div>
      ) : (
        filtered.map((grade) => {
          const isOpen = !!expanded[grade.grade_level_id];
          return (
            <div key={grade.grade_level_id} className="card border-0 shadow-sm rounded-4 mb-3">
              <button
                className="card-header d-flex justify-content-between align-items-center bg-body-tertiary rounded-top-4 py-3 px-4 border-0 w-100 text-start"
                onClick={() => toggleExpand(grade.grade_level_id)}
                aria-expanded={isOpen}
              >
                <span className="fw-semibold">
                  {grade.grade_name} {grade.grade_code ? `(${grade.grade_code})` : ""}{" "}
                  <span className="badge text-bg-light ms-2">{grade.subjects.length}</span>
                </span>
                {isOpen ? <FaChevronUp /> : <FaChevronDown />}
              </button>

              {isOpen && (
                <div className="card-body p-0">
                  {grade.subjects.length === 0 ? (
                    <div className="text-center text-muted py-4">No subjects in this grade.</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: 120 }} className="text-center">Code</th>
                            <th style={{ minWidth: 240 }}>Name</th>
                            <th>Description</th>
                            <th style={{ width: 110 }} className="text-center">Required</th>
                            <th style={{ width: 90 }} className="text-center">Units</th>
                            <th style={{ width: 140 }} className="text-end">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grade.subjects.map((s) => (
                            <tr key={s.subject_id}>
                              <td className="text-center">
                                <span className="badge text-bg-secondary">{s.subject_code}</span>
                              </td>
                              <td className="fw-semibold">{s.subject_name}</td>
                              <td className="text-truncate" style={{ maxWidth: 520 }}>
                                {s.description || <span className="text-muted">—</span>}
                              </td>
                              <td className="text-center">
                                <span className={`badge ${s.is_required ? "text-bg-success" : "text-bg-secondary"}`}>
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

      {/* Delete confirm */}
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
                    Remove this subject from the grade? This cannot be undone.
                  </p>
                </div>
                <div className="modal-footer border-0">
                  <button type="button" className="btn btn-light" onClick={() => setConfirmDelete(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-danger" onClick={handleDelete}>
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
}
