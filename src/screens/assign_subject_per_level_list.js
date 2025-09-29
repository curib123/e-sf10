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
const VIEW_ALL_ENDPOINT = 'subjects/view-all-sub-grade-levels';

// Minimal request helper
const request = async (endpoint, method = 'GET', token, body = null) => {
  const url = `${(BASE_URL || '').replace(/\/$/, '')}/${(endpoint || '').replace(/^\//, '')}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
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
  const token = useMemo(() => sessionStorage.getItem('token'), []);

  // Data from API
  const [curriculum, setCurriculum] = useState(null); // { curriculum_id, curriculum_name, school_year_id }
  const [gradesRaw, setGradesRaw] = useState([]); // API `data` array

  // Derived/UI data
  const [gradeLevels, setGradeLevels] = useState([]); // dropdown options derived from gradesRaw
  const [assignSubjects, setAssignSubjects] = useState([]); // normalized for rendering

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({}); // {[grade_level_id]: boolean}

  const [selectedGradeId, setSelectedGradeId] = useState(
    Number(sessionStorage.getItem('asg.simple.selectedGradeId') || 0)
  );
  const [q, setQ] = useState(sessionStorage.getItem('asg.simple.q') || '');
  const [debouncedQ, setDebouncedQ] = useState(
    (sessionStorage.getItem('asg.simple.q') || '').toLowerCase()
  );

  // Modal
  const [modal, setModal] = useState({ show: false, title: '', message: '', variant: 'danger' });

  // Persist + debounce search
  useEffect(() => {
    sessionStorage.setItem('asg.simple.q', q);
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    sessionStorage.setItem('asg.simple.selectedGradeId', String(selectedGradeId || 0));
  }, [selectedGradeId]);

  // Fetch all (active curriculum subjects per grade level)
  const fetchAll = async () => {
    setLoading(true);
    try {
      const data = await request(VIEW_ALL_ENDPOINT, 'GET', token);
      if (data?.success) {
        setCurriculum(data.curriculum || null);
        const grades = Array.isArray(data.data) ? data.data : [];
        setGradesRaw(grades);
      } else {
        setCurriculum(null);
        setGradesRaw([]);
      }
    } catch (err) {
      setModal({ show: true, title: 'Error', message: 'Failed to load active curriculum subjects.', variant: 'danger' });
      setCurriculum(null);
      setGradesRaw([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive dropdown options from gradesRaw
  useEffect(() => {
    const options = gradesRaw
      .map((g) => ({
        grade_level_id: g.grade_level_id,
        grade_name: g.grade_name,
        grade_code: g.grade_code,
      }))
      // de-dup in case API returns duplicates
      .filter((v, i, arr) => arr.findIndex((x) => x.grade_level_id === v.grade_level_id) === i)
      // keep natural ordering (assuming API already ordered); fallback by id
      .sort((a, b) => (a.order ?? a.grade_level_id) - (b.order ?? b.grade_level_id));
    setGradeLevels(options);
  }, [gradesRaw]);

  // Normalize for table (apply grade filter + search)
  useEffect(() => {
    let list = gradesRaw;
    if (selectedGradeId) {
      list = list.filter((g) => g.grade_level_id === selectedGradeId);
    }

    const normalized = list.map((g) => ({
      grade_level_id: g.grade_level_id,
      grade_name: g.grade_name,
      grade_code: g.grade_code,
      sections: Array.isArray(g.sections) ? g.sections : [],
      subjects: (Array.isArray(g.subjects) ? g.subjects : [])
        .map((s) => ({
          subject_id: s.subject_id,
          subject_code: s.subject_code,
          subject_name: s.subject_name,
        }))
        .sort((a, b) => String(a.subject_code || '').localeCompare(String(b.subject_code || ''))),
    }));

    const searched = normalized.map((g) => ({
      ...g,
      subjects: g.subjects.filter((s) => {
        if (!debouncedQ) return true;
        const text = `${s.subject_code ?? ''} ${s.subject_name ?? ''}`.toLowerCase();
        return text.includes(debouncedQ);
      }),
    }));

    setAssignSubjects(searched);

    // Expand only the first visible group by default
    if (searched.length > 0) {
      setExpanded((prev) => ({ [searched[0].grade_level_id]: prev[searched[0].grade_level_id] ?? true }));
    }
  }, [gradesRaw, selectedGradeId, debouncedQ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const toggleExpand = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  return (
    <div className="container-xxl my-4">
      {/* Title */}
      <div className="mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>
          <h4 className="fw-bold mb-1">Assigned Subjects (Active Curriculum)</h4>
          <p className="text-muted mb-0">View subjects per grade level for the currently active curriculum.</p>
        </div>
        {curriculum && (
          <span className="badge rounded-pill text-bg-light px-3 py-2">
            <span className="text-muted me-1">Curriculum:</span>
            <strong>{curriculum.curriculum_name}</strong>
          </span>
        )}
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
                  {g.grade_name} {g.grade_code ? `(${g.grade_code})` : ''}
                </option>
              ))}
            </select>

            <div className="input-group" style={{ flex: '1 1 300px' }}>
              <span className="input-group-text bg-transparent">
                <FaSearch />
              </span>
              <input
                className="form-control"
                placeholder="Search by subject code or name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button className="btn btn-light border" onClick={() => setQ('')} title="Clear">
                  <FaTimes />
                </button>
              )}
            </div>

            <button
              className="btn btn-light border d-inline-flex align-items-center gap-2"
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              {refreshing ? <span className="spinner-border spinner-border-sm" role="status" /> : <FaSync />}
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
      ) : assignSubjects.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body text-center p-5">
            <div className="display-6">🗂️</div>
            <h5 className="mt-2 mb-1">No subjects found</h5>
            <p className="text-muted small mb-4">Try a different grade filter or search.</p>
            <button
              className="btn btn-primary d-inline-flex align-items-center gap-2"
              onClick={() => navigate(`/assign-subject-per-year-level/assign`)}
            >
              <FaPlus /> Assign Subject
            </button>
          </div>
        </div>
      ) : (
        assignSubjects.map((grade) => {
          const isOpen = !!expanded[grade.grade_level_id];
          const sectionCount = Array.isArray(grade.sections) ? grade.sections.length : 0;
          return (
            <div key={grade.grade_level_id} className="card border-0 shadow-sm rounded-4 mb-3">
              <button
                className="card-header d-flex justify-content-between align-items-center bg-body-tertiary rounded-top-4 py-3 px-4 border-0 w-100 text-start"
                onClick={() => toggleExpand(grade.grade_level_id)}
                aria-expanded={isOpen}
              >
                <span className="fw-semibold">
                  {grade.grade_name} {grade.grade_code ? `(${grade.grade_code})` : ''}{' '}
                  <span className="badge text-bg-light ms-2" title="Subjects">{grade.subjects.length}</span>
                  {sectionCount > 0 && (
                    <span className="badge text-bg-secondary ms-2" title="Sections">
                      {sectionCount} section{sectionCount > 1 ? 's' : ''}
                    </span>
                  )}
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
                            <th style={{ width: 140 }} className="text-center">Code</th>
                            <th style={{ minWidth: 260 }}>Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grade.subjects.map((s) => (
                            <tr key={s.subject_id}>
                              <td className="text-center">
                                <span className="badge text-bg-secondary">{s.subject_code}</span>
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

      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />
    </div>
  );
}
