import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaEdit,
  FaExclamationTriangle,
  FaInfoCircle,
  FaPlus,
  FaSearch,
  FaSort,
  FaSortDown,
  FaSortUp,
  FaSyncAlt,
  FaTimes,
  FaTimesCircle,
  FaUserTie,
} from 'react-icons/fa';
import {
  useNavigate,
  useSearchParams,
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
const SORT_FIELDS = { id: "teacher_id", name: "full_name", created: "created_at", updated: "updated_at" };

const toBool = (v) => (v === true || v === "true" || v === 1 || v === "1");
const coalesce = (v, alt = "") => (v === null || v === undefined ? alt : v);
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(); } catch { return "—"; } };

const buildComparator = (field, dir = "asc") => {
  const fn = (a, b) => {
    const va = coalesce(a?.[field], "");
    const vb = coalesce(b?.[field], "");
    if (typeof va === "number" && typeof vb === "number") return va - vb;
    if (typeof va === "string" && typeof vb === "string" && (/\d{4}-\d{2}-\d{2}/.test(va) || /\d{4}-\d{2}-\d{2}/.test(vb))) {
      return new Date(va).getTime() - new Date(vb).getTime();
    }
    return String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
  };
  return (a, b) => (dir === "asc" ? fn(a, b) : -fn(a, b));
};

