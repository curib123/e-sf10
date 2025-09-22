// src/pages/EnrollmentUpsert.jsx
import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FaArrowLeft,
  FaCheck,
  FaEdit,
  FaHistory,
  FaInfoCircle,
  FaSave,
  FaSync,
} from 'react-icons/fa';
import {
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL; // already includes /esf10
const DEFAULT_STATUS = "Enrolled";

// ---- Date helpers ----
const todayYMD = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (String(d) === "Invalid Date") return "—";
  return d.toLocaleDateString();
};

// ────────────────────────────────────────────────────────────────────────────────
// Minimal async search dropdown for students (Bootstrap-only)
const StudentSearchSelect = ({
  token,
  value,                 // student_id
  onChange,              // (student_id, label, meta) => void
  initialLabel = "",
  placeholder = "Search LRN or name…",
  minChars = 2,
  readOnly = false,
}) => {
  const [query, setQuery] = useState(initialLabel || "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [touched, setTouched] = useState(false);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (!touched) setQuery(initialLabel || ""); }, [initialLabel, touched]);

  useEffect(() => {
    if (readOnly) return; // no searching in read-only mode
    const q = query.trim();
    if (!touched || q.length < minChars) { setItems([]); return; }

    const doSearch = async () => {
      try {
        setLoading(true);
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        const res = await fetch(
          `${BASE_URL}/students/search?query=${encodeURIComponent(q)}`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: abortRef.current.signal,
          }
        );
        if (!res.ok) throw new Error("Search failed");
        const js = await res.json();
        setItems(Array.isArray(js) ? js : []);
        setOpen(true);
      } catch { /* ignore */ } finally { setLoading(false); }
    };

    const t = setTimeout(doSearch, 300);
    return () => clearTimeout(t);
  }, [query, minChars, token, readOnly]);

  const buildLabel = (it) => {
    return `${it.last_name || ""}, ${it.first_name || ""}${it.middle_name ? " " + it.middle_name : ""}`.replace(/\s+/g, " ").trim();
  };

  const pick = (it) => {
    const label = buildLabel(it);
    onChange(String(it.student_id), label, it);
    setQuery(label); setOpen(false); setTouched(false);
  };

  const clear = () => {
    if (readOnly) return;
    setQuery("");
    onChange("", "", null);
    setItems([]); setOpen(false); setTouched(true);
    inputRef.current?.focus();
  };

  return (
    <div className="position-relative">
      <div className="input-group">
        <input
          ref={inputRef}
          type="text"
          className="form-control"
          placeholder={placeholder}
          value={query}
          readOnly={readOnly}
          onChange={(e) => { if (!readOnly) { setQuery(e.target.value); setTouched(true); } }}
          onFocus={() => { if (!readOnly && items.length) setOpen(true); }}
          autoComplete="off"
        />
        {!readOnly && query ? (
          <button type="button" className="btn btn-outline-secondary" onClick={clear}>Clear</button>
        ) : null}
      </div>

      {open && !readOnly && (
        <div className="dropdown-menu show w-100 mt-1 border shadow-sm" style={{ maxHeight: 280, overflowY: "auto" }}>
          {loading ? (
            <div className="dropdown-item text-muted small d-flex align-items-center gap-2">
              <span className="spinner-border spinner-border-sm" /> Searching…
            </div>
          ) : items.length === 0 ? (
            <div className="dropdown-item text-muted small">No matches</div>
          ) : (
            items.map((it) => (
              <button
                key={it.student_id}
                type="button"
                className="dropdown-item d-flex flex-column align-items-start"
                onClick={() => pick(it)}
              >
                <div className="d-flex w-100 justify-content-between">
                  <strong>{buildLabel(it)}</strong>
                  {it.lrn ? <span className="text-muted">[{it.lrn}]</span> : null}
                </div>
                <small className="text-muted">
                  {(it.gender || "—")} • {it.date_of_birth ? fmtDate(it.date_of_birth) : "—"}
                </small>
              </button>
            ))
          )}
        </div>
      )}

      <input type="hidden" value={value || ""} readOnly />
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────────
// Helper to build a student display label from many possible shapes
const studentLabelFrom = (src) => {
  if (!src) return "";
  if (typeof src === "string") return src;

  // Try common direct fields
  const direct =
    src.student_name ||
    src.student_full_name ||
    src.full_name ||
    src.name;
  if (direct) return String(direct);

  // Try nested: data.student.*
  const s = src.student ?? src;
  const ln = s.last_name ?? s.student_last_name ?? "";
  const fn = s.first_name ?? s.student_first_name ?? "";
  const mn = s.middle_name ?? s.student_middle_name ?? "";
  const left = String(ln).trim();
  const right = [String(fn).trim(), String(mn).trim()].filter(Boolean).join(" ");
  const both = [left, right].filter(Boolean).join(", ").trim();
  return both || "";
};

// ────────────────────────────────────────────────────────────────────────────────
// Enrollment Upsert — now auto-detects existing enrollments for the picked student
// and switches to UPDATE MODE (soft edit) + shows a table of previous enrollments.
const EnrollmentUpsert = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const routeEditId = id ? String(id) : "";
  const isEditByRoute = Boolean(routeEditId);
  const { search } = useLocation();
  const qs = new URLSearchParams(search);

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const inFlight = useRef(false);

  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "info" });
  const showModal = (variant, title, message) => setModal({ show: true, title, message, variant });

  // Data buckets
  const [gradeLevels, setGradeLevels] = useState([]);  // { grade_level_id, grade_level_name, grade_order }
  const [activeEnrollments, setActiveEnrollments] = useState([]); // from /enrollments/active-enrollments

  // Sections cache (per SY+Grade)
  const sectionsCacheRef = useRef(new Map()); // key: `${syId}:${gradeId}` -> array
  const [sectionsForGrade, setSectionsForGrade] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  // Auto context from active curriculum / active school year
  const [autoInfo, setAutoInfo] = useState({
    school_year_id: "",
    school_year_period: "",
    curriculum_id: "",
    curriculum_name: "",
  });

  const [studentLabel, setStudentLabel] = useState("");

  // Prefill (student/section only)
  const prefill = useMemo(() => ({
    student_id: qs.get("student_id") || "",
    section_id: qs.get("section_id") || "",
  }), [qs]);

  // Hidden status; visible inputs: student, grade, section
  const [form, setForm] = useState({
    student_id: prefill.student_id || "",
    grade_level_id: "",
    section_id: prefill.section_id || "",
    status: DEFAULT_STATUS,
  });

  // NEW: Loaded student details + enrollments list + soft edit target
  const [studentDetails, setStudentDetails] = useState(null);
  const [prevEnrolls, setPrevEnrolls] = useState([]); // array of enrollments from /students/:id/details
  const [softEditId, setSoftEditId] = useState("");   // when non-empty, we are in UPDATE MODE even on create route

  // ---- Auth + fetch helpers ----
  const authHeaders = () => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };
  const handleUnauthorized = () => {
    sessionStorage.removeItem("token");
    showModal("danger", "Unauthorized", "Please login to continue.");
    setTimeout(() => navigate("/login"), 900);
  };
  const apiFetch = async (path, options = {}) => {
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
    if (res.status === 401) { handleUnauthorized(); throw new Error("Unauthorized"); }
    return res;
  };

  const fetchGradeLevels = async () => {
    const res = await apiFetch(`/grade-levels`);
    if (!res.ok) throw new Error("Failed to fetch grade levels");
    const js = await res.json();
    const arr = Array.isArray(js?.data) ? js.data : [];
    return arr
      .slice()
      .sort((a, b) => Number(a.grade_order ?? 0) - Number(b.grade_order ?? 0))
      .map((g) => ({
        grade_level_id: String(g.grade_level_id),
        grade_level_name: g.grade_name ?? g.grade_code ?? `Grade ${g.grade_order ?? ""}`.trim(),
        grade_order: Number(g.grade_order ?? 0),
      }));
  };

  const fetchActiveEnrollmentList = async () => {
    const res = await apiFetch(`/enrollments/active-enrollments`);
    if (!res.ok) throw new Error("Failed to fetch active enrollments");
    const js = await res.json();
    return Array.isArray(js?.data) ? js.data : [];
  };

  const fetchActiveCurriculum = async () => {
    const res = await apiFetch(`/curriculum/active-curriculums`);
    if (!res.ok) throw new Error("Failed to fetch active curriculum");
    const js = await res.json();
    const d = js?.data;
    if (!d?.school_year_id) throw new Error("No active curriculum found");
    return {
      curriculum_id: d?.curriculum_id ? String(d.curriculum_id) : "",
      curriculum_name: d?.curriculum_name ?? "",
      school_year_id: String(d.school_year_id),
      school_year_period: d?.school_year_period ?? "",
    };
  };

  const fetchActiveSchoolYearFallback = async () => {
    const res = await apiFetch(`/school-year/all-school-years`);
    if (!res.ok) throw new Error("Failed to fetch school years");
    const js = await res.json();
    const list = Array.isArray(js?.schoolYears) ? js.schoolYears : [];
    const actives = list.filter((y) => Number(y.is_active) === 1);
    const chosen = (actives.length ? actives : list)
      .slice()
      .sort((a, b) => (b.start_year ?? 0) - (a.start_year ?? 0))[0];
    if (!chosen) throw new Error("No school years available");

    return {
      school_year_id: String(chosen.school_year_id),
      school_year_period:
        (chosen.start_year > 0 && chosen.end_year > 0)
          ? `${chosen.start_year}-${chosen.end_year}`
          : "",
    };
  };

  const fetchEnrollment = async (enrollmentId) => {
    const res = await apiFetch(`/enrollments/${enrollmentId}`);
    if (!res.ok) throw new Error("Failed to fetch enrollment");
    const js = await res.json();
    return js?.data || null;
  };

  const fetchStudentById = async (studentId) => {
    if (!studentId) return null;
    const res = await apiFetch(`/students/${studentId}`);
    if (!res.ok) throw new Error("Failed to fetch student");
    const js = await res.json();
    return js?.data || null;
  };

  // NEW: get richer details including enrollments
  const fetchStudentDetails = async (studentId) => {
    if (!studentId) return null;
    const res = await apiFetch(`/students/${studentId}/details`);
    if (!res.ok) throw new Error("Failed to fetch student details");
    const js = await res.json();
    return js?.student || js?.data || js || null;
  };

  // Fetch ALL sections once (only after grade is selected we’ll filter & cache)
  const fetchSectionsOnce = async () => {
    const res = await apiFetch(`/sections`);
    if (!res.ok) throw new Error("Failed to fetch sections");
    const js = await res.json();
    return Array.isArray(js?.data) ? js.data : [];
  };

  // ---- Init ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setInitializing(true);

        // 1) load grades + active enrollments in parallel
        const [grades, enrActive] = await Promise.all([
          fetchGradeLevels(),
          fetchActiveEnrollmentList(),
        ]);
        if (cancelled) return;
        setGradeLevels(grades);
        setActiveEnrollments(enrActive);

        // 2) resolve active School Year & Curriculum
        let active = null;
        try {
          active = await fetchActiveCurriculum(); // primary path
        } catch {
          const fb = await fetchActiveSchoolYearFallback(); // fallback path
          active = {
            school_year_id: fb.school_year_id,
            school_year_period: fb.school_year_period,
            curriculum_id: "",
            curriculum_name: "",
          };
        }
        if (cancelled) return;
        setAutoInfo(active);

        // 3) If editing by route, load enrollment, then auto-fill student label robustly
        if (isEditByRoute && routeEditId) {
          const data = await fetchEnrollment(routeEditId);
          if (cancelled) return;
          if (data) {
            setForm((prev) => ({
              ...prev,
              student_id: String(data.student_id ?? prev.student_id ?? ""),
              grade_level_id: String(data.grade_level_id ?? prev.grade_level_id ?? ""),
              section_id: String(data.section_id ?? prev.section_id ?? ""),
              status: String(data.status ?? prev.status ?? DEFAULT_STATUS),
            }));

            let label = studentLabelFrom(data?.student || data);
            if (!label && data?.student_id) {
              try {
                const s = await fetchStudentById(data.student_id);
                label = studentLabelFrom(s);
              } catch { /* ignore */ }
            }
            if (!cancelled) setStudentLabel(label || "");
          }
        }
      } catch (err) {
        if (err?.message !== "Unauthorized") {
          showModal("danger", "Load error", err?.message || "Something went wrong.");
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [routeEditId, isEditByRoute, token]);

  // If creating with ?student_id=, also prefill the visible label
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isEditByRoute) return;
      if (!prefill.student_id) return;
      if (studentLabel) return;
      try {
        const s = await fetchStudentById(prefill.student_id);
        if (!cancelled) setStudentLabel(studentLabelFrom(s) || "");
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditByRoute, prefill.student_id, studentLabel]);

  // Helpers
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Detect active enrollment list item for student (used only for CREATE flow restriction)
  const activeForStudent = useMemo(() => {
    if (!form.student_id) return null;
    return activeEnrollments.find(e => String(e.student_id) === String(form.student_id)) || null;
  }, [activeEnrollments, form.student_id]);

  // 🔎 When student changes, load details (enrollments); decide soft edit target
  useEffect(() => {
    let cancelled = false;

    const chooseTargetEnrollment = (enrolls) => {
      if (!enrolls?.length) return null;

      // Prefer one in the active school year
      const matchActive = enrolls.find(e =>
        String(e.school_year_id ?? "") === String(autoInfo.school_year_id || "")
      );

      if (matchActive) return matchActive;

      // Else pick the latest by enrollment_date/created_at, then by id
      const sorted = enrolls.slice().sort((a, b) => {
        const ad = new Date(a.enrollment_date || a.created_at || 0).getTime();
        const bd = new Date(b.enrollment_date || b.created_at || 0).getTime();
        if (bd !== ad) return bd - ad;
        return Number(b.enrollment_id || 0) - Number(a.enrollment_id || 0);
      });
      return sorted[0] || null;
    };

    (async () => {
      if (!form.student_id) {
        setStudentDetails(null);
        setPrevEnrolls([]);
        setSoftEditId("");
        return;
      }
      try {
        // fetch details (with enrollments)
        const details = await fetchStudentDetails(form.student_id).catch(() => null);
        if (cancelled) return;

        setStudentDetails(details);
        const enrolls =
          (details?.enrollments && Array.isArray(details.enrollments)) ? details.enrollments
            : (details?.student?.enrollments && Array.isArray(details.student.enrollments)) ? details.student.enrollments
            : [];

        setPrevEnrolls(enrolls);

        if (enrolls.length > 0 && !isEditByRoute) {
          // Soft UPDATE mode
          const target = chooseTargetEnrollment(enrolls);
          if (target?.enrollment_id) {
            setSoftEditId(String(target.enrollment_id));
            // prefill grade/section/status from the target
            const targetGradeId = String(target.grade_level_id ?? target.grade_level?.grade_level_id ?? "");
            const targetSectionId = String(target.section_id ?? target.section?.section_id ?? "");
            setForm(f => ({
              ...f,
              grade_level_id: targetGradeId || f.grade_level_id,
              section_id: targetSectionId || f.section_id,
              status: String(target.status ?? f.status ?? DEFAULT_STATUS),
            }));
            // make sure label is visible
            const label = studentLabelFrom(details) || studentLabel;
            if (label) setStudentLabel(label);
          } else {
            setSoftEditId("");
          }
        } else {
          setSoftEditId(""); // no previous enrollments or route-edit overrides soft-edit
        }
      } catch (err) {
        if (err?.message !== "Unauthorized") {
          // Not fatal; just no details
          setStudentDetails(null);
          setPrevEnrolls([]);
          setSoftEditId("");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [form.student_id, autoInfo.school_year_id, isEditByRoute]); // eslint-disable-line react-hooks/exhaustive-deps

  // Grade options logic:
  // - If editing (route or softEdit), allow ALL grade levels (we're updating an existing record).
  // - Else (pure create): if student has an active enrollment, restrict to immediate next grade; otherwise all.
  const isEditingNow = isEditByRoute || Boolean(softEditId);

  const gradeOptions = useMemo(() => {
    const sortedAll = [...gradeLevels].sort((a, b) => Number(a.grade_order) - Number(b.grade_order));
    if (isEditingNow) return sortedAll;

    if (form.student_id && activeForStudent) {
      const current = gradeLevels.find(
        g => String(g.grade_level_id) === String(activeForStudent.grade_level_id)
      );
      if (!current) return [];
      const higher = gradeLevels
        .filter(g => Number(g.grade_order) > Number(current.grade_order))
        .sort((a, b) => Number(a.grade_order) - Number(b.grade_order));
      return higher[0] ? [higher[0]] : [];
    }
    return sortedAll;
  }, [gradeLevels, activeForStudent, form.student_id, isEditingNow]);

  // Auto-pick/clear grade when gradeOptions change
  useEffect(() => {
    if (!gradeOptions.length) {
      setForm(f => ({ ...f, grade_level_id: "", section_id: "" }));
      setSectionsForGrade([]);
      return;
    }
    const hasCurrent = gradeOptions.some(g => String(g.grade_level_id) === String(form.grade_level_id));
    if (!hasCurrent) {
      if (gradeOptions.length === 1) {
        setForm(f => ({ ...f, grade_level_id: String(gradeOptions[0].grade_level_id), section_id: "" }));
      } else {
        // keep what user selected during soft edit load if still valid, else clear
        setForm(f => ({ ...f, grade_level_id: "", section_id: "" }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeOptions]);

  // 🔑 Fetch sections ONLY when grade is selected (and active SY is known)
  useEffect(() => {
    const syId = autoInfo.school_year_id;
    const gradeId = form.grade_level_id;
    if (!syId || !gradeId) {
      setSectionsForGrade([]);
      setSectionsLoading(false);
      return;
    }

    const key = `${syId}:${gradeId}`;
    const cached = sectionsCacheRef.current.get(key);
    if (cached) {
      setSectionsForGrade(cached);
      setSectionsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setSectionsLoading(true);
        const all = await fetchSectionsOnce(); // fetch after grade chosen
        const filtered = all
          .filter(s =>
            String(s.school_year_id) === String(syId) &&
            String(s.grade_level_id) === String(gradeId)
          )
          .map((s) => ({
            section_id: String(s.section_id),
            section_name: s.section_name ?? `Section ${s.section_id}`,
          }));
        if (cancelled) return;
        sectionsCacheRef.current.set(key, filtered);
        setSectionsForGrade(filtered);
      } catch (err) {
        if (err?.message !== "Unauthorized") {
          showModal("danger", "Load error", err?.message || "Failed to fetch sections.");
        }
        setSectionsForGrade([]);
      } finally {
        if (!cancelled) setSectionsLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoInfo.school_year_id, form.grade_level_id]);

  // Clear section if no longer valid when new list arrives
  useEffect(() => {
    if (!form.section_id) return;
    const stillValid = sectionsForGrade.some(s => String(s.section_id) === String(form.section_id));
    if (!stillValid) setForm(f => ({ ...f, section_id: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionsForGrade]);

  const validate = () => {
    const required = [
      ["student_id", "Student is required."],
      ["grade_level_id", "Grade Level is required."],
      ["section_id", "Section is required."],
      // Auto deps:
      ["__auto_sy", !autoInfo.school_year_id ? "Active School Year not found." : ""],
      ["__sections", sectionsForGrade.length === 0 ? "No sections for the selected grade under the active school year." : ""],
    ];
    for (const [key, msg] of required) {
      if (key.startsWith("__")) { if (msg) { showModal("warning", "Missing data", msg); return false; } }
      else if (!String(form[key] || "").trim()) { showModal("warning", "Missing field", msg); return false; }
    }
    return true;
  };

  // Load fields from a selected previous enrollment row
  const loadFromPrev = (row) => {
    if (!row) return;
    const targetGradeId = String(row.grade_level_id ?? row.grade_level?.grade_level_id ?? "");
    const targetSectionId = String(row.section_id ?? row.section?.section_id ?? "");
    setSoftEditId(String(row.enrollment_id || ""));
    setForm(f => ({
      ...f,
      grade_level_id: targetGradeId || f.grade_level_id,
      section_id: targetSectionId || f.section_id,
      status: String(row.status ?? f.status ?? DEFAULT_STATUS),
    }));
    showModal("info", "Update Mode", `Loaded enrollment #${row.enrollment_id} for editing.`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || loading || inFlight.current) return;

    setLoading(true);
    inFlight.current = true;
    try {
      const payload = {
        student_id: Number(form.student_id),
        school_year_id: Number(autoInfo.school_year_id),   // ACTIVE SY
        grade_level_id: Number(form.grade_level_id),
        section_id: Number(form.section_id),
        curriculum_id: autoInfo.curriculum_id ? Number(autoInfo.curriculum_id) : undefined, // from active curriculum if present
        enrollment_date: todayYMD(),                       // AUTO: today
        status: form.status || DEFAULT_STATUS,             // AUTO
      };

      // Decide endpoint:
      const effectiveEditId = isEditByRoute ? routeEditId : (softEditId || "");
      const path = effectiveEditId ? `/enrollments/update/${effectiveEditId}` : `/enrollments/create`;
      const method = effectiveEditId ? "PUT" : "POST";

      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      let js = {};
      try { js = await res.json(); } catch {}

      const ok = js?.success ?? res.ok;
      if (ok) {
        showModal("success", effectiveEditId ? "Enrollment Updated" : "Enrollment Created", js?.message || "Success");
        setTimeout(() => navigate("/enrollments"), 900);
      } else {
        showModal("danger", "Failed", js?.message || `Request failed (${res.status}).`);
      }
    } catch (err) {
      if (err.message !== "Unauthorized") showModal("danger", "Error", err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  // Derive student on-top badge text
  const studentBadge = useMemo(() => {
    if (!form.student_id) return null;
    const label = studentLabel || (studentDetails ? studentLabelFrom(studentDetails) : "");
    if (!label) return null;
    return `${label} (ID: ${form.student_id})`;
  }, [form.student_id, studentLabel, studentDetails]);

  // ---- UI ----
  return (
    <div className="container-xxl my-4">
      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          {/* Header */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
            <div className="d-flex flex-column">
              <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
                {isEditByRoute ? (
                  <>Edit Enrollment <span className="badge text-bg-dark">#{routeEditId}</span></>
                ) : (softEditId ? (
                  <>Update Enrollment <span className="badge text-bg-dark">#{softEditId}</span></>
                ) : (
                  <>Create Enrollment</>
                ))}
              </h4>
              {studentBadge && (
                <div className="text-muted small d-flex align-items-center gap-2">
                  <FaInfoCircle /> {studentBadge}
                </div>
              )}
            </div>
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn btn-light border d-flex align-items-center gap-2 px-3" onClick={() => navigate(-1)}>
                <FaArrowLeft /> Back
              </button>
            </div>
          </div>

          {/* Auto context summary (read-only) */}
          <div className="alert alert-secondary d-flex flex-wrap gap-2 align-items-center" role="alert">
            <span className="badge text-bg-dark">Auto</span>
            <span>School Year: <strong>{autoInfo.school_year_period || autoInfo.school_year_id || "…"}</strong></span>
            {autoInfo.curriculum_id ? (
              <>
                <span className="mx-1">•</span>
                <span>Curriculum: <strong>{autoInfo.curriculum_name || autoInfo.curriculum_id}</strong></span>
              </>
            ) : null}
            <span className="mx-1">•</span>
            <span>Enrollment Date: <strong>{todayYMD()}</strong></span>
            <span className="mx-1">•</span>
            <span>Status: <strong>{form.status || DEFAULT_STATUS}</strong></span>
            {softEditId && (
              <>
                <span className="mx-1">•</span>
                <span className="text-success d-flex align-items-center gap-1">
                  <FaCheck /> Update Mode (Existing enrollment detected)
                </span>
              </>
            )}
          </div>

          {/* Form — Student, Grade, Section */}
          <form onSubmit={handleSubmit} className="row g-3 g-lg-4" noValidate>
            {/* Top: Student */}
            <div className="col-12">
              <label className="form-label fw-semibold">Student</label>
              <StudentSearchSelect
                token={token}
                value={form.student_id}
                initialLabel={studentLabel}      // Auto-populates in edit / prefill
                readOnly={false}
                onChange={async (student_id, label/*, meta*/) => {
                  // reset per-student states
                  setSoftEditId("");
                  setPrevEnrolls([]);
                  setStudentDetails(null);

                  setField("student_id", student_id);
                  setStudentLabel(label || "");
                  // Also clear grade/section to force user awareness
                  setForm(f => ({ ...f, grade_level_id: "", section_id: "" }));
                }}
              />
              <div className="form-text">Type at least 2 characters (LRN or name) to search.</div>
            </div>

            {/* Bottom: Grade Level + Section */}
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">
                Grade Level {!isEditingNow && activeForStudent ? <span className="badge text-bg-dark ms-2">Next grade only</span> : null}
              </label>
              <select
                className="form-select"
                value={form.grade_level_id}
                onChange={(e) => setField("grade_level_id", e.target.value)}
                required
                disabled={!autoInfo.school_year_id || gradeOptions.length === 0}
              >
                <option value="" disabled>
                  {!autoInfo.school_year_id
                    ? "— Waiting for active school year —"
                    : (gradeOptions.length ? "— Select grade level —" : "— No grade option available —")}
                </option>
                {gradeOptions.map((g) => (
                  <option key={g.grade_level_id} value={g.grade_level_id}>
                    {g.grade_level_name}
                  </option>
                ))}
              </select>
              <div className="form-text">
                {isEditingNow
                  ? "Editing an existing enrollment — all grade levels are available."
                  : (activeForStudent
                      ? "Student has an active enrollment — only the immediate next grade is allowed."
                      : "No active enrollment — showing all available grade levels.")}
              </div>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Section</label>
              <select
                className="form-select"
                value={form.section_id}
                onChange={(e) => setField("section_id", e.target.value)}
                required
                disabled={
                  !autoInfo.school_year_id ||
                  !form.grade_level_id ||
                  sectionsLoading ||
                  sectionsForGrade.length === 0
                }
              >
                <option value="" disabled>
                  {!autoInfo.school_year_id
                    ? "— Waiting for active school year —"
                    : (!form.grade_level_id
                        ? "— Select grade level first —"
                        : (sectionsLoading
                            ? "— Loading sections… —"
                            : (sectionsForGrade.length ? "— Select section —" : "— No sections for this grade —")))}
                </option>
                {sectionsForGrade.map((s) => (
                  <option key={s.section_id} value={s.section_id}>
                    {s.section_name}
                  </option>
                ))}
              </select>
              <div className="form-text">
                Sections are fetched only after you pick a grade (filtered by the active school year).
              </div>
            </div>

            {/* Actions */}
            <div className="col-12 d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-light border" onClick={() => navigate(-1)} disabled={loading || initializing}>
                Cancel
              </button>
              <button type="submit" className="btn btn-dark d-flex align-items-center gap-2" disabled={loading || initializing}>
                {(loading || initializing) && <span className="spinner-border spinner-border-sm" role="status" />}
                <FaSave /> {isEditingNow ? "Save Changes" : "Create Enrollment"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Previous Enrollments table */}
      {form.student_id && prevEnrolls.length > 0 && (
        <div className="card border-0 shadow-sm rounded-4 mt-4">
          <div className="card-body p-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="fw-bold mb-0 d-flex align-items-center gap-2">
                <FaHistory /> Previous Enrollments
              </h5>
              <span className="badge text-bg-secondary">{prevEnrolls.length}</span>
            </div>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{whiteSpace:'nowrap'}}>Enrollment #</th>
                    <th style={{whiteSpace:'nowrap'}}>School Year</th>
                    <th style={{whiteSpace:'nowrap'}}>Grade</th>
                    <th style={{whiteSpace:'nowrap'}}>Section</th>
                    <th style={{whiteSpace:'nowrap'}}>Status</th>
                    <th style={{whiteSpace:'nowrap'}}>Enrolled On</th>
                    <th style={{width:1}}></th>
                  </tr>
                </thead>
                <tbody>
                  {prevEnrolls.map((e) => {
                    const eid = e.enrollment_id;
                    const sy = e.school_year_period || e.school_year?.period || e.school_year?.name || e.school_year_id || "—";
                    const gradeName =
                      e.grade_level?.grade_name ??
                      e.grade_level?.grade_code ??
                      e.grade_name ??
                      (e.grade_level_id ? `Grade ${e.grade_level_id}` : "—");
                    const sectionName = e.section?.section_name ?? e.section_name ?? e.section_id ?? "—";
                    const status = e.status || "—";
                    const date = fmtDate(e.enrollment_date || e.created_at);
                    const isLoaded = String(softEditId || routeEditId) === String(eid);
                    return (
                      <tr key={eid}>
                        <td>#{eid}</td>
                        <td>{sy}</td>
                        <td>{gradeName}</td>
                        <td>{sectionName}</td>
                        <td>{status}</td>
                        <td>{date}</td>
                        <td className="text-end">
                          <div className="btn-group">
                            <button
                              type="button"
                              className={`btn btn-sm ${isLoaded ? "btn-success" : "btn-outline-secondary"}`}
                              onClick={() => loadFromPrev(e)}
                              title="Load this enrollment for editing"
                            >
                              {isLoaded ? <FaCheck /> : <FaEdit />} {isLoaded ? "Loaded" : "Load"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-muted small d-flex align-items-center gap-2">
              <FaSync /> Tip: Click <em>Load</em> to switch which existing enrollment you’re updating.
            </div>
          </div>
        </div>
      )}

      {(loading || initializing) && (
        <div className="position-fixed bottom-0 start-50 translate-middle-x mb-3 px-3 py-2 d-inline-flex align-items-center gap-2 bg-body border rounded-pill shadow-sm">
          <span className="spinner-border spinner-border-sm" role="status" />
          <span>{initializing ? "Loading…" : "Processing…"}</span>
        </div>
      )}
    </div>
  );
};

export default EnrollmentUpsert;
