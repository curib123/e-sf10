import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FaSave,
  FaSearch,
  FaSync,
  FaTimes,
  FaTimesCircle,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import StatusModal from '../components/status_modal';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const joinUrl = (path = "") => `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

const headers = (token) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const isAbort = (err) => err && (err.name === "AbortError" || String(err).includes("aborted"));

// ─────────────────────────────────────────────────────────────────────────────
// Reusable: SearchableSelect
// ─────────────────────────────────────────────────────────────────────────────
function SearchableSelect({
  label,
  options = [],
  value,
  onChange,
  placeholder = "Search and select...",
  disabled = false,
  loading = false,
}) {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => {
    const sel = options.find((o) => String(o.value) === String(value));
    if (sel && !open) setQuery(sel.label);
  }, [value, options, open]);

  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase().trim();
    if (!q) return options;
    return options.filter((o) =>
      [o.label, o.subtitle, o.code].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [options, query]);

  useEffect(() => {
    const handle = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const selectAt = (idx) => {
    const opt = filtered[idx];
    if (!opt) return;
    onChange?.(String(opt.value));
    setOpen(false);
    setQuery(opt.label);
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
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
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

  return (
    <div ref={containerRef} className="position-relative">
      {label ? <label className="form-label">{label}</label> : null}
      <div className="input-group">
        <span className="input-group-text"><FaSearch /></span>
        <input
          ref={inputRef}
          type="text"
          className="form-control"
          placeholder={placeholder}
          value={query}
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
              onChange?.("");
              setQuery("");
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
          {loading ? (
            <div className="px-3 py-2 small text-muted">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 small text-muted">No matches</div>
          ) : (
            filtered.slice(0, 50).map((o, idx) => (
              <button
                key={o.value}
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
      <div className="form-text">Start typing to filter, then hit Enter or click to select.</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: GradeInputUpsert
// ─────────────────────────────────────────────────────────────────────────────
const GRADE_PERIODS = ["1st", "2nd", "3rd", "4th"];

export default function GradeInputUpsert() {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);

  // Data state
  const [enrollments, setEnrollments] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Selection state
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");
  const [derivedGradeLevelId, setDerivedGradeLevelId] = useState(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [gradingPeriod, setGradingPeriod] = useState("");
  const [gradeValue, setGradeValue] = useState("");

  // UI state
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusModal, setStatusModal] = useState({ show: false, variant: "info", title: "", message: "" });

  // NEW: current grades state
  const [studentId, setStudentId] = useState(null);
  const [grades, setGrades] = useState([]);
  const [loadingGrades, setLoadingGrades] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // Fetch: Enrollments  (GET /enrollments)
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    (async () => {
      try {
        setLoadingEnrollments(true);
        const res = await fetch(joinUrl("/enrollments"), {
          method: "GET",
          headers: headers(token),
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`Enrollments request failed (${res.status})`);
        const json = await res.json();
        if (!mounted) return;
        const list = Array.isArray(json?.data) ? json.data : [];
        setEnrollments(list);
      } catch (err) {
        if (isAbort(err)) return;
        console.error(err);
        if (mounted) setStatusModal({ show: true, variant: "danger", title: "Load failed", message: String(err?.message || err) });
      } finally {
        if (mounted) setLoadingEnrollments(false);
      }
    })();

    return () => { mounted = false; ac.abort(); };
  }, [token]);

  // ───────────────────────────────────────────────────────────────────────────
  // Enrollment → derive grade level & subjects (existing)
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const eid = Number(selectedEnrollmentId) || null;

    setDerivedGradeLevelId(null);
    setSubjects([]);
    setSelectedSubjectId("");

    if (!eid) return;

    let mounted = true;
    const ac = new AbortController();

    const fetchAllSubjects = async () => {
      try {
        const resAll = await fetch(joinUrl("/subjects/view-all-subjects"), {
          method: "GET",
          headers: headers(token),
          signal: ac.signal,
        });
        if (!resAll.ok) throw new Error(`View-all subjects failed (${resAll.status})`);
        const jsonAll = await resAll.json();
        const rowsAll = Array.isArray(jsonAll?.data) ? jsonAll.data : [];
        const mappedAll = rowsAll.map((s) => ({
          value: s.subject_id,
          label: s.subject_name || s.subject_code || `Subject #${s.subject_id}`
        }));
        if (mounted) setSubjects(mappedAll);
      } catch (err) {
        if (isAbort(err)) return;
        console.error(err);
        if (mounted) setStatusModal({ show: true, variant: "danger", title: "Subjects load failed", message: String(err?.message || err) });
      }
    };

    const fetchSubjectsByGradeLevel = async (gradeLevelId) => {
      if (!gradeLevelId) return fetchAllSubjects();
      try {
        const res = await fetch(joinUrl(`/subject-grade-levels/by-grade-level/${gradeLevelId}`), {
          method: "GET",
          headers: headers(token),
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`Subjects by grade-level failed (${res.status})`);
        const json = await res.json();
        const rows = Array.isArray(json?.data) ? json.data : [];
        const mapped = rows.map((r) => ({
          value: r.subject_id,
          label: r.subject?.subject_name || r.subject?.subject_code || `Subject #${r.subject_id}`,
          subtitle: r.subject?.subject_code || "",
          code: r.subject?.subject_code || "",
          units: r.units,
          is_required: r.is_required,
        }));
        if (mounted) setSubjects(mapped);
      } catch (err) {
        if (isAbort(err)) return;
        console.warn("Grade-level subjects failed; falling back to ALL subjects", err);
        await fetchAllSubjects();
      }
    };

    const run = async () => {
      setLoadingSubjects(true);
      try {
        const enrollment = enrollments.find((e) => Number(e.enrollment_id) === eid);
        if (!enrollment) return;

        if (enrollment?.grade_level_id) {
          if (mounted) setDerivedGradeLevelId(enrollment.grade_level_id);
          await fetchSubjectsByGradeLevel(enrollment.grade_level_id);
          return;
        }

        const sectionId = enrollment?.section_id;
        if (!sectionId) { await fetchAllSubjects(); return; }

        try {
          const res = await fetch(joinUrl(`/sections/${sectionId}`), {
            method: "GET",
            headers: headers(token),
            signal: ac.signal,
          });
          if (!res.ok) throw new Error(`Section lookup failed (${res.status})`);
          const json = await res.json();
          const glId = json?.data?.grade_level_id ?? json?.data?.grade_level?.grade_level_id ?? null;
          if (mounted) setDerivedGradeLevelId(glId);
          await fetchSubjectsByGradeLevel(glId);
        } catch (err) {
          if (isAbort(err)) return;
          console.warn("Section lookup failed; will show all subjects", err);
          if (mounted) setDerivedGradeLevelId(null);
          await fetchAllSubjects();
        }
      } finally {
        if (mounted) setLoadingSubjects(false);
      }
    };

    run();
    return () => { mounted = false; ac.abort(); };
  }, [selectedEnrollmentId, enrollments, token]);

  // ───────────────────────────────────────────────────────────────────────────
  // NEW: Enrollment → fetch student_id → fetch current grades
  // GET /enrollments/:enrollment_id  -> student_id
  // GET /grades/student/:student_id  -> grades[]
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    const eid = Number(selectedEnrollmentId) || null;
    setStudentId(null);
    setGrades([]);

    if (!eid) return;

    const fetchEnrollmentAndGrades = async () => {
      try {
        setLoadingGrades(true);

        // 1) Enrollment detail to get student_id
        const resEnroll = await fetch(joinUrl(`/enrollments/${eid}`), {
          method: "GET",
          headers: headers(token),
          signal: ac.signal,
        });
        if (!resEnroll.ok) throw new Error(`Enrollment detail failed (${resEnroll.status})`);
        const jsonEnroll = await resEnroll.json();
        const sid = jsonEnroll?.data?.student_id || null;
        if (!mounted) return;
        setStudentId(sid);

        if (!sid) { setGrades([]); return; }

        // 2) Grades by student_id
        const resGrades = await fetch(joinUrl(`/grades/student/${sid}`), {
          method: "GET",
          headers: headers(token),
          signal: ac.signal,
        });
        if (!resGrades.ok) throw new Error(`Grades request failed (${resGrades.status})`);
        const jsonGrades = await resGrades.json();
        if (!mounted) return;
        setGrades(Array.isArray(jsonGrades?.data) ? jsonGrades.data : []);
      } catch (err) {
        if (isAbort(err)) return;
        console.error(err);
        if (mounted) setStatusModal({ show: true, variant: "danger", title: "Grades load failed", message: String(err?.message || err) });
      } finally {
        if (mounted) setLoadingGrades(false);
      }
    };

    fetchEnrollmentAndGrades();
    return () => { mounted = false; ac.abort(); };
  }, [selectedEnrollmentId, token]);

  // Helpers
  const enrollmentOptions = useMemo(() =>
    enrollments.map((e) => ({
      value: e.enrollment_id,
      label: `${e.student_name ?? "(Unnamed)"} • ${e.section_name ?? "?"} • ${e.school_year ?? "?"}`,
      subtitle: `#${e.enrollment_id} • ${e.status ?? ""}`,
    })), [enrollments]);

  const subjectOptions = useMemo(() => subjects, [subjects]);

  const selectedEnrollment = useMemo(() => {
    const id = Number(selectedEnrollmentId) || null;
    return enrollments.find((e) => Number(e.enrollment_id) === id) || null;
  }, [selectedEnrollmentId, enrollments]);

  const fmtGrade = (g) => {
    const n = Number(g);
    return Number.isFinite(n) ? n.toFixed(2) : String(g ?? "—");
    // backend may already send "88.00" as string; this normalizes display
  };

  const refreshGrades = async () => {
    if (!studentId) return;
    setLoadingGrades(true);
    try {
      const res = await fetch(joinUrl(`/grades/student/${studentId}`), {
        method: "GET",
        headers: headers(token),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `Grades request failed (${res.status})`);
      setGrades(Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      console.error(err);
      setStatusModal({ show: true, variant: "danger", title: "Grades refresh failed", message: String(err?.message || err) });
    } finally {
      setLoadingGrades(false);
    }
  };

  // Submit
  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const eid = Number(selectedEnrollmentId) || null;
    const sid = Number(selectedSubjectId) || null;
    const period = gradingPeriod || "";
    const gradeNum = Number(gradeValue);

    if (!eid) return setStatusModal({ show: true, variant: "warning", title: "Missing selection", message: "Please choose an enrollment." });
    if (!sid) return setStatusModal({ show: true, variant: "warning", title: "Missing selection", message: "Please choose a subject." });
    if (!period) return setStatusModal({ show: true, variant: "warning", title: "Missing selection", message: "Please choose a grading period (1st–4th)." });
    if (!Number.isFinite(gradeNum) || gradeNum < 0 || gradeNum > 100)
      return setStatusModal({ show: true, variant: "warning", title: "Invalid grade", message: "Enter a number between 0 and 100." });

    try {
      setSubmitting(true);
      const body = { enrollment_id: eid, subject_id: sid, grading_period: period, grade: gradeNum };
      const res = await fetch(joinUrl("/grades/create-or-update"), {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);

      setStatusModal({
        show: true,
        variant: "success",
        title: "Grade saved",
        message: json?.message || "Grade has been created/updated successfully.",
      });

      // Auto-refresh current grades table
      await refreshGrades();
    } catch (err) {
      if (isAbort(err)) return;
      console.error(err);
      setStatusModal({ show: true, variant: "danger", title: "Save failed", message: String(err?.message || err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => navigate(-1);

  // ───────────────────────────────────────────────────────────────────────────
  // UI
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="container py-3">
      <StatusModal
        show={statusModal.show}
        onClose={() => setStatusModal((s) => ({ ...s, show: false }))}
        title={statusModal.title}
        message={statusModal.message}
        variant={statusModal.variant}
      />

      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0">Create / Update Grade</h5>
        <div className="btn-group">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => window.history.back()}>
            <FaTimes className="me-1" /> Close
          </button>
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={() => window.location.reload()}
            disabled={loadingEnrollments || submitting}
          >
            <FaSync className={loadingEnrollments ? "me-1 spin" : "me-1"} /> Refresh
          </button>
        </div>
      </div>

      {/* FORM CARD */}
      <div className="card shadow-sm border-0">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            {/* Row 1: THREE DROPDOWNS */}
            <div className="row g-3">
              <div className="col-12 col-lg-4">
                <SearchableSelect
                  label={<span>Enrollment <span className="text-muted">(student • section • SY)</span></span>}
                  options={enrollmentOptions}
                  value={selectedEnrollmentId}
                  onChange={setSelectedEnrollmentId}
                  placeholder="Search enrollments…"
                  disabled={loadingEnrollments}
                  loading={loadingEnrollments}
                />
              </div>

              <div className="col-12 col-lg-4">
                <SearchableSelect
                  label={<span>Subject <span className="text-muted">(filtered by grade level)</span></span>}
                  options={subjectOptions}
                  value={selectedSubjectId}
                  onChange={setSelectedSubjectId}
                  placeholder="Search subjects…"
                  disabled={!selectedEnrollmentId || loadingSubjects}
                  loading={loadingSubjects}
                />
              </div>

              <div className="col-12 col-lg-4">
                <label className="form-label">Grading Period</label>
                <select
                  className="form-select"
                  value={gradingPeriod}
                  onChange={(e) => setGradingPeriod(e.target.value)}
                  disabled={!selectedEnrollmentId}
                >
                  <option value="">— Select period —</option>
                  {GRADE_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <div className="form-text">Choose one of: 1st, 2nd, 3rd, or 4th grading.</div>
              </div>
            </div>

  {/* Grade input — expands to occupy free width */}
  <div className="col-12 col-lg">
    <label className="form-label">Grade</label>
    <input
      type="number"
      inputMode="numeric"
      className="form-control"
      placeholder="e.g., 89"
      min={0}
      max={100}
      step={1}
      value={gradeValue}
      onChange={(e) => setGradeValue(e.target.value)}
      disabled={!selectedEnrollmentId}
    />
    <div className="form-text">Enter a whole number from 0 to 100.</div>
  </div>

        
            {/* Row 4: ACTIONS */}
            <div className="row g-3 mt-3">
              <div className="col-12">
                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary" onClick={handleCancel} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting || loadingEnrollments || !selectedEnrollmentId}>
                    <FaSave className={submitting ? "me-2 spin" : "me-2"} />
                    {submitting ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* CURRENT GRADES TABLE (BELOW THE FORM)                               */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <div className="card shadow-sm border-0 mt-3">
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h6 className="mb-0">Current Grades {studentId ? <span className="text-muted">• Student #{studentId}</span> : null}</h6>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-light text-dark">Count: {grades?.length ?? 0}</span>
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={refreshGrades}
                disabled={!studentId || loadingGrades}
                title="Refresh grades"
              >
                <FaSync className={loadingGrades ? "me-1 spin" : "me-1"} />
                Refresh
              </button>
            </div>
          </div>

          {!selectedEnrollmentId ? (
            <div className="text-muted small">Select an enrollment to view the student’s current grades.</div>
          ) : loadingGrades ? (
            <div className="text-muted small">Loading grades…</div>
          ) : (grades?.length ?? 0) === 0 ? (
            <div className="text-muted small">No grades found for this student.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-striped align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{width: '26%'}}>Subject</th>
                    <th style={{width: '10%'}}>Period</th>
                    <th style={{width: '12%'}}>Grade</th>
                    <th style={{width: '18%'}}>Section</th>
                    <th style={{width: '18%'}}>Grade Level</th>
                    <th style={{width: '16%'}}>School Year</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => (
                    <tr key={g.grade_id}>
                      <td>
                        <div className="fw-semibold">{g?.subject?.subject_code ?? '—'}{g?.subject?.subject_code ? ' — ' : ''}{g?.subject?.subject_name ?? '—'}</div>
                      </td>
                      <td>{g?.grading_period ?? '—'}</td>
                      <td>{fmtGrade(g?.grade)}</td>
                      <td>{g?.section?.section_name ?? '—'}</td>
                      <td>{g?.grade_level ?? '—'}</td>
                      <td>{g?.school_year ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .dropdown-item.active, .dropdown-item:active { color: #fff; }
      `}</style>
    </div>
  );
}
