import React, { useEffect, useMemo, useRef, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaSave } from "react-icons/fa";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

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
  value,                 // student_id (string|number)
  onChange,              // (student_id, label, meta) => void
  initialLabel = "",     // e.g., "Santos, Maria S."
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

  // keep label in sync when editing loads
  useEffect(() => {
    if (!touched) setQuery(initialLabel || "");
  }, [initialLabel, touched]);

  // search API
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
        // swallow (user typing fast / aborts)
      } finally {
        setLoading(false);
      }
    };

    const t = setTimeout(doSearch, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      {/* Dropdown */}
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

      {/* Hidden actual value (student_id) to cooperate with native validation if needed */}
      <input type="hidden" value={value || ""} />
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────────
// Enrollment Upsert (Create/Update) — grade level removed
const EnrollmentUpsert = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const inFlight = useRef(false);

  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "info" });
  const showModal = (variant, title, message) => setModal({ show: true, title, message, variant });

  // Master lists
  const [schoolYears, setSchoolYears] = useState([]);
  const [sections, setSections] = useState([]);
  const [curricula, setCurricula] = useState([]);

  // For student selector display when editing
  const [studentLabel, setStudentLabel] = useState("");

  // Form (no grade_level_id)
  const [form, setForm] = useState({
    student_id: "",
    school_year_id: "",
    section_id: "",
    curriculum_id: "",
    enrollment_date: todayYMD(), // default to system date
    status: "Enrolled",
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

  const fetchSchoolYears = async () => {
    const res = await apiFetch(`/school-year/all-school-years`);
    if (!res.ok) throw new Error("Failed to fetch school years");
    const js = await res.json();
    const list = Array.isArray(js?.schoolYears) ? js.schoolYears : [];
    return list.map((sy) => ({ school_year_id: sy.school_year_id, label: `${sy.start_year}-${sy.end_year}` }));
  };
  const fetchSections = async () => {
    const res = await apiFetch(`/sections`);
    if (!res.ok) throw new Error("Failed to fetch sections");
    const js = await res.json();
    return Array.isArray(js?.data) ? js.data : [];
  };
  const fetchCurriculaAll = async () => {
    // gather all pages even if API paginates
    const all = [];
    let page = 1, totalPages = 1;
    const limit = 100;
    do {
      const url = new URL(`${BASE_URL}/curriculum/view-all-curriculums`);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(limit));
      const res = await fetch(url.toString(), { headers: authHeaders() });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) throw new Error("Failed to fetch curriculums");
      const js = await res.json();
      all.push(...(Array.isArray(js?.data) ? js.data : []));
      totalPages = js?.pagination?.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages);
    return all;
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
        const [sys, sects, currs] = await Promise.all([
          fetchSchoolYears(),
          fetchSections(),
          fetchCurriculaAll(),
        ]);
        if (!cancelled) {
          setSchoolYears(sys);
          setSections(sects);
          setCurricula(currs);
        }
        if (isEdit && id) {
          const data = await fetchEnrollment(id);
          if (data && !cancelled) {
            setForm({
              student_id: String(data.student_id ?? ""),
              school_year_id: String(data.school_year_id ?? ""),
              section_id: String(data.section_id ?? ""),
              curriculum_id: String(data.curriculum_id ?? ""),
              enrollment_date: toDateInput(data.enrollment_date) || todayYMD(),
              status: data.status ?? "Enrolled",
            });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit, token]);

  // ---- Handlers ----
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const required = [
      ["student_id", "Student is required."],
      ["school_year_id", "School Year is required."],
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
        section_id: Number(form.section_id),
        curriculum_id: Number(form.curriculum_id),
        enrollment_date: toApiDate(form.enrollment_date), // YYYY-MM-DD
        status: form.status,
      };

      const path = isEdit ? `/enrollments/update/${id}` : `/enrollments/create`;
      const method = isEdit ? "PUT" : "POST";

      const res = await apiFetch(path, { method, body: JSON.stringify(payload) });
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
            {/* Row 1: Student (async search) + School Year */}
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
                <option value="" disabled>— Select year (e.g., 2024-2025) —</option>
                {schoolYears.map((sy) => (
                  <option key={sy.school_year_id} value={sy.school_year_id}>{sy.label}</option>
                ))}
              </select>
              <div className="form-text">Academic year of the enrollment.</div>
            </div>

            {/* Row 2: Section + Curriculum */}
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Section</label>
              <select
                className="form-select"
                value={form.section_id}
                onChange={(e) => setField("section_id", e.target.value)}
                required
              >
                <option value="" disabled>— Select section —</option>
                {sections.map((s) => (
                  <option key={s.section_id} value={s.section_id}>{s.section_name}</option>
                ))}
              </select>
              <div className="form-text">Assign the student to a section.</div>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Curriculum</label>
              <select
                className="form-select"
                value={form.curriculum_id}
                onChange={(e) => setField("curriculum_id", e.target.value)}
                required
              >
                <option value="" disabled>— Select curriculum —</option>
                {curricula.map((c) => (
                  <option key={c.curriculum_id} value={c.curriculum_id}>
                    {c.curriculum_name}
                  </option>
                ))}
              </select>
              <div className="form-text">Pick the curriculum for this enrollment.</div>
            </div>

            {/* Row 3: Date + Status */}
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Enrollment Date</label>
              <input
                type="date"
                className="form-control"
                value={form.enrollment_date}
                onChange={(e) => setField("enrollment_date", e.target.value)}
                required
              />
              <div className="form-text">Defaults to today ({todayYMD()}). Sent to API as <code>YYYY-MM-DD</code>.</div>
            </div>

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
              <div className="form-text">Current enrollment status.</div>
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
