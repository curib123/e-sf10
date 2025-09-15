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
  FaSave,
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

// ────────────────────────────────────────────────────────────────────────────────
// Minimal async search dropdown for students (Bootstrap-only)
const StudentSearchSelect = ({
  token,
  value,                 // student_id
  onChange,              // (student_id, label, meta) => void
  initialLabel = "",
  placeholder = "Search LRN or name…",
  minChars = 2,
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
      } catch {/* ignore */} finally { setLoading(false); }
    };

    const t = setTimeout(doSearch, 300);
    return () => clearTimeout(t);
  }, [query, minChars, token]);

  const pick = (it) => {
    const label = `${it.last_name}, ${it.first_name}${it.middle_name ? " " + it.middle_name : ""}`;
    onChange(String(it.student_id), label, it);
    setQuery(label); setOpen(false); setTouched(false);
  };

  const clear = () => {
    setQuery(""); onChange("", "", null); setItems([]); setOpen(false); setTouched(true); inputRef.current?.focus();
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
          onChange={(e) => { setQuery(e.target.value); setTouched(true); }}
          onFocus={() => { if (items.length) setOpen(true); }}
          autoComplete="off"
        />
        {query ? (
          <button type="button" className="btn btn-outline-secondary" onClick={clear}>Clear</button>
        ) : null}
      </div>

      {open && (
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
                  <strong>{`${it.last_name}, ${it.first_name}${it.middle_name ? " " + it.middle_name : ""}`}</strong>
                  {it.lrn ? <span className="text-muted">[{it.lrn}]</span> : null}
                </div>
                <small className="text-muted">
                  {it.gender || "—"} • {it.date_of_birth ? new Date(it.date_of_birth).toLocaleDateString() : "—"}
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
// Enrollment Upsert — SY/Curriculum/Date/Status are AUTO (hidden)
// Exactly 3 inputs: Student (top), Grade Level + Section (bottom)
const EnrollmentUpsert = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { search } = useLocation();
  const qs = new URLSearchParams(search);

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const inFlight = useRef(false);

  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "info" });
  const showModal = (variant, title, message) => setModal({ show: true, title, message, variant });

  // Data buckets
  const [gradeLevels, setGradeLevels] = useState([]);  // grade_level_id, grade_name, grade_order
  const [activeEnrollments, setActiveEnrollments] = useState([]); // from /enrollments/active-enrollments

  // Sections are fetched ONLY when grade is selected:
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

  // Primary: Active curriculum (gives us active school_year_id + curriculum)
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

  // Fallback: get active SY from /school-year/all-school-years if needed
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

        // 3) If editing, load enrollment (we keep status; autos still apply)
        if (isEdit && id) {
          const data = await fetchEnrollment(id);
          if (cancelled) return;
          if (data) {
            setForm((prev) => ({
              ...prev,
              student_id: String(data.student_id ?? prev.student_id ?? ""),
              grade_level_id: String(data.grade_level_id ?? prev.grade_level_id ?? ""),
              section_id: String(data.section_id ?? prev.section_id ?? ""),
              status: String(data.status ?? prev.status ?? DEFAULT_STATUS),
            }));
            setStudentLabel(data.student_name || "");
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
  }, [id, isEdit, token]);

  // Helpers
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Find next grade for a given current grade_order
  const findNextGrade = (currentOrder) => {
    const higher = gradeLevels
      .filter(g => Number(g.grade_order) > Number(currentOrder))
      .sort((a, b) => Number(a.grade_order) - Number(b.grade_order));
    return higher[0] || null;
  };

  // Is there an active enrollment for this student?
  const activeForStudent = useMemo(() => {
    if (!form.student_id) return null;
    return activeEnrollments.find(e => String(e.student_id) === String(form.student_id)) || null;
  }, [activeEnrollments, form.student_id]);

  // Final grade options:
  // - If student has active enrollment: ONLY the single next grade (by grade_order).
  // - Otherwise: ALL grade levels from /grade-levels.
  const gradeOptions = useMemo(() => {
    if (activeForStudent) {
      const current = gradeLevels.find(
        g => String(g.grade_level_id) === String(activeForStudent.grade_level_id)
      );
      if (!current) return [];
      const next = findNextGrade(current.grade_order);
      return next ? [next] : [];
    }
    return [...gradeLevels].sort((a, b) => Number(a.grade_order) - Number(b.grade_order));
  }, [gradeLevels, activeForStudent]);

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
        // filter by active school year + selected grade
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
      ["__grade_opts", gradeOptions.length === 0 ? "No available grade option for this student." : ""],
      ["__sections", sectionsForGrade.length === 0 ? "No sections for the selected grade under the active school year." : ""],
    ];
    for (const [key, msg] of required) {
      if (key.startsWith("__")) { if (msg) { showModal("warning", "Missing data", msg); return false; } }
      else if (!String(form[key] || "").trim()) { showModal("warning", "Missing field", msg); return false; }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || loading || inFlight.current) return;

    setLoading(true);
    inFlight.current = true;
    try {
      const payload = {
        student_id: Number(form.student_id),
        school_year_id: Number(autoInfo.school_year_id),   // ✅ ACTIVE SY
        grade_level_id: Number(form.grade_level_id),
        section_id: Number(form.section_id),
        curriculum_id: autoInfo.curriculum_id ? Number(autoInfo.curriculum_id) : undefined, // from active curriculum if present
        enrollment_date: todayYMD(),                       // AUTO: today
        status: form.status || DEFAULT_STATUS,             // AUTO: Enrolled
      };

      const path = isEdit ? `/enrollments/update/${id}` : `/enrollments/create`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      let js = {};
      try { js = await res.json(); } catch {}

      const ok = js?.success ?? res.ok;
      if (ok) {
        showModal("success", isEdit ? "Enrollment Updated" : "Enrollment Created", js?.message || "Success");
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

  // ---- UI ----
  return (
    <div className="container-xxl my-4">
      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          {/* Header */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
            <h4 className="fw-bold mb-0">{isEdit ? "Edit Enrollment" : "Create Enrollment"}</h4>
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
          </div>

          {/* Form — exactly 3 inputs: 1 top (Student), 2 bottom (Grade, Section) */}
          <form onSubmit={handleSubmit} className="row g-3 g-lg-4" noValidate>
            {/* Top: Student */}
            <div className="col-12">
              <label className="form-label fw-semibold">Student</label>
              <StudentSearchSelect
                token={token}
                value={form.student_id}
                initialLabel={studentLabel}
                onChange={(student_id, label/*, meta*/) => {
                  setField("student_id", student_id);
                  setStudentLabel(label || "");
                }}
              />
              <div className="form-text">Type at least 2 characters (LRN or name) to search.</div>
            </div>

            {/* Bottom: Grade Level + Section */}
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">
                Grade Level {activeForStudent ? <span className="badge text-bg-dark ms-2">Next grade only</span> : null}
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
                {activeForStudent
                  ? "Student has an active enrollment — only the immediate next grade is allowed."
                  : "No active enrollment — showing all available grade levels."}
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
                {loading && <span className="spinner-border spinner-border-sm" role="status" />}
                <FaSave /> {isEdit ? "Save Changes" : "Create Enrollment"}
              </button>
            </div>
          </form>
        </div>
      </div>

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
