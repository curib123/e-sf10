import React, { useEffect, useMemo, useRef, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaSave, FaCheckCircle } from "react-icons/fa";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// ---- Time helpers (UI <-> API) ----
const toTimeInput = (t) => {
  if (!t) return "";
  const parts = t.split(":");
  return `${parts[0]?.padStart(2,"0")}:${(parts[1] ?? "00").padStart(2,"0")}`;
};
const toApiTime = (t) => {
  if (!t) return "";
  const parts = t.split(":");
  const hh = parts[0]?.padStart(2,"0") ?? "00";
  const mm = parts[1]?.padStart(2,"0") ?? "00";
  const ss = parts[2]?.padStart(2,"0") ?? "00";
  return `${hh}:${mm}:${ss}`;
};
const minutesOf = (t) => {
  const [h, m] = toTimeInput(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const ClassScheduleUpsert = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const token = useMemo(() => sessionStorage.getItem("token"), []);

  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const inFlight = useRef(false);

  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "info" });
  const showModal = (variant, title, message) => setModal({ show: true, title, message, variant });

  // Dropdown data
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [sections, setSections] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // Form
  const [form, setForm] = useState({
    subject_id: "",
    teacher_id: "",
    section_id: "",
    school_year_id: "",
    day_of_week: "",
    start_time: "",
    end_time: "",
  });

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

  // ---- Loads ----
  const fetchAllSubjects = async () => {
    const all = [];
    let page = 1, totalPages = 1;
    const limit = 100;
    do {
      const url = new URL(`${BASE_URL}/subjects/view-all-subjects`);
      url.searchParams.set("page", page);
      url.searchParams.set("limit", String(limit));
      const res = await fetch(url.toString(), { headers: authHeaders() });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) throw new Error("Failed to fetch subjects");
      const js = await res.json();
      all.push(...(Array.isArray(js?.data) ? js.data : []));
      totalPages = js?.pagination?.totalPages || 1;
      page += 1;
    } while (page <= totalPages);
    return all;
  };

  const fetchTeachers = async () => {
    const res = await apiFetch(`/teachers`);
    if (!res.ok) throw new Error("Failed to fetch teachers");
    const js = await res.json();
    return Array.isArray(js?.data) ? js.data : [];
  };

  const fetchSections = async () => {
    const res = await apiFetch(`/sections`);
    if (!res.ok) throw new Error("Failed to fetch sections");
    const js = await res.json();
    return Array.isArray(js?.data) ? js.data : [];
  };

  const fetchSchoolYears = async () => {
    const res = await apiFetch(`/school-year/all-school-years`);
    if (!res.ok) throw new Error("Failed to fetch school years");
    const js = await res.json();
    const list = Array.isArray(js?.schoolYears) ? js.schoolYears : [];
    return list.map((sy) => ({ school_year_id: sy.school_year_id, school_year: `${sy.start_year}-${sy.end_year}` }));
  };

  const fetchAssignments = async () => {
    const res = await apiFetch(`/teacher-assignments`); // per spec: No Auth required, but sending headers is ok
    if (!res.ok) throw new Error("Failed to fetch teacher assignments");
    const js = await res.json();
    return Array.isArray(js?.data) ? js.data : [];
  };

  const fetchSchedule = async (schedId) => {
    const res = await apiFetch(`/class-schedules/${schedId}`);
    if (!res.ok) throw new Error("Failed to fetch class schedule");
    const js = await res.json();
    return js?.data || null;
  };

  // ---- Init ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setInitializing(true);
        const [subs, teach, sects, sys, assigns] = await Promise.all([
          fetchAllSubjects(),
          fetchTeachers(),
          fetchSections(),
          fetchSchoolYears(),
          fetchAssignments(),
        ]);
        if (!cancelled) {
          setSubjects(subs);
          setTeachers(teach);
          setSections(sects);
          setSchoolYears(sys);
          setAssignments(assigns);
        }
        if (isEdit && id) {
          const data = await fetchSchedule(id);
          if (data && !cancelled) {
            setForm({
              subject_id: String(data.subject_id ?? ""),
              teacher_id: String(data.teacher_id ?? ""),
              section_id: String(data.section_id ?? ""),
              school_year_id: String(data.school_year_id ?? ""),
              day_of_week: data.day_of_week ?? "",
              start_time: toTimeInput(data.start_time),
              end_time: toTimeInput(data.end_time),
            });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit, token]);

  // ---- Assignment-driven dropdowns (cascade) ----

  // quick maps to inject current values if not present in filtered options
  const subjMap = useMemo(() => Object.fromEntries(subjects.map(s => [String(s.subject_id), s])), [subjects]);
  const teachMap = useMemo(() => Object.fromEntries(teachers.map(t => [String(t.teacher_id), t])), [teachers]);
  const sectMap = useMemo(() => Object.fromEntries(sections.map(s => [String(s.section_id), s])), [sections]);
  const syMap   = useMemo(() => Object.fromEntries(schoolYears.map(sy => [String(sy.school_year_id), sy])), [schoolYears]);

  // School Year options: years that appear in assignments
  const syOptions = useMemo(() => {
    const present = new Set(assignments.map(a => String(a.school_year_id)));
    const out = schoolYears.filter(sy => present.has(String(sy.school_year_id)));
    if (form.school_year_id && !out.find(x => String(x.school_year_id) === String(form.school_year_id)) && syMap[form.school_year_id]) {
      out.unshift(syMap[form.school_year_id]);
    }
    return out;
  }, [assignments, schoolYears, form.school_year_id, syMap]);

  // Section options: sections with assignments for selected SY
  const sectionOptions = useMemo(() => {
    if (!form.school_year_id) return [];
    const present = new Set(
      assignments
        .filter(a => String(a.school_year_id) === String(form.school_year_id))
        .map(a => String(a.section_id))
    );
    const out = sections.filter(s => present.has(String(s.section_id)));
    if (form.section_id && !out.find(x => String(x.section_id) === String(form.section_id)) && sectMap[form.section_id]) {
      out.unshift(sectMap[form.section_id]);
    }
    return out;
  }, [assignments, sections, form.school_year_id, form.section_id, sectMap]);

  // Subject options: subjects with assignments for selected SY + Section
  const subjectOptions = useMemo(() => {
    if (!form.school_year_id || !form.section_id) return [];
    const present = new Set(
      assignments
        .filter(a =>
          String(a.school_year_id) === String(form.school_year_id) &&
          String(a.section_id) === String(form.section_id)
        )
        .map(a => String(a.subject_id))
    );
    const out = subjects.filter(s => present.has(String(s.subject_id)));
    if (form.subject_id && !out.find(x => String(x.subject_id) === String(form.subject_id)) && subjMap[form.subject_id]) {
      out.unshift(subjMap[form.subject_id]);
    }
    return out;
  }, [assignments, subjects, form.school_year_id, form.section_id, form.subject_id, subjMap]);

  // Teacher options: teachers assigned for selected SY + Section + Subject
  const teacherOptions = useMemo(() => {
    if (!form.school_year_id || !form.section_id || !form.subject_id) return [];
    const present = new Set(
      assignments
        .filter(a =>
          String(a.school_year_id) === String(form.school_year_id) &&
          String(a.section_id) === String(form.section_id) &&
          String(a.subject_id) === String(form.subject_id)
        )
        .map(a => String(a.teacher_id))
    );
    const out = teachers.filter(t => present.has(String(t.teacher_id)));
    if (form.teacher_id && !out.find(x => String(x.teacher_id) === String(form.teacher_id)) && teachMap[form.teacher_id]) {
      out.unshift(teachMap[form.teacher_id]);
    }
    return out;
  }, [assignments, teachers, form.school_year_id, form.section_id, form.subject_id, form.teacher_id, teachMap]);

  // Clear dependents when parent changes (SY -> clear section/subject/teacher; Section -> clear subject/teacher; Subject -> clear teacher)
  useEffect(() => {
    setForm(f => ({ ...f, section_id: "", subject_id: "", teacher_id: "" }));
  }, [form.school_year_id]);
  useEffect(() => {
    setForm(f => ({ ...f, subject_id: "", teacher_id: "" }));
  }, [form.section_id]);
  useEffect(() => {
    setForm(f => ({ ...f, teacher_id: "" }));
  }, [form.subject_id]);

  // ---- Handlers ----
  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const validate = () => {
    const required = [
      ["school_year_id", "School Year"],
      ["section_id", "Section"],
      ["subject_id", "Subject"],
      ["teacher_id", "Teacher"],
      ["day_of_week", "Day of week"],
      ["start_time", "Start time"],
      ["end_time", "End time"],
    ];
    for (const [k, label] of required) {
      const v = String(form[k] || "").trim();
      if (!v) return [false, `${label} is required.`];
    }
    if (minutesOf(form.end_time) <= minutesOf(form.start_time)) {
      return [false, "End time must be after start time (24-hour)."];
    }
    const payload = {
      subject_id: Number(form.subject_id),
      teacher_id: Number(form.teacher_id),
      section_id: Number(form.section_id),
      school_year_id: Number(form.school_year_id),
      day_of_week: form.day_of_week,
      start_time: toApiTime(form.start_time),
      end_time: toApiTime(form.end_time),
    };
    return [true, payload];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || inFlight.current) return;

    const [ok, dataOrMsg] = validate();
    if (!ok) return showModal("warning", "Check fields", dataOrMsg);

    setLoading(true);
    inFlight.current = true;
    try {
      const path = isEdit ? `/class-schedules/update/${id}` : `/class-schedules/create`;
      const method = isEdit ? "PUT" : "POST";
      const res = await apiFetch(path, { method, body: JSON.stringify(dataOrMsg) });
      let js = {};
      try { js = await res.json(); } catch {}
      const success = js?.success ?? res.ok;

      if (success) {
        showModal("success", isEdit ? "Updated" : "Created", js?.message || (isEdit ? "Class schedule updated successfully" : "Class schedule created successfully"));
        setTimeout(() => navigate(-1), 900);
      } else {
        showModal("danger", "Failed", js?.message || `Request failed (${res.status}).`);
      }
    } catch (err) {
      if (err.message !== "Unauthorized") showModal("danger", "Error", "Something went wrong.");
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
            <h4 className="fw-bold mb-0">{isEdit ? "Edit Class Schedule" : "Create Class Schedule"}</h4>
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn btn-light border d-flex align-items-center gap-2 px-3" onClick={() => navigate(-1)}>
                <FaArrowLeft /> Back
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="row g-3 g-lg-4" noValidate>
            {/* Row 1: School Year + Section (cascading) */}
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">School Year</label>
              <select
                className="form-select"
                value={form.school_year_id}
                onChange={(e) => setField("school_year_id", e.target.value)}
                required
              >
                <option value="" disabled>— Select school year (e.g., 2024-2025) —</option>
                {syOptions.map((sy) => (
                  <option key={sy.school_year_id} value={sy.school_year_id}>{sy.school_year}</option>
                ))}
              </select>
              <div className="form-text">Choose year first to narrow sections, subjects, and teachers.</div>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Section</label>
              <select
                className="form-select"
                value={form.section_id}
                onChange={(e) => setField("section_id", e.target.value)}
                required
                disabled={!form.school_year_id}
              >
                <option value="" disabled>— Select section (e.g., Section B) —</option>
                {sectionOptions.map((s) => (
                  <option key={s.section_id} value={s.section_id}>{s.section_name}</option>
                ))}
              </select>
              <div className="form-text">Only sections assigned in the selected school year.</div>
            </div>

            {/* Row 2: Subject + Teacher (cascading) */}
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Subject</label>
              <select
                className="form-select"
                value={form.subject_id}
                onChange={(e) => setField("subject_id", e.target.value)}
                required
                disabled={!form.section_id}
              >
                <option value="" disabled>— Select subject (e.g., Advanced Mathematics) —</option>
                {subjectOptions.map((s) => (
                  <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
                ))}
              </select>
              <div className="form-text">Filtered by School Year and Section assignments.</div>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Teacher</label>
              <select
                className="form-select"
                value={form.teacher_id}
                onChange={(e) => setField("teacher_id", e.target.value)}
                required
                disabled={!form.subject_id}
              >
                <option value="" disabled>— Select teacher (e.g., Jemil M. Doblas) —</option>
                {teacherOptions.map((t) => (
                  <option key={t.teacher_id} value={t.teacher_id}>{t.full_name}</option>
                ))}
              </select>
              <div className="form-text">Only teachers assigned to the chosen Subject & Section in the selected year.</div>
            </div>

            {/* Row 3: Day + Start + End */}
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold">Day of week</label>
              <select
                className="form-select"
                value={form.day_of_week}
                onChange={(e) => setField("day_of_week", e.target.value)}
                required
              >
                <option value="" disabled>— Select day (e.g., Monday) —</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <div className="form-text">Pick the meeting day for this class.</div>
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label fw-semibold">Start time</label>
              <input
                type="time"
                step="60"
                inputMode="numeric"
                className="form-control"
                value={form.start_time}
                onChange={(e) => setField("start_time", e.target.value)}
                required
              />
              <div className="form-text">
                Use <strong>24-hour</strong> format. Example: <code>10:00</code> → API sends <code>10:00:00</code>.
              </div>
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label fw-semibold">End time</label>
              <input
                type="time"
                step="60"
                inputMode="numeric"
                className="form-control"
                value={form.end_time}
                onChange={(e) => setField("end_time", e.target.value)}
                required
              />
              <div className="form-text">
                Use <strong>24-hour</strong> format. Example: <code>13:30</code> → API sends <code>13:30:00</code>.
              </div>
            </div>

            {/* Helper note */}
            <div className="col-12">
              <div className="alert alert-info py-2 d-flex align-items-start gap-2 small" role="alert">
                <FaCheckCircle className="mt-1" />
                <div>
                  Make sure the schedule doesn’t overlap for the same <em>teacher</em> or <em>section</em>. Times are validated as 24-hour and sent to the server as <code>HH:MM:SS</code>.
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="col-12 d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-light border" onClick={() => navigate(-1)} disabled={loading || initializing}>
                Cancel
              </button>
              <button type="submit" className="btn btn-dark d-flex align-items-center gap-2" disabled={loading || initializing}>
                {loading && <span className="spinner-border spinner-border-sm" role="status" />}
                <FaSave /> {isEdit ? "Save Changes" : "Create Schedule"}
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

export default ClassScheduleUpsert;
