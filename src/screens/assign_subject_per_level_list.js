import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FaChevronDown,
  FaChevronUp,
  FaPlus,
  FaSearch,
  FaSync,
  FaTimes,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

/** Safe URL joiners that ensure we hit /esf10/subjects/view-all-sub-grade-levels exactly */
const joinUrl = (base, path) =>
  `${(base || "").replace(/\/$/, "")}/${(path || "").replace(/^\//, "")}`;

const ensureEsf10 = (base) =>
  base && base.includes("/esf10") ? base : joinUrl(base || "", "esf10");

const URL_VIEW_ALL = joinUrl(
  ensureEsf10(BASE_URL || "http://localhost:3001"),
  "subjects/view-all-sub-grade-levels"
);

// Minimal request helper (token optional)
const request = async (url, method = "GET", token, body = null) => {
  const res = await fetch(url, {
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

  // Data from endpoint
  const [curriculum, setCurriculum] = useState(null);
  const [assignSubjects, setAssignSubjects] = useState([]); // array of grades
  const [gradeLevels, setGradeLevels] = useState([]); // dropdown
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [selectedGradeId, setSelectedGradeId] = useState(
    Number(sessionStorage.getItem("asg.simple.selectedGradeId") || 0)
  );
  const [q, setQ] = useState(sessionStorage.getItem("asg.simple.q") || "");
  const [debouncedQ, setDebouncedQ] = useState(
    (sessionStorage.getItem("asg.simple.q") || "").toLowerCase()
  );
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({}); // {[grade_level_id]: bool}

  // Modal
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "danger",
  });

  // Persist + debounce
  useEffect(() => {
    sessionStorage.setItem("asg.simple.q", q);
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    sessionStorage.setItem(
      "asg.simple.selectedGradeId",
      String(selectedGradeId || 0)
    );
  }, [selectedGradeId]);

// Fetch the active-curriculum subjects per grade
const fetchAll = async () => {
  setLoading(true);
  try {
    const resp = await request(URL_VIEW_ALL, "GET", token);

    // 👇 Console-log the raw API response for debugging
    console.log(
      "[AssignSubjectsTable] GET /esf10/subjects/view-all-sub-grade-levels response:",
      resp
    );

    if (!resp?.success) {
      throw new Error(resp?.message || "Failed to fetch data");
    }

    setCurriculum(resp.curriculum || null);
    setPagination(resp.pagination || null);

    const normalized = Array.isArray(resp.data)
      ? resp.data.map((g) => ({
          grade_level_id: g.grade_level_id,
          grade_name: g.grade_name,
          grade_code: g.grade_code,
          sections: Array.isArray(g.sections) ? g.sections : [],
          subjects: Array.isArray(g.subjects)
            ? g.subjects.map((s) => ({
                subject_id: s.subject_id,
                subject_code: s.subject_code,
                subject_name: s.subject_name,
              }))
            : [],
        }))
      : [];

    setAssignSubjects(normalized);

    // Build dropdown options from the response
    setGradeLevels(
      normalized.map((g) => ({
        grade_level_id: g.grade_level_id,
        grade_name: g.grade_name,
        grade_code: g.grade_code,
      }))
    );

    // Default expand
    if (selectedGradeId) {
      setExpanded({ [selectedGradeId]: true });
    } else if (normalized[0]) {
      setExpanded({ [normalized[0].grade_level_id]: true });
    }
  } catch (e) {
    // 👇 Also log errors in the console
    console.error("[AssignSubjectsTable] fetchAll error:", e);
    setAssignSubjects([]);
    setModal({
      show: true,
      title: "Error",
      message: e?.message || "Failed to load data.",
      variant: "danger",
    });
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const toggleExpand = (id) =>
    setExpanded((e) => ({ ...e, [id]: !e[id] }));

  // Filter by selected grade
  const visibleGrades =
    selectedGradeId && assignSubjects.length
      ? assignSubjects.filter((g) => g.grade_level_id === selectedGradeId)
      : assignSubjects;

  // Client-side search (code/name)
  const filtered = visibleGrades.map((g) => ({
    ...g,
    subjects: g.subjects.filter((s) => {
      if (!debouncedQ) return true;
      const text = `${s.subject_code ?? ""} ${s.subject_name ?? ""}`.toLowerCase();
      return text.includes(debouncedQ);
    }),
  }));

  return (
    <div className="container-xxl my-4">
      {/* Title */}
      <div className="mb-3">
        <h4 className="fw-bold mb-1">Assigned Subjects</h4>
        <p className="text-muted mb-0">
          Active curriculum subjects grouped by grade level.
        </p>
        {curriculum && (
          <div className="mt-2 d-flex flex-wrap align-items-center gap-2">
            <span className="badge text-bg-primary rounded-pill">
              Active Curriculum: {curriculum.curriculum_name}
            </span>
            {typeof curriculum.school_year_id !== "undefined" && (
              <span className="badge text-bg-light rounded-pill">
                SY ID: {curriculum.school_year_id}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Toolbar */}
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
                placeholder="Search subjects by code or name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button
                  className="btn btn-light border"
                  onClick={() => setQ("")}
                  title="Clear"
                >
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
              className="btn btn-primary d-inline-flex align-items-center gap-2"
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
            <p className="text-muted small mb-4">
              Try a different grade filter or search.
            </p>
            <button
              className="btn btn-primary d-inline-flex align-items-center gap-2"
              onClick={() => navigate(`/assign-subject-per-year-level/assign`)}
            >
              <FaPlus /> Assign Subject
            </button>
          </div>
        </div>
      ) : (
        filtered.map((grade) => {
          const isOpen = !!expanded[grade.grade_level_id];
          const sectionCount = grade.sections?.length || 0;
          return (
            <div
              key={grade.grade_level_id}
              className="card border-0 shadow-sm rounded-4 mb-3"
            >
              <button
                className="card-header d-flex justify-content-between align-items-center bg-body-tertiary rounded-top-4 py-3 px-4 border-0 w-100 text-start"
                onClick={() => toggleExpand(grade.grade_level_id)}
                aria-expanded={isOpen}
              >
                <div className="d-flex align-items-center gap-3">
                  <span className="fw-semibold">
                    {grade.grade_name}{" "}
                    {grade.grade_code ? `(${grade.grade_code})` : ""}
                  </span>
                  <span className="badge text-bg-light">
                    Subjects: {grade.subjects.length}
                  </span>
                  <span className="badge text-bg-secondary">
                    Sections: {sectionCount}
                  </span>
                </div>
                {isOpen ? <FaChevronUp /> : <FaChevronDown />}
              </button>

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
                            <th style={{ width: 160 }} className="text-center">
                              Code
                            </th>
                            <th style={{ minWidth: 280 }}>Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grade.subjects.map((s) => (
                            <tr key={`${grade.grade_level_id}-${s.subject_id}`}>
                              <td className="text-center">
                                <span className="badge text-bg-secondary">
                                  {s.subject_code}
                                </span>
                              </td>
                              <td className="fw-semibold">{s.subject_name}</td>
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

      {/* Optional: show pagination info if provided */}
      {pagination && (
        <div className="text-muted small mt-2">
          Page {pagination.page} of {pagination.totalPages} • Total:{" "}
          {pagination.total}
        </div>
      )}

      <StatusModal
        {...modal}
        onHide={() => setModal((m) => ({ ...m, show: false }))}
      />
    </div>
  );
}