const TeachersList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Per-teacher grade-input status: { [id]: { loading, toggling, can } }
  const [inputMap, setInputMap] = useState({});

  // Bulk toggle state
  const [bulkWorking, setBulkWorking] = useState(false);
  const masterRef = useRef(null);

  const [statusModal, setStatusModal] = useState({
    show: false, title: "", message: "", variant: "info", icon: icons.info,
  });
  const showStatus = (variant, title, message) =>
    setStatusModal({ show: true, title, message, variant, icon: icons[variant] });

  // URL-synced controls
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "all"); // all|active|inactive
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [pageSize, setPageSize] = useState(Number(searchParams.get("size") || PAGE_SIZES[1]));
  const [sortKey, setSortKey] = useState(searchParams.get("sortKey") || "name");
  const [sortDir, setSortDir] = useState(searchParams.get("sortDir") || "asc");

  const debounceRef = useRef(null);
  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const inFlight = useRef(false);

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
    if (res.status === 401) { handleUnauthorized(); throw new Error("Unauthorized"); }
    return res;
  };

  const fetchTeachers = async () => {
    try {
      if (inFlight.current) return;
      inFlight.current = true;
      setRefreshing(true);
      if (teachers.length === 0) setLoading(true);

      const res = await apiFetch(`/teachers`, { method: "GET" });
      if (!res.ok) throw new Error("Failed to fetch teachers");
      const payload = await res.json();
      setTeachers(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      if (err.message !== "Unauthorized") showStatus("danger", "Error", err.message || "Something went wrong.");
    } finally {
      setLoading(false); setRefreshing(false); inFlight.current = false;
    }
  };

  useEffect(() => { fetchTeachers(); /* eslint-disable-next-line */ }, [token]);

  const syncParams = (overrides = {}) => {
    const next = new URLSearchParams(searchParams);
    const updates = { q, status, page: String(page), size: String(pageSize), sortKey, sortDir, ...overrides };
    Object.entries(updates).forEach(([k, v]) => { if (v == null || String(v).trim() === "") next.delete(k); else next.set(k, String(v)); });
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => syncParams({ page: "1" }), 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line
  }, [q]);

  useEffect(() => { syncParams(); /* eslint-disable-next-line */ }, [status, page, pageSize, sortKey, sortDir]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return teachers.filter((t) => {
      const matchActive = status === "all" ? true : status === "active" ? toBool(t.is_active) : !toBool(t.is_active);
      if (!needle) return matchActive;
      const hay = [
        t.full_name, t.first_name, t.middle_name, t.last_name,
        t.email, t.teacher_address, t.contact_number, String(t.teacher_id),
      ].filter(Boolean).join(" ").toLowerCase();
      return matchActive && hay.includes(needle);
    });
  }, [teachers, q, status]);

  const sorted = useMemo(() => {
    const field = SORT_FIELDS[sortKey] || SORT_FIELDS.name;
    const cmp = buildComparator(field, sortDir);
    return [...filtered].sort(cmp);
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  useEffect(() => setPage(1), [status, pageSize]);

  // ---- Grade Input Status: load for visible rows only
  useEffect(() => {
    const idsToFetch = pageData.map((t) => t.teacher_id).filter((id) => inputMap[id] === undefined);
    if (idsToFetch.length === 0) return;

    const load = async (id) => {
      try {
        // GET /grades/input-status/:teacher_id → { can_input: boolean }
        setInputMap((m) => ({ ...m, [id]: { loading: true, toggling: false, can: null } }));
        const res = await apiFetch(`/grades/input-status/${id}`, { method: "GET" });
        if (!res.ok) throw new Error("Failed to fetch input status");
        const data = await res.json();
        setInputMap((m) => ({ ...m, [id]: { loading: false, toggling: false, can: Boolean(data?.can_input) } }));
      } catch {
        setInputMap((m) => ({ ...m, [id]: { loading: false, toggling: false, can: null } }));
      }
    };

    idsToFetch.forEach(load);
    // eslint-disable-next-line
  }, [pageData, token]);

  // ---- Set (not just toggle) desired state for a teacher by calling toggle only when needed
  const setTeacherCanInput = async (teacherId, targetOn) => {
    const entry = inputMap[teacherId];
    if (!entry || entry.loading) {
      // If unknown, fetch first then recurse
      try {
        setInputMap((m) => ({ ...m, [teacherId]: { loading: true, toggling: false, can: null } }));
        const res = await apiFetch(`/grades/input-status/${teacherId}`, { method: "GET" });
        const data = await res.json();
        setInputMap((m) => ({ ...m, [teacherId]: { loading: false, toggling: false, can: Boolean(data?.can_input) } }));
        return setTeacherCanInput(teacherId, targetOn);
      } catch {
        setInputMap((m) => ({ ...m, [teacherId]: { loading: false, toggling: false, can: null } }));
        throw new Error("Cannot determine current status.");
      }
    }

    if (entry.can === targetOn) return; // already correct

    setInputMap((m) => ({ ...m, [teacherId]: { ...entry, toggling: true } }));
    try {
      /**
       * POST /grades/toggle-input/:teacher_id
       * Headers: Content-Type: application/json
       * Body: none
       * Response: { success, message, newStatus: boolean, timestamp }
       */
      const res = await apiFetch(`/grades/toggle-input/${teacherId}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to toggle grade input");
      const data = await res.json();
      const next = Boolean(data?.newStatus);
      setInputMap((m) => ({ ...m, [teacherId]: { loading: false, toggling: false, can: next } }));
    } catch (err) {
      setInputMap((m) => ({ ...m, [teacherId]: { ...entry, toggling: false } }));
      throw err;
    }
  };

  // ---- Per-row click from switch
  const onRowToggle = async (teacherId) => {
    const entry = inputMap[teacherId];
    const target = !(entry?.can === true);
    try {
      await setTeacherCanInput(teacherId, target);
      showStatus(target ? "success" : "warning", target ? "Enabled" : "Disabled", `Grade input ${target ? "enabled" : "disabled"} for teacher #${teacherId}.`);
    } catch (err) {
      showStatus("danger", "Toggle Failed", err?.message || "Unable to update grade input.");
    }
  };

  // ---- Master (this page) switch: set all on page to desired state
  const pageKnown = pageData.filter((t) => inputMap[t.teacher_id] && inputMap[t.teacher_id].loading === false);
  const pageAllOn = pageKnown.length === pageData.length && pageKnown.every((t) => inputMap[t.teacher_id].can === true);
  const pageAllOff = pageKnown.length === pageData.length && pageKnown.every((t) => inputMap[t.teacher_id].can === false);
  const pageMixed = !pageAllOn && !pageAllOff;

  useEffect(() => {
    if (masterRef.current) masterRef.current.indeterminate = pageMixed && pageKnown.length > 0;
  }, [pageMixed, pageKnown.length]);

  const onMasterChange = async (e) => {
    const targetOn = e.target.checked; // true = enable all, false = disable all
    try {
      setBulkWorking(true);

      // Ensure statuses known for all on page
      await Promise.all(
        pageData.map(async (t) => {
          const entry = inputMap[t.teacher_id];
          if (!entry || entry.loading) {
            try {
              const res = await apiFetch(`/grades/input-status/${t.teacher_id}`, { method: "GET" });
              const data = await res.json();
              setInputMap((m) => ({ ...m, [t.teacher_id]: { loading: false, toggling: false, can: Boolean(data?.can_input) } }));
            } catch {
              setInputMap((m) => ({ ...m, [t.teacher_id]: { loading: false, toggling: false, can: null } }));
            }
          }
        })
      );

      // After statuses known, toggle only those that need change
      const toChange = pageData
        .filter((t) => (inputMap[t.teacher_id]?.can !== targetOn))
        .map((t) => t.teacher_id);

      for (const id of toChange) {
        await setTeacherCanInput(id, targetOn);
      }

      showStatus(
        targetOn ? "success" : "warning",
        targetOn ? "Enabled for All (this page)" : "Disabled for All (this page)",
        `${toChange.length} teacher${toChange.length === 1 ? "" : "s"} updated.`
      );
    } catch (err) {
      showStatus("danger", "Bulk Update Failed", err?.message || "Unable to update all.");
    } finally {
      setBulkWorking(false);
    }
  };

  // ---- UI actions
  const onCreate = () => navigate("/teacher/create");
  const onEdit = (id) => navigate(`/teacher/edit/${id}`);
  const onAssignSubject = () => navigate("/teacher-assignments/create");
  const onRefresh = () => fetchTeachers();
  const onReset = () => {
    setQ(""); setStatus("all"); setPage(1); setPageSize(PAGE_SIZES[1]); setSortKey("name"); setSortDir("asc");
  };

  const toggleSort = (key) => {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); return; }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };
  const SortIcon = ({ k }) => (sortKey !== k ? <FaSort className="ms-1 text-muted" /> : (sortDir === "asc" ? <FaSortUp className="ms-1" /> : <FaSortDown className="ms-1" />));

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, sorted.length);

  return (
    <div className="container-xxl py-4 py-lg-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 mb-lg-4">
        <div>
          <h3 className="fw-bold mb-1">Teachers</h3>
          <div className="text-muted small">Manage teacher records, search, filter, sort — and assign subjects.</div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-2" onClick={onRefresh} disabled={refreshing} title="Refresh">
            <FaSyncAlt className={refreshing ? "spinner-border spinner-border-sm" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button className="btn btn-outline-success rounded-3 d-inline-flex align-items-center gap-2" onClick={onAssignSubject}>
            <FaPlus /> Assign Subject
          </button>
          <button className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2" onClick={onCreate}>
            <FaPlus /> Add Teacher
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-3">
          {/* Search */}
          <div className="input-group">
            <span className="input-group-text"><FaSearch /></span>
            <input
              type="text"
              className="form-control"
              placeholder="Search name, email, address, or ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
            {q && (
              <button className="btn btn-outline-secondary" type="button" onClick={() => setQ("")} title="Clear search">
                <FaTimes />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="d-flex align-items-center gap-2 ms-lg-auto">
            <label className="form-label mb-0 small text-muted">Status</label>
            <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="all">All</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>

            <label className="form-label mb-0 small text-muted ms-2">Show</label>
            <select className="form-select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ maxWidth: 120 }}>
              {PAGE_SIZES.map((s) => (<option key={s} value={s}>{s} / page</option>))}
            </select>

            <button className="btn btn-link text-decoration-none ms-2" onClick={onReset}>Reset</button>
          </div>

          {/* Master switch (this page) */}
          <div className="d-flex align-items-center gap-2">
            <label className="form-label mb-0 small text-muted">Grade Input (this page)</label>
            <div className="form-check form-switch m-0">
              <input
                ref={masterRef}
                className="form-check-input"
                type="checkbox"
                checked={pageAllOn}
                onChange={onMasterChange}
                disabled={bulkWorking || pageData.length === 0 || pageKnown.length === 0}
                title="Enable/disable grade input for ALL teachers on this page"
              />
            </div>
            {bulkWorking && <span className="spinner-border spinner-border-sm" role="status" />}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-0">
          {loading ? (
            <div className="py-5 text-center">
              <div className="spinner-border" role="status" />
              <div className="mt-2 small text-muted">Loading teachers…</div>
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-5 text-center">
              <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-secondary" style={{ width: 72, height: 72 }}>
                <FaUserTie size={28} className="text-muted" />
              </div>
              <h5 className="fw-semibold mt-3 mb-1">No teachers found</h5>
              <p className="text-muted mb-3">Try adjusting your search or create a new teacher.</p>
              <div className="d-flex justify-content-center gap-2">
                <button className="btn btn-outline-success rounded-3 d-inline-flex align-items-center gap-2" onClick={onAssignSubject}>
                  <FaPlus /> Assign Subject
                </button>
                <button className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2" onClick={onCreate}>
                  <FaPlus /> Create Teacher
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th role="button" onClick={() => toggleSort("id")}>ID <SortIcon k="id" /></th>
                      <th role="button" onClick={() => toggleSort("name")}>Name <SortIcon k="name" /></th>
                      <th>Email</th>
                      <th>Address</th>
                      <th>Date of Birth</th>
                      <th>Contact</th>
                      <th>Status</th>
                      <th>Input Grades</th>
                      <th className="text-end" style={{ minWidth: 240 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((t) => {
                      const entry = inputMap[t.teacher_id] || { loading: true, toggling: false, can: null };
                      const { loading: sLoading, toggling, can } = entry;
                      return (
                        <tr key={t.teacher_id}>
                          <td className="text-muted">#{t.teacher_id}</td>
                          <td className="fw-medium">{coalesce(t.full_name, "—")}</td>
                          <td>{t.email || <span className="text-muted">—</span>}</td>
                          <td className="text-truncate" style={{ maxWidth: 260 }}>
                            {t.teacher_address || <span className="text-muted">—</span>}
                          </td>
                          <td>{t.date_of_birth ? fmtDate(t.date_of_birth) : <span className="text-muted">—</span>}</td>
                          <td>{t.contact_number || <span className="text-muted">—</span>}</td>
                          <td>
                            <span className={`badge rounded-pill ${toBool(t.is_active) ? "text-bg-success" : "text-bg-secondary"}`}>
                              {toBool(t.is_active) ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td>
                             {/* status pill (compact) */}
                                {sLoading ? (
                                  <span className="badge bg-secondary">
                                    <span className="spinner-border spinner-border-sm" role="status" />
                                  </span>
                                ) : can === true ? (
                                  <span className="badge bg-success d-inline-flex align-items-center gap-1">
                                    <FaCheckCircle size={12} /> Open
                                  </span>
                                ) : can === false ? (
                                  <span className="badge bg-secondary d-inline-flex align-items-center gap-1">
                                    <FaTimesCircle size={12} /> Closed
                                  </span>
                                ) : (
                                  <span className="badge bg-warning text-dark d-inline-flex align-items-center gap-1">
                                    <FaExclamationTriangle size={12} /> Unknown
                                  </span>
                                )}
                          </td>

                          {/* Action column with Edit + Grade Input switch */}
                          <td className="text-end">
                            <div className="d-inline-flex align-items-center gap-2">
                              <button className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" onClick={() => onEdit(t.teacher_id)}>
                                <FaEdit /> Edit
                              </button>

                              {/* Grade Input switch (per teacher) */}
                              <div className="d-flex align-items-center gap-2" title="Enable/disable grade input for ALL assignments of this teacher">
              

                                <div className="form-check form-switch m-0">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={!!can}
                                    onChange={() => onRowToggle(t.teacher_id)}
                                    disabled={sLoading || toggling}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-2 p-3">
                <div className="small text-muted">
                  Showing <strong>{startIndex}–{endIndex}</strong> of <strong>{sorted.length}</strong> teachers
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button className="btn btn-outline-secondary btn-sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
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
                  <button className="btn btn-outline-secondary btn-sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
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

export default TeachersList;
