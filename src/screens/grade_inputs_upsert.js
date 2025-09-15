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
<<<<<<< HEAD
// Page: Grade entry by Teacher → Student → Period → Subjects list (per-row save)
// ─────────────────────────────────────────────────────────────────────────────
export default function GradeInputUpsert() {
=======
// Component: GradeInputByTeacher (driven by /grades/teacher/:teacher_id)
// ─────────────────────────────────────────────────────────────────────────────
const GRADE_PERIODS = ["1st", "2nd", "3rd", "4th"];

export default function GradeInputByTeacher() {
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
  const navigate = useNavigate();
  const location = useLocation();

  const token = useMemo(() => sessionStorage.getItem("token"), []);
<<<<<<< HEAD
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
=======
  const teacherId = useMemo(() => getTeacherId(), []);

  // Raw data from grades-by-teacher
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);

  // Selections
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
  const [gradingPeriod, setGradingPeriod] = useState("");

<<<<<<< HEAD
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
=======
  // UI
  const [submitting, setSubmitting] = useState(false);
  const [statusModal, setStatusModal] = useState({ show: false, variant: "info", title: "", message: "" });

  // Load: /grades/teacher/:teacher_id
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    async function run() {
      if (!teacherId) {
        setLoadingStudents(false);
        return;
      }
      try {
<<<<<<< HEAD
        setLoadingStudents(true);
        const res = await fetch(joinUrl(`/grades/students/${teacherId}`), {
=======
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
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
          method: "GET",
          headers: headers(token),
          signal: ac.signal,
        });
<<<<<<< HEAD
        if (!res.ok) throw new Error(`Students load failed (${res.status})`);
        const json = await res.json();
        if (!mounted) return;

        const list = Array.isArray(json?.data) ? json.data : [];
        setStudents(list);
=======
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
        if (!mounted) return;

        const list = Array.isArray(json?.data) ? json.data : [];
        setRows(list);
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
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
<<<<<<< HEAD
        if (mounted) setLoadingStudents(false);
=======
        if (mounted) setLoadingRows(false);
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
      }
    }

<<<<<<< HEAD
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
=======
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
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
        method: "GET",
        headers: headers(token),
      });
      const json = await res.json().catch(() => ({}));
<<<<<<< HEAD
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
=======
      if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      console.error(err);
      setStatusModal({ show: true, variant: "danger", title: "Refresh failed", message: String(err?.message || err) });
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
    } finally {
      setLoadingRows(false);
    }
  };

<<<<<<< HEAD
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
=======
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
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435

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
<<<<<<< HEAD
=======

      // Refresh the teacher view so the tables reflect the change
      await refreshRows();
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
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

<<<<<<< HEAD
=======
  // Options for selects
  const studentOptions = students;
  const enrollmentOptions = studentEnrollments;
  const subjectOptions = studentSubjects;

  // ───────────────────────────────────────────────────────────────────────────
  // UI
  // ───────────────────────────────────────────────────────────────────────────
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
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
<<<<<<< HEAD
        <h5 className="mb-0">Grade Entry</h5>
=======
        <h5 className="mb-0">Create / Update Grade (by Teacher)</h5>
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
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
<<<<<<< HEAD
            onClick={refreshGrades}
            disabled={!selectedStudentId || loadingGrades}
            title="Refresh grades"
          >
            <FaSync className={loadingGrades ? "me-1 spin" : "me-1"} />
            Refresh
=======
            onClick={refreshRows}
            disabled={loadingRows}
          >
            <FaSync className={loadingRows ? "me-1 spin" : "me-1"} /> Refresh
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
          </button>
        </div>
      </div>

      {/* Top controls */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          {!teacherId ? (
<<<<<<< HEAD
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
=======
            <div className="alert alert-warning mb-0">
              No <code>teacher_id</code> found. Make sure you’ve called:
              <pre className="mt-2 mb-0">storage.setItem("teacher_id", data.user?.user_id || "");</pre>
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
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

<<<<<<< HEAD
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
=======
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
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
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
<<<<<<< HEAD
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
=======
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
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
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
