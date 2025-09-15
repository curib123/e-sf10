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
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import StatusModal from '../components/status_modal';

// ─────────────────────────────────────────────────────────────────────────────
// Config & helpers
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const joinUrl = (path = "") =>
  `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

const headers = (token) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const isAbort = (err) =>
  err && (err.name === "AbortError" || String(err).includes("aborted"));

const GRADE_PERIODS = ["1st", "2nd", "3rd", "4th"];

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
      [o.label, o.subtitle, o.code]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
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
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
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
        <div
          className="dropdown-menu show w-100 mt-1 p-0"
          style={{ maxHeight: 260, overflowY: "auto" }}
        >
          {loading ? (
            <div className="px-3 py-2 small text-muted">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 small text-muted">No matches</div>
          ) : (
            filtered.slice(0, 60).map((o, idx) => (
              <button
                key={o.value}
                type="button"
                className={`dropdown-item d-flex flex-column ${idx === activeIdx ? "active" : ""}`}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectAt(idx)}
              >
                <span>{o.label}</span>
                {o.subtitle ? (
                  <small className="text-muted">{o.subtitle}</small>
                ) : null}
              </button>
            ))
          )}
        </div>
      )}
      <div className="form-text">
        Start typing to filter, then hit Enter or click to select.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page: Grade entry by Teacher → Student → Period → Subjects list (per-row save)
// ─────────────────────────────────────────────────────────────────────────────
export default function GradeInputUpsert() {
  const navigate = useNavigate();
  const location = useLocation();

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const teacherId = useMemo(() => {
    const q = new URLSearchParams(location.search).get("teacher_id");
    return (
      q ||
      sessionStorage.getItem("teacher_id") ||
      sessionStorage.getItem("user_id") ||
      ""
    );
  }, [location.search]);

  // Students (for this teacher)
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Selection
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [gradingPeriod, setGradingPeriod] = useState("");

  // Derived from selected student
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [subjects, setSubjects] = useState([]); // subjects for that student's grade level
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Saved grades + inputs (for selected student & period)
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [existingGrades, setExistingGrades] = useState([]); // raw list from API
  const [inputsBySubject, setInputsBySubject] = useState({}); // { [subject_id]: "88" }
  const [savingBySubject, setSavingBySubject] = useState({}); // { [subject_id]: bool }
  const [savedTickBySubject, setSavedTickBySubject] = useState({}); // { [subject_id]: timestamp }

  // UI status
  const [statusModal, setStatusModal] = useState({
    show: false,
    variant: "info",
    title: "",
    message: "",
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Fetch Teacher's Students
  // GET /grades/students/:teacher_id
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    async function run() {
      if (!teacherId) {
        setLoadingStudents(false);
        return;
      }
      try {
        setLoadingStudents(true);
        const res = await fetch(joinUrl(`/grades/students/${teacherId}`), {
          method: "GET",
          headers: headers(token),
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`Students load failed (${res.status})`);
        const json = await res.json();
        if (!mounted) return;

        const list = Array.isArray(json?.data) ? json.data : [];
        setStudents(list);
      } catch (err) {
        if (isAbort(err)) return;
        console.error(err);
        if (mounted) {
          setStatusModal({
            show: true,
            variant: "danger",
            title: "Load failed",
            message: String(err?.message || err),
          });
        }
      } finally {
        if (mounted) setLoadingStudents(false);
      }
    }

    run();
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [teacherId, token]);

  // Selected student record
  useEffect(() => {
    const sid = Number(selectedStudentId) || null;
    setSelectedStudent(
      sid ? students.find((s) => Number(s.student_id) === sid) || null : null
    );
  }, [selectedStudentId, students]);

  // ───────────────────────────────────────────────────────────────────────────
  // When a student changes → fetch subjects for their grade level
  // Uses ONLY: GET /subjects/view-all-sub-grade-levels
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    async function fetchSubjectsForGradeLevel(gradeLevelId) {
      try {
        setLoadingSubjects(true);
        const res = await fetch(joinUrl(`/subjects/view-all-sub-grade-levels`), {
          method: "GET",
          headers: headers(token),
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`Subjects load failed (${res.status})`);
        const json = await res.json();
        if (!mounted) return;

        const rows = Array.isArray(json?.data) ? json.data : [];
        const match = rows.find(
          (r) => Number(r.grade_level_id) === Number(gradeLevelId)
        );
        const subs = Array.isArray(match?.subjects) ? match.subjects : [];
        // Normalize shape: ensure subject_id, subject_code, subject_name are present
        const mapped = subs.map((s) => ({
          subject_id: s.subject_id,
          subject_code: s.subject_code || "",
          subject_name: s.subject_name || `Subject #${s.subject_id}`,
        }));
        setSubjects(mapped);
      } catch (err) {
        if (isAbort(err)) return;
        console.error(err);
        if (mounted) {
          setSubjects([]);
          setStatusModal({
            show: true,
            variant: "danger",
            title: "Subjects load failed",
            message: String(err?.message || err),
          });
        }
      } finally {
        if (mounted) setLoadingSubjects(false);
      }
    }

    // Reset whenever student changes
    setSubjects([]);
    setInputsBySubject({});
    setSavedTickBySubject({});
    setExistingGrades([]);

    const glId =
      selectedStudent?.grade_level?.grade_level_id ||
      selectedStudent?.grade_level_id ||
      null;

    if (glId) fetchSubjectsForGradeLevel(glId);
  }, [selectedStudent, token]);

  // ───────────────────────────────────────────────────────────────────────────
  // Load existing grades for this student (all periods), then prefill inputs
  // GET /grades/student/:student_id
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    async function fetchExistingGrades(studentId) {
      try {
        setLoadingGrades(true);
        const res = await fetch(joinUrl(`/grades/student/${studentId}`), {
          method: "GET",
          headers: headers(token),
          signal: ac.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || `Grades load failed (${res.status})`);
        if (!mounted) return;

        const list = Array.isArray(json?.data) ? json.data : [];
        setExistingGrades(list);
      } catch (err) {
        if (isAbort(err)) return;
        console.error(err);
        if (mounted) {
          setExistingGrades([]);
          setStatusModal({
            show: true,
            variant: "danger",
            title: "Grades load failed",
            message: String(err?.message || err),
          });
        }
      } finally {
        if (mounted) setLoadingGrades(false);
      }
    }

    // Reset when student or period changes
    setInputsBySubject({});
    setSavedTickBySubject({});

    const sid = Number(selectedStudentId) || null;
    if (sid) fetchExistingGrades(sid);
  }, [selectedStudentId, token]);

  // Prefill inputs whenever (subjects OR existingGrades OR gradingPeriod) changes
  useEffect(() => {
    if (!gradingPeriod) {
      setInputsBySubject({});
      return;
    }
    // Build an index of saved grades for the selected period
    const index = {};
    for (const g of existingGrades) {
      const sid = g.subject_id || g.subject?.subject_id;
      if (!sid) continue;
      const gp = g.grading_period;
      if (gp === gradingPeriod) index[String(sid)] = g.grade ?? "";
    }

    const nextInputs = {};
    for (const s of subjects) {
      const key = String(s.subject_id);
      nextInputs[key] = index[key] != null ? String(index[key]) : "";
    }
    setInputsBySubject(nextInputs);
  }, [subjects, existingGrades, gradingPeriod]);

  // Options for the Student selector (limited to this teacher)
  const studentOptions = useMemo(
    () =>
      students.map((s) => ({
        value: s.student_id,
        label: `${s.student_name ?? "(Unnamed)"} • ${s.section?.section_name ?? "?"} • ${s.school_year?.school_year ?? "?"}`,
        subtitle: `LRN: ${s.lrn ?? "—"}`,
      })),
    [students]
  );

  const onChangeGradeInput = (subjectId, val) => {
    setInputsBySubject((prev) => ({ ...prev, [String(subjectId)]: val }));
  };

  const refreshGrades = async () => {
    const sid = Number(selectedStudentId) || null;
    if (!sid) return;
    try {
      setLoadingGrades(true);
      const res = await fetch(joinUrl(`/grades/student/${sid}`), {
        method: "GET",
        headers: headers(token),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || `Grades refresh failed (${res.status})`);
      const list = Array.isArray(json?.data) ? json.data : [];
      setExistingGrades(list);
    } catch (err) {
      console.error(err);
      setStatusModal({
        show: true,
        variant: "danger",
        title: "Refresh failed",
        message: String(err?.message || err),
      });
    } finally {
      setLoadingGrades(false);
    }
  };

  const saveOne = async (subjectId) => {
    const sid = Number(selectedStudentId) || null;
    const gp = gradingPeriod || "";
    const raw = inputsBySubject[String(subjectId)];
    const n = Number(raw);

    if (!sid)
      return setStatusModal({
        show: true,
        variant: "warning",
        title: "Missing student",
        message: "Please select a student.",
      });

    if (!gp)
      return setStatusModal({
        show: true,
        variant: "warning",
        title: "Missing grading period",
        message: "Please choose 1st / 2nd / 3rd / 4th.",
      });

    if (!Number.isFinite(n) || n < 0 || n > 100)
      return setStatusModal({
        show: true,
        variant: "warning",
        title: "Invalid grade",
        message: "Enter a number between 0 and 100.",
      });

    try {
      setSavingBySubject((m) => ({ ...m, [String(subjectId)]: true }));

      // We post by student_id (since we're not using Enrollment dropdown anymore).
      // If your backend expects enrollment_id, adjust here accordingly.
      const body = {
        student_id: sid,
        subject_id: Number(subjectId),
        grading_period: gp,
        grade: n,
      };

      // Extra context (optional; backend may ignore):
      if (selectedStudent?.section?.section_id)
        body.section_id = selectedStudent.section.section_id;
      const glId =
        selectedStudent?.grade_level?.grade_level_id ||
        selectedStudent?.grade_level_id;
      if (glId) body.grade_level_id = glId;
      if (selectedStudent?.school_year?.school_year_id)
        body.school_year_id = selectedStudent.school_year.school_year_id;

      const res = await fetch(joinUrl(`/grades/create-or-update`), {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(json?.message || `Save failed (${res.status})`);

      setSavedTickBySubject((m) => ({
        ...m,
        [String(subjectId)]: Date.now(),
      }));

      // Refresh saved grades then re-prefill inputs for consistency
      await refreshGrades();

      setStatusModal({
        show: true,
        variant: "success",
        title: "Saved",
        message: json?.message || "Grade saved successfully.",
      });
    } catch (err) {
      if (isAbort(err)) return;
      console.error(err);
      setStatusModal({
        show: true,
        variant: "danger",
        title: "Save failed",
        message: String(err?.message || err),
      });
    } finally {
      setSavingBySubject((m) => ({ ...m, [String(subjectId)]: false }));
    }
  };

  const handleClose = () => navigate(-1);

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
        <h5 className="mb-0">Grade Entry</h5>
        <div className="btn-group">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={handleClose}
          >
            <FaTimes className="me-1" />
            Close
          </button>
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={refreshGrades}
            disabled={!selectedStudentId || loadingGrades}
            title="Refresh grades"
          >
            <FaSync className={loadingGrades ? "me-1 spin" : "me-1"} />
            Refresh
          </button>
        </div>
      </div>

      {/* Top controls */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          {!teacherId ? (
            <div className="alert alert-warning mb-3">
              No <code>teacher_id</code> found. Provide it via query
              <code>?teacher_id=</code> or store it in{' '}
              <code>sessionStorage.teacher_id</code>.
            </div>
          ) : null}

          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <SearchableSelect
                label="Teacher’s Students"
                options={studentOptions}
                value={selectedStudentId}
                onChange={(v) => {
                  setSelectedStudentId(v);
                  setGradingPeriod(""); // reset period when switching student
                }}
                placeholder="Search students…"
                disabled={loadingStudents || !teacherId}
                loading={loadingStudents}
              />
            </div>

            <div className="col-12 col-lg-6">
              <label className="form-label">Grading Period</label>
              <select
                className="form-select"
                value={gradingPeriod}
                onChange={(e) => setGradingPeriod(e.target.value)}
                disabled={!selectedStudentId}
              >
                <option value="">— Select period —</option>
                {GRADE_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <div className="form-text">
                Choose one: 1st, 2nd, 3rd, or 4th grading.
              </div>
            </div>
          </div>

          {selectedStudent ? (
            <div className="mt-3 small text-muted">
              <div>
                <strong>Student:</strong> {selectedStudent.student_name} (LRN:{' '}
                {selectedStudent.lrn || '—'})
              </div>
              <div>
                <strong>Section:</strong>{' '}
                {selectedStudent.section?.section_name || '—'} •{' '}
                <strong>Grade Level:</strong>{' '}
                {selectedStudent.grade_level?.grade_name || '—'} •{' '}
                <strong>SY:</strong>{' '}
                {selectedStudent.school_year?.school_year || '—'}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Subjects list with per-row grade input + save */}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h6 className="mb-3">Subjects</h6>

          {!selectedStudentId ? (
            <div className="text-muted small">
              Select a student to load their subjects.
            </div>
          ) : loadingSubjects ? (
            <div className="text-muted small">Loading subjects…</div>
          ) : subjects.length === 0 ? (
            <div className="text-muted small">
              No subjects found for this student’s grade level in the active
              curriculum.
            </div>
          ) : !gradingPeriod ? (
            <div className="text-muted small">
              Pick a grading period to enter grades.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '40%' }}>Subject</th>
                    <th style={{ width: '20%' }}>Code</th>
                    <th style={{ width: '20%' }}>Grade</th>
                    <th style={{ width: '20%' }} className="text-end">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => {
                    const key = String(s.subject_id);
                    const saving = !!savingBySubject[key];
                    const savedTick = savedTickBySubject[key];

                    return (
                      <tr key={s.subject_id}>
                        <td className="fw-semibold">{s.subject_name}</td>
                        <td>{s.subject_code || '—'}</td>
                        <td style={{ maxWidth: 160 }}>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100}
                            step={1}
                            className="form-control"
                            placeholder="e.g., 88"
                            value={inputsBySubject[key] ?? ""}
                            onChange={(e) =>
                              onChangeGradeInput(s.subject_id, e.target.value)
                            }
                            disabled={!gradingPeriod || saving}
                          />
                          <div className="form-text">
                            0–100, whole number.
                          </div>
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-primary"
                            onClick={() => saveOne(s.subject_id)}
                            disabled={
                              saving ||
                              !gradingPeriod ||
                              !selectedStudentId ||
                              inputsBySubject[key] == null ||
                              String(inputsBySubject[key]).trim() === ""
                            }
                            title="Save grade"
                          >
                            <FaSave className={saving ? 'me-2 spin' : 'me-2'} />
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          {savedTick ? (
                            <div className="small text-success mt-1">Saved ✓</div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
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
