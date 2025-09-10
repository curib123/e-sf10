import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaChevronUp,
  FaPlus,
  FaSearch,
  FaSync,
  FaTimesCircle,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

/* ────────────────────────────────────────────────────────────────────────────
   AsyncSearchSelect
   - No network on empty query.
   - Always caps visible results (maxOptions, default 5).
   - Works with remote fetchers (students) or cached-on-demand fetchers
     (sections/teachers).
   onChange(value, option) fires only when a result is selected.
   ──────────────────────────────────────────────────────────────────────────── */
function AsyncSearchSelect({
  label,
  value,
  onChange,
  placeholder = "Search…",
  fetcher,          // async (q) => Promise<[{value,label,subtitle?}]>  MUST handle empty->[]
  disabled = false,
  minChars = 1,
  maxOptions = 5,
}) {
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [selectedLabel, setSelectedLabel] = useState("");

  // Close on outside click
  useEffect(() => {
    const handle = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Keep displayed label in sync when value changes externally
  useEffect(() => {
    const current = opts.find((o) => String(o.value) === String(value));
    if (current && !open) {
      setSelectedLabel(current.label);
      setQuery(current.label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, open]);

  // Debounced fetch with minChars, maxOptions
  useEffect(() => {
    let cancel = false;
    const run = async () => {
      const q = (query || "").trim();
      if (q.length < minChars) {
        if (!cancel) setOpts([]);
        return;
      }
      if (!fetcher) return;

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

    const id = setTimeout(run, 250);
    return () => {
      cancel = true;
      clearTimeout(id);
    };
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
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, opts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectAt(activeIdx >= 0 ? activeIdx : 0);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
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
            onClick={() => {
              onChange?.("", null);
              setQuery("");
              setSelectedLabel("");
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
        <div className="dropdown-menu show w-100 mt-1 p-0" style={{ maxHeight: 260, overflowY: "auto" }}>
          {tooShort ? (
            <div className="px-3 py-2 small text-muted">
              Type at least {minChars} character{minChars > 1 ? "s" : ""}…
            </div>
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

      <div className="form-text">Type to search; results are limited to {maxOptions}.</div>
    </div>
  );
}

export default function GradeInputsList() {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);

  // Table state
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusModal, setStatusModal] = useState({ show: false, title: "", message: "", variant: "info" });

  // Dataset
  const [dataset, setDataset] = useState("all"); // all | student | section | teacher
  const [studentPick, setStudentPick] = useState({ id: "", label: "" });
  const [sectionPick, setSectionPick] = useState({ id: "", label: "" });
  const [teacherPick, setTeacherPick] = useState({ id: "", label: "" });

  // Search & Filters
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterYear, setFilterYear] = useState("all");

  // Sort
  const [sortBy, setSortBy] = useState("student"); // student | subject | grade | period | section | year | id
  const [sortDir, setSortDir] = useState("asc");

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  // On-demand caches for sections/teachers
  const sectionCacheRef = useRef(null);
  const teacherCacheRef = useRef(null);

  // Headers
  const authHeaders = () => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: "Unauthorized", message: "Access denied. Please log in.", variant: "danger" });
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 900);
  };

  const checkToken = () => {
    if (!token) {
      handleUnauthorized();
      return false;
    }
    return true;
  };

  /* ──────────────────────────────────────────────────────────────────────────
     API helpers (per your provided endpoints)
     BASE_URL should be like: http://localhost:3001/esf10
     ────────────────────────────────────────────────────────────────────────── */
  const fetchAllGrades = async () => {
    const res = await fetch(`${BASE_URL}/grades/`, { headers: authHeaders() });
    if (res.status === 401) return handleUnauthorized();
    const json = await res.json();
    return json?.success ? (json.data || []) : [];
  };

  const fetchGradesByStudent = async (studentId) => {
    const res = await fetch(`${BASE_URL}/grades/student/${studentId}`, { headers: authHeaders() });
    if (res.status === 401) return handleUnauthorized();
    const json = await res.json();
    return json?.success ? (json.data || []) : [];
  };

  // Per spec, "grades-by-section" is served under /grades/teacher/:section_id
  const fetchGradesBySection = async (sectionId) => {
    const res = await fetch(`${BASE_URL}/grades/teacher/${sectionId}`, { headers: authHeaders() });
    if (res.status === 401) return handleUnauthorized();
    const json = await res.json();
    return json?.success ? (json.data || []) : [];
  };

  const fetchGradesByTeacher = async (teacherId) => {
    const res = await fetch(`${BASE_URL}/grades/teacher/${teacherId}`, { headers: authHeaders() });
    if (res.status === 401) return handleUnauthorized();
    const json = await res.json();
    return json?.success ? (json.data || []) : [];
  };

  /* ──────────────────────────────────────────────────────────────────────────
     Dropdown fetchers (safe + capped)
     - Students: remote search API (never fetch on empty), slice to 5.
     - Sections/Teachers: on-demand cache. Fetch all ONCE only after user typed,
       then filter client-side and cap to 5.
     ────────────────────────────────────────────────────────────────────────── */
  const searchStudents = async (text) => {
    const q = (text || "").trim();
    if (!q) return []; // no response if empty
    const url = `${BASE_URL}/students/search?query=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (res.status === 401) { handleUnauthorized(); return []; }
    const json = await res.json();
    const arr = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
    return arr.slice(0, 5).map((s) => ({
      value: s.student_id,
      label: `${s.last_name}, ${s.first_name}${s.middle_name ? " " + s.middle_name : ""}`,
      subtitle: s.lrn ? `LRN: ${s.lrn}` : undefined,
    }));
  };

  const searchSections = async (text) => {
    const q = (text || "").trim();
    if (!q) return []; // no response if empty
    if (!checkToken()) return [];
    if (!sectionCacheRef.current) {
      try {
        const res = await fetch(`${BASE_URL}/sections`, { headers: authHeaders() });
        if (res.status === 401) { handleUnauthorized(); return []; }
        const json = await res.json();
        sectionCacheRef.current = (json?.data || []).map((s) => ({
          value: s.section_id,
          label: s.section_name || `Section #${s.section_id}`,
          subtitle: [s.grade_name, s.school_year].filter(Boolean).join(" • "),
        }));
      } catch {
        sectionCacheRef.current = [];
      }
    }
    const pool = sectionCacheRef.current || [];
    return pool
      .filter((o) =>
        [o.label, o.subtitle]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q.toLowerCase()))
      )
      .slice(0, 5);
  };

  const searchTeachers = async (text) => {
    const q = (text || "").trim();
    if (!q) return []; // no response if empty
    if (!checkToken()) return [];
    if (!teacherCacheRef.current) {
      try {
        const res = await fetch(`${BASE_URL}/teachers`, { headers: authHeaders() });
        if (res.status === 401) { handleUnauthorized(); return []; }
        const json = await res.json();
        teacherCacheRef.current = (json?.data || []).map((t) => ({
          value: t.teacher_id,
          label: t.full_name || `${t.last_name}, ${t.first_name}`,
          subtitle: t.email || undefined,
        }));
      } catch {
        teacherCacheRef.current = [];
      }
    }
    const pool = teacherCacheRef.current || [];
    return pool
      .filter((o) =>
        [o.label, o.subtitle]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q.toLowerCase()))
      )
      .slice(0, 5);
  };

  /* ──────────────────────────────────────────────────────────────────────────
     Load dataset automatically when selection changes
     ────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      if (!checkToken()) return;
      setLoading(true);
      try {
        let list = [];
        if (dataset === "all") {
          list = await fetchAllGrades();
        } else if (dataset === "student") {
          if (!studentPick.id) { setRows([]); return; }
          list = await fetchGradesByStudent(studentPick.id);
        } else if (dataset === "section") {
          if (!sectionPick.id) { setRows([]); return; }
          list = await fetchGradesBySection(sectionPick.id);
        } else if (dataset === "teacher") {
          if (!teacherPick.id) { setRows([]); return; }
          list = await fetchGradesByTeacher(teacherPick.id);
        }
        setRows(Array.isArray(list) ? list : []);
        setPage(1);
      } catch (e) {
        console.error(e);
        setRows([]);
        setStatusModal({ show: true, title: "Error", message: "Failed to load grades.", variant: "danger" });
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, studentPick.id, sectionPick.id, teacherPick.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (dataset === "all") setRows(await fetchAllGrades());
      if (dataset === "student" && studentPick.id) setRows(await fetchGradesByStudent(studentPick.id));
      if (dataset === "section" && sectionPick.id) setRows(await fetchGradesBySection(sectionPick.id));
      if (dataset === "teacher" && teacherPick.id) setRows(await fetchGradesByTeacher(teacherPick.id));
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────
     Derived filter options
     ────────────────────────────────────────────────────────────────────────── */
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

  const resetFilters = () => {
    setQ("");
    setFilterSubject("all");
    setFilterPeriod("all");
    setFilterYear("all");
    setSortBy("student");
    setSortDir("asc");
    setPage(1);
  };

  /* ──────────────────────────────────────────────────────────────────────────
     Search + filters + sort
     ────────────────────────────────────────────────────────────────────────── */
  const filteredSorted = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      const txt = [
        r?.student?.name, r?.student?.lrn,
        r?.subject?.subject_code, r?.subject?.subject_name,
        r?.section?.section_name, r?.grade_level, r?.school_year,
        r?.grading_period, r?.grade, r?.grade_id, r?.enrollment_id,
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
      if (sortBy === "id")    return (Number(a.grade_id) - Number(b.grade_id)) * dir;
      if (sortBy === "grade") return ((Number(a.grade) || 0) - (Number(b.grade) || 0)) * dir;

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

  /* ──────────────────────────────────────────────────────────────────────────
     Pagination
     ────────────────────────────────────────────────────────────────────────── */
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
    const n = Number(g);
    return Number.isFinite(n) ? n.toFixed(2) : String(g ?? "—");
  };

  return (
    <div className="container-xxl my-4">
      <div className="card border-0 shadow-sm rounded-4">
        {/* Header */}
        <div className="card-header bg-white border-0 py-3 px-4 px-lg-5">
          <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
            <div>
              <h4 className="fw-bold mb-1">Grades</h4>
              <div className="text-muted small">Lightweight browsing with safe dropdown searches (max 5 results).</div>
            </div>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary d-flex align-items-center gap-2 px-3"
                onClick={handleRefresh}
                disabled={loading || refreshing}
                title="Refresh data"
              >
                {refreshing ? <span className="spinner-border spinner-border-sm" role="status" /> : <FaSync />}
                <span>{refreshing ? "Refreshing" : "Refresh"}</span>
              </button>
              <button
                className="btn btn-primary d-flex align-items-center gap-2 px-3"
                onClick={() => navigate("/grade-inputs/upsert")}
              >
                <FaPlus /> Add Student Grades
              </button>
            </div>
          </div>
        </div>

        <div className="card-body p-4 p-lg-5">
          {/* Dataset nav pills */}
          <div className="mb-3">
            <ul className="nav nav-pills gap-2">
              {["all", "student", "section", "teacher"].map((k) => (
                <li className="nav-item" key={k}>
                  <button
                    className={`nav-link ${dataset === k ? "active" : ""}`}
                    onClick={() => { setDataset(k); setPage(1); }}
                  >
                    {k === "all" ? "All" : k.charAt(0).toUpperCase() + k.slice(1)}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contextual picker */}
          {dataset !== "all" && (
            <div className="row g-2 align-items-end mb-3">
              <div className="col-12 col-lg-6">
                {dataset === "student" && (
                  <AsyncSearchSelect
                    label="Student"
                    placeholder="Type name or LRN…"
                    value={studentPick.id}
                    onChange={(val, opt) => setStudentPick({ id: val, label: opt?.label || "" })}
                    fetcher={searchStudents}
                    disabled={loading}
                    minChars={1}
                    maxOptions={5}
                  />
                )}
                {dataset === "section" && (
                  <AsyncSearchSelect
                    label="Section"
                    placeholder="Search section…"
                    value={sectionPick.id}
                    onChange={(val, opt) => setSectionPick({ id: val, label: opt?.label || "" })}
                    fetcher={searchSections}
                    disabled={loading}
                    minChars={1}
                    maxOptions={5}
                  />
                )}
                {dataset === "teacher" && (
                  <AsyncSearchSelect
                    label="Teacher"
                    placeholder="Search teacher…"
                    value={teacherPick.id}
                    onChange={(val, opt) => setTeacherPick({ id: val, label: opt?.label || "" })}
                    fetcher={searchTeachers}
                    disabled={loading}
                    minChars={1}
                    maxOptions={5}
                  />
                )}
              </div>
              <div className="col-12 col-lg-6 text-lg-end">
                <span className="badge bg-light text-dark">
                  {dataset === "all" ? "All grades" :
                    dataset === "student" ? (studentPick.label || "Pick a student") :
                    dataset === "section" ? (sectionPick.label || "Pick a section") :
                    (teacherPick.label || "Pick a teacher")}
                </span>
              </div>
            </div>
          )}

          {/* Quick search */}
          <div className="row g-2 align-items-center mb-2">
            <div className="col-12 col-lg-7">
              <div className="input-group">
                <span className="input-group-text">Search</span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Student, Subject, Section, Period, Year, LRN"
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(1); }}
                />
              </div>
            </div>
            <div className="col-7 col-lg-3">
              <select className="form-select" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}>
                <option value="student">Sort by Student</option>
                <option value="subject">Sort by Subject</option>
                <option value="grade">Sort by Grade</option>
                <option value="period">Sort by Period</option>
                <option value="section">Sort by Section</option>
                <option value="year">Sort by Year</option>
                <option value="id">Sort by Grade ID</option>
              </select>
            </div>
            <div className="col-5 col-lg-2">
              <select className="form-select" value={sortDir} onChange={(e) => { setSortDir(e.target.value); setPage(1); }}>
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
          </div>

          {/* Filters (collapsible) */}
          <div className="mb-3">
            <button
              className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2"
              onClick={() => setShowFilters((s) => !s)}
              type="button"
            >
              {showFilters ? <FaChevronUp /> : <FaChevronDown />} Filters
            </button>
            {showFilters && (
              <div className="row g-2 mt-2">
                <div className="col-12 col-md-4 col-lg-3">
                  <div className="input-group">
                    <span className="input-group-text">Subject</span>
                    <select className="form-select" value={filterSubject} onChange={(e) => { setFilterSubject(e.target.value); setPage(1); }}>
                      <option value="all">All</option>
                      {subjectOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="col-6 col-md-4 col-lg-3">
                  <div className="input-group">
                    <span className="input-group-text">Period</span>
                    <select className="form-select" value={filterPeriod} onChange={(e) => { setFilterPeriod(e.target.value); setPage(1); }}>
                      <option value="all">All</option>
                      {periodOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="col-6 col-md-4 col-lg-3">
                  <div className="input-group">
                    <span className="input-group-text">Year</span>
                    <select className="form-select" value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setPage(1); }}>
                      <option value="all">All</option>
                      {yearOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="col-12 col-lg-3 d-flex align-items-center">
                  <button className="btn btn-link text-decoration-none ms-auto" onClick={resetFilters}>Reset filters</button>
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-5 text-muted">⏳ Loading…</div>
          ) : filteredSorted.length === 0 ? (
            <div className="text-center bg-body-tertiary rounded-4 p-5">
              <div className="mb-2">No grades found</div>
              <p className="text-muted mb-4 small">Adjust search/filters or change dataset.</p>
              <button className="btn btn-primary d-inline-flex align-items-center gap-2 px-3" onClick={() => navigate("/grade-inputs/upsert")}>
                <FaPlus /> Create / Update Grade
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
                          <span className={`badge ${Number(it?.grade) < 75 ? "bg-danger" : Number(it?.grade) < 85 ? "bg-warning text-dark" : "bg-success"}`}>
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
