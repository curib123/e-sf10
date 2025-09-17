import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FaChalkboardTeacher,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaEdit,
  FaFilter,
  FaInfoCircle,
  FaPlus,
  FaSort,
  FaSortDown,
  FaSortUp,
  FaSyncAlt,
  FaTimes,
  FaTimesCircle,
  FaUserTie,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL; // must already include /esf10
const PAGE_SIZES = [5, 10, 20, 50];

const icons = {
  success: <FaCheckCircle size={18} />,
  danger: <FaTimesCircle size={18} />,
  info: <FaInfoCircle size={18} />,
};

const VIEW_BY = [
  { value: 'teacher', label: 'By Teacher' },
  { value: 'subject', label: 'By Subject' },
  { value: 'section', label: 'By Section' },
  { value: 'year', label: 'By School Year' },
];

// Small helpers
const clsx = (...xs) => xs.filter(Boolean).join(' ');
const safeStr = (v) => (v == null ? '' : String(v));
const initials = (name = '') => {
  const parts = name.trim().split(' ').filter(Boolean).slice(0, 2);
  return parts.map((s) => s[0]?.toUpperCase()).join('') || 'T';
};

const TeacherAssignmentsList = () => {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem('token'), []);

  // UI state
  const [loading, setLoading] = useState(true);
  const [statusModal, setStatusModal] = useState({
    show: false,
    title: '',
    message: '',
    variant: 'info',
    icon: icons.info,
  });
  const showStatus = (variant, title, message) =>
    setStatusModal({ show: true, title, message, variant, icon: icons[variant] });

  // Data
  const [assignments, setAssignments] = useState([]);

  // Filters
  const [viewBy, setViewBy] = useState('teacher'); // teacher | subject | section | year
  const [selectedKey, setSelectedKey] = useState(''); // id or year string
  const [q, setQ] = useState('');
  const qDeferred = useDeferredValue(q);

  // Sorting (by visible column)
  const [sort, setSort] = useState({ key: 'teacher', dir: 'asc' }); // dir: 'asc' | 'desc'

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const inFlight = useRef(false);

  // ──────────────────────────────────────────────────────────────────────────────
  // Networking — single API only
  const handleUnauthorized = () => {
    showStatus('danger', 'Unauthorized', 'Please login to continue.');
    sessionStorage.removeItem('token');
    setTimeout(() => navigate('/login'), 800);
  };

  const apiFetch = async (path, options = {}) => {
    const isAbsolute = /^https?:\/\//i.test(path);
    const fullUrl = isAbsolute ? path : `${BASE_URL}${path}`;
    const res = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    return res;
  };

  const loadAssignments = async () => {
    if (inFlight.current) return;
    try {
      setLoading(true);
      inFlight.current = true;
      const res = await apiFetch('/teacher-assignments', { method: 'GET' });
      const data = await res.json();
      setAssignments(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      console.error(e);
      showStatus('danger', 'Error', 'Failed to load teacher assignments.');
      setAssignments([]);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  useEffect(() => {
    if (!token) return handleUnauthorized();
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ──────────────────────────────────────────────────────────────────────────────
  // Derived options from single dataset
  const teacherOptions = useMemo(() => {
    const map = new Map();
    assignments.forEach((a) => {
      if (!map.has(a.teacher_id)) map.set(a.teacher_id, a.teacher_name);
    });
    return Array.from(map, ([value, label]) => ({ value, label })).sort((x, y) =>
      safeStr(x.label).localeCompare(safeStr(y.label))
    );
  }, [assignments]);

  const subjectOptions = useMemo(() => {
    const map = new Map();
    assignments.forEach((a) => {
      const label = [a.subject_code, a.subject_name].filter(Boolean).join(' — ');
      if (!map.has(a.subject_id)) map.set(a.subject_id, label);
    });
    return Array.from(map, ([value, label]) => ({ value, label })).sort((x, y) =>
      safeStr(x.label).localeCompare(safeStr(y.label))
    );
  }, [assignments]);

  const sectionOptions = useMemo(() => {
    const map = new Map();
    assignments.forEach((a) => {
      const label = [a.section_name, a.grade_name ? `(${a.grade_name})` : '']
        .filter(Boolean)
        .join(' ');
      if (!map.has(a.section_id)) map.set(a.section_id, label);
    });
    return Array.from(map, ([value, label]) => ({ value, label })).sort((x, y) =>
      safeStr(x.label).localeCompare(safeStr(y.label))
    );
  }, [assignments]);

  const yearOptions = useMemo(() => {
    const set = new Set();
    assignments.forEach((a) => a.school_year && set.add(a.school_year));
    return Array.from(set)
      .sort()
      .map((y) => ({ value: y, label: y }));
  }, [assignments]);

  const optionsByView = useMemo(() => {
    switch (viewBy) {
      case 'teacher':
        return teacherOptions;
      case 'subject':
        return subjectOptions;
      case 'section':
        return sectionOptions;
      case 'year':
        return yearOptions;
      default:
        return [];
    }
  }, [viewBy, teacherOptions, subjectOptions, sectionOptions, yearOptions]);

  // Reset selection on view change
  useEffect(() => {
    setSelectedKey('');
    // set sensible default sort per view
    setSort(
      viewBy === 'teacher'
        ? { key: 'teacher', dir: 'asc' }
        : viewBy === 'subject'
        ? { key: 'teacher', dir: 'asc' }
        : viewBy === 'section'
        ? { key: 'teacher', dir: 'asc' }
        : { key: 'teacher', dir: 'asc' }
    );
  }, [viewBy]);

  // ──────────────────────────────────────────────────────────────────────────────
  // Default directory when no teacher selected: show ALL active teachers (those with assignments)
  const teacherDirectory = useMemo(() => {
    const map = new Map();
    for (const a of assignments) {
      const key = String(a.teacher_id);
      if (!map.has(key)) {
        map.set(key, {
          teacher_id: a.teacher_id,
          teacher_name: a.teacher_name,
          subjects: new Set(),
          sections: new Set(),
          years: new Set(),
          grades: new Set(),
          assignmentIds: new Set(),
        });
      }
      const rec = map.get(key);
      rec.subjects.add([a.subject_code, a.subject_name].filter(Boolean).join(' ').trim());
      rec.sections.add(a.section_name);
      rec.years.add(a.school_year);
      rec.grades.add(a.grade_name);
      rec.assignmentIds.add(a.assignment_id);
    }
    let arr = Array.from(map.values()).map((r) => ({
      teacher_id: r.teacher_id,
      teacher_name: r.teacher_name,
      subjectsCount: r.subjects.size,
      sectionsCount: r.sections.size,
      assignmentsCount: r.assignmentIds.size,
      subjectsSample: Array.from(r.subjects).slice(0, 3),
    }));

    const q = qDeferred.trim().toLowerCase();
    if (q) {
      arr = arr.filter(
        (r) =>
          r.teacher_name?.toLowerCase().includes(q) ||
          r.subjectsSample.some((s) => s.toLowerCase().includes(q))
      );
    }

    const cmp = (a, b, dir = 'asc') => (dir === 'asc' ? a - b : b - a);
    if (sort.key === 'subs') arr.sort((a, b) => cmp(a.subjectsCount, b.subjectsCount, sort.dir));
    else if (sort.key === 'sects') arr.sort((a, b) => cmp(a.sectionsCount, b.sectionsCount, sort.dir));
    else if (sort.key === 'assign') arr.sort((a, b) => cmp(a.assignmentsCount, b.assignmentsCount, sort.dir));
    else
      arr.sort((a, b) =>
        sort.dir === 'asc'
          ? safeStr(a.teacher_name).localeCompare(safeStr(b.teacher_name))
          : safeStr(b.teacher_name).localeCompare(safeStr(a.teacher_name))
      );

    return arr;
  }, [assignments, qDeferred, sort]);

  const isTeacherDirectory = viewBy === 'teacher' && !selectedKey;

  // Row filtering, search, sorting, pagination (client-side)
  const filteredRows = useMemo(() => {
    if (isTeacherDirectory) return [];
    const key = selectedKey;
    let base = assignments;
    if (key) {
      base = base.filter((a) => {
        switch (viewBy) {
          case 'teacher':
            return String(a.teacher_id) === String(key);
          case 'subject':
            return String(a.subject_id) === String(key);
          case 'section':
            return String(a.section_id) === String(key);
          case 'year':
            return String(a.school_year) === String(key);
          default:
            return true;
        }
      });
    } else {
      base = [];
    }

    const q = qDeferred.trim().toLowerCase();
    if (q) {
      base = base.filter((a) =>
        [a.teacher_name, a.subject_code, a.subject_name, a.section_name, a.grade_name, a.school_year]
          .map(safeStr)
          .some((v) => v.toLowerCase().includes(q))
      );
    }

    const accessors = {
      teacher: (r) => safeStr(r.teacher_name),
      subject: (r) => safeStr(`${r.subject_code} ${r.subject_name}`),
      section: (r) => safeStr(r.section_name),
      year: (r) => safeStr(r.school_year),
      grade: (r) => safeStr(r.grade_name),
      // id accessor kept (not displayed) to avoid runtime surprises if ever referenced
      id: (r) => Number(r.assignment_id) || 0,
    };
    const acc = accessors[sort.key] || accessors.teacher;
    base = [...base].sort((a, b) => {
      const av = acc(a);
      const bv = acc(b);
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });

    return base;
  }, [assignments, selectedKey, viewBy, qDeferred, sort, isTeacherDirectory]);

  // Choose dataset for table/pagination
  const effectiveRows = isTeacherDirectory ? teacherDirectory : filteredRows;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(effectiveRows.length / pageSize)),
    [effectiveRows.length, pageSize]
  );
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return effectiveRows.slice(start, start + pageSize);
  }, [effectiveRows, page, pageSize]);
  const rangeStart = useMemo(
    () => (effectiveRows.length ? (page - 1) * pageSize + 1 : 0),
    [effectiveRows.length, page, pageSize]
  );
  const rangeEnd = useMemo(
    () => Math.min(effectiveRows.length, page * pageSize),
    [effectiveRows.length, page, pageSize]
  );

  useEffect(() => setPage(1), [selectedKey, viewBy, pageSize, qDeferred, isTeacherDirectory]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const buildPageList = useMemo(() => {
    const pages = [];
    const maxToShow = 7;
    if (totalPages <= maxToShow) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    const showAround = 1;
    const start = Math.max(2, page - showAround);
    const end = Math.min(totalPages - 1, page + showAround);
    pages.push(1);
    if (start > 2) pages.push('…');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('…');
    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  // Sorting UI helper
  const SortIcon = ({ active, dir }) =>
    !active ? (
      <FaSort className="ms-1 opacity-50" />
    ) : dir === 'asc' ? (
      <FaSortUp className="ms-1" />
    ) : (
      <FaSortDown className="ms-1" />
    );

  const onSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const headerTitle = useMemo(() => {
    if (isTeacherDirectory) return 'All Active Teachers';
    if (!selectedKey) {
      switch (viewBy) {
        case 'teacher':
          return 'Select a teacher';
        case 'subject':
          return 'Select a subject';
        case 'section':
          return 'Select a section';
        case 'year':
          return 'Select a school year';
        default:
          return '';
      }
    }
    const opt = optionsByView.find((x) => String(x.value) === String(selectedKey));
    const label = opt?.label || '';
    switch (viewBy) {
      case 'teacher':
        return `${label} — Subjects`;
      case 'subject':
        return `${label} — Teachers`;
      case 'section':
        return `${label} — Assignments`;
      case 'year':
        return `${label} — Assignments`;
      default:
        return label;
    }
  }, [selectedKey, viewBy, optionsByView, isTeacherDirectory]);

  const onCreate = () => navigate('/teacher-assignments/create');
  const onUpdate = (assignmentId) => navigate(`/teacher-assignments/update/${assignmentId}`);
  const onUpdateForTeacher = (teacherId) =>
    navigate(`/teacher-assignments/create?teacher_id=${encodeURIComponent(teacherId)}`);

  return (
    <div className="container-xxl py-4 py-lg-5">
      <style>{`
        :root{ --soft-border: rgba(0,0,0,.06); --shadow-sm: 0 .25rem .75rem rgba(0,0,0,.05); }
        .toolbar{ border: 1px solid var(--soft-border); border-radius: 16px; box-shadow: var(--shadow-sm); }
        .table thead th { position: sticky; top: 0; z-index: 1; background: var(--bs-light,#f8f9fa); }
        .form-select:focus, .form-control:focus { box-shadow: 0 0 0 .2rem rgba(13,110,253,.15); border-color: #86b7fe; }
        .btn-outline-primary:hover { transform: translateY(-1px); }
        .pagination .page-link { cursor: pointer; }
      `}</style>

      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 mb-lg-4">
        <div>
          <h3 className="fw-bold mb-1">Teacher Assignments</h3>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary d-inline-flex align-items-center gap-2" onClick={loadAssignments} disabled={loading}>
            <FaSyncAlt /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2" onClick={onCreate}>
            <FaPlus /> Assign Teacher
          </button>
        </div>
      </div>

      {/* Toolbar: Quick search + View + Selector */}
      <div className="card toolbar border-0 rounded-4 p-3">
        <div
          className="card-body d-grid gap-3 gap-lg-2 align-items-start align-items-lg-center"
          style={{ gridTemplateColumns: 'minmax(260px, 1fr) minmax(220px, 260px) minmax(220px, 320px)' }}
        >
          {/* Quick search — now beside View dropdown area */}
          <div className="d-flex flex-column">
            <label className="form-label small text-muted mb-1">Quick search</label>
            <div className="input-group">
              <span className="input-group-text"><FaFilter /></span>
              <input
                className="form-control"
                placeholder={isTeacherDirectory ? 'Search teacher or subject…' : 'Search teacher / subject / section / year…'}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button className="btn btn-outline-secondary" type="button" onClick={() => setQ('')}>
                  <FaTimes />
                </button>
              )}
            </div>
          </div>

          {/* View By */}
          <div className="d-flex flex-column">
            <label className="form-label small text-muted mb-1">View</label>
            <select className="form-select" aria-label="View by" value={viewBy} onChange={(e) => setViewBy(e.target.value)}>
              {VIEW_BY.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic selector */}
          <div className="d-flex flex-column">
            <label className="form-label small text-muted mb-1">
              {viewBy === 'teacher' ? 'Teacher' : viewBy === 'subject' ? 'Subject' : viewBy === 'section' ? 'Section' : 'School Year'}
            </label>
            <select className="form-select" aria-label="Primary filter" value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
              <option value="">
                {viewBy === 'teacher'
                  ? 'All active teachers (default)…'
                  : viewBy === 'subject'
                  ? 'Select subject…'
                  : viewBy === 'section'
                  ? 'Select section…'
                  : 'Select school year…'}
              </option>
              {optionsByView.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="form-text"></div>
          </div>
        </div>
      </div>

      {/* Content states */}
      {loading ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body py-4">
            <div className="placeholder-glow">
              {[...Array(5)].map((_, i) => (
                <p key={i} className="placeholder col-12 mb-2" style={{ height: 18 }} />
              ))}
            </div>
            <div className="text-center text-muted small mt-2">Loading assignments…</div>
          </div>
        </div>
      ) : assignments.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body text-center py-5">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-secondary"
              style={{ width: 70, height: 70 }}
            >
              <FaChalkboardTeacher size={26} className="text-muted" />
            </div>
            <h5 className="fw-semibold mt-3 mb-1">No assignments yet</h5>
            <p className="text-muted mb-3 small">Create your first teacher assignment to get started.</p>
            <button className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2" onClick={onCreate}>
              <FaPlus /> Assign Teacher
            </button>
          </div>
        </div>
      ) : isTeacherDirectory ? (
        // ────────────────────────────────────────────────────────────────────────
        // Directory view: ALL active teachers by default
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-0">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-3 pb-2">
              <div>
                <h6 className="mb-0 fw-semibold">All Active Teachers</h6>
                <div className="text-muted small">
                  Showing {rangeStart}–{rangeEnd} of {effectiveRows.length} teacher{effectiveRows.length > 1 ? 's' : ''}
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                <span className="text-muted small">Rows</span>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 90 }}
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <nav aria-label="Teachers pagination">
                  <ul className="pagination pagination-sm mb-0">
                    <li className={clsx('page-item', page === 1 && 'disabled')}>
                      <button className="page-link" onClick={() => setPage(1)} aria-label="First">
                        <span aria-hidden="true">«</span>
                      </button>
                    </li>
                    <li className={clsx('page-item', page === 1 && 'disabled')}>
                      <button
                        className="page-link"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-label="Previous"
                      >
                        <FaChevronLeft />
                      </button>
                    </li>
                    {buildPageList.map((p, idx) =>
                      typeof p === 'string' ? (
                        <li key={`ellipsis-${idx}`} className="page-item disabled">
                          <span className="page-link">…</span>
                        </li>
                      ) : (
                        <li key={`pg-${p}`} className={clsx('page-item', p === page && 'active')}>
                          <button className="page-link" onClick={() => setPage(p)}>
                            {p}
                          </button>
                        </li>
                      )
                    )}
                    <li className={clsx('page-item', page === totalPages && 'disabled')}>
                      <button
                        className="page-link"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        aria-label="Next"
                      >
                        <FaChevronRight />
                      </button>
                    </li>
                    <li className={clsx('page-item', page === totalPages && 'disabled')}>
                      <button className="page-link" onClick={() => setPage(totalPages)} aria-label="Last">
                        <span aria-hidden="true">»</span>
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>

            <div className="table-responsive" style={{ maxHeight: '65vh' }}>
              <table className="table align-middle mb-0 table-striped table-hover">
                <thead className="table-light">
                  <tr>
                    <th style={{ minWidth: 240 }}>
                      <button
                        className="btn btn-sm btn-link text-decoration-none text-reset p-0"
                        onClick={() => onSort('teacher')}
                      >
                        Teacher <SortIcon active={sort.key === 'teacher'} dir={sort.dir} />
                      </button>
                    </th>
                    <th style={{ minWidth: 220 }}>
                      <button
                        className="btn btn-sm btn-link text-decoration-none text-reset p-0"
                        onClick={() => onSort('subs')}
                      >
                        Subjects <SortIcon active={sort.key === 'subs'} dir={sort.dir} />
                      </button>
                    </th>
                    <th style={{ width: 140 }}>
                      <button
                        className="btn btn-sm btn-link text-decoration-none text-reset p-0"
                        onClick={() => onSort('sects')}
                      >
                        Sections <SortIcon active={sort.key === 'sects'} dir={sort.dir} />
                      </button>
                    </th>
                    <th style={{ width: 160 }}>
                      <button
                        className="btn btn-sm btn-link text-decoration-none text-reset p-0"
                        onClick={() => onSort('assign')}
                      >
                        Assignments <SortIcon active={sort.key === 'assign'} dir={sort.dir} />
                      </button>
                    </th>
                    <th className="text-end" style={{ width: 260 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((t) => (
                    <tr key={`t-${t.teacher_id}`} className="border-top">
                      <td className="text-wrap">
                        <span className="d-inline-flex align-items-center gap-2">
                          <span
                            className="rounded-circle bg-primary-subtle d-inline-flex align-items-center justify-content-center"
                            style={{ width: 28, height: 28 }}
                          >
                            <span className="fw-bold text-primary" style={{ fontSize: '0.75rem' }}>
                              {initials(t.teacher_name)}
                            </span>
                          </span>
                          <span className="d-inline-flex align-items-center gap-1">
                            <FaUserTie className="text-muted" /> {t.teacher_name}
                          </span>
                        </span>
                      </td>
                      <td className="text-wrap">
                        <div className="d-flex flex-wrap gap-1 align-items-center">
                          {t.subjectsSample.map((s, i) => (
                            <span
                              key={`sub-${t.teacher_id}-${i}`}
                              className="badge bg-body-tertiary border text-body fw-normal"
                            >
                              {s}
                            </span>
                          ))}
                          {t.subjectsCount > t.subjectsSample.length && (
                            <span className="badge bg-light border">
                              +{t.subjectsCount - t.subjectsSample.length} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{t.sectionsCount}</td>
                      <td>
                        <span className="badge text-bg-light border">{t.assignmentsCount}</span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex gap-2 justify-content-end flex-wrap">
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => setSelectedKey(String(t.teacher_id))}
                          >
                            View subjects
                          </button>
                         
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : !selectedKey ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body text-center py-5 text-muted small">
            Select a {viewBy === 'subject' ? 'subject' : viewBy === 'section' ? 'section' : 'school year'} to display results.
          </div>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body text-center py-5 text-muted small">No results found for your selection.</div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-0">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-3 pb-2">
              <div>
                <h6 className="mb-0 fw-semibold">{headerTitle}</h6>
                <div className="text-muted small">
                  Showing {rangeStart}–{rangeEnd} of {effectiveRows.length} assignment{effectiveRows.length > 1 ? 's' : ''}
                </div>
              </div>

              {/* Page size + pagination */}
              <div className="d-flex align-items-center gap-2">
                <span className="text-muted small">Rows</span>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 90 }}
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>

                <nav aria-label="Assignments pagination">
                  <ul className="pagination pagination-sm mb-0">
                    <li className={clsx('page-item', page === 1 && 'disabled')}>
                      <button className="page-link" onClick={() => setPage(1)} aria-label="First">
                        <span aria-hidden="true">«</span>
                      </button>
                    </li>
                    <li className={clsx('page-item', page === 1 && 'disabled')}>
                      <button
                        className="page-link"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-label="Previous"
                      >
                        <FaChevronLeft />
                      </button>
                    </li>
                    {buildPageList.map((p, idx) =>
                      typeof p === 'string' ? (
                        <li key={`ellipsis-${idx}`} className="page-item disabled">
                          <span className="page-link">…</span>
                        </li>
                      ) : (
                        <li key={`pg-${p}`} className={clsx('page-item', p === page && 'active')}>
                          <button className="page-link" onClick={() => setPage(p)}>
                            {p}
                          </button>
                        </li>
                      )
                    )}
                    <li className={clsx('page-item', page === totalPages && 'disabled')}>
                      <button
                        className="page-link"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        aria-label="Next"
                      >
                        <FaChevronRight />
                      </button>
                    </li>
                    <li className={clsx('page-item', page === totalPages && 'disabled')}>
                      <button className="page-link" onClick={() => setPage(totalPages)} aria-label="Last">
                        <span aria-hidden="true">»</span>
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>

            {/* Table */}
            <div className="table-responsive" style={{ maxHeight: '65vh' }}>
              <table className="table align-middle mb-0 table-striped table-hover">
                <thead className="table-light">
                  <tr>
                    {viewBy !== 'teacher' && (
                      <th style={{ minWidth: 220 }}>
                        <button
                          className="btn btn-sm btn-link text-decoration-none text-reset p-0"
                          onClick={() => onSort('teacher')}
                        >
                          Teacher <SortIcon active={sort.key === 'teacher'} dir={sort.dir} />
                        </button>
                      </th>
                    )}
                    {viewBy !== 'subject' && (
                      <th style={{ minWidth: 180 }}>
                        <button
                          className="btn btn-sm btn-link text-decoration-none text-reset p-0"
                          onClick={() => onSort('subject')}
                        >
                          Subject <SortIcon active={sort.key === 'subject'} dir={sort.dir} />
                        </button>
                      </th>
                    )}
                    {viewBy !== 'section' && (
                      <th style={{ minWidth: 160 }}>
                        <button
                          className="btn btn-sm btn-link text-decoration-none text-reset p-0"
                          onClick={() => onSort('section')}
                        >
                          Section <SortIcon active={sort.key === 'section'} dir={sort.dir} />
                        </button>
                      </th>
                    )}
                    {viewBy !== 'year' && (
                      <th style={{ width: 160 }}>
                        <button
                          className="btn btn-sm btn-link text-decoration-none text-reset p-0"
                          onClick={() => onSort('year')}
                        >
                          School Year <SortIcon active={sort.key === 'year'} dir={sort.dir} />
                        </button>
                      </th>
                    )}
                    <th style={{ width: 140 }}>
                      <button
                        className="btn btn-sm btn-link text-decoration-none text-reset p-0"
                        onClick={() => onSort('grade')}
                      >
                        Grade <SortIcon active={sort.key === 'grade'} dir={sort.dir} />
                      </button>
                    </th>
                    <th className="text-end" style={{ width: 140 }}>Update</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((a) => (
                    <tr key={a.assignment_id} className="border-top">
                      {viewBy !== 'teacher' && (
                        <td className="text-wrap">
                          <span className="d-inline-flex align-items-center gap-2">
                            <span
                              className="rounded-circle bg-primary-subtle d-inline-flex align-items-center justify-content-center"
                              style={{ width: 28, height: 28 }}
                            >
                              <span className="fw-bold text-primary" style={{ fontSize: '0.75rem' }}>
                                {initials(a.teacher_name)}
                              </span>
                            </span>
                            <span className="d-inline-flex align-items-center gap-1">
                              <FaUserTie className="text-muted" /> {a.teacher_name}
                            </span>
                          </span>
                        </td>
                      )}
                      {viewBy !== 'subject' && (
                        <td className="text-wrap">
                          <div className="fw-medium">{a.subject_code}</div>
                          <div className="text-muted small">{a.subject_name}</div>
                        </td>
                      )}
                      {viewBy !== 'section' && <td className="text-wrap">{a.section_name}</td>}
                      {viewBy !== 'year' && <td>{a.school_year}</td>}
                      <td>{a.grade_name}</td>
                      <td className="text-end">
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => onUpdate(a.assignment_id)}
                        >
                          <FaEdit /> Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <StatusModal
        {...statusModal}
        onHide={() => setStatusModal((s) => ({ ...s, show: false }))}
      />
    </div>
  );
};

export default TeacherAssignmentsList;
