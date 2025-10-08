import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
  FaSearch,
  FaSync,
  FaTimesCircle,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

/* ────────────────────────────────────────────────────────────────────────────
   AsyncSearchSelect — Bootstrap only, max 5 results (minimal UI)
   ──────────────────────────────────────────────────────────────────────────── */
function AsyncSearchSelect({
  label,
  value,
  onChange,
  placeholder = 'Search…',
  fetcher,          // async (q) => Promise<[{value,label,subtitle?}]>
  disabled = false,
  minChars = 1,
  maxOptions = 5,
}) {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [selectedLabel, setSelectedLabel] = useState('');

  useEffect(() => {
    const handle = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    const current = opts.find((o) => String(o.value) === String(value));
    if (current && !open) {
      setSelectedLabel(current.label);
      setQuery(current.label);
    }
  }, [value, open, opts]);

  useEffect(() => {
    let cancel = false;
    const run = async () => {
      const q = (query || '').trim();
      if (q.length < minChars || !fetcher) {
        if (!cancel) setOpts([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetcher(q);
        const arr = Array.isArray(res) ? res : [];
        if (!cancel) setOpts(arr.slice(0, maxOptions));
      } catch {
        if (!cancel) setOpts([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    const id = setTimeout(run, 200);
    return () => { cancel = true; clearTimeout(id); };
  }, [query, fetcher, minChars, maxOptions]);

  const selectAt = (idx) => {
    const opt = opts[idx];
    if (!opt) return;
    setSelectedLabel(opt.label);
    setQuery(opt.label);
    setOpen(false);
    onChange?.(String(opt.value), opt);
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      setActiveIdx(0);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, opts.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); selectAt(activeIdx >= 0 ? activeIdx : 0); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const tooShort = (query || '').trim().length < minChars;

  return (
    <div ref={containerRef} className="position-relative w-100">
      {label ? <label className="form-label mb-1">{label}</label> : null}
      <div className="input-group input-group-sm">
        <span className="input-group-text bg-white"><FaSearch /></span>
        <input
          ref={inputRef}
          className="form-control"
          placeholder={placeholder}
          value={open ? query : selectedLabel || query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          disabled={disabled}
        />
        {value && (
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
              onChange?.('', null);
              setQuery('');
              setSelectedLabel('');
              setOpen(true);
              inputRef.current?.focus();
            }}
            disabled={disabled}
            title="Clear"
          >
            <FaTimesCircle />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="dropdown-menu show w-100 mt-1 p-0">
          {tooShort ? (
            <div className="px-3 py-2 small text-muted">Type at least {minChars} char…</div>
          ) : loading ? (
            <div className="px-3 py-2 small text-muted">Loading…</div>
          ) : opts.length === 0 ? (
            <div className="px-3 py-2 small text-muted">No matches</div>
          ) : (
            opts.map((o, idx) => (
              <button
                key={`${o.value}-${idx}`}
                type="button"
                className={`dropdown-item d-flex flex-column ${idx === activeIdx ? 'active' : ''}`}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectAt(idx)}
              >
                <span>{o.label}</span>
                {o.subtitle ? <small className="text-muted">{o.subtitle}</small> : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────────── */
function numFromString(s) {
  const m = String(s ?? '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
}
function sortPeriods(labels) {
  return [...labels].sort((a, b) => {
    const na = numFromString(a);
    const nb = numFromString(b);
    if (na !== nb) return na - nb;
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  });
}
function buildAllPeriods(students) {
  const set = new Set();
  for (const s of students || []) {
    for (const sub of (s?.subjects || [])) {
      for (const g of (sub?.grades || [])) {
        if (g?.grading_period) set.add(String(g.grading_period));
      }
    }
  }
  return sortPeriods([...set]);
}
function aggregateStudentSubjects(student, allPeriods) {
  const rows = [];
  const byKey = new Map();
  for (const sub of (student?.subjects || [])) {
    const code = sub?.subject_code || '';
    const name = sub?.subject_name || '';
    const key = String(sub?.subject_id ?? `${code}::${name}`);
    if (!byKey.has(key)) {
      const periodGrades = {};
      for (const p of allPeriods) periodGrades[p] = null;
      byKey.set(key, { key, subject_code: code, subject_name: name, periodGrades });
    }
    const entry = byKey.get(key);
    for (const g of (sub?.grades || [])) {
      const p = g?.grading_period;
      if (p) entry.periodGrades[String(p)] = g?.grade ?? null;
    }
  }
  for (const v of byKey.values()) rows.push(v);
  rows.sort((a, b) => (a.subject_code || a.subject_name || '').localeCompare(b.subject_code || b.subject_name || '', undefined, { numeric: true }));
  return rows;
}
function fmtGrade(g) {
  if (g == null || g === '') return '—';
  const n = Number(g);
  return Number.isFinite(n) ? n.toFixed(2) : String(g);
}
function gradeVariant(g) {
  if (g == null || g === '') return 'secondary';
  const n = Number(g);
  if (!Number.isFinite(n)) return 'secondary';
  if (n < 75) return 'danger';
  if (n < 85) return 'warning';
  return 'success';
}
function computePeriodAverages(rows, allPeriods) {
  const out = {};
  for (const p of allPeriods) {
    let sum = 0;
    let count = 0;
    for (const r of rows) {
      const v = Number(r.periodGrades?.[p]);
      if (Number.isFinite(v)) { sum += v; count += 1; }
    }
    out[p] = count ? (sum / count) : null;
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────────
   GradeStudentList — Minimal UI + per-student “Input Grades” button
   ──────────────────────────────────────────────────────────────────────────── */
export default function GradeStudentList() {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem('token'), []);
  const teacherId = useMemo(
    () => sessionStorage.getItem('teacher_id') || sessionStorage.getItem('user_id') || '',
    []
  );

  const teacherStudentsRef = useRef([]);
  const [bundleLoaded, setBundleLoaded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusModal, setStatusModal] = useState({ show: false, title: '', message: '', variant: 'info' });

  const [q, setQ] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterSection, setFilterSection] = useState('all');
  const [studentPick, setStudentPick] = useState({ id: '', label: '' });

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: 'Unauthorized', message: 'Access denied. Please log in.', variant: 'danger' });
    sessionStorage.removeItem('token');
    setTimeout(() => navigate('/login'), 900);
  };

  const loadTeacherBundle = async () => {
    if (!teacherId) return;
    const res = await fetch(`${BASE_URL}/grades/students/${teacherId}`, { headers: authHeaders() });
    if (res.status === 401) return handleUnauthorized();
    const json = await res.json().catch(() => ({}));
    teacherStudentsRef.current = Array.isArray(json?.data) ? json.data : [];
    setBundleLoaded(true);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadTeacherBundle();
      } catch {
        setStatusModal({ show: true, title: 'Error', message: 'Failed to load students.', variant: 'danger' });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  const searchStudents = async (text) => {
    const query = (text || '').trim().toLowerCase();
    if (!query || !teacherId) return [];
    try {
      if (!teacherStudentsRef.current || teacherStudentsRef.current.length === 0) await loadTeacherBundle();
      const pool = teacherStudentsRef.current || [];
      const options = pool.map((s) => {
        const yearLabel = s?.school_year?.school_year || s?.school_year || '';
        return {
          value: s.student_id,
          label: `${s.student_name || '(Unnamed)'}${s.section?.section_name ? ' • ' + s.section.section_name : ''}${yearLabel ? ' • ' + yearLabel : ''}`,
          subtitle: `LRN: ${s.lrn || '—'}${s.grade_level?.grade_name ? ' • ' + s.grade_level.grade_name : ''}`,
          _search: [
            s.student_name, s.lrn, s.section?.section_name, s.grade_level?.grade_name, yearLabel
          ].map(x => String(x ?? '').toLowerCase()).join(' '),
        };
      });

      return options
        .filter(o => o._search.includes(query))
        .map(({ _search, ...o }) => o)
        .slice(0, 5);
    } catch {
      return [];
    }
  };

  const allPeriods = useMemo(() => buildAllPeriods(teacherStudentsRef.current || []), [bundleLoaded]);

  const yearOptions = useMemo(() => {
    const set = new Set(
      (teacherStudentsRef.current || [])
        .map(s => s?.school_year?.school_year || s?.school_year)
        .filter(Boolean)
        .map(String)
    );
    return [...set].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [bundleLoaded]);

  const sectionOptions = useMemo(() => {
    const set = new Set(
      (teacherStudentsRef.current || [])
        .map(s => s?.section?.section_name)
        .filter(Boolean)
        .map(String)
    );
    return [...set].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [bundleLoaded]);

  const filteredStudents = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (teacherStudentsRef.current || []).filter((s) => {
      if (studentPick.id && String(s.student_id) !== String(studentPick.id)) return false;
      const yearLabel = s?.school_year?.school_year || s?.school_year || '';
      const sectionName = s?.section?.section_name || '';
      const matchYear = filterYear === 'all' || String(yearLabel) === String(filterYear);
      const matchSection = filterSection === 'all' || String(sectionName) === String(filterSection);
      if (!matchYear || !matchSection) return false;

      if (term === '') return true;

      const subjectTexts = (Array.isArray(s?.subjects) ? s.subjects : [])
        .map(sub => `${sub?.subject_code ?? ''} ${sub?.subject_name ?? ''}`)
        .join(' ')
        .toLowerCase();

      const hay = [
        s?.student_name,
        s?.lrn,
        sectionName,
        s?.grade_level?.grade_name,
        yearLabel,
        subjectTexts,
      ].map(x => String(x ?? '')).join(' ').toLowerCase();

      return hay.includes(term);
    });

    return list;
  }, [q, filterYear, filterSection, studentPick.id, bundleLoaded]);

  // Pagination over students
  const totalStudents = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalStudents / perPage));
  const pageClamped = Math.min(Math.max(1, page), totalPages);
  const startIdx = (pageClamped - 1) * perPage;
  const pageStudents = filteredStudents.slice(startIdx, startIdx + perPage);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
  useEffect(() => { setPage(1); }, [q, filterYear, filterSection, studentPick.id, perPage]);

  const handleRefresh = async () => {
    if (!teacherId) return;
    setRefreshing(true);
    try {
      await loadTeacherBundle();
    } catch {/* ignore */} finally {
      setRefreshing(false);
    }
  };

  const goUpsertFor = (stu) => {
    const tid = teacherId ? `?teacher_id=${encodeURIComponent(teacherId)}` : '';
    navigate(`/grade-inputs/upsert${tid}`, {
      state: {
        studentId: String(stu.student_id),
        from: 'GradeStudentList',
      },
    });
  };

  return (
    <div className="container-fluid my-3">
      {/* Minimal header */}
      <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-2 mb-3">
        <div>
          <h5 className="mb-1 text-dark">Student Grades</h5>
          <div className="small text-muted">
            Showing {pageStudents.length} of {totalStudents} student{totalStudents !== 1 ? 's' : ''} (page {pageClamped}/{totalPages})
          </div>
        </div>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
            onClick={handleRefresh}
            disabled={loading || refreshing || !teacherId}
            title="Refresh data"
          >
            {refreshing ? <span className="spinner-border spinner-border-sm" role="status" /> : <FaSync />}
            <span className="d-none d-sm-inline">{refreshing ? 'Refreshing' : 'Refresh'}</span>
          </button>
          <button
            className="btn btn-primary btn-sm d-flex align-items-center gap-2"
            onClick={() => {
              const tid = teacherId ? `?teacher_id=${encodeURIComponent(teacherId)}` : '';
              navigate(`/grade-inputs/upsert${tid}`);
            }}
          >
            <FaPlus /> <span className="d-none d-sm-inline">Input Grades</span>
          </button>
        </div>
      </div>

      {/* Controls (compact) */}
      <div className="row g-2 align-items-end mb-3">
        <div className="col-12 col-lg-5">
          <AsyncSearchSelect
            label="Jump to Student"
            placeholder="Type name or LRN…"
            value={studentPick.id}
            onChange={(val, opt) => setStudentPick({ id: val, label: opt?.label || '' })}
            fetcher={searchStudents}
            disabled={loading || !teacherId}
            minChars={1}
            maxOptions={5}
          />
          {studentPick.id ? (
            <button
              className="btn btn-link btn-sm p-0 mt-1"
              onClick={() => setStudentPick({ id: '', label: '' })}
            >
              Show all students
            </button>
          ) : null}
        </div>
        <div className="col-12 col-lg-7">
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white">Search</span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Student, LRN, Section, Year, Subject"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white">Year</span>
                <select className="form-select" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                  <option value="all">All</option>
                  {yearOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white">Section</span>
                <select className="form-select" value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
                  <option value="all">All</option>
                  {sectionOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Students list (minimal cards) */}
      {loading ? (
        <div className="text-center py-5 text-muted">⏳ Loading…</div>
      ) : (pageStudents.length === 0) ? (
        <div className="text-center bg-body-tertiary rounded-3 p-5">
          <div className="mb-2">No matching students</div>
          <p className="text-muted mb-0 small">Adjust search or filters.</p>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {pageStudents.map((stu) => {
            const rows = aggregateStudentSubjects(stu, allPeriods);
            const periodAverages = computePeriodAverages(rows, allPeriods);
            const studentName = stu?.student_name || '(Unnamed)';
            const lrn = stu?.lrn || '';
            const section = stu?.section?.section_name || '—';
            const gradeLevel = stu?.grade_level?.grade_name || '—';
            const yearLabel = stu?.school_year?.school_year || stu?.school_year || '—';
            const genAve = stu?.general_average;

            return (
              <div key={stu.student_id} className="border rounded-3">
                {/* Minimal header line */}
                <div className="px-3 py-2 border-bottom d-flex flex-column flex-md-row justify-content-between gap-2">
                  <div className="small">
                    <strong>{studentName}</strong>
                    <span className="text-muted"> • LRN:</span> <span>{lrn || '—'}</span>
                    <span className="text-muted"> • Section:</span> <span>{section}</span>
                    <span className="text-muted"> • Grade:</span> <span>{gradeLevel}</span>
                    <span className="text-muted"> • SY:</span> <span>{yearLabel}</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    {genAve != null ? (
                      <div className="small">
                        <span className="text-muted me-1">General Avg:</span>
                        <span className={`badge rounded-pill text-bg-${gradeVariant(genAve)}`}>{fmtGrade(genAve)}</span>
                      </div>
                    ) : null}
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => goUpsertFor(stu)}
                      title="Input or edit grades for this student"
                    >
                      Input Grades
                    </button>
                  </div>
                </div>

                <div className="px-3 py-2">
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="text-nowrap">Subject</th>
                          {allPeriods.map((p) => (
                            <th key={p} className="text-nowrap text-center">{p}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={1 + allPeriods.length} className="text-center text-muted py-4">
                              No subject grades.
                            </td>
                          </tr>
                        ) : rows.map((r) => {
                          const subjLabel = r.subject_code && r.subject_name
                            ? `${r.subject_code} — ${r.subject_name}`
                            : (r.subject_code || r.subject_name || '—');
                          return (
                            <tr key={r.key}>
                              <td className="fw-medium">{subjLabel}</td>
                              {allPeriods.map((p) => {
                                const g = r.periodGrades[p];
                                return (
                                  <td key={p} className="text-center">
                                    <span className={`badge rounded-pill text-bg-${gradeVariant(g)}`}>{fmtGrade(g)}</span>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>

                      <tfoot>
                        <tr>
                          <th className="text-nowrap">Average</th>
                          {allPeriods.map((p) => {
                            const avg = periodAverages[p];
                            return (
                              <th key={p} className="text-center fw-normal">
                                <span className={`badge rounded-pill text-bg-${gradeVariant(avg)}`}>
                                  {fmtGrade(avg)}
                                </span>
                              </th>
                            );
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination (minimal) */}
      {totalStudents > 0 && (
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-2 mt-3">
          <div className="d-flex align-items-center gap-2">
            <label className="text-muted small mb-0">Students per page</label>
            <select
              className="form-select form-select-sm"
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); }}
              style={{ maxWidth: 120 }}
            >
              {[3, 5, 10, 15].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-muted small">
              {Math.min(totalStudents, startIdx + 1)}–{Math.min(totalStudents, startIdx + pageStudents.length)} of {totalStudents}
            </span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={pageClamped <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <FaChevronLeft /> Prev
            </button>
            <span className="small">Page {pageClamped} / {totalPages}</span>
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={pageClamped >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <FaChevronRight />
            </button>
          </div>
        </div>
      )}

      <StatusModal {...statusModal} onHide={() => setStatusModal((s) => ({ ...s, show: false }))} />
    </div>
  );
}
