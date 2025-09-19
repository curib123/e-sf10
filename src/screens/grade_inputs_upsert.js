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
// Page: Grade entry — now powered solely by /grades/students/:teacher_id
// ─────────────────────────────────────────────────────────────────────────────
export default function GradeInputUpsert() {
  const navigate = useNavigate();
  const location = useLocation();

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const teacherId = useMemo(() => {
    const q = new URLSearchParams(location.search).get("teacher_id");
    return q || sessionStorage.getItem("teacher_id") || sessionStorage.getItem("user_id") || "";
  }, [location.search]);

  // Entire bundle from the single endpoint
  const [students, setStudents] = useState([]);
  const [loadingBundle, setLoadingBundle] = useState(true);

  // Selection
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [gradingPeriod, setGradingPeriod] = useState("");

  // Derived student + subjects (from the bundle)
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [subjects, setSubjects] = useState([]); // normalized from selectedStudent.subjects

  // Inputs + per-subject "Saved ✓"
  const [inputsBySubject, setInputsBySubject] = useState({}); // { [subject_id]: "88" }
  const [savedTickBySubject, setSavedTickBySubject] = useState({}); // { [subject_id]: ts }

  // Saving state
  const [savingAll, setSavingAll] = useState(false);

  // UI status
  const [statusModal, setStatusModal] = useState({ show: false, variant: "info", title: "", message: "" });

  // 401 handling
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

  // ───────────────────────────────────────────────────────────────────────────
  // Load teacher’s full bundle (students + subjects + grades)
  // ───────────────────────────────────────────────────────────────────────────
  const loadTeacherBundle = async (signal) => {
    if (!teacherId) { setLoadingBundle(false); setStudents([]); return; }
    try {
      setLoadingBundle(true);
      const res = await fetch(joinUrl(`/grades/students/${teacherId}`), {
        method: "GET",
        headers: headers(token),
        signal,
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const json = await res.json();
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
    let mounted = true;
    const ac = new AbortController();
    (async () => {
      await loadTeacherBundle(ac.signal);
      if (!mounted) return;

      // Optional: keep a previous selection via URL or state
    })();
    return () => { mounted = false; ac.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, token]);

  // Keep selected student object
  useEffect(() => {
    const sid = Number(selectedStudentId) || null;
    setSelectedStudent(sid ? students.find((s) => Number(s.student_id) === sid) || null : null);
  }, [selectedStudentId, students]);

  // When selected student changes → derive subjects locally
  useEffect(() => {
    setInputsBySubject({});
    setSavedTickBySubject({});
    setSubjects(() => {
      const subs = Array.isArray(selectedStudent?.subjects) ? selectedStudent.subjects : [];
      // normalize minimal shape for table
      return subs.map((s) => ({
        subject_id: s.subject_id,
        subject_code: s.subject_code || "",
        subject_name: s.subject_name || `Subject #${s.subject_id}`,
        grades: Array.isArray(s.grades) ? s.grades : [], // [{ grading_period, grade }]
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
  const studentOptions = useMemo(() =>
    students.map((s) => ({
      value: s.student_id,
      label: `${s.student_name ?? "(Unnamed)"} • ${s.section?.section_name ?? "?"} • ${s.school_year?.school_year ?? "?"}`,
      subtitle: `LRN: ${s.lrn ?? "—"} • Grade: ${s.grade_level?.grade_name ?? "—"}`,
    })), [students]);

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
    setSavedTickBySubject((prev) => {
      const copy = { ...prev };
      delete copy[String(subjectId)];
      return copy;
    });
  };

  // Refresh button now re-reads the single bundle and re-derives selected student
  const refreshBundle = async () => {
    const prevId = selectedStudentId;
    await loadTeacherBundle();
    // reselect to update nested grades/subjects view
    if (prevId) {
      // small delay not necessary; we can just set after state updates
      setSelectedStudentId(prevId);
    }
  };

  // Compute which subjects have valid entries (0–100)
  const filledValidSubjectIds = useMemo(() => {
    const ids = [];
    for (const s of subjects) {
      const raw = (inputsBySubject[String(s.subject_id)] ?? "").toString().trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0 && n <= 100) ids.push(s.subject_id);
    }
    return ids;
  }, [subjects, inputsBySubject]);

  const canSaveAll = !!selectedStudentId && !!gradingPeriod && filledValidSubjectIds.length > 0 && !savingAll;

  const saveAll = async () => {
    if (!selectedStudentId) {
      return setStatusModal({ show: true, variant: "warning", title: "Missing student", message: "Please select a student." });
    }
    if (!gradingPeriod) {
      return setStatusModal({ show: true, variant: "warning", title: "Missing grading period", message: "Please choose 1st / 2nd / 3rd / 4th." });
    }
    if (filledValidSubjectIds.length === 0) {
      return setStatusModal({ show: true, variant: "warning", title: "No grades to save", message: "Enter at least one valid grade (0–100)." });
    }

    const sid = Number(selectedStudentId);
    setSavingAll(true);

    try {
      const tasks = filledValidSubjectIds.map((subjectId) => {
        const n = Number(inputsBySubject[String(subjectId)]);
        const body = {
          student_id: sid,
          subject_id: Number(subjectId),
          grading_period: gradingPeriod,
          grade: n,
        }; // trimmed payload — extra ids removed as requested

        return fetch(joinUrl(`/grades/create-or-update`), {
          method: "POST",
          headers: headers(token),
          body: JSON.stringify(body),
        }).then(async (res) => {
          if (res.status === 401) { handleUnauthorized(); return { subjectId, ok: false, unauthorized: true }; }
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.message || `Save failed (${res.status})`);
          return { subjectId, ok: true };
        });
      });

      const results = await Promise.allSettled(tasks);

      let ok = 0, fail = 0;
      const failedMsgs = [];
      const savedMap = {};

      // Update local nested grades for instant feedback
      const updatedSubjects = subjects.map((s) => ({ ...s, grades: Array.isArray(s.grades) ? [...s.grades] : [] }));

      results.forEach((r, idx) => {
        const subjectId = filledValidSubjectIds[idx];
        if (r.status === "fulfilled" && r.value?.ok) {
          ok += 1;
          savedMap[String(subjectId)] = Date.now();

          // reflect change in local nested grades
          const subj = updatedSubjects.find((x) => x.subject_id === subjectId);
          if (subj) {
            const g = (subj.grades || []).find((x) => x.grading_period === gradingPeriod);
            const n = Number(inputsBySubject[String(subjectId)]);
            if (g) g.grade = n;
            else subj.grades = [...(subj.grades || []), { grading_period: gradingPeriod, grade: n }];
          }
        } else if (r.status === "fulfilled" && r.value?.unauthorized) {
          // handled by handleUnauthorized
        } else {
          fail += 1;
          const errMsg = r.reason?.message || "Unknown error";
          failedMsgs.push(`• ${subjects.find(s => s.subject_id === subjectId)?.subject_name || `Subject #${subjectId}`}: ${errMsg}`);
        }
      });

      setSavedTickBySubject((m) => ({ ...m, ...savedMap }));
      setSubjects(updatedSubjects); // reflect saved grades immediately

      setStatusModal({
        show: true,
        variant: fail ? "warning" : "success",
        title: fail ? "Partially saved" : "All grades saved",
        message: fail
          ? `Saved ${ok} of ${ok + fail} grade(s).\n\n${failedMsgs.join("\n")}`
          : `Saved ${ok} grade(s) successfully.`,
      });
    } catch (err) {
      console.error(err);
      setStatusModal({ show: true, variant: "danger", title: "Save failed", message: String(err?.message || err) });
    } finally {
      setSavingAll(false);
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
            <FaSync className={loadingBundle ? "me-1 spin" : "me-1"} /> Refresh
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
                  setGradingPeriod(""); // reset period when switching student
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

      {/* Subjects + single Save All button */}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between">
            <h6 className="mb-0">Subjects</h6>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-light text-dark">
                Ready: {filledValidSubjectIds.length} / {subjects.length}
              </span>
              <button
                className="btn btn-primary"
                onClick={saveAll}
                disabled={!canSaveAll}
                title="Save all entered grades"
              >
                <FaSave className={savingAll ? "me-2 spin" : "me-2"} />
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
                    <th style={{ width: '32%' }}>Subject</th>
                    <th style={{ width: '18%' }}>Code</th>
                    <th style={{ width: '24%' }}>Teacher</th>
                    <th style={{ width: '14%' }}>Grade</th>
                    <th style={{ width: '12%' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => {
                    const key = String(s.subject_id);
                    const savedTick = savedTickBySubject[key];
                    const teacherName = selectedStudent?.subjects?.find(x => x.subject_id === s.subject_id)?.teacher?.teacher_name ?? '—';

                    return (
                      <tr key={s.subject_id}>
                        <td className="fw-semibold">{s.subject_name}</td>
                        <td>{s.subject_code || '—'}</td>
                        <td>{teacherName?.trim() || '—'}</td>
                        <td style={{ maxWidth: 140 }}>
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
                        <td>
                          {savedTick ? <span className="text-success">Saved ✓</span> : <span className="text-muted">—</span>}
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
