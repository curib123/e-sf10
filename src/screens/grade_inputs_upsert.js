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
const BASE_URL = process.env.REACT_APP_API_BASE_URL; // should already include /esf10
const joinUrl = (path = "") => `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

const headers = (token) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const isAbort = (err) => err && (err.name === "AbortError" || String(err).includes("aborted"));
const GRADE_PERIODS = ["1st", "2nd", "3rd", "4th"];

// small utilities
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const serverMessage = async (res) => {
  try { const j = await res.json(); return j?.message || j?.error || res.statusText; }
  catch { return res.statusText; }
};
const currentGradeFor = (subjectId, gradingPeriod, subjects) => {
  const subj = subjects.find((s) => s.subject_id === subjectId);
  const g = subj?.grades?.find((x) => x.grading_period === gradingPeriod);
  return g?.grade ?? null;
};
const toPosInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Reusable: SearchableSelect (hard-capped to 5 visible results)
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
  const MAX_RESULTS = 5;

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

  const visible = useMemo(() => filtered.slice(0, MAX_RESULTS), [filtered]);

  useEffect(() => {
    const handle = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const selectAt = (idx) => {
    const opt = visible[idx];
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
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, visible.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); selectAt(activeIdx >= 0 ? activeIdx : 0); }
    else if (e.key === "Escape") { setOpen(false); }
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
          ) : visible.length === 0 ? (
            <div className="px-3 py-2 small text-muted">No matches</div>
          ) : (
            visible.map((o, idx) => (
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
      <div className="form-text">Showing up to 5 results. Type to filter; press Enter to select.</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page: Grade entry — powered by /grades/students/:teacher_id
// ─────────────────────────────────────────────────────────────────────────────
export default function GradeInputUpsert() {
  const navigate = useNavigate();
  const location = useLocation();

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const teacherId = useMemo(() => {
    const q = new URLSearchParams(location.search).get("teacher_id");
    return q || sessionStorage.getItem("teacher_id") || sessionStorage.getItem("user_id") || "";
  }, [location.search]);

  // Accept preselected student from state or ?student_id=
  const preselectStudentId = useMemo(() => {
    const qsId = new URLSearchParams(location.search).get("student_id");
    // location.state may be null on hard refresh
    const stId = location.state && location.state.studentId ? String(location.state.studentId) : "";
    return String(qsId || stId || "");
  }, [location.search, location.state]);

  // Entire bundle from the single endpoint
  const [students, setStudents] = useState([]);
  const [loadingBundle, setLoadingBundle] = useState(true);

  // Selection
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [gradingPeriod, setGradingPeriod] = useState("");

  // Derived student + subjects (from the bundle)
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [subjects, setSubjects] = useState([]);

  // Inputs
  const [inputsBySubject, setInputsBySubject] = useState({});

  // Saving state
  const [savingAll, setSavingAll] = useState(false);

  // UI status
  const [statusModal, setStatusModal] = useState({ show: false, variant: "info", title: "", message: "" });

  const handleUnauthorized = () => {
    sessionStorage.removeItem("token");
    setStatusModal({
      show: true,
      variant: "warning",
      title: "Session expired",
      message: "Please sign in again.",
    });
    setTimeout(() => navigate("/login"), 600);
  };

  // Load teacher’s full bundle (students + subjects + grades)
  const loadTeacherBundle = async (signal) => {
    if (!teacherId) { setLoadingBundle(false); setStudents([]); return; }
    try {
      setLoadingBundle(true);

      const url = joinUrl(`/grades/students/${teacherId}`);
      const res = await fetch(url, {
        method: "GET",
        headers: headers(token),
        signal,
      });

      // Log for debugging
      const headersObj = Object.fromEntries(res.headers.entries());
      let body;
      let json = null;
      try {
        json = await res.json();
        body = json;
      } catch {
        try { body = await res.text(); } catch { body = "(no body)"; }
      }
      console.log("[GET grades/students/:teacher_id]", { url, status: res.status, ok: res.ok, headers: headersObj, body });
      try { window.__lastGradesStudentsResponse = { url, status: res.status, ok: res.ok, headers: headersObj, body }; } catch {}

      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error(`Load failed (${res.status})`);

      const rows = Array.isArray(json?.data) ? json.data : [];
      setStudents(rows);
    } catch (err) {
      if (isAbort(err)) return;
      console.error(err);
      setStudents([]);
      setStatusModal({ show: true, variant: "danger", title: "Load failed", message: String(err?.message || err) });
    } finally {
      setLoadingBundle(false);
    }
  };

  useEffect(() => {
    const ac = new AbortController();
    (async () => { await loadTeacherBundle(ac.signal); })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, token]);

  // Apply preselect after bundle loaded (only once)
  const preselectAppliedRef = useRef(false);
  useEffect(() => {
    if (preselectAppliedRef.current) return;
    const id = String(preselectStudentId || "");
    if (!id) return;
    if (loadingBundle) return;
    if (!students.length) return;
    const exists = students.some(s => String(s.student_id) === id);
    if (exists) {
      setSelectedStudentId(id);
      preselectAppliedRef.current = true;
    }
  }, [preselectStudentId, loadingBundle, students]);

  // Keep selected student object
  useEffect(() => {
    const sid = Number(selectedStudentId) || null;
    setSelectedStudent(sid ? students.find((s) => Number(s.student_id) === sid) || null : null);
  }, [selectedStudentId, students]);

  // When selected student changes → derive subjects locally
  useEffect(() => {
    setInputsBySubject({});
    setSubjects(() => {
      const subs = Array.isArray(selectedStudent?.subjects) ? selectedStudent.subjects : [];

      const studentLevelEnrollmentId =
        toPosInt(selectedStudent?.enrollment_id) ||
        toPosInt(selectedStudent?.enrollment?.enrollment_id) ||
        toPosInt(selectedStudent?.current_enrollment_id) ||
        null;

      return subs.map((s) => ({
        subject_id: s.subject_id,
        subject_code: s.subject_code || "",
        subject_name: s.subject_name || `Subject #${s.subject_id}`,
        enrollment_id:
          toPosInt(s?.enrollment_id) ||
          toPosInt(s?.enrollment?.enrollment_id) ||
          studentLevelEnrollmentId ||
          null,
        grades: Array.isArray(s.grades) ? s.grades : [],
      }));
    });
  }, [selectedStudent]);

  // Prefill inputs for the chosen period from selectedStudent.subjects[].grades
  useEffect(() => {
    if (!gradingPeriod) { setInputsBySubject({}); return; }
    const next = {};
    for (const s of subjects) {
      const g = (s.grades || []).find((x) => x.grading_period === gradingPeriod);
      next[String(s.subject_id)] = g?.grade != null ? String(g.grade) : "";
    }
    setInputsBySubject(next);
  }, [subjects, gradingPeriod]);

  // Options for student dropdown
  const studentOptions = useMemo(
    () => students.map((s) => ({
      value: s.student_id,
      label: `${s.student_name ?? "(Unnamed)"} • ${s.section?.section_name ?? "?"} • ${s.school_year?.school_year ?? "?"}`,
      subtitle: `LRN: ${s.lrn ?? "—"} • Grade: ${s.grade_level?.grade_name ?? "—"}`,
    })),
    [students]
  );

  const onChangeGradeInput = (subjectId, val) => {
    const raw = val.trim();
    if (raw === "") {
      setInputsBySubject((prev) => ({ ...prev, [String(subjectId)]: "" }));
    } else {
      const n = Number(raw);
      if (!Number.isNaN(n)) {
        const clamped = Math.max(0, Math.min(100, Math.round(n)));
        setInputsBySubject((prev) => ({ ...prev, [String(subjectId)]: String(clamped) }));
      }
    }
  };

  // Refresh button: re-read bundle and reselect student
  const refreshBundle = async () => {
    const prevId = selectedStudentId;
    await loadTeacherBundle();
    if (prevId) setSelectedStudentId(prevId);
  };

  // Compute which subjects have valid entries (0–100) and changed values
  const toSave = useMemo(() => {
    if (!gradingPeriod) return [];
    const list = [];
    for (const s of subjects) {
      const raw = (inputsBySubject[String(s.subject_id)] ?? "").toString().trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 100) continue;
      const current = currentGradeFor(s.subject_id, gradingPeriod, subjects);
      if (Number(current) !== n) {
        list.push({
          subjectId: s.subject_id,
          newGrade: n,
          enrollmentId: toPosInt(s.enrollment_id) || null,
        });
      }
    }
    return list;
  }, [subjects, inputsBySubject, gradingPeriod]);

  const canSaveAll = !!selectedStudentId && !!gradingPeriod && toSave.length > 0 && !savingAll;

  // SAVE ALL
  const saveAll = async () => {
    if (!selectedStudentId) {
      return setStatusModal({ show: true, variant: "warning", title: "Missing student", message: "Please select a student." });
    }
    if (!gradingPeriod) {
      return setStatusModal({ show: true, variant: "warning", title: "Missing grading period", message: "Please choose 1st / 2nd / 3rd / 4th." });
    }
    if (toSave.length === 0) {
      return setStatusModal({ show: true, variant: "info", title: "Nothing to save", message: "No changes detected." });
    }

    const missing = toSave.filter(x => !toPosInt(x.enrollmentId));
    if (missing.length) {
      const names = missing.map(m => subjects.find(s => s.subject_id === m.subjectId)?.subject_name || `Subject #${m.subjectId}`);
      return setStatusModal({
        show: true,
        variant: "warning",
        title: "Missing enrollment ID",
        message: `These subject(s) have no enrollment_id and cannot be saved:\n• ${names.join("\n• ")}\n\nCheck the bundle payload for an 'enrollment_id' per subject or a student-level enrollment.`,
      });
    }

    const sid = Number(selectedStudentId);

    const gradeLevelId =
      toPosInt(selectedStudent?.grade_level_id) ||
      toPosInt(selectedStudent?.grade_level?.grade_level_id) ||
      null;
    const sectionId =
      toPosInt(selectedStudent?.section_id) ||
      toPosInt(selectedStudent?.section?.section_id) ||
      null;
    const schoolYearId =
      toPosInt(selectedStudent?.school_year_id) ||
      toPosInt(selectedStudent?.school_year?.school_year_id) ||
      null;

    setSavingAll(true);
    const successes = [];
    const failures = [];

    try {
      for (const item of toSave) {
        const payload = {
          student_id: sid,
          subject_id: Number(item.subjectId),
          grading_period: gradingPeriod,
          grade: Number(item.newGrade),
          enrollment_id: Number(item.enrollmentId),
          ...(gradeLevelId ? { grade_level_id: Number(gradeLevelId) } : {}),
          ...(sectionId ? { section_id: Number(sectionId) } : {}),
          ...(schoolYearId ? { school_year_id: Number(schoolYearId) } : {}),
        };

        let attempt = 0;
        let done = false;
        let lastErr = "";

        while (!done && attempt < 3) {
          attempt++;
          try {
            const res = await fetch(joinUrl(`/grades/create-or-update`), {
              method: "POST",
              headers: headers(token),
              body: JSON.stringify(payload),
            });

            if (res.ok) {
              successes.push(item.subjectId);
              done = true;
            } else {
              const msg = await serverMessage(res);
              if ([408, 409, 425, 429, 500, 502, 503, 504].includes(res.status)) {
                lastErr = `${res.status}: ${msg}`;
                await wait(300 * attempt);
              } else {
                throw new Error(`${res.status}: ${msg}`);
              }
            }
          } catch (err) {
            lastErr = String(err?.message || err);
            if (attempt < 3) await wait(300 * attempt);
            else break;
          }
        }

        if (!done) failures.push({ subjectId: item.subjectId, message: lastErr || "Unknown error" });
      }

      if (successes.length) {
        const updated = subjects.map((s) => ({ ...s, grades: Array.isArray(s.grades) ? [...s.grades] : [] }));
        for (const subjectId of successes) {
          const subj = updated.find((x) => x.subject_id === subjectId);
          if (!subj) continue;
          const existing = subj.grades.find((g) => g.grading_period === gradingPeriod);
          const gradeNum = Number(inputsBySubject[String(subjectId)]);
          if (existing) existing.grade = gradeNum;
          else subj.grades.push({ grading_period: gradingPeriod, grade: gradeNum });
        }
        setSubjects(updated);
      }

      if (failures.length === 0) {
        setStatusModal({
          show: true,
          variant: "success",
          title: "All grades saved",
          message: `Saved ${successes.length} grade(s) successfully.`,
        });
      } else {
        const byName = (id) => subjects.find((s) => s.subject_id === id)?.subject_name || `Subject #${id}`;
        setStatusModal({
          show: true,
          variant: "warning",
          title: "Some grades couldn’t be saved",
          message:
            `Saved ${successes.length} of ${toSave.length}.\n\n` +
            failures.map((f) => `• ${byName(f.subjectId)} — ${f.message}`).join("\n"),
        });
      }
    } catch (err) {
      setStatusModal({
        show: true,
        variant: "danger",
        title: "Save failed",
        message: String(err?.message || err),
      });
    } finally {
      setSavingAll(false);
      await refreshBundle();
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
          <button className="btn btn-outline-secondary btn-sm" onClick={handleClose}>
            <FaTimes className="me-1" /> Close
          </button>
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={refreshBundle}
            disabled={!teacherId || loadingBundle}
            title="Reload students & grades"
          >
            {loadingBundle ? <span className="spinner-border spinner-border-sm me-2" /> : <FaSync className="me-1" />}
            {loadingBundle ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Top controls */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          {!teacherId ? (
            <div className="alert alert-warning mb-3">
              No <code>teacher_id</code> found. Provide it via <code>?teacher_id=</code> or store it in <code>sessionStorage.teacher_id</code>.
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
                  setGradingPeriod("");
                }}
                placeholder="Search students…"
                disabled={loadingBundle || !teacherId}
                loading={loadingBundle}
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
                {GRADE_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="form-text">Choose one: 1st, 2nd, 3rd, or 4th grading.</div>
            </div>
          </div>

          {selectedStudent ? (
            <div className="mt-3 small text-muted">
              <div><strong>Student:</strong> {selectedStudent.student_name} (LRN: {selectedStudent.lrn || '—'})</div>
              <div>
                <strong>Section:</strong> {selectedStudent.section?.section_name || '—'} •{" "}
                <strong>Grade Level:</strong> {selectedStudent.grade_level?.grade_name || '—'} •{" "}
                <strong>SY:</strong> {selectedStudent.school_year?.school_year || '—'}
              </div>
              {selectedStudent.general_average != null ? (
                <div><strong>General Average:</strong> {selectedStudent.general_average}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Subjects + Save All button */}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between">
            <h6 className="mb-0">Subjects</h6>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-light text-dark">
                Ready: {toSave.length} / {subjects.length}
              </span>
              <button
                className="btn btn-primary"
                onClick={saveAll}
                disabled={!canSaveAll}
                title="Save all entered grades"
              >
                {savingAll ? <span className="spinner-border spinner-border-sm me-2" /> : <FaSave className="me-2" />}
                {savingAll ? "Saving…" : "Save All Grades"}
              </button>
            </div>
          </div>

          <hr />

          {!selectedStudentId ? (
            <div className="text-muted small">Select a student to load their subjects.</div>
          ) : loadingBundle ? (
            <div className="text-muted small">Loading subjects…</div>
          ) : subjects.length === 0 ? (
            <div className="text-muted small">No subjects found for this student.</div>
          ) : !gradingPeriod ? (
            <div className="text-muted small">Pick a grading period to enter grades.</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '50%' }}>Subject</th>
                    <th style={{ width: '25%' }}>Code</th>
                    <th style={{ width: '25%' }}>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => {
                    const key = String(s.subject_id);
                    return (
                      <tr key={s.subject_id}>
                        <td className="fw-semibold">
                          {s.subject_name}
                          {/* <div className="small text-muted">enrollment_id: {s.enrollment_id || '—'}</div> */}
                        </td>
                        <td>{s.subject_code || '—'}</td>
                        <td style={{ maxWidth: 180 }}>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100}
                            step={1}
                            className="form-control"
                            placeholder="e.g., 88"
                            value={inputsBySubject[key] ?? ""}
                            onChange={(e) => onChangeGradeInput(s.subject_id, e.target.value)}
                            disabled={!gradingPeriod || savingAll}
                          />
                          <div className="form-text">0–100, whole number.</div>
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
    </div>
  );
}
