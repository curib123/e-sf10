import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaInfoCircle,
  FaPlus,
  FaSearch,
  FaUserTie,
  FaChevronLeft,
  FaChevronRight,
  FaEdit,
  FaSyncAlt,
  FaTimes,
  FaSort,
  FaSortUp,
  FaSortDown,
} from "react-icons/fa";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

// ──────────────────────────────────────────────────────────────────────────────
// Icons per status
// ──────────────────────────────────────────────────────────────────────────────
const icons = {
  success: <FaCheckCircle size={20} />,
  danger: <FaTimesCircle size={20} />,
  warning: <FaExclamationTriangle size={20} />,
  info: <FaInfoCircle size={20} />,
};

const PAGE_SIZES = [5, 10, 20, 50];

// Sortable fields map: key -> accessor
const SORT_FIELDS = {
  id: "teacher_id",
  name: "full_name",
  created: "created_at",
  updated: "updated_at",
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
const toBool = (v) => (v === true || v === "true");
const coalesce = (v, alt = "") => (v === null || v === undefined ? alt : v);
const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "—";
  }
};

const buildComparator = (field, dir = "asc") => {
  const fn = (a, b) => {
    const va = coalesce(a?.[field], "");
    const vb = coalesce(b?.[field], "");
    // numeric compare if both are numbers
    if (typeof va === "number" && typeof vb === "number") {
      return va - vb;
    }
    // date compare if looks like ISO
    if (typeof va === "string" && typeof vb === "string" && (/\d{4}-\d{2}-\d{2}/.test(va) || /\d{4}-\d{2}-\d{2}/.test(vb))) {
      const da = new Date(va).getTime();
      const db = new Date(vb).getTime();
      return da - db;
    }
    // string compare
    return String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
  };
  return (a, b) => (dir === "asc" ? fn(a, b) : -fn(a, b));
};

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────
const TeachersList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── State
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Status modal
  const [statusModal, setStatusModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "info",
    icon: icons.info,
  });
  const showStatus = (variant, title, message) =>
    setStatusModal({ show: true, title, message, variant, icon: icons[variant] });

  // URL-synced filters (source of truth)
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "all"); // all | active | inactive
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [pageSize, setPageSize] = useState(
    Number(searchParams.get("size") || PAGE_SIZES[1])
  );
  const [sortKey, setSortKey] = useState(searchParams.get("sortKey") || "name"); // id | name | created | updated
  const [sortDir, setSortDir] = useState(searchParams.get("sortDir") || "asc"); // asc | desc

  // debounce for search
  const debounceRef = useRef(null);

  // auth
  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const inFlight = useRef(false);

  const handleUnauthorized = () => {
    showStatus("danger", "Unauthorized", "Please login to continue.");
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 800);
  };

  const apiFetch = async (path, options = {}) => {
    const controller = new AbortController();
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
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

  // ── Initial fetch + refresh
  const fetchTeachers = async () => {
    try {
      if (inFlight.current) return;
      inFlight.current = true;
      setRefreshing(true);
      if (teachers.length === 0) setLoading(true);

      // ESF10 endpoint (get-all-teacher)
      const res = await apiFetch(`/teachers`, { method: "GET" });
      if (!res.ok) throw new Error("Failed to fetch teachers");
      const payload = await res.json();
      const list = Array.isArray(payload?.data) ? payload.data : [];
      setTeachers(list);
    } catch (err) {
      if (err.message !== "Unauthorized") {
        showStatus("danger", "Error", err.message || "Something went wrong.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlight.current = false;
    }
  };

  useEffect(() => {
    fetchTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Keep URL in sync whenever local state changes
  const syncParams = (overrides = {}) => {
    const next = new URLSearchParams(searchParams);
    const updates = {
      q,
      status,
      page: String(page),
      size: String(pageSize),
      sortKey,
      sortDir,
      ...overrides,
    };

    // write (delete empty ones)
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === null || String(v).trim() === "") {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    });

    setSearchParams(next, { replace: true });
  };

  // Search debounce → URL
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // reset to first page when query changes
      syncParams({ page: "1" });
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Other filters immediate → URL
  useEffect(() => {
    syncParams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, pageSize, sortKey, sortDir]);

  // ── Derived view: filter → sort → paginate
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return teachers.filter((t) => {
      const matchActive =
        status === "all" ? true : status === "active" ? toBool(t.is_active) : !toBool(t.is_active);

      if (!needle) return matchActive;

      const hay = [
        t.full_name,
        t.first_name,
        t.middle_name,
        t.last_name,
        t.email,
        t.teacher_address,
        t.contact_number,
        String(t.teacher_id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

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

  // Reset to first page when filters affecting count change
  useEffect(() => setPage(1), [status, pageSize]);

  // ── Actions
  const onCreate = () => navigate("/teacher/create");
  const onEdit = (id) => navigate(`/teacher/edit/${id}`);
  const onAssignSubject = () => navigate("/teacher-assignments/create");
  const onRefresh = () => fetchTeachers();
  const onReset = () => {
    setQ("");
    setStatus("all");
    setPage(1);
    setPageSize(PAGE_SIZES[1]);
    setSortKey("name");
    setSortDir("asc");
  };

  // Sorting toggler
  const toggleSort = (key) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <FaSort className="ms-1 text-muted" />;
    return sortDir === "asc" ? (
      <FaSortUp className="ms-1" />
    ) : (
      <FaSortDown className="ms-1" />
    );
  };

  return (
    <div className="container-xxl py-4 py-lg-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 mb-lg-4">
        <div>
          <h3 className="fw-bold mb-1">Teachers</h3>
          <div className="text-muted small">
            Manage teacher records, search, filter, sort — and assign subjects.
          </div>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-2"
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh"
          >
            <FaSyncAlt className={refreshing ? "spinner-border spinner-border-sm" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            className="btn btn-outline-success rounded-3 d-inline-flex align-items-center gap-2"
            onClick={onAssignSubject}
          >
            <FaPlus /> Assign Subject
          </button>
          <button
            className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2"
            onClick={onCreate}
          >
            <FaPlus /> Add Teacher
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-2">
          <div className="input-group">
            <span className="input-group-text">
              <FaSearch />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Search name, email, address, or ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
            {q && (
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => setQ("")}
                title="Clear search"
              >
                <FaTimes />
              </button>
            )}
          </div>

          <div className="d-flex align-items-center gap-2 ms-lg-auto">
            <label className="form-label mb-0 small text-muted">Status</label>
            <select
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ maxWidth: 180 }}
            >
              <option value="all">All</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>

            <label className="form-label mb-0 small text-muted ms-2">Show</label>
            <select
              className="form-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ maxWidth: 120 }}
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} / page
                </option>
              ))}
            </select>

            <button
              className="btn btn-link text-decoration-none ms-2"
              onClick={onReset}
            >
              Reset
            </button>
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
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-secondary"
                style={{ width: 72, height: 72 }}
              >
                <FaUserTie size={28} className="text-muted" />
              </div>
              <h5 className="fw-semibold mt-3 mb-1">No teachers found</h5>
              <p className="text-muted mb-3">
                Try adjusting your search or create a new teacher.
              </p>
              <div className="d-flex justify-content-center gap-2">
                <button
                  className="btn btn-outline-success rounded-3 d-inline-flex align-items-center gap-2"
                  onClick={onAssignSubject}
                >
                  <FaPlus /> Assign Subject
                </button>
                <button
                  className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2"
                  onClick={onCreate}
                >
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
                      <th role="button" onClick={() => toggleSort("id")}>
                        ID <SortIcon k="id" />
                      </th>
                      <th role="button" onClick={() => toggleSort("name")}>
                        Name <SortIcon k="name" />
                      </th>
                      <th>Email</th>
                      <th>Address</th>
                      <th>Date of Birth</th>
                      <th>Contact</th>
                      <th>Status</th>
                      <th role="button" onClick={() => toggleSort("created")}>
                        Created <SortIcon k="created" />
                      </th>
                      <th role="button" onClick={() => toggleSort("updated")}>
                        Updated <SortIcon k="updated" />
                      </th>
                      <th style={{ width: 120 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((t) => (
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
                          <span
                            className={`badge rounded-pill ${
                              toBool(t.is_active) ? "text-bg-success" : "text-bg-secondary"
                            }`}
                          >
                            {toBool(t.is_active) ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="text-muted small">{fmtDate(t.created_at) || "—"}</td>
                        <td className="text-muted small">{fmtDate(t.updated_at) || "—"}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                            onClick={() => onEdit(t.teacher_id)}
                          >
                            <FaEdit /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
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
                  of <strong>{sorted.length}</strong> teachers
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

      <StatusModal
        {...statusModal}
        onHide={() => setStatusModal((s) => ({ ...s, show: false }))}
      />
    </div>
  );
};

export default TeachersList;
