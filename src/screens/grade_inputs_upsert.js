// src/screens/grade_input_by_teacher.jsx
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

const safeStorage = (() => {
  try { return (window.storage || window.sessionStorage); } catch { return null; }
})();

const getTeacherId = () => {
  try {
    const tid = safeStorage?.getItem("teacher_id");
    return tid ? String(tid) : "";
  } catch { return ""; }
};

// ─────────────────────────────────────────────────────────────────────────────
// Reusable: SearchableSelect (same UX you already use)
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
// Component: GradeInputByTeacher (driven by /grades/teacher/:teacher_id)
// ─────────────────────────────────────────────────────────────────────────────
const GRADE_PERIODS = ["1st", "2nd", "3rd", "4th"];

export default function GradeInputByTeacher() {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const teacherId = useMemo(() => getTeacherId(), []);

  // Raw data from grades-by-teacher
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);

  // Selections
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [gradingPeriod, setGradingPeriod] = useState("");
  const [gradeValue, setGradeValue] = useState("");

  // UI
  const [submitting, setSubmitting] = useState(false);
  const [statusModal, setStatusModal] = useState({ show: false, variant: "info", title: "", message: "" });

  // Load: /grades/teacher/:teacher_id
  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    (async () => {
      try {
        if (!teacherId) {
          setStatusModal({
            show: true,
            variant: "warning",
            title: "Missing teacher id",
            message: "No teacher_id found in storage. Make sure you call storage.setItem('teacher_id', data.user?.user_id || '').",
          });
          setRows([]);
          return;
        }

        setLoadingRows(true);
        const res = await fetch(joinUrl(`/grades/teacher/${teacherId}`), {
          method: "GET",
          headers: headers(token),
          signal: ac.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
        if (!mounted) return;

        const list = Array.isArray(json?.data) ? json.data : [];
        setRows(list);
      } catch (err) {
        if (isAbort(err)) return;
        console.error(err);
        if (mounted) setStatusModal({ show: true, variant: "danger", title: "Load failed", message: String(err?.message || err) });
      } finally {
        if (mounted) setLoadingRows(false);
      }
    })();

    return () => { mounted = false; ac.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, token]);

  // Derived: students, subjects (per student), enrollments (per student)
  const students = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const s = r?.student;
      if (!s?.student_id) return;
      if (!map.has(s.student_id)) {
        // pick the "latest-looking" row label; keep simple
        const sec = r?.section?.section_name ?? "";
        const sy = r?.school_year ?? "";
        const sub = `${sec || "—"} • ${sy || "—"}`;
        map.set(s.student_id, {
          value: String(s.student_id),
          label: s.name || `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || `Student #${s.student_id}`,
          subtitle: sub
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }, [rows]);

  const studentEnrollments = useMemo(() => {
    if (!selectedStudentId) return [];
    const sid = Number(selectedStudentId);
    const map = new Map();
    rows.filter(r => r?.student?.student_id === sid).forEach(r => {
      const eid = r?.enrollment_id;
      if (!eid) return;
      if (!map.has(eid)) {
        const sec = r?.section?.section_name ?? "—";
        const sy  = r?.school_year ?? "—";
        const gl  = r?.grade_level ?? "—";
        map.set(eid, {
          value: String(eid),
          label: `${sec} • ${sy}`,
          subtitle: gl
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => Number(a.value) - Number(b.value));
  }, [rows, selectedStudentId]);

  const studentSubjects = useMemo(() => {
    if (!selectedStudentId) return [];
    const sid = Number(selectedStudentId);
    const map = new Map();
    rows.filter(r => r?.student?.student_id === sid).forEach(r => {
      const subj = r?.subject;
      if (!subj?.subject_id) return;
      if (!map.has(subj.subject_id)) {
        map.set(subj.subject_id, {
          value: String(subj.subject_id),
          label: subj.subject_name || subj.subject_code || `Subject #${subj.subject_id}`,
          subtitle: subj.subject_code || ""
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }, [rows, selectedStudentId]);

  // Auto-pick defaults when student changes
  useEffect(() => {
    setSelectedEnrollmentId("");
    setSelectedSubjectId("");
    setGradingPeriod("");
    setGradeValue("");

    if (!selectedStudentId) return;

    // Choose the first enrollment & subject if any
    const e0 = studentEnrollments[0]?.value;
    const s0 = studentSubjects[0]?.value;
    if (e0) setSelectedEnrollmentId(String(e0));
    if (s0) setSelectedSubjectId(String(s0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId]);

  // Current grades table (for selected student)
  const currentGrades = useMemo(() => {
    if (!selectedStudentId) return [];
    const sid = Number(selectedStudentId);
    return rows.filter(r => r?.student?.student_id === sid);
  }, [rows, selectedStudentId]);

  // Per-subject history (for quick reference under the subject select)
  const subjectHistory = useMemo(() => {
    if (!selectedStudentId || !selectedSubjectId) return [];
    const sid = Number(selectedStudentId);
    const subid = Number(selectedSubjectId);
    return rows
      .filter(r => r?.student?.student_id === sid && r?.subject?.subject_id === subid)
      .sort((a, b) => String(a.grading_period).localeCompare(String(b.grading_period)));
  }, [rows, selectedStudentId, selectedSubjectId]);

  const fmtGrade = (g) => {
    const n = Number(g);
    return Number.isFinite(n) ? n.toFixed(2) : String(g ?? "—");
  };

  const refreshRows = async () => {
    if (!teacherId) return;
    setLoadingRows(true);
    try {
      const res = await fetch(joinUrl(`/grades/teacher/${teacherId}`), {
        method: "GET",
        headers: headers(token),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      console.error(err);
      setStatusModal({ show: true, variant: "danger", title: "Refresh failed", message: String(err?.message || err) });
    } finally {
      setLoadingRows(false);
    }
  };

  // Submit
  const handleSubmit = async (e) => {
    e?.preventDefault?.();

    const eid = Number(selectedEnrollmentId) || null;
    const sid = Number(selectedSubjectId) || null;
    const period = gradingPeriod || "";
    const gradeNum = Number(gradeValue);

    if (!selectedStudentId) return setStatusModal({ show: true, variant: "warning", title: "Missing selection", message: "Please choose a student." });
    if (!eid) return setStatusModal({ show: true, variant: "warning", title: "Missing selection", message: "Please choose an enrollment (Section • SY)." });
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

      // Refresh the teacher view so the tables reflect the change
      await refreshRows();
    } catch (err) {
      if (isAbort(err)) return;
      console.error(err);
      setStatusModal({ show: true, variant: "danger", title: "Save failed", message: String(err?.message || err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => navigate(-1);

  // Options for selects
  const studentOptions = students;
  const enrollmentOptions = studentEnrollments;
  const subjectOptions = studentSubjects;

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
        <h5 className="mb-0">Create / Update Grade (by Teacher)</h5>
        <div className="btn-group">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => window.history.back()}>
            <FaTimes className="me-1" /> Close
          </button>
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={refreshRows}
            disabled={loadingRows}
          >
            <FaSync className={loadingRows ? "me-1 spin" : "me-1"} /> Refresh
          </button>
        </div>
      </div>

      {/* FORM CARD */}
      <div className="card shadow-sm border-0">
        <div className="card-body">
          {!teacherId ? (
            <div className="alert alert-warning mb-0">
              No <code>teacher_id</code> found. Make sure you’ve called:
              <pre className="mt-2 mb-0">storage.setItem("teacher_id", data.user?.user_id || "");</pre>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Row: Student / Enrollment / Subject */}
              <div className="row g-3">
                <div className="col-12 col-lg-4">
                  <SearchableSelect
                    label="Student"
                    options={studentOptions}
                    value={selectedStudentId}
                    onChange={setSelectedStudentId}
                    placeholder="Search students…"
                    disabled={loadingRows}
                    loading={loadingRows}
                  />
                </div>

                <div className="col-12 col-lg-4">
                  <SearchableSelect
                    label={<span>Enrollment <span className="text-muted">(Section • SY)</span></span>}
                    options={enrollmentOptions}
                    value={selectedEnrollmentId}
                    onChange={setSelectedEnrollmentId}
                    placeholder={selectedStudentId ? "Choose Section • SY…" : "Select a student first"}
                    disabled={!selectedStudentId || loadingRows}
                    loading={loadingRows}
                  />
                </div>

                <div className="col-12 col-lg-4">
                  <SearchableSelect
                    label="Subject"
                    options={subjectOptions}
                    value={selectedSubjectId}
                    onChange={setSelectedSubjectId}
                    placeholder={selectedStudentId ? "Search subjects…" : "Select a student first"}
                    disabled={!selectedStudentId || loadingRows}
                    loading={loadingRows}
                  />
                </div>
              </div>

              {/* Row: Period / Grade */}
              <div className="row g-3 mt-1">
                <div className="col-12 col-lg-4">
                  <label className="form-label">Grading Period</label>
                  <select
                    className="form-select"
                    value={gradingPeriod}
                    onChange={(e) => setGradingPeriod(e.target.value)}
                    disabled={!selectedStudentId}
                  >
                    <option value="">— Select period —</option>
                    {GRADE_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <div className="form-text">Choose one of: 1st, 2nd, 3rd, or 4th grading.</div>
                </div>

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
                    disabled={!selectedStudentId}
                  />
                  <div className="form-text">Enter a whole number from 0 to 100.</div>
                </div>
              </div>

              {/* Subject history (quick glance) */}
              {selectedStudentId && selectedSubjectId && (
                <div className="mt-3">
                  <div className="small text-muted mb-1">Existing grades for this subject:</div>
                  {subjectHistory.length === 0 ? (
                    <div className="small text-muted">No grades yet for this subject.</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{width: '20%'}}>Period</th>
                            <th style={{width: '20%'}}>Grade</th>
                            <th style={{width: '30%'}}>Section</th>
                            <th style={{width: '30%'}}>School Year</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjectHistory.map((g) => (
                            <tr key={`subhist-${g.grade_id}`}>
                              <td>{g?.grading_period ?? '—'}</td>
                              <td>{fmtGrade(g?.grade)}</td>
                              <td>{g?.section?.section_name ?? '—'}</td>
                              <td>{g?.school_year ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button type="button" className="btn btn-outline-secondary" onClick={handleCancel} disabled={submitting}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    submitting ||
                    loadingRows ||
                    !selectedStudentId ||
                    !selectedEnrollmentId ||
                    !selectedSubjectId ||
                    !gradingPeriod ||
                    gradeValue === ""
                  }
                >
                  <FaSave className={submitting ? "me-2 spin" : "me-2"} />
                  {submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* CURRENT GRADES TABLE (for selected student) */}
      <div className="card shadow-sm border-0 mt-3">
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h6 className="mb-0">
              Current Grades {selectedStudentId ? <span className="text-muted">• Student #{selectedStudentId}</span> : null}
            </h6>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-light text-dark">Count: {currentGrades?.length ?? 0}</span>
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={refreshRows}
                disabled={loadingRows}
                title="Refresh grades"
              >
                <FaSync className={loadingRows ? "me-1 spin" : "me-1"} />
                Refresh
              </button>
            </div>
          </div>

          {!selectedStudentId ? (
            <div className="text-muted small">Select a student to view their grades.</div>
          ) : loadingRows ? (
            <div className="text-muted small">Loading…</div>
          ) : (currentGrades?.length ?? 0) === 0 ? (
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
                  {currentGrades.map((g) => (
                    <tr key={g.grade_id}>
                      <td>
                        <div className="fw-semibold">
                          {g?.subject?.subject_code ?? '—'}{g?.subject?.subject_code ? ' — ' : ''}{g?.subject?.subject_name ?? '—'}
                        </div>
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
