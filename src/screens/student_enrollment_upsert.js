import React, { useEffect, useMemo, useRef, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaArrowLeft, FaSave } from "react-icons/fa";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL; // already includes /esf10

// ---- Date helpers (UI <-> API) ----
const todayYMD = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const toDateInput = (isoOrYmd) => {
  if (!isoOrYmd) return "";
  const d = new Date(isoOrYmd);
  if (Number.isNaN(d.getTime())) return isoOrYmd; // assume already YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const toApiDate = (ymd) => (ymd ? ymd : "");

const STATUSES = ["Enrolled", "Pending", "Dropped", "Completed", "Cancelled"];

// ────────────────────────────────────────────────────────────────────────────────
// Minimal async "search dropdown" for students (Bootstrap-only, no lib deps)
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

  useEffect(() => {
    if (!touched) setQuery(initialLabel || "");
  }, [initialLabel, touched]);

  useEffect(() => {
    const q = query.trim();
    if (!touched || q.length < minChars) {
      setItems([]);
      return;
    }

    const doSearch = async () => {
      try {
        setLoading(true);
        if (abortRef.current) abortRef.current.abort();
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
      } catch {
        // swallow
      } finally {
        setLoading(false);
      }
    };

    const t = setTimeout(doSearch, 300);
    return () => clearTimeout(t);
  }, [query, minChars, token]);

  const pick = (it) => {
    const label = `${it.last_name}, ${it.first_name}${it.middle_name ? " " + it.middle_name : ""}`;
    onChange(String(it.student_id), label, it);
    setQuery(label);
    setOpen(false);
    setTouched(false);
  };

  const clear = () => {
    setQuery("");
    onChange("", "", null);
    setItems([]);
    setOpen(false);
    setTouched(true);
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
          onChange={(e) => { setQuery(e.target.value); setTouched(true); }}
          onFocus={() => { if (items.length) setOpen(true); }}
          autoComplete="off"
        />
        {query ? (
          <button type="button" className="btn btn-outline-secondary" onClick={clear}>
            Clear
          </button>
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

      <input type="hidden" value={value || ""} />
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────────
// Enrollment Upsert (Create/Update) — now with ID-based prefill + dependent Sections
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

  // Master lists
  const [schoolYears, setSchoolYears] = useState([]);  // only active
  const [sections, setSections] = useState([]);        // all sections (we'll filter by grade)
  const [curricula, setCurricula] = useState([]);      // only active
  const [gradeLevels, setGradeLevels] = useState([]);  // sorted by grade_order

  const [studentLabel, setStudentLabel] = useState("");

  // Prefill via querystring (IDs). Example:
  // ?student_id=1&school_year_id=2&grade_level_id=3§ion_id=9&curriculum_id=1&date=2025-08-27&status=Enrolled
  const prefill = useMemo(() => ({
    student_id: qs.get("student_id") || "",
    school_year_id: qs.get("school_year_id") || "",
    grade_level_id: qs.get("grade_level_id") || "",
    section_id: qs.get("section_id") || "",
    curriculum_id: qs.get("curriculum_id") || "",
    enrollment_date: qs.get("date") || "",
    status: qs.get("status") || "",
  }), [qs]);

  const [form, setForm] = useState({
    student_id: prefill.student_id || "",
    school_year_id: prefill.school_year_id || "",
    grade_level_id: prefill.grade_level_id || "",
    section_id: prefill.section_id || "",
    curriculum_id: prefill.curriculum_id || "",
    enrollment_date: prefill.enrollment_date || todayYMD(),
    status: prefill.status || "Enrolled",
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
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error("Unauthorized");
    }
    return res;
  };

  const fetchSchoolYearsActive = async () => {
    const res = await apiFetch(`/school-year/all-school-years`);
    if (!res.ok) throw new Error("Failed to fetch school years");
    const js = await res.json();
    const all = Array.isArray(js?.schoolYears) ? js.schoolYears : [];
    const active = all.filter(sy => Number(sy.is_active) === 1);
    return active.map((sy) => ({
      school_year_id: String(sy.school_year_id),
      label: `${sy.start_year}-${sy.end_year}`,
    }));
  };

  const fetchSections = async () => {
    const res = await apiFetch(`/sections`);
    if (!res.ok) throw new Error("Failed to fetch sections");
    const js = await res.json();
    // Expecting fields: section_id, section_name, grade_level_id (used for filtering)
    const arr = Array.isArray(js?.data) ? js.data : [];
    return arr.map((s) => ({
      section_id: String(s.section_id),
      section_name: s.section_name ?? `Section ${s.section_id}`,
      grade_level_id: String(s.grade_level_id ?? ""), // important for filtering
    }));
  };

  const fetchCurriculaActive = async () => {
    const res = await apiFetch(`/curriculum/active-curriculums`);
    if (!res.ok) throw new Error("Failed to fetch active curriculums");
    const js = await res.json();
    return (Array.isArray(js?.data) ? js.data : []).map((c) => ({
      curriculum_id: String(c.curriculum_id),
      curriculum_name: c.curriculum_name,
    }));
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
      }));
  };

  const fetchEnrollment = async (enrollmentId) => {
    const res = await apiFetch(`/enrollments/${enrollmentId}`);
    if (!res.ok) throw new Error("Failed to fetch enrollment");
    const js = await res.json();
    return js?.data || null;
  };

  // ---- Init ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setInitializing(true);
        const [sysActive, sects, currsActive, grades] = await Promise.all([
          fetchSchoolYearsActive(),
          fetchSections(),
          fetchCurriculaActive(),
          fetchGradeLevels(),
        ]);
        if (!cancelled) {
          setSchoolYears(sysActive);
          setSections(sects);
          setCurricula(currsActive);
          setGradeLevels(grades);
        }

        // If editing, enrollment data wins over query prefill
        if (isEdit && id) {
          const data = await fetchEnrollment(id);
          if (data && !cancelled) {
            setForm((prev) => ({
              ...prev,
              student_id: String(data.student_id ?? prev.student_id ?? ""),
              school_year_id: String(data.school_year_id ?? prev.school_year_id ?? ""),
              grade_level_id: String(data.grade_level_id ?? prev.grade_level_id ?? ""),
              section_id: String(data.section_id ?? prev.section_id ?? ""),
              curriculum_id: String(data.curriculum_id ?? prev.curriculum_id ?? ""),
              enrollment_date: toDateInput(data.enrollment_date) || prev.enrollment_date || todayYMD(),
              status: data.status ?? prev.status ?? "Enrolled",
            }));
            setStudentLabel(data.student_name || "");
          }
        }
      } catch (err) {
        if (err?.message !== "Unauthorized") showModal("danger", "Load error", err?.message || "Something went wrong.");
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit, token]);

  // ---- Derived: sections filtered by grade_level_id ----
  const filteredSections = useMemo(() => {
    if (!form.grade_level_id) return sections;
    return sections.filter((s) => String(s.grade_level_id) === String(form.grade_level_id));
  }, [sections, form.grade_level_id]);

  // If grade level changes and current section doesn't belong, clear it
  useEffect(() => {
    if (!form.section_id) return;
    const stillValid = filteredSections.some((s) => String(s.section_id) === String(form.section_id));
    if (!stillValid) {
      setForm((f) => ({ ...f, section_id: "" }));
    }
  }, [form.grade_level_id, filteredSections]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Handlers ----
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const required = [
      ["student_id", "Student is required."],
      ["school_year_id", "School Year is required."],
      ["grade_level_id", "Grade Level is required."],
      ["section_id", "Section is required."],
      ["curriculum_id", "Curriculum is required."],
      ["enrollment_date", "Enrollment date is required."],
      ["status", "Status is required."],
    ];
    for (const [key, msg] of required) {
      if (!String(form[key] || "").trim()) {
        showModal("warning", "Missing field", msg);
        return false;
      }
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
        school_year_id: Number(form.school_year_id),
        grade_level_id: Number(form.grade_level_id),
        section_id: Number(form.section_id),
        curriculum_id: Number(form.curriculum_id),
        enrollment_date: toApiDate(form.enrollment_date), // YYYY-MM-DD
        status: form.status,
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="row g-3 g-lg-4" noValidate>
            {/* Row 1: Student + School Year (active only) */}
            <div className="col-12 col-md-6">
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

            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">School Year</label>
              <select
                className="form-select"
                value={form.school_year_id}
                onChange={(e) => setField("school_year_id", e.target.value)}
                required
              >
                <option value="" disabled>— Select active school year —</option>
                {schoolYears.map((sy) => (
                  <option key={sy.school_year_id} value={sy.school_year_id}>{sy.label}</option>
                ))}
              </select>
              <div className="form-text">Only active school years are listed.</div>
            </div>

            {/* Row 2: Grade Level + Section (sections filtered by grade) */}
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Grade Level</label>
              <select
                className="form-select"
                value={form.grade_level_id}
                onChange={(e) => setField("grade_level_id", e.target.value)}
                required
              >
                <option value="" disabled>— Select grade level —</option>
                {gradeLevels.map((g) => (
                  <option key={g.grade_level_id} value={g.grade_level_id}>
                    {g.grade_level_name}
                  </option>
                ))}
              </select>
              <div className="form-text">Sorted by grade order.</div>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Section</label>
              <select
                className="form-select"
                value={form.section_id}
                onChange={(e) => setField("section_id", e.target.value)}
                required
                disabled={!form.grade_level_id}
              >
                <option value="" disabled>
                  {form.grade_level_id ? "— Select section —" : "— Select a grade level first —"}
                </option>
                {filteredSections.map((s) => (
                  <option key={s.section_id} value={s.section_id}>{s.section_name}</option>
                ))}
              </select>
              <div className="form-text">
                {form.grade_level_id ? "Showing sections for the selected grade level." : "Pick a grade level to load its sections."}
              </div>
            </div>

            {/* Row 3: Curriculum (active only) + Date */}
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Curriculum</label>
              <select
                className="form-select"
                value={form.curriculum_id}
                onChange={(e) => setField("curriculum_id", e.target.value)}
                required
              >
                <option value="" disabled>— Select active curriculum —</option>
                {curricula.map((c) => (
                  <option key={c.curriculum_id} value={c.curriculum_id}>
                    {c.curriculum_name}
                  </option>
                ))}
              </select>
              <div className="form-text">Only active curricula are listed.</div>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Enrollment Date</label>
              <input
                type="date"
                className="form-control"
                value={form.enrollment_date}
                onChange={(e) => setField("enrollment_date", e.target.value)}
                required
              />
              <div className="form-text">Defaults to today ({todayYMD()}). Sent as <code>YYYY-MM-DD</code>.</div>
            </div>

            {/* Row 4: Status */}
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Status</label>
              <select
                className="form-select"
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                required
              >
                {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
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
