import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FaBookOpen,
  FaCalendarAlt,
  FaChalkboardTeacher,
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
  FaTimesCircle,
} from 'react-icons/fa';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const icons = {
  success: <FaCheckCircle size={20} />,
  danger: <FaTimesCircle size={20} />,
  warning: <FaExclamationTriangle size={20} />,
  info: <FaInfoCircle size={20} />,
};

const PAGE_SIZES = [5, 10, 20, 50];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const dayIndex = Object.fromEntries(DAYS.map((d, i) => [d, i]));

const fmtTime = (t) => {
  if (!t) return "—";
  const [h = "00", m = "00"] = (t || "").split(":");
  const date = new Date();
  date.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const getQueryParam = (search, key, fallback) => {
  const params = new URLSearchParams(search);
  return params.get(key) ?? fallback;
};
const setQueryParams = (navigate, location, next) => {
  const params = new URLSearchParams(location.search);
  Object.entries(next).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") params.delete(k);
    else params.set(k, String(v));
  });
  navigate({ search: params.toString() }, { replace: true });
};

const ClassSchedulesList = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // URL/init
  const initialQ = useMemo(() => getQueryParam(location.search, "q", ""), [location.search]);
  const initialSubject = useMemo(() => getQueryParam(location.search, "subject", "all"), [location.search]);
  const initialTeacher = useMemo(() => getQueryParam(location.search, "teacher", "all"), [location.search]);
  const initialSection = useMemo(() => getQueryParam(location.search, "section", "all"), [location.search]);
  const initialSY = useMemo(() => getQueryParam(location.search, "sy", "all"), [location.search]);
  const initialDay = useMemo(() => getQueryParam(location.search, "day", "all"), [location.search]);
  const initialPage = useMemo(() => Number(getQueryParam(location.search, "page", 1)), [location.search]);
  const initialSize = useMemo(() => Number(getQueryParam(location.search, "size", PAGE_SIZES[1])), [location.search]);
  const initialSort = useMemo(() => getQueryParam(location.search, "sort", "day:asc"), [location.search]);
  const initialGroup = useMemo(() => getQueryParam(location.search, "group", "none"), [location.search]);

  // state
  const [q, setQ] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  const [subject, setSubject] = useState(initialSubject);
  const [teacher, setTeacher] = useState(initialTeacher);
  const [section, setSection] = useState(initialSection);
  const [schoolYear, setSchoolYear] = useState(initialSY); // value should be school_year_id or "all"
  const [day, setDay] = useState(DAYS.includes(initialDay) ? initialDay : "all");
  const [page, setPage] = useState(Number.isFinite(initialPage) && initialPage > 0 ? initialPage : 1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES.includes(initialSize) ? initialSize : PAGE_SIZES[1]);
  const [sort, setSort] = useState(initialSort);
  const [groupBy, setGroupBy] = useState(["none", "sy", "teacher", "subject", "section", "day"].includes(initialGroup) ? initialGroup : "none");

  // data
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [sections, setSections] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);

  // Active school year (for defaulting & display)
  const [activeSyId, setActiveSyId] = useState(null);
  const [activeSyLabel, setActiveSyLabel] = useState(null);

  const [statusModal, setStatusModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "info",
    icon: icons.info,
  });
  const showStatus = (variant, title, message) =>
    setStatusModal({ show: true, title, message, variant, icon: icons[variant] });

  const inFlight = useRef(false);
  const token = useMemo(() => sessionStorage.getItem("token"), []);

  const handleUnauthorized = () => {
    showStatus("danger", "Unauthorized", "Please login to continue.");
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 800);
  };

  const apiFetch = async (path, options = {}) => {
    const res = await fetch(`${BASE_URL}${path}`, {
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

  // fetchers
  const fetchAllSubjects = async () => {
    let page = 1;
    const limit = 100;
    let totalPages = 1;
    const all = [];
    while (page <= totalPages) {
      const url = new URL(`${BASE_URL}/subjects/view-all-subjects`);
      url.searchParams.set("page", page);
      url.searchParams.set("limit", String(limit));
      const res = await fetch(url.toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) throw new Error("Failed to fetch subjects");
      const js = await res.json();
      const list = Array.isArray(js?.data) ? js.data : [];
      all.push(...list);
      const p = js?.pagination;
      totalPages = p?.totalPages || 1;
      page += 1;
    }
    return all;
  };

  const fetchTeachers = async () => {
    const res = await apiFetch(`/teachers`, { method: "GET" });
    if (!res.ok) throw new Error("Failed to fetch teachers");
    const js = await res.json();
    return Array.isArray(js?.data) ? js.data : [];
  };

  const fetchSections = async () => {
    const res = await apiFetch(`/sections`, { method: "GET" });
    if (!res.ok) throw new Error("Failed to fetch sections");
    const js = await res.json();
    return Array.isArray(js?.data) ? js.data : [];
  };

  // Keep is_active so we can identify the active record
  const fetchSchoolYears = async () => {
    const res = await apiFetch(`/school-year/all-school-years`, { method: "GET" });
    if (!res.ok) throw new Error("Failed to fetch school years");
    const js = await res.json();
    const list = Array.isArray(js?.schoolYears) ? js.schoolYears : [];
    return list.map((sy) => ({
      school_year_id: sy.school_year_id,
      school_year: `${sy.start_year}-${sy.end_year}`,
      is_active: Number(sy?.is_active) === 1 || sy?.is_active === true,
      start_year: sy.start_year,
      end_year: sy.end_year,
    }));
  };

  const fetchSchedules = async () => {
    const res = await apiFetch(`/class-schedules`, { method: "GET" });
    if (!res.ok) throw new Error("Failed to fetch class schedules");
    const js = await res.json();
    return Array.isArray(js?.data) ? js.data : [];
  };

  // Determine active school year (id + label) using the same endpoint
  const fetchActiveSchoolYearInfo = async () => {
    const res = await apiFetch(`/school-year/all-school-years`, { method: "GET" });
    if (!res.ok) throw new Error("Failed to fetch school years");
    const js = await res.json();
    const list = Array.isArray(js?.schoolYears) ? js.schoolYears : [];

    let active = list.find((y) => Number(y?.is_active) === 1 || y?.is_active === true);
    if (!active) {
      const candidates = list.filter((y) => Number(y?.end_year) > 0);
      if (candidates.length > 0) {
        active = candidates.reduce((a, b) =>
          Number(a.end_year) >= Number(b.end_year) ? a : b
        );
      }
    }
    if (active && Number(active.start_year) > 0 && Number(active.end_year) > 0) {
      return {
        id: active.school_year_id,
        label: `${active.start_year}-${active.end_year}`,
      };
    }
    return { id: null, label: null };
  };

  // init
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        inFlight.current = true;

        const [activeInfo, sched, subs, teach, sects, sys] = await Promise.all([
          fetchActiveSchoolYearInfo(),
          fetchSchedules(),
          fetchAllSubjects(),
          fetchTeachers(),
          fetchSections(),
          fetchSchoolYears(),
        ]);

        if (cancelled) return;

        setRows(sched);
        setSubjects(subs);
        setTeachers(teach);
        setSections(sects);
        setSchoolYears(sys);

        // Save active SY info for display
        setActiveSyId(activeInfo.id);
        setActiveSyLabel(activeInfo.label);

        // Default the filter to ACTIVE SY if:
        // 1) URL didn't specify ?sy=..., or
        // 2) The specified id isn't in the list.
        const sysIds = new Set(sys.map((s) => String(s.school_year_id)));
        const hasUrlSy = initialSY !== "all";
        const urlSyValid = hasUrlSy && sysIds.has(String(initialSY));

        if (!urlSyValid && activeInfo.id) {
          setSchoolYear(String(activeInfo.id));
        }
      } catch (err) {
        if (err?.message !== "Unauthorized") {
          showStatus("danger", "Load error", err?.message || "Something went wrong.");
        }
      } finally {
        if (!cancelled) setLoading(false);
        inFlight.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // reflect state -> URL
  useEffect(() => {
    setQueryParams(navigate, location, {
      q: debouncedQ || undefined,
      subject: subject !== "all" ? subject : undefined,
      teacher: teacher !== "all" ? teacher : undefined,
      section: section !== "all" ? section : undefined,
      sy: schoolYear !== "all" ? schoolYear : undefined, // holds school_year_id
      day: day !== "all" ? day : undefined,
      page,
      size: pageSize,
      sort,
      group: groupBy !== "none" ? groupBy : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, subject, teacher, section, schoolYear, day, page, pageSize, sort, groupBy]);

  // filter → sort → paginate
  const filtered = useMemo(() => {
    const needle = (debouncedQ || "").trim().toLowerCase();
    return rows.filter((r) => {
      const matchSubject = subject === "all" ? true : String(r.subject_id) === String(subject);
      const matchTeacher = teacher === "all" ? true : String(r.teacher_id) === String(teacher);
      const matchSection = section === "all" ? true : String(r.section_id) === String(section);
      const matchSY = schoolYear === "all" ? true : String(r.school_year_id) === String(schoolYear);
      const matchDay = day === "all" ? true : r.day_of_week === day;
      const hay = `${r.subject_name ?? ""} ${r.teacher_name ?? ""} ${r.section_name ?? ""} ${r.school_year ?? ""} ${r.day_of_week ?? ""}`.toLowerCase();
      const matchQ = needle ? hay.includes(needle) : true;
      return matchSubject && matchTeacher && matchSection && matchSY && matchDay && matchQ;
    });
  }, [rows, debouncedQ, subject, teacher, section, schoolYear, day]);

  const sorted = useMemo(() => {
    const [key, dir] = (sort || "day:asc").split(":");
    const asc = dir !== "desc";
    const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    const by = (r) => {
      switch (key) {
        case "subject":
          return (r.subject_name || "").toLowerCase();
        case "teacher":
          return (r.teacher_name || "").toLowerCase();
        case "section":
          return (r.section_name || "").toLowerCase();
        case "sy":
          return (r.school_year || "").toLowerCase();
        case "start":
          return r.start_time || "";
        case "end":
          return r.end_time || "";
        case "day":
        default:
          return dayIndex[r.day_of_week] ?? 99;
      }
    };
    const arr = [...filtered].sort((A, B) => {
      const va = by(A),
        vb = by(B);
      return asc ? cmp(va, vb) : cmp(vb, va);
    });
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, subject, teacher, section, schoolYear, day, pageSize, sort, groupBy]);

  const onClear = () => setQ("");
  const onReload = () => window.location.reload();

  const SortIcon = ({ col }) => {
    const [k, dir] = (sort || "day:asc").split(":");
    if (k !== col) return <FaSort className="opacity-50" />;
    return dir === "asc" ? <FaSortUp /> : <FaSortDown />;
  };

  const ThSortable = ({ col, children, width }) => (
    <th style={width ? { width } : undefined}>
      <button
        type="button"
        className="btn btn-link p-0 text-decoration-none d-inline-flex align-items-center gap-1"
        onClick={() => {
          const [k, dir] = (sort || "day:asc").split(":");
          if (k === col) setSort(`${col}:${dir === "asc" ? "desc" : "asc"}`);
          else setSort(`${col}:asc`);
        }}
        aria-label={`Sort by ${children}`}
      >
        <span className="fw-semibold text-body">{children}</span>
        <SortIcon col={col} />
      </button>
    </th>
  );

  // ---- Grouping helpers ----
  const groupKeyFns = {
    none: () => "All",
    sy: (r) => r.school_year || "—",
    teacher: (r) => r.teacher_name || "—",
    subject: (r) => r.subject_name || "—",
    section: (r) => r.section_name || "—",
    day: (r) => r.day_of_week || "—",
  };

  const grouped = useMemo(() => {
    if (groupBy === "none") return null;
    const g = new Map();
    for (const r of pageData) {
      const k = groupKeyFns[groupBy](r);
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(r);
    }
    return g; // Map<label, rows[]>
  }, [pageData, groupBy]);

  return (
    <div className="container-xxl py-4 py-lg-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 mb-lg-4">
        <div>
          <h3 className="fw-bold mb-1">Class Schedules</h3>
          <div className="text-muted small">
            Filter by subject, teacher, section, school year, and day of week.
          </div>
          {activeSyLabel && (
            <div className="small text-success mt-1">
             Active School Year <span className="fw-semibold">{activeSyLabel}</span>
            </div>
          )}
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button
            className="btn btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-2"
            onClick={onReload}
            title="Reload"
          >
            <FaRedoAlt /> Refresh
          </button>
          <button
            className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2"
            onClick={() => navigate("/class-schedules/create")}
          >
            <FaPlus /> Add Schedule
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body d-grid gap-2 gap-lg-3" style={{ gridTemplateColumns: "1fr" }}>
          <div className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-2">
            <div className="input-group">
              <span className="input-group-text">
                <FaSearch />
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search subject, teacher, section, or school year…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onClear();
                }}
                autoComplete="off"
              />
              {q ? (
                <button className="btn btn-outline-secondary" onClick={onClear} aria-label="Clear search">
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {/* Group By */}
          <div className="flex-grow-1">
            <label className="form-label small text-muted mb-1">Group by</label>
            <select className="form-select" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              <option value="none">None</option>
              <option value="sy">School Year</option>
              <option value="teacher">Teacher</option>
              <option value="subject">Subject</option>
              <option value="section">Section</option>
              <option value="day">Day</option>
            </select>
          </div>

          {/* Filters row (inline, single line wrapping) */}
          <div className="d-flex flex-wrap align-items-end gap-2">
            {/* Subject */}
            <div className="flex-grow-1">
              <label className="form-label small text-muted d-flex align-items-center gap-2 mb-1">
                <FaBookOpen /> Subject
              </label>
              <select className="form-select" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="all">All subjects</option>
                {subjects.map((s) => (
                  <option key={s.subject_id} value={s.subject_id}>
                    {s.subject_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Teacher */}
            <div className="flex-grow-1">
              <label className="form-label small text-muted d-flex align-items-center gap-2 mb-1">
                <FaChalkboardTeacher /> Teacher
              </label>
              <select className="form-select" value={teacher} onChange={(e) => setTeacher(e.target.value)}>
                <option value="all">All teachers</option>
                {teachers.map((t) => (
                  <option key={t.teacher_id} value={t.teacher_id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Section */}
            <div className="flex-grow-1">
              <label className="form-label small text-muted d-flex align-items-center gap-2 mb-1">
                <FaLayerGroup /> Section
              </label>
              <select className="form-select" value={section} onChange={(e) => setSection(e.target.value)}>
                <option value="all">All sections</option>
                {sections.map((s) => (
                  <option key={s.section_id} value={s.section_id}>
                    {s.section_name}
                  </option>
                ))}
              </select>
            </div>

            {/* School Year (defaults to ACTIVE) */}
            <div className="flex-grow-1">
              <label className="form-label small text-muted d-flex align-items-center gap-2 mb-1">
                <FaCalendarAlt /> School Year
              </label>
              <select className="form-select" value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)}>
                <option value="all">All years</option>
                {schoolYears.map((sy) => (
                  <option key={sy.school_year_id} value={sy.school_year_id}>
                    {sy.school_year}
                  </option>
                ))}
              </select>
            </div>

            {/* Day */}
            <div className="flex-grow-1">
              <label className="form-label small text-muted mb-1">Day of week</label>
              <select className="form-select" value={day} onChange={(e) => setDay(e.target.value)}>
                <option value="all">All days</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
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
              <div className="mt-2 small text-muted">Loading schedules…</div>
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-5 text-center">
              <h5 className="fw-semibold mt-2 mb-1">No schedules found</h5>
              <p className="text-muted mb-3">Try adjusting filters or create a new schedule.</p>
              <button
                className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2"
                onClick={() => navigate("/class-schedules/create")}
              >
                <FaPlus /> Create Schedule
              </button>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>
                      <th style={{ width: 90 }}>#</th>
                      <ThSortable col="day" width={140}>
                        Day
                      </ThSortable>
                      <ThSortable col="start" width={130}>
                        Start
                      </ThSortable>
                      <ThSortable col="end" width={130}>
                        End
                      </ThSortable>
                      <ThSortable col="subject">Subject</ThSortable>
                      <ThSortable col="teacher">Teacher</ThSortable>
                      <ThSortable col="section" width={160}>
                        Section
                      </ThSortable>
                      <ThSortable col="sy" width={160}>
                        School Year
                      </ThSortable>
                      <th style={{ width: 120 }}>Action</th>
                    </tr>
                  </thead>

                  {/* Body (grouped or flat) */}
                  {groupBy === "none" ? (
                    <tbody>
                      {pageData.map((r) => (
                        <tr key={r.schedule_id}>
                          <td className="text-muted">#{r.schedule_id}</td>
                          <td>{r.day_of_week}</td>
                          <td>{fmtTime(r.start_time)}</td>
                          <td>{fmtTime(r.end_time)}</td>
                          <td>{r.subject_name}</td>
                          <td>{r.teacher_name}</td>
                          <td>{r.section_name}</td>
                          <td>{r.school_year}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                              onClick={() => navigate(`/class-schedules/edit/${r.schedule_id}`)}
                            >
                              <FaEdit /> Update
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  ) : (
                    <tbody>
                      {[...grouped.keys()].map((label) => (
                        <React.Fragment key={label}>
                          <tr className="table-group-divider table-primary-subtle">
                            <td colSpan={9} className="fw-semibold">
                              {label}
                            </td>
                          </tr>
                          {grouped.get(label).map((r) => (
                            <tr key={r.schedule_id}>
                              <td className="text-muted">#{r.schedule_id}</td>
                              <td>{r.day_of_week}</td>
                              <td>{fmtTime(r.start_time)}</td>
                              <td>{fmtTime(r.end_time)}</td>
                              <td>{r.subject_name}</td>
                              <td>{r.teacher_name}</td>
                              <td>{r.section_name}</td>
                              <td>{r.school_year}</td>
                              <td>
                                <button
                                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                  onClick={() => navigate(`/class-schedules/edit/${r.schedule_id}`)}
                                >
                                  <FaEdit /> Update
                                </button>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
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
                    {(currentPage - 1) * pageSize + 1}
                    {"–"}
                    {Math.min(currentPage * pageSize, sorted.length)}
                  </strong>{" "}
                  of <strong>{sorted.length}</strong> schedules
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
                      <option key={s} value={s}>
                        {s} / page
                      </option>
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

      <StatusModal {...statusModal} onHide={() => setStatusModal((s) => ({ ...s, show: false }))} />
    </div>
  );
};

export default ClassSchedulesList;
