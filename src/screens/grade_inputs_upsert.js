import 'bootstrap/dist/css/bootstrap.min.css';

// EnrollmentList.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FaBookOpen,
  FaCalendarAlt,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaEdit,
  FaExclamationTriangle,
  FaInfoCircle,
  FaLayerGroup,
  FaPlus,
  FaRedoAlt,
  FaSearch,
  FaSort,
  FaSortDown,
  FaSortUp,
  FaTag,
  FaTimesCircle,
  FaTrash,
  FaUserGraduate,
} from 'react-icons/fa';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import StatusModal from '../components/status_modal';

// ────────────────────────────────────────────────────────────────────────────────
// Config
const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const PAGE_SIZES = [5, 10, 20, 50];
const DEFAULT_SORT = "date:desc";
const DEFAULT_PAGE_SIZE = PAGE_SIZES[1];

// ────────────────────────────────────────────────────────────────────────────────
// Reusable bits
const icons = {
  success: <FaCheckCircle size={20} />,
  danger: <FaTimesCircle size={20} />,
  warning: <FaExclamationTriangle size={20} />,
  info: <FaInfoCircle size={20} />,
};

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" })
    : "—";

const readQP = (s, k, f) => new URLSearchParams(s).get(k) ?? f;
const writeQP = (navigate, location, next) => {
  const p = new URLSearchParams(location.search);
  Object.entries(next).forEach(([k, v]) =>
    v === undefined || v === null || v === "" || v === "all" ? p.delete(k) : p.set(k, String(v))
  );
  navigate({ search: p.toString() }, { replace: true });
};
const useDebounced = (val, d = 300) => {
  const [v, setV] = useState(val);
  useEffect(() => { const t = setTimeout(() => setV(val), d); return () => clearTimeout(t); }, [val, d]);
  return v;
};

const buildSorter = (sort, getters) => {
  const [key, dir] = (sort || DEFAULT_SORT).split(":");
  const asc = dir !== "desc";
  const get = getters[key] || ((r) => r?.enrollment_date || "");
  return (A, B) => {
    const a = get(A), b = get(B);
    if (a < b) return asc ? -1 : 1;
    if (a > b) return asc ? 1 : -1;
    return 0;
  };
};

const groupBy = (rows, keyFn) =>
  rows.reduce((m, r) => (m.set(keyFn(r), [...(m.get(keyFn(r)) || []), r]), m), new Map());

const authHeaders = (t) => ({
  "Content-Type": "application/json",
  ...(t ? { Authorization: `Bearer ${t}` } : {}),
});

const api = {
  get: (path, t) => fetch(`${BASE_URL}${path}`, { headers: authHeaders(t) }),
  del: (path, t) => fetch(`${BASE_URL}${path}`, { method: "DELETE", headers: authHeaders(t) }),
  fetchPagedAll: async (basePath, t, dataKey = "data", pageParam = "page", limitParam = "limit") => {
    let page = 1, totalPages = 1;
    const limit = 100, all = [];
    while (page <= totalPages) {
      const url = new URL(`${BASE_URL}${basePath}`);
      url.searchParams.set(pageParam, String(page));
      url.searchParams.set(limitParam, String(limit));
      const res = await fetch(url.toString(), { headers: authHeaders(t) });
      if (!res.ok) throw new Error(`Failed to fetch ${basePath}`);
      const js = await res.json();
      all.push(...(Array.isArray(js?.[dataKey]) ? js[dataKey] : []));
      totalPages = js?.pagination?.totalPages ?? js?.totalPages ?? 1;
      page += 1;
    }
    return all;
  },
};

