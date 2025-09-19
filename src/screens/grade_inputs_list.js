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
   AsyncSearchSelect (filters over cached /grades/students/:teacher_id)
   ──────────────────────────────────────────────────────────────────────────── */
function AsyncSearchSelect({
  label,
  value,
  onChange,
  placeholder = "Search…",
  fetcher,          // async (q) => Promise<[{value,label,subtitle?}]>
  disabled = false,
  minChars = 1,
  maxOptions = 8,
}) {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [selectedLabel, setSelectedLabel] = useState("");

  useEffect(() => {
    const handle = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
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
      const q = (query || "").trim();
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
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      setActiveIdx(0);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, opts.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); selectAt(activeIdx >= 0 ? activeIdx : 0); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  const tooShort = (query || "").trim().length < minChars;

  return (
    <div ref={containerRef} className="position-relative w-100">
      {label ? <label className="form-label mb-1">{label}</label> : null}
      <div className="input-group">
        <span className="input-group-text"><FaSearch /></span>
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
            onClick={() => { onChange?.("", null); setQuery(""); setSelectedLabel(""); setOpen(true); inputRef.current?.focus(); }}
            disabled={disabled}
            title="Clear"
          >
            <FaTimesCircle />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="dropdown-menu show w-100 mt-1 p-0" style={{ maxHeight: 260, overflowY: "auto" }}>
          {tooShort ? (
            <div className="px-3 py-2 small text-muted">Type at least {minChars} character{minChars > 1 ? "s" : ""}…</div>
          ) : loading ? (
            <div className="px-3 py-2 small text-muted">Loading…</div>
          ) : opts.length === 0 ? (
            <div className="px-3 py-2 small text-muted">No matches</div>
          ) : (
            opts.map((o, idx) => (
              <button
                key={`${o.value}-${idx}`}
                type="button"
                className={`dropdown-item d-flex flex-column ${idx === activeIdx ? "active" : ""}`}
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

      <div className="form-text">Type to search; results are limited.</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Component: GradeStudentList (now flattened from /grades/students/:teacher_id)
   ──────────────────────────────────────────────────────────────────────────── */
export default function GradeStudentList() {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const teacherId = useMemo(
    () => sessionStorage.getItem("teacher_id") || sessionStorage.getItem("user_id") || "",
    []
  );

  // Cached teacher bundle (students with subjects+grades)
  const teacherStudentsRef = useRef(null); // [{ student_id, ..., subjects: [{ subject_id, ..., grades: [...] }] }]
  const [bundleLoaded, setBundleLoaded] = useState(false);

  // Table-ish flattened rows for selected student
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusModal, setStatusModal] = useState({ show: false, title: "", message: "", variant: "info" });

  // Student picker
  const [studentPick, setStudentPick] = useState({ id: "", label: "" });
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Search/filters/sort/pagination
  const [q, setQ] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [sortBy, setSortBy] = useState("subject");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: "Unauthorized", message: "Access denied. Please log in.", variant: "danger" });
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 900);
  };

  // Load teacher bundle once (or on refresh)
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
        setStatusModal({ show: true, title: "Error", message: "Failed to load students.", variant: "danger" });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  // Build AsyncSearchSelect source from cached bundle
  const searchStudents = async (text) => {
    const q = (text || "").trim().toLowerCase();
    if (!q || !teacherId) return [];
    try {
      if (!teacherStudentsRef.current) await loadTeacherBundle();
      const pool = teacherStudentsRef.current || [];
      const options = pool.map((s) => {
        const yearLabel = s.school_year?.school_year || "";
        return {
          value: s.student_id,
          label: `${s.student_name || "(Unnamed)"}${s.section?.section_name ? " • " + s.section.section_name : ""}${yearLabel ? " • " + yearLabel : ""}`,
          subtitle: `LRN: ${s.lrn || "—"}${s.grade_level?.grade_name ? " • " + s.grade_level.grade_name : ""}`,
          _search: [
            s.student_name, s.lrn, s.section?.section_name, s.grade_level?.grade_name, yearLabel
          ].map(x => String(x ?? "").toLowerCase()).join(" "),
        };
      });

      return options
        .filter(o => o._search.includes(q))
        .map(({ _search, ...o }) => o)
        .slice(0, 8);
    } catch {
      return [];
    }
  };

  // When student is picked, set selectedStudent and flatten rows from subjects[].grades[]
  useEffect(() => {
    const id = studentPick.id;
    if (!id || !teacherStudentsRef.current) {
      setSelectedStudent(null);
      setRows([]);
      return;
    }
    const stu = teacherStudentsRef.current.find(s => String(s.student_id) === String(id));
    setSelectedStudent(stu || null);

    if (!stu) { setRows([]); return; }

    // Flatten: one row per subject x grading_period
    const yearLabel = stu.school_year?.school_year || "";
    const section = stu.section?.section_name || "";
    const gradeLevel = stu.grade_level?.grade_name || "";
    const studentName = stu.student_name || "";
    const studentLrn = stu.lrn || "";

    const flattened = [];
    const subjects = Array.isArray(stu.subjects) ? stu.subjects : [];
    for (const sub of subjects) {
      const subjCode = sub.subject_code || "";
      const subjName = sub.subject_name || "";
      const grades = Array.isArray(sub.grades) ? sub.grades : [];
      for (const g of grades) {
        const period = g?.grading_period || "";
        const val = g?.grade;
        flattened.push({
          // Synthetic id from subject + period (unique enough for table key)
          grade_id: `S${stu.student_id}-SUB${sub.subject_id}-${period}`,
          grade: val,
          grading_period: period,
          school_year: yearLabel,
          grade_level: gradeLevel,
          section: { section_name: section },
          student: { name: studentName, lrn: studentLrn },
          subject: { subject_code: subjCode, subject_name: subjName },
        });
      }
    }

    setRows(flattened);
    setPage(1);
  }, [studentPick.id, bundleLoaded]);

  const handleRefresh = async () => {
    if (!teacherId) return;
    setRefreshing(true);
    try {
      await loadTeacherBundle();
      // Re-derive rows for current pick
      if (studentPick.id) {
        const stu = teacherStudentsRef.current.find(s => String(s.student_id) === String(studentPick.id));
        setSelectedStudent(stu || null);
        // trigger rows derivation by toggling id state no-op
        setStudentPick(s => ({ ...s }));
      }
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  // Derived filter options based on current rows
  const subjectOptions = useMemo(() => {
    const set = new Set(rows.map(r => r?.subject?.subject_code || r?.subject?.subject_name).filter(Boolean));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [rows]);

  const periodOptions = useMemo(() => {
    const set = new Set(rows.map(r => r?.grading_period).filter(Boolean));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [rows]);

  const yearOptions = useMemo(() => {
    const set = new Set(rows.map(r => r?.school_year).filter(Boolean));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [rows]);

  // Search + filters + sort
  const filteredSorted = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      const txt = [
        r?.student?.name, r?.student?.lrn,
        r?.subject?.subject_code, r?.subject?.subject_name,
        r?.section?.section_name, r?.grade_level, r?.school_year,
        r?.grading_period, r?.grade, r?.grade_id,
      ].map(x => String(x ?? "")).join(" ").toLowerCase();

      const matchSearch = term === "" || txt.includes(term);
      const subjLabel   = r?.subject?.subject_code || r?.subject?.subject_name || "";
      const matchSubject = filterSubject === "all" || subjLabel === filterSubject;
      const matchPeriod  = filterPeriod  === "all" || (r?.grading_period ?? "") === filterPeriod;
      const matchYear    = filterYear    === "all" || (r?.school_year ?? "") === filterYear;

      return matchSearch && matchSubject && matchPeriod && matchYear;
    });

    const sorted = [...list].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "id")    return (String(a.grade_id).localeCompare(String(b.grade_id), undefined, { numeric: true })) * dir;
      if (sortBy === "grade") return (((Number(a.grade) || 0) - (Number(b.grade) || 0)) * dir);

      const pick = (row, key) => {
        if (key === "student") return row?.student?.name || "";
        if (key === "subject") return (row?.subject?.subject_code || row?.subject?.subject_name || "");
        if (key === "period")  return row?.grading_period || "";
        if (key === "section") return row?.section?.section_name || "";
        if (key === "year")    return row?.school_year || "";
        return "";
      };
      return pick(a, sortBy).localeCompare(pick(b, sortBy), undefined, { numeric: true }) * dir;
    });

    return sorted;
  }, [rows, q, sortBy, sortDir, filterSubject, filterPeriod, filterYear]);

  // Pagination
  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageClamped = Math.min(Math.max(1, page), totalPages);
  const startIdx = (pageClamped - 1) * perPage;
  const pageSlice = filteredSorted.slice(startIdx, startIdx + perPage);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  const fmtSubject = (r) => {
    const code = r?.subject?.subject_code;
    const name = r?.subject?.subject_name;
    if (code && name) return `${code} — ${name}`;
    return code || name || "—";
  };
  const fmtGrade = (g) => {
    if (g == null || g === "") return "—";
    const n = Number(g);
    return Number.isFinite(n) ? n.toFixed(2) : String(g);
  };

  return (
    <div className="container-xxl my-4">
      <div className="card border-0 shadow-sm rounded-4">
        {/* Header */}
        <div className="card-header bg-white border-0 py-3 px-4 px-lg-5">
          <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
            <div>
              <h4 className="fw-bold mb-1">Student Grades</h4>
              {selectedStudent?.general_average != null && (
                <div className="small text-muted">General Average: <strong>{fmtGrade(selectedStudent.general_average)}</strong></div>
              )}
            </div>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary d-flex align-items-center gap-2 px-3"
                onClick={handleRefresh}
                disabled={loading || refreshing || !teacherId}
                title="Refresh data"
              >
                {refreshing ? <span className="spinner-border spinner-border-sm" role="status" /> : <FaSync />}
                <span>{refreshing ? "Refreshing" : "Refresh"}</span>
              </button>
              <button
                className="btn btn-primary d-flex align-items-center gap-2 px-3"
                onClick={() => navigate("/grade-inputs/upsert")}
              >
                <FaPlus /> Input Grades
              </button>
            </div>
          </div>
        </div>

        <div className="card-body p-4 p-lg-5">
          {/* Student picker */}
          <div className="row g-2 align-items-end mb-4">
            <div className="col-12 col-lg-6">
              <AsyncSearchSelect
                label="Student"
                placeholder="Type name or LRN…"
                value={studentPick.id}
                onChange={(val, opt) => setStudentPick({ id: val, label: opt?.label || "" })}
                fetcher={searchStudents}
                disabled={loading || !teacherId}
                minChars={1}
                maxOptions={8}
              />
            </div>
            <div className="col-12 col-lg-6 text-lg-end">
              <span className="badge bg-light text-dark">
                {studentPick.label ? `Selected: ${studentPick.label}` : "Pick a student"}
              </span>
              {teacherId ? <span className="badge bg-light text-dark ms-2">Teacher ID: {teacherId}</span> : null}
            </div>
          </div>

          {/* Quick search + minimal sort */}
          <div className="row g-2 align-items-center mb-2">
            <div className="col-12 col-lg-7">
              <div className="input-group">
                <span className="input-group-text">Search</span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Subject, Section, Period, Year, LRN"
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(1); }}
                />
              </div>
            </div>
            <div className="col-7 col-lg-3">
              <select className="form-select" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}>
                <option value="subject">Sort by Subject</option>
                <option value="grade">Sort by Grade</option>
                <option value="period">Sort by Period</option>
                <option value="section">Sort by Section</option>
                <option value="year">Sort by Year</option>
                <option value="student">Sort by Student</option>
                <option value="id">Sort by Row ID</option>
              </select>
            </div>
            <div className="col-5 col-lg-2">
              <select className="form-select" value={sortDir} onChange={(e) => { setSortDir(e.target.value); setPage(1); }}>
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
          </div>

          {/* Filters */}
          <div className="row g-2 mb-3">
            <div className="col-12 col-md-4">
              <div className="input-group">
                <span className="input-group-text">Subject</span>
                <select className="form-select" value={filterSubject} onChange={(e) => { setFilterSubject(e.target.value); setPage(1); }}>
                  <option value="all">All</option>
                  {subjectOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="col-6 col-md-4">
              <div className="input-group">
                <span className="input-group-text">Period</span>
                <select className="form-select" value={filterPeriod} onChange={(e) => { setFilterPeriod(e.target.value); setPage(1); }}>
                  <option value="all">All</option>
                  {periodOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="col-6 col-md-4">
              <div className="input-group">
                <span className="input-group-text">Year</span>
                <select className="form-select" value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setPage(1); }}>
                  <option value="all">All</option>
                  {yearOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-5 text-muted">⏳ Loading…</div>
          ) : !studentPick.id ? (
            <div className="text-center bg-body-tertiary rounded-4 p-5">
              <div className="mb-2">Pick a student to view grades</div>
            </div>
          ) : filteredSorted.length === 0 ? (
            <div className="text-center bg-body-tertiary rounded-4 p-5">
              <div className="mb-2">No grades found</div>
              <p className="text-muted mb-3 small">Adjust search/filters.</p>
              <button
                className="btn btn-primary d-inline-flex align-items-center gap-2 px-3"
                onClick={() => navigate("/grade-inputs/upsert")}
              >
                <FaPlus /> Input Grades
              </button>
            </div>
          ) : (
            <>
              <div className="table-responsive" style={{ maxHeight: "60vh" }}>
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light sticky-top shadow-sm">
                    <tr>
                      <th className="text-nowrap">Student</th>
                      <th className="text-nowrap">Subject</th>
                      <th className="text-nowrap">Period</th>
                      <th className="text-nowrap">Grade</th>
                      <th className="text-nowrap">Section</th>
                      <th className="text-nowrap">Grade Level</th>
                      <th className="text-nowrap">School Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageSlice.map((it) => (
                      <tr key={it.grade_id}>
                        <td className="fw-medium">
                          {it?.student?.name || "—"}
                          {it?.student?.lrn ? <div className="small text-muted">LRN: {it.student.lrn}</div> : null}
                        </td>
                        <td>{fmtSubject(it)}</td>
                        <td>{it?.grading_period ?? "—"}</td>
                        <td>
                          <span className={`badge ${it?.grade == null ? "bg-secondary" : Number(it?.grade) < 75 ? "bg-danger" : Number(it?.grade) < 85 ? "bg-warning text-dark" : "bg-success"}`}>
                            {fmtGrade(it?.grade)}
                          </span>
                        </td>
                        <td>{it?.section?.section_name ?? "—"}</td>
                        <td>{it?.grade_level ?? "—"}</td>
                        <td>{it?.school_year ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-2 mt-3">
                <div className="d-flex align-items-center gap-2">
                  <label className="text-muted small mb-0">Rows</label>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 90 }}
                    value={perPage}
                    onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                  >
                    {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span className="text-muted small">
                    {Math.min(total, startIdx + 1)}–{Math.min(total, startIdx + pageSlice.length)} of {total}
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
            </>
          )}
        </div>
      </div>

      <StatusModal {...statusModal} onHide={() => setStatusModal((s) => ({ ...s, show: false }))} />

      <style>{`
        .table thead.sticky-top { top: 0; z-index: 2; }
        .table-hover tbody tr:hover { background-color: rgba(0,0,0,.03); }
        .rounded-4 { border-radius: 1rem; }
      `}</style>
    </div>
  );
}
