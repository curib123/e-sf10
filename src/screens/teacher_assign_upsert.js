import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaInfoCircle,
  FaSave,
  FaUndo,
  FaChevronLeft,
  FaChevronRight,
  FaSyncAlt,
} from "react-icons/fa";
import StatusModal from "../components/status_modal";

// ────────────────────────────────────────────────────────────────────────────────
// Config
const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const CREATE_ENDPOINT = `/teacher-assignments/create`;
const UPDATE_ENDPOINT = (id) => `/teacher-assignments/update/${id}`;
const SHOW_ENDPOINT = (id) => `/teacher-assignments/${id}`;
const TEACHER_ASSIGNMENTS_BY_TEACHER = (teacherId) =>
  `/teacher-assignments/teacher/${teacherId}`;

// Persist selected teacher across hard reloads
const STORAGE_KEY = "teacherAssignment.selectedTeacherId";

// If you ever want old behavior, flip this back to false
const HARD_REFRESH_ON_SAVE = true;
const PAGE_SIZES = [5, 10, 20, 50];

const icons = {
  success: <FaCheckCircle size={18} />,
  danger: <FaTimesCircle size={18} />,
  warning: <FaExclamationTriangle size={18} />,
  info: <FaInfoCircle size={18} />,
};

// ────────────────────────────────────────────────────────────────────────────────
// Component
const TeacherAssignmentForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const inFlight = useRef(false);

  // UI
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [statusModal, setStatusModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "info",
    icon: icons.info,
  });
  const showStatus = (variant, title, message) =>
    setStatusModal({ show: true, title, message, variant, icon: icons[variant] });

  // Dropdown sources
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);

  // Form
  const [form, setForm] = useState({
    teacher_id: "",
    subject_id: "",
    section_id: "",
    school_year_id: "",
  });

  // Current assignment (edit)
  const [current, setCurrent] = useState(null);

  // Table below
  const [teacherSubs, setTeacherSubs] = useState([]);
  const [teacherSubsLoading, setTeacherSubsLoading] = useState(false);
  const lastTeacherFetched = useRef(null);

  // Pagination (client-side) for teacherSubs
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const selectedTeacher = useMemo(
    () => teachers.find((x) => String(x.teacher_id) === String(form.teacher_id)),
    [teachers, form.teacher_id]
  );
  const selectedTeacherName = useMemo(() => {
    const t = selectedTeacher;
    return t?.full_name || t?.teacher_name || (teacherSubs[0]?.teacher_name ?? "");
  }, [selectedTeacher, teacherSubs]);

  const teacherInitials = useMemo(() => {
    const name = selectedTeacherName || "";
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join("") || "T"
    );
  }, [selectedTeacherName]);

  // ── persistence helpers ───────────────────────────────────────────────────────
  const persistSelectedTeacher = (tid) => {
    if (tid) sessionStorage.setItem(STORAGE_KEY, String(tid));
  };
  const restorePersistedTeacher = () => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      sessionStorage.removeItem(STORAGE_KEY);
      return saved;
    }
    return null;
  };
  const hardRefreshPreserveTeacher = () => {
    if (form.teacher_id) persistSelectedTeacher(form.teacher_id);
    window.location.reload();
  };

  // --- helpers ---
  const handleUnauthorized = () => {
    showStatus("danger", "Unauthorized", "Please login to continue.");
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 800);
  };

  const apiFetch = async (path, options = {}) => {
    const isAbsolute = /^https?:\/\//i.test(path);
    const fullUrl = isAbsolute ? path : `${BASE_URL}${path}`;
    const res = await fetch(fullUrl, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error("Unauthorized");
    }
    return res;
  };

  // ---- loads ----
  const loadTeachers = async () => {
    try {
      const res = await apiFetch(`/teachers`, { method: "GET" });
      const data = await res.json();
      setTeachers(data?.success ? data.data || [] : []);
    } catch {
      showStatus("danger", "Error", "Failed to load teachers.");
    }
  };

  // fetch ALL subjects (iterate pages)
  const loadAllSubjects = async () => {
    try {
      const all = [];
      let page = 1;
      let totalPages = 1;
      do {
        const res = await apiFetch(
          `/subjects/view-all-subjects?page=${page}&limit=100`,
          { method: "GET" }
        );
        const data = await res.json();
        const list = data?.success ? data.data || [] : [];
        all.push(...list);
        const pg = data.pagination || {};
        page = Number(pg.page || page) + 1;
        totalPages = Number(pg.totalPages || pg.total_pages || 1);
      } while (page <= totalPages);
      setSubjects(all);
    } catch {
      showStatus("danger", "Error", "Failed to load subjects.");
    }
  };

  const loadSections = async () => {
    try {
      const res = await apiFetch(`/sections`, { method: "GET" });
      const data = await res.json();
      setSections(data?.success ? data.data || [] : []);
    } catch {
      showStatus("danger", "Error", "Failed to load sections.");
    }
  };

  const loadSchoolYears = async () => {
    try {
      const res = await apiFetch(`/school-year/all-school-years`, {
        method: "GET",
      });
      const data = await res.json();
      setSchoolYears(data?.success ? data.schoolYears || [] : []);
    } catch {
      showStatus("danger", "Error", "Failed to load school years.");
    }
  };

  // Populate edit form
  const loadAssignment = async () => {
    if (!id) return;
    try {
      const res = await apiFetch(SHOW_ENDPOINT(id), { method: "GET" });
      const data = await res.json();
      if (!data?.success || !data.data) {
        showStatus("warning", "Not found", "Assignment not found.");
        return;
      }
      const a = data.data;
      setCurrent(a);
      setForm((f) => ({
        ...f,
        teacher_id: a.teacher_id ?? "",
        subject_id: a.subject_id ?? "",
        section_id: a.section_id ?? "",
        school_year_id: a.school_year_id ?? "",
      }));
    } catch {
      showStatus("danger", "Error", "Failed to load assignment details.");
    }
  };

  // Load dropdowns + edit payload, then restore persisted teacher (if any)
  useEffect(() => {
    if (!token) return handleUnauthorized();
    (async () => {
      setBusy(true);
      await Promise.all([
        loadTeachers(),
        loadAllSubjects(),
        loadSections(),
        loadSchoolYears(),
      ]);
      if (id) await loadAssignment();

      // After options & (maybe) assignment are ready, restore teacher selection if saved
      const savedTeacherId = restorePersistedTeacher();
      if (savedTeacherId) {
        setForm((f) => ({ ...f, teacher_id: savedTeacherId }));
      }

      setBusy(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  // Fetch subjects by selected teacher (for the table below)
  const fetchTeacherSubjects = async (tid) => {
    if (!tid) {
      setTeacherSubs([]);
      lastTeacherFetched.current = null;
      return;
    }
    if (
      String(lastTeacherFetched.current) === String(tid) &&
      teacherSubs.length
    ) {
      return; // already have data
    }
    try {
      setTeacherSubsLoading(true);
      const res = await apiFetch(TEACHER_ASSIGNMENTS_BY_TEACHER(tid), {
        method: "GET",
      });
      const data = await res.json();
      const list = data?.success ? data.data || [] : [];
      setTeacherSubs(list);
      lastTeacherFetched.current = tid;
    } catch {
      setTeacherSubs([]);
      showStatus("danger", "Error", "Failed to load teacher's current subjects.");
    } finally {
      setTeacherSubsLoading(false);
    }
  };

  // Auto-fetch when teacher changes
  useEffect(() => {
    if (form.teacher_id) fetchTeacherSubjects(form.teacher_id);
    else {
      setTeacherSubs([]);
      lastTeacherFetched.current = null;
    }
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.teacher_id]);

  // ---- form helpers ----
  const setField = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const invalid = (k) => submitted && !String(form[k]).trim();

  const validate = () => {
    return ["teacher_id", "subject_id", "section_id", "school_year_id"].every(
      (k) => String(form[k]).trim()
    );
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!token || inFlight.current) return;
    setSubmitted(true);
    if (!validate()) {
      showStatus(
        "warning",
        "Missing fields",
        "Please complete all required fields."
      );
      return;
    }

    try {
      setBusy(true);
      inFlight.current = true;

      const payload = {
        teacher_id: Number(form.teacher_id),
        subject_id: Number(form.subject_id),
        section_id: Number(form.section_id),
        school_year_id: Number(form.school_year_id),
      };

      const res = await apiFetch(id ? UPDATE_ENDPOINT(id) : CREATE_ENDPOINT, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || data?.success === false)
        throw new Error(data?.message || "Request failed");

      showStatus(
        "success",
        id ? "Updated" : "Created",
        id
          ? "Teacher assignment updated successfully."
          : "Teacher assignment created successfully."
      );

      // 🚀 HARD RELOAD while preserving selected teacher
      if (HARD_REFRESH_ON_SAVE) {
        persistSelectedTeacher(form.teacher_id);
        window.location.reload();
        return;
      }

      // Soft refresh fallback (if you switch HARD_REFRESH_ON_SAVE to false)
      onReset();
      if (id) await loadAssignment();
      if (form.teacher_id) await fetchTeacherSubjects(form.teacher_id);
      if (!id) setForm((f) => ({ ...f, subject_id: "", section_id: "" }));
    } catch (err) {
      showStatus(
        "danger",
        "Error",
        err.message || "Something went wrong while saving."
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  const onReset = () => {
    setSubmitted(false);
    if (id) loadAssignment();
    else
      setForm({
        teacher_id: form.teacher_id,
        subject_id: "",
        section_id: "",
        school_year_id: "",
      });
  };

  // Derived pagination numbers for teacherSubs
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(teacherSubs.length / pageSize)),
    [teacherSubs.length, pageSize]
  );
  const paginatedSubs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return teacherSubs.slice(start, start + pageSize);
  }, [teacherSubs, page, pageSize]);
  const rangeStart = useMemo(
    () => (teacherSubs.length ? (page - 1) * pageSize + 1 : 0),
    [teacherSubs.length, page, pageSize]
  );
  const rangeEnd = useMemo(
    () => Math.min(teacherSubs.length, page * pageSize),
    [teacherSubs.length, page, pageSize]
  );

  // Keep page in bounds & reset when list or pageSize changes
  useEffect(() => {
    setPage(1);
  }, [teacherSubs.length, pageSize]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const buildPageList = useMemo(() => {
    const pages = [];
    const maxToShow = 7;
    if (totalPages <= maxToShow) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    const showAround = 1;
    const start = Math.max(2, page - showAround);
    const end = Math.min(totalPages - 1, page + showAround);
    pages.push(1);
    if (start > 2) pages.push("…");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("…");
    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  // 🔙 Back button handler
  const onBack = () => {
    try {
      navigate(-1);
    } catch {
      navigate("/teacher-assignments");
    }
  };

  return (
    <div className="container-fluid ">
      <style>{`
        .page-header {
          background: linear-gradient(135deg, rgba(13,110,253,.08), rgba(25,135,84,.08));
          border: 1px solid rgba(0,0,0,.04);
        }
        .avatar {
          width: 44px; height: 44px; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          background: #0d6efd10; color: #0d6efd; font-weight: 700;
        }
        .card { border-radius: 1rem; }
        .card-header { border-bottom: 1px solid rgba(0,0,0,.08); }
        .table thead th { position: sticky; top: 0; z-index: 1; background: var(--bs-light,#f8f9fa); }
        .table tbody tr { transition: background-color .15s ease; }
        .table tbody tr:hover { background-color: rgba(13,110,253,.03); }
        .form-select:focus, .form-control:focus { box-shadow: 0 0 0 .2rem rgba(13,110,253,.15); border-color: #86b7fe; }
        .btn-icon { display: inline-flex; align-items: center; gap: .5rem; }
        .badge-soft { background: rgba(13,110,253,.08); color: #0d6efd; }
        .pagination .page-link { cursor: pointer; }
      `}</style>

      {/* Header */}
      <div className="page-header rounded-4 p-3 p-md-4 mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div className="d-flex align-items-center gap-3">
          <div className="avatar">{teacherInitials}</div>
          <div>
            <h3 className="fw-bold mb-1">{id ? "Update Assignment" : "Assign Teacher"}</h3>
            <div className="text-muted small">
              {id
                ? "Modify the teacher–subject–section assignment for a school year."
                : "Create a teacher–subject–section assignment for a school year."}
            </div>
          </div>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary btn-icon" onClick={onBack}>
            <FaChevronLeft /> Back
          </button>

          {/* 🔄 FULL PAGE RELOAD (preserves teacher) */}
          <button
            type="button"
            className="btn btn-outline-secondary btn-icon"
            onClick={hardRefreshPreserveTeacher}
            aria-label="Refresh page"
            title="Refresh page"
          >
            <FaSyncAlt /> Refresh
          </button>
        </div>
      </div>

      {/* Form card */}
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-white px-4 py-3">
          <div className="d-flex align-items-center justify-content-between">
            <div className="fw-semibold">Assignment Details</div>
            {teacherSubs.length > 0 && (
              <span className="badge rounded-pill badge-soft">
                {teacherSubs.length} assignment{teacherSubs.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="card-body p-4">
          {id && (
            <div className="mb-4">
              {!current ? (
                <div className="placeholder-glow">
                  <p className="placeholder col-12 mb-2" style={{ height: 18 }} />
                  <p className="placeholder col-10 mb-0" style={{ height: 18 }} />
                </div>
              ) : (
                <div className="alert alert-light border rounded-3">
                  <div className="small text-muted mb-1">Current assignment</div>
                  <div className="d-flex flex-wrap gap-3 small">
                    <div><strong>Teacher:</strong> {current.teacher_name}</div>
                    <div><strong>Subject:</strong> {current.subject_code} — {current.subject_name}</div>
                    <div><strong>Section:</strong> {current.section_name}</div>
                    <div><strong>Grade:</strong> {current.grade_name}</div>
                    <div><strong>School Year:</strong> {current.school_year}</div>
                    <div><strong>ID:</strong> {current.assignment_id}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={onSubmit} noValidate>
            <div className="row g-4">
              {/* Teacher */}
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold">
                  Teacher <span className="text-danger">*</span>
                </label>
                <select
                  className={`form-select ${invalid("teacher_id") ? "is-invalid" : ""}`}
                  value={form.teacher_id}
                  onChange={setField("teacher_id")}
                  disabled={busy}
                >
                  <option value="">Select teacher</option>
                  {teachers.map((t) => (
                    <option key={t.teacher_id} value={t.teacher_id}>
                      {t.full_name || t.teacher_name || `${t.first_name} ${t.last_name}`}
                    </option>
                  ))}
                </select>
                <div className="form-text">
                  {form.teacher_id
                    ? "Selected teacher will appear below with their current subjects."
                    : "Choose the teacher to assign."}
                </div>
                <div className="invalid-feedback">Teacher is required.</div>
              </div>

              {/* Subject */}
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold">
                  Subject <span className="text-danger">*</span>
                </label>
                <select
                  className={`form-select ${invalid("subject_id") ? "is-invalid" : ""}`}
                  value={form.subject_id}
                  onChange={setField("subject_id")}
                  disabled={busy}
                >
                  <option value="">Select subject</option>
                  {subjects.map((s) => (
                    <option key={s.subject_id} value={s.subject_id}>
                      {s.subject_code} — {s.subject_name}
                    </option>
                  ))}
                </select>
                <div className="form-text">Pick the subject for this assignment.</div>
                <div className="invalid-feedback">Subject is required.</div>
              </div>

              {/* Section */}
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold">
                  Section <span className="text-danger">*</span>
                </label>
                <select
                  className={`form-select ${invalid("section_id") ? "is-invalid" : ""}`}
                  value={form.section_id}
                  onChange={setField("section_id")}
                  disabled={busy}
                >
                  <option value="">Select section</option>
                  {sections.map((s) => (
                    <option key={s.section_id} value={s.section_id}>
                      {s.section_name} {s.grade_name ? `— ${s.grade_name}` : ""}
                    </option>
                  ))}
                </select>
                <div className="form-text">Select the section for the teacher.</div>
                <div className="invalid-feedback">Section is required.</div>
              </div>

              {/* School Year */}
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold">
                  School Year <span className="text-danger">*</span>
                </label>
                <select
                  className={`form-select ${invalid("school_year_id") ? "is-invalid" : ""}`}
                  value={form.school_year_id}
                  onChange={setField("school_year_id")}
                  disabled={busy}
                >
                  <option value="">Select school year</option>
                  {schoolYears.map((sy) => (
                    <option key={sy.school_year_id} value={sy.school_year_id}>
                      {sy.start_year} - {sy.end_year}
                    </option>
                  ))}
                </select>
                <div className="form-text">Choose the school year for this assignment.</div>
                <div className="invalid-feedback">School year is required.</div>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button type="button" className="btn btn-outline-secondary btn-icon" onClick={onReset} disabled={busy}>
                <FaUndo /> Reset
              </button>
              <button type="submit" className="btn btn-primary btn-icon" disabled={busy}>
                {busy && (
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                )}
                <FaSave /> {id ? "Update Assignment" : "Save Assignment"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Table below — Current subjects for selected teacher */}
      {form.teacher_id && (
        <div className="card shadow-sm">
          <div className="card-header bg-white px-4 py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <h6 className="mb-0 fw-semibold">
                {selectedTeacherName
                  ? `${selectedTeacherName} — Current Subjects`
                  : "Current Subjects"}
              </h6>
              <div className="text-muted small">
                {teacherSubsLoading
                  ? "Loading assignments for this teacher…"
                  : teacherSubs.length
                  ? `Showing ${rangeStart}–${rangeEnd} of ${teacherSubs.length} assignment${
                      teacherSubs.length > 1 ? "s" : ""
                    }`
                  : "No current subjects for this teacher."}
              </div>
            </div>

            {/* Right controls: page size + pagination + refresh (soft refresh for table) */}
            <div className="d-flex align-items-center gap-2 ms-auto">
              {teacherSubs.length > 0 && (
                <>
                  <span className="text-muted small">Rows</span>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 90 }}
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {teacherSubs.length > pageSize && (
                <nav aria-label="Teacher subjects pagination">
                  <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage(1)}
                        aria-label="First"
                      >
                        <span aria-hidden="true">«</span>
                      </button>
                    </li>
                    <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-label="Previous"
                      >
                        <FaChevronLeft />
                      </button>
                    </li>
                    {buildPageList.map((p, idx) =>
                      typeof p === "string" ? (
                        <li key={`ellipsis-${idx}`} className="page-item disabled">
                          <span className="page-link">…</span>
                        </li>
                      ) : (
                        <li
                          key={`pg-${p}`}
                          className={`page-item ${p === page ? "active" : ""}`}
                        >
                          <button className="page-link" onClick={() => setPage(p)}>
                            {p}
                          </button>
                        </li>
                      )
                    )}
                    <li
                      className={`page-item ${page === totalPages ? "disabled" : ""}`}
                    >
                      <button
                        className="page-link"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        aria-label="Next"
                      >
                        <FaChevronRight />
                      </button>
                    </li>
                    <li
                      className={`page-item ${page === totalPages ? "disabled" : ""}`}
                    >
                      <button
                        className="page-link"
                        onClick={() => setPage(totalPages)}
                        aria-label="Last"
                      >
                        <span aria-hidden="true">»</span>
                      </button>
                    </li>
                  </ul>
                </nav>
              )}

              {/* Soft refresh for the table ONLY (no full reload) */}
              <button
                className="btn btn-outline-secondary btn-sm btn-icon"
                onClick={() => fetchTeacherSubjects(form.teacher_id)}
                disabled={teacherSubsLoading}
              >
                <FaSyncAlt /> {teacherSubsLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          {teacherSubsLoading ? (
            <div className="p-3">
              <div className="placeholder-glow">
                {[...Array(4)].map((_, i) => (
                  <p key={i} className="placeholder col-12 mb-2" style={{ height: 18 }} />
                ))}
              </div>
            </div>
          ) : teacherSubs.length === 0 ? (
            <div className="p-4 text-center text-muted small">No records to display.</div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: "60vh" }}>
              <table className="table table-sm align-middle mb-0 table-hover table-striped">
                <thead className="table-light">
                  <tr>
                    <th style={{ minWidth: 160 }}>Subject</th>
                    <th style={{ minWidth: 140 }}>Section</th>
                    <th style={{ width: 120 }}>Grade</th>
                    <th style={{ width: 140 }}>School Year</th>
                    <th style={{ width: 140 }}>Assignment ID</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSubs.map((a) => (
                    <tr key={`teach-sub-${a.assignment_id}`}>
                      <td className="text-wrap">
                        <div className="fw-medium">{a.subject_code}</div>
                        <div className="small text-muted">{a.subject_name}</div>
                      </td>
                      <td className="text-wrap">{a.section_name}</td>
                      <td>{a.grade_name}</td>
                      <td>{a.school_year}</td>
                      <td>
                        <span className="badge text-bg-light border">{a.assignment_id}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <StatusModal
        {...statusModal}
        onHide={() => setStatusModal((s) => ({ ...s, show: false }))}
      />
    </div>
  );
};

export default TeacherAssignmentForm;