// ────────────────────────────────────────────────────────────────────────────────
// Async student search (filter only; keeps list scalable)
const StudentFilterSearch = ({ token, value, onPick, className = "" }) => {
  const [label, setLabel] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    const q = label.trim();
    if (!touched || q.length < 2) {
      setItems([]); setOpen(false); return;
    }
    const run = async () => {
      try {
        setLoading(true);
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        const res = await fetch(
          `${BASE_URL}/students/search?query=${encodeURIComponent(q)}`,
          { headers: authHeaders(token), signal: abortRef.current.signal }
        );
        if (!res.ok) throw new Error("Search failed");
        const js = await res.json();
        setItems(Array.isArray(js) ? js : []);
        setOpen(true);
      } catch {
        /* ignore fast-typing/abort */
      } finally {
        setLoading(false);
      }
    };
    const t = setTimeout(run, 300);
    return () => clearTimeout(t);
  }, [label, token, touched]);

  const pick = (it) => {
    const text = `${it.last_name}, ${it.first_name}${it.middle_name ? " " + it.middle_name : ""}`;
    onPick(String(it.student_id), text);
    setLabel(text);
    setOpen(false);
    setTouched(false);
  };
  const clear = () => {
    setLabel(""); onPick("all", ""); setItems([]); setOpen(false); setTouched(true);
  };

  return (
    <div className={`position-relative w-100 ${className}`}>
      <div className="input-group">
        <input
          type="text"
          className="form-control"
          style={{ height: "calc(2.25rem + 2px)" }}
          placeholder="Search student by LRN or name…"
          value={label}
          onChange={(e) => { setLabel(e.target.value); setTouched(true); }}
          onFocus={() => items.length && setOpen(true)}
          autoComplete="off"
        />
        {label && (
          <button className="btn btn-outline-secondary" type="button" onClick={clear}>
            Clear
          </button>
        )}
      </div>
      {open && (
        <div className="dropdown-menu show w-100 mt-1 border shadow-sm" style={{ maxHeight: 280, overflowY: "auto", zIndex: 1050 }}>
          {loading ? (
            <div className="dropdown-item text-muted small d-flex align-items-center gap-2">
              <span className="spinner-border spinner-border-sm" /> Searching…
            </div>
          ) : items.length ? (
            items.map((it) => (
              <button key={it.student_id} type="button" className="dropdown-item d-flex flex-column" onClick={() => pick(it)}>
                <div className="d-flex w-100 justify-content-between">
                  <strong>{`${it.last_name}, ${it.first_name}${it.middle_name ? " " + it.middle_name : ""}`}</strong>
                  {it.lrn ? <span className="text-muted">[{it.lrn}]</span> : null}
                </div>
                <small className="text-muted">
                  {it.gender || "—"} • {it.date_of_birth ? new Date(it.date_of_birth).toLocaleDateString() : "—"}
                </small>
              </button>
            ))
          ) : (
            <div className="dropdown-item text-muted small">No matches</div>
          )}
        </div>
      )}
      <input type="hidden" value={value} readOnly />
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────────
// Delete confirmation modal
const DeleteConfirmModal = ({ show, item, busy, onCancel, onConfirm }) =>
  !show ? null : (
    <>
      <div className="modal fade show" style={{ display: "block" }} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content rounded-4">
            <div className="modal-header">
              <h5 className="modal-title">Delete enrollment</h5>
              <button type="button" className="btn-close" onClick={onCancel} aria-label="Close" />
            </div>
            <div className="modal-body">
              <p className="mb-1">This action cannot be undone.</p>
              <p className="mb-0">
                Delete enrollment <strong>#{item?.enrollment_id}</strong>
                {item?.student_name ? <> for <em>{item.student_name}</em></> : null}?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-light border" onClick={onCancel} disabled={busy}>Cancel</button>
              <button className="btn btn-danger d-inline-flex align-items-center gap-2" onClick={onConfirm} disabled={busy}>
                {busy && <span className="spinner-border spinner-border-sm" role="status" />} <FaTrash /> Delete
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );

// ────────────────────────────────────────────────────────────────────────────────
// Main component (now perfectly aligned with /enrollments data)
const EnrollmentList = () => {
  const navigate = useNavigate(), location = useLocation();

  // URL state
  const initial = useMemo(() => ({
    q: readQP(location.search, "q", ""),
    student: readQP(location.search, "student", "all"),
    section: readQP(location.search, "section", "all"),
    sy: readQP(location.search, "sy", "all"),
    curriculum: readQP(location.search, "curriculum", "all"),
    status: readQP(location.search, "status", "all"),
    page: Number(readQP(location.search, "page", 1)) || 1,
    size: Number(readQP(location.search, "size", DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE,
    sort: readQP(location.search, "sort", DEFAULT_SORT),
    group: readQP(location.search, "group", "none"),
  }), [location.search]);

  // Local state
  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [q, setQ] = useState(initial.q);
  const [studentId, setStudentId] = useState(initial.student);
  const [sectionId, setSectionId] = useState(initial.section);
  const [schoolYearId, setSchoolYearId] = useState(initial.sy);
  const [curriculumId, setCurriculumId] = useState(initial.curriculum);
  const [status, setStatus] = useState(initial.status);

  const [page, setPage] = useState(Math.max(1, initial.page));
  const [pageSize, setPageSize] = useState(PAGE_SIZES.includes(initial.size) ? initial.size : DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState(initial.sort);
  const [groupByKey, setGroupByKey] = useState(
    ["none", "sy", "section", "curriculum", "status", "date"].includes(initial.group) ? initial.group : "none"
  );

  const debouncedQ = useDebounced(q, 300);

  // Data
  const [enrollments, setEnrollments] = useState([]);
  const [sections, setSections] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [curricula, setCurricula] = useState([]);
  const [availableStatuses, setAvailableStatuses] = useState([]);

  // Track active curriculum (for labeling & defaulting)
  const [activeCurriculumId, setActiveCurriculumId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [statusModal, setStatusModal] = useState({
    show: false, title: "", message: "", variant: "info", icon: icons.info,
  });

  // Delete modal
  const [delOpen, setDelOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [delItem, setDelItem] = useState(null);

  const showStatus = useCallback(
    (variant, title, message) => setStatusModal({ show: true, title, message, variant, icon: icons[variant] }),
    []
  );

  const handleUnauthorized = useCallback(() => {
    showStatus("danger", "Unauthorized", "Please login to continue.");
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 800);
  }, [navigate, showStatus]);

  // Track whether we've already auto-applied the defaults (so we don't override user changes later)
  const appliedDefaultSyRef = useRef(false);
  const appliedDefaultCurrRef = useRef(false);

  // Load data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [enrRes, secRes, syRes, curAllRes, curActiveRes] = await Promise.all([
          api.get(`/enrollments`, token),
          api.get(`/sections`, token),
          api.get(`/school-year/all-school-years`, token),
          // all curricula (paged)
          // NOTE: returns a flat array already (via fetchPagedAll)
          Promise.resolve().then(() => api.fetchPagedAll(`/curriculum/view-all-curriculums`, token, "data")),
          api.get(`/curriculum/active-curriculums`, token), // may fail; don't hard fail load
        ]);

        if (!enrRes.ok || !secRes.ok || !syRes.ok) throw new Error("Failed to load data");
        const [enr, secJs, syJs] = await Promise.all([enrRes.json(), secRes.json(), syRes.json()]);
        if (cancelled) return;

        // Enrollments & sections
        setEnrollments(Array.isArray(enr?.data) ? enr.data : []);
        setSections(Array.isArray(secJs?.data) ? secJs.data : []);

        // School years (keep is_active so we can label or use it)
        const syRaw = Array.isArray(syJs?.schoolYears) ? syJs.schoolYears : [];
        const syMapped = syRaw.map((sy) => ({
          school_year_id: sy.school_year_id,
          school_year: `${sy.start_year}-${sy.end_year}`,
          is_active: sy.is_active,
        }));
        setSchoolYears(syMapped);

        // ✅ Default SY to ACTIVE (only once if no URL sy)
        if (!appliedDefaultSyRef.current && (initial.sy === "all" || initial.sy == null)) {
          const activeSY = syRaw.find((s) => s?.is_active === 1 || s?.is_active === true || String(s?.is_active) === "1");
          if (activeSY?.school_year_id) {
            setSchoolYearId(String(activeSY.school_year_id));
          }
          appliedDefaultSyRef.current = true;
        }

        // Curriculums
        const curAll = Array.isArray(curAllRes) ? curAllRes : [];
        setCurricula(curAll);

        // 🔹 Active curriculum (optional; do not break load if missing)
        let activeCurId = null;
        if (curActiveRes && curActiveRes.ok) {
          try {
            const curActiveJs = await curActiveRes.json();
            const d = curActiveJs?.data;
            if (d?.curriculum_id) activeCurId = String(d.curriculum_id);
          } catch { /* ignore parse */ }
        }
        setActiveCurriculumId(activeCurId);

        // ✅ Default Curriculum to ACTIVE (only once if no URL curriculum)
        if (!appliedDefaultCurrRef.current && (initial.curriculum === "all" || initial.curriculum == null)) {
          if (activeCurId) setCurriculumId(activeCurId);
          appliedDefaultCurrRef.current = true;
        }

        // Status set (from actual data)
        setAvailableStatuses(
          Array.from(new Set((enr?.data || []).map((r) => r.status).filter(Boolean)))
        );
      } catch (err) {
        const msg = String(err?.message || "");
        msg.toLowerCase().includes("unauthorized") ? handleUnauthorized()
          : showStatus("danger", "Load error", msg || "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, handleUnauthorized, showStatus]);

  // URL sync
  useEffect(() => {
    writeQP(navigate, location, {
      q: debouncedQ || undefined,
      student: studentId !== "all" ? studentId : undefined,
      section: sectionId !== "all" ? sectionId : undefined,
      sy: schoolYearId !== "all" ? schoolYearId : undefined,
      curriculum: curriculumId !== "all" ? curriculumId : undefined,
      status: status !== "all" ? status : undefined,
      page, size: pageSize, sort,
      group: groupByKey !== "none" ? groupByKey : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, studentId, sectionId, schoolYearId, curriculumId, status, page, pageSize, sort, groupByKey]);

  // Filter/sort/page with only real fields
  const { total, totalPages, currentPage, pageRows, grouped } = useMemo(() => {
    const needle = (debouncedQ || "").trim().toLowerCase();

    const filtered = enrollments.filter((r) => {
      const matchesFilters =
        (studentId === "all" || String(r.student_id) === String(studentId)) &&
        (sectionId === "all" || String(r.section_id) === String(sectionId)) &&
        (schoolYearId === "all" || String(r.school_year_id) === String(schoolYearId)) &&
        (curriculumId === "all" || String(r.curriculum_id) === String(curriculumId)) &&
        (status === "all" || String(r.status) === String(status));

      if (!matchesFilters) return false;

      const hay = `${r.student_name ?? ""} ${r.section_name ?? ""} ${r.school_year ?? ""} ${r.curriculum_name ?? ""} ${r.status ?? ""}`.toLowerCase();
      return needle ? hay.includes(needle) : true;
    });

    const getters = {
      date: (r) => r.enrollment_date || "",
      student: (r) => (r.student_name || "").toLowerCase(),
      section: (r) => (r.section_name || "").toLowerCase(),
      sy: (r) => (r.school_year || "").toLowerCase(),
      curriculum: (r) => (r.curriculum_name || "").toLowerCase(),
      status: (r) => (r.status || "").toLowerCase(),
    };

    const sorted = [...filtered].sort(buildSorter(sort, getters));

    const totalItems = sorted.length;
    const pages = Math.max(1, Math.ceil(totalItems / pageSize));
    const clamped = Math.min(Math.max(1, page), pages);
    const start = (clamped - 1) * pageSize;
    const slice = sorted.slice(start, start + pageSize);

    const keyFns = {
      none: () => "All",
      sy: (r) => r.school_year || "—",
      section: (r) => r.section_name || "—",
      curriculum: (r) => r.curriculum_name || "—",
      status: (r) => r.status || "—",
      date: (r) => (r.enrollment_date ? new Date(r.enrollment_date).toLocaleDateString() : "—"),
    };

    return {
      total: totalItems,
      totalPages: pages,
      currentPage: clamped,
      pageRows: slice,
      grouped: groupByKey === "none" ? null : groupBy(slice, keyFns[groupByKey]),
    };
  }, [enrollments, debouncedQ, studentId, sectionId, schoolYearId, curriculumId, status, sort, page, pageSize, groupByKey]);

  // Reset page when dependencies change
  useEffect(() => { setPage(1); }, [debouncedQ, studentId, sectionId, schoolYearId, curriculumId, status, pageSize, sort, groupByKey]);

  // UI helpers
  const onClear = () => setQ("");
  const onReload = () => window.location.reload();

  const SortIcon = ({ col }) => {
    const [k, dir] = (sort || DEFAULT_SORT).split(":");
    if (k !== col) return <FaSort className="opacity-50" />;
    return dir === "asc" ? <FaSortUp /> : <FaSortDown />;
  };
  const ThSortable = ({ col, children, width }) => (
    <th style={width ? { width } : undefined}>
      <button
        type="button"
        className="btn btn-link p-0 text-decoration-none d-inline-flex align-items-center gap-1"
        onClick={() => {
          const [k, dir] = (sort || DEFAULT_SORT).split(":");
          setSort(k === col ? `${col}:${dir === "asc" ? "desc" : "asc"}` : `${col}:asc`);
        }}
        aria-label={`Sort by ${children}`}
      >
        <span className="fw-semibold text-body">{children}</span>
        <SortIcon col={col} />
      </button>
    </th>
  );

  // Delete flow
  const openDelete = useCallback((row) => { setDelItem(row); setDelOpen(true); }, []);
  const closeDelete = useCallback(() => { setDelOpen(false); setDelItem(null); setDelBusy(false); }, []);
  const confirmDelete = useCallback(async () => {
    if (!delItem) return;
    try {
      setDelBusy(true);
      const res = await api.del(`/enrollments/delete/${delItem.enrollment_id}`, token);
      let js = {};
      try { js = await res.json(); } catch {}
      if (!res.ok || js?.success === false) throw new Error(js?.message || "Delete failed");

      setEnrollments((prev) => {
        const next = prev.filter((r) => r.enrollment_id !== delItem.enrollment_id);
        const newPages = Math.max(1, Math.ceil(next.length / pageSize));
        setPage((p) => Math.min(p, newPages));
        return next;
      });

      showStatus("success", "Deleted", js?.message || "Enrollment deleted successfully.");
      closeDelete();
    } catch (err) {
      showStatus("danger", "Delete error", err?.message || "Something went wrong.");
      setDelBusy(false);
    }
  }, [delItem, token, pageSize, closeDelete, showStatus]);

  return (
    <div className="container-xxl py-4 py-lg-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 mb-lg-4">
        <div>
          <h3 className="fw-bold mb-1">Enrollments</h3>
          <div className="text-muted small">Filter by student (search), section, school year, curriculum, and status.</div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-2" onClick={onReload} title="Reload">
            <FaRedoAlt /> Refresh
          </button>
          <button className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2" onClick={() => navigate("/enrollments/create")}>
            <FaPlus /> Add Enrollment
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body d-grid gap-2 gap-lg-3" style={{ gridTemplateColumns: "1fr" }}>
          <div className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-2">
            <div className="input-group">
              <span className="input-group-text"><FaSearch /></span>
              <input
                type="text"
                className="form-control"
                placeholder="Search student, section, school year, curriculum, status…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") onClear(); }}
                autoComplete="off"
              />
              {q && <button className="btn btn-outline-secondary" onClick={onClear}>Clear</button>}
            </div>
          </div>

          <div className="flex-grow-1">
            <label className="form-label small text-muted mb-1">Group by</label>
            <select className="form-select" value={groupByKey} onChange={(e) => setGroupByKey(e.target.value)}>
              <option value="none">None</option>
              <option value="sy">School Year</option>
              <option value="section">Section</option>
              <option value="curriculum">Curriculum</option>
              <option value="status">Status</option>
              <option value="date">Date</option>
            </select>
          </div>

          {/* Filters */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="flex-grow-1 d-flex flex-column">
              <label className="form-label small text-muted d-flex align-items-center gap-2 mb-1">
                <FaUserGraduate /> Student
              </label>
              <StudentFilterSearch token={token} value={studentId} onPick={(id) => setStudentId(id || "all")} />
            </div>

            <div className="flex-grow-1">
              <label className="form-label small text-muted d-flex align-items-center gap-2 mb-1">
                <FaLayerGroup /> Section
              </label>
              <select className="form-select" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                <option value="all">All sections</option>
                {sections.map((s) => (
                  <option key={s.section_id} value={s.section_id}>{s.section_name}</option>
                ))}
              </select>
            </div>

            <div className="flex-grow-1">
              <label className="form-label small text-muted d-flex align-items-center gap-2 mb-1">
                <FaCalendarAlt /> School Year
              </label>
              <select className="form-select" value={schoolYearId} onChange={(e) => setSchoolYearId(e.target.value)}>
                <option value="all">All years</option>
                {schoolYears.map((sy) => (
                  <option key={sy.school_year_id} value={sy.school_year_id}>
                    {sy.school_year}{(sy.is_active === 1 || sy.is_active === true || String(sy.is_active) === "1") ? " (Active)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-grow-1">
              <label className="form-label small text-muted d-flex align-items-center gap-2 mb-1">
                <FaBookOpen /> Curriculum
              </label>
              <select className="form-select" value={curriculumId} onChange={(e) => setCurriculumId(e.target.value)}>
                <option value="all">All curriculums</option>
                {curricula.map((c) => (
                  <option key={c.curriculum_id} value={c.curriculum_id}>
                    {c.curriculum_name}{String(activeCurriculumId) === String(c.curriculum_id) ? " (Active)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-grow-1">
              <label className="form-label small text-muted d-flex align-items-center gap-2 mb-1">
                <FaTag /> Status
              </label>
              <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All status</option>
                {(availableStatuses.length ? availableStatuses : ["Enrolled", "Pending", "Dropped", "Completed", "Cancelled"])
                  .map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-0">
          {loading ? (
            <div className="py-5 text-center">
              <div className="spinner-border" role="status" />
              <div className="mt-2 small text-muted">Loading enrollments…</div>
            </div>
          ) : total === 0 ? (
            <div className="p-5 text-center">
              <h5 className="fw-semibold mt-2 mb-1">No enrollments found</h5>
              <p className="text-muted mb-3">Try adjusting filters or create a new enrollment.</p>
              <button className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2" onClick={() => navigate("/enrollments/create")}>
                <FaPlus /> Create Enrollment
              </button>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>
                      <th style={{ width: 70 }}>#</th>
                      <ThSortable col="date" width={140}>Enrolled</ThSortable>
                      <ThSortable col="student">Student</ThSortable>
                      <ThSortable col="section" width={160}>Section</ThSortable>
                      <ThSortable col="sy" width={160}>School Year</ThSortable>
                      <ThSortable col="curriculum">Curriculum</ThSortable>
                      <ThSortable col="status" width={140}>Status</ThSortable>
                      <th style={{ width: 170 }}>Action</th>
                    </tr>
                  </thead>

                  {grouped ? (
                    [...grouped.keys()].map((label) => (
                      <tbody key={label}>
                        <tr className="table-group-divider table-primary-subtle">
                          <td colSpan={9} className="fw-semibold">{label}</td>
                        </tr>
                        {grouped.get(label).map((r) => (
                          <EnrollmentRow
                            key={r.enrollment_id}
                            row={r}
                            onEdit={() => navigate(`/enrollments/edit/${r.enrollment_id}`)}
                            onDelete={() => openDelete(r)}
                          />
                        ))}
                      </tbody>
                    ))
                  ) : (
                    <tbody>
                      {pageRows.map((r) => (
                        <EnrollmentRow
                          key={r.enrollment_id}
                          row={r}
                          onEdit={() => navigate(`/enrollments/edit/${r.enrollment_id}`)}
                          onDelete={() => openDelete(r)}
                        />
                      ))}
                    </tbody>
                  )}
                </table>
              </div>

              {/* Footer */}
              <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-2 p-3">
                <div className="small text-muted">
                  Showing{" "}
                  <strong>
                    {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)}
                  </strong>{" "}
                  of <strong>{total}</strong> enrollments
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <FaChevronLeft /> Prev
                  </button>
                  <span className="small text-muted">Page</span>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: 80 }}
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const v = Number(e.target.value || 1);
                      setPage(Math.min(Math.max(1, v), totalPages));
                    }}
                  />
                  <span className="small text-muted">of {totalPages}</span>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 120 }}
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    {PAGE_SIZES.map((s) => (
                      <option key={s} value={s}>{s} / page</option>
                    ))}
                  </select>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next <FaChevronRight />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <DeleteConfirmModal
        show={delOpen}
        item={delItem}
        busy={delBusy}
        onCancel={closeDelete}
        onConfirm={confirmDelete}
      />

      <StatusModal {...statusModal} onHide={() => setStatusModal((s) => ({ ...s, show: false }))} />
    </div>
  ); 
};

const EnrollmentRow = ({ row, onEdit, onDelete }) => (
  <tr>
    <td className="text-muted">#{row.enrollment_id}</td>
    <td>{fmtDate(row.enrollment_date)}</td>
    <td className="d-flex align-items-center gap-2"><FaUserGraduate className="opacity-50" />{row.student_name || "—"}</td>
    <td>{row.section_name}</td>
    <td>{row.school_year}</td>
    <td>{row.curriculum_name}</td>
    <td>{row.status || "—"}</td>
    <td className="d-flex gap-1">
      <button className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" onClick={onEdit}>
        <FaEdit /> Update
      </button>
      <button className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1" onClick={onDelete}>
        <FaTrash /> Delete
      </button>
    </td>
  </tr>
);

export default EnrollmentList;
