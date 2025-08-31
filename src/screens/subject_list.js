import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaInfoCircle,
  FaPlus,
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
  FaEdit,
  FaBook,
} from "react-icons/fa";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL; // already includes /esf10
const PAGE_SIZES = [5, 10, 20, 50];

const icons = {
  success: <FaCheckCircle size={20} />,
  danger: <FaTimesCircle size={20} />,
  warning: <FaExclamationTriangle size={20} />,
  info: <FaInfoCircle size={20} />,
};

const SubjectList = () => {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);

  // --- UI state ---
  const [loading, setLoading] = useState(true);
  const [statusModal, setStatusModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "info",
    icon: icons.info,
  });
  const showStatus = (variant, title, message) =>
    setStatusModal({ show: true, title, message, variant, icon: icons[variant] });

  // --- Data state ---
  const [allSubjects, setAllSubjects] = useState([]); // full set from API
  const [subjects, setSubjects] = useState([]); // current page slice
  const [query, setQuery] = useState("");
  const [gradeLevels, setGradeLevels] = useState([]);
  const [gradeLevel, setGradeLevel] = useState(""); // selected grade_level_id

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1]); // default 10
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const inFlight = useRef(false);
  const debounceRef = useRef(null);

  // --- helpers ---
  const handleUnauthorized = () => {
    showStatus("danger", "Unauthorized", "Please login to continue.");
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 800);
  };

  // Accepts absolute URL or relative path. If relative, prefix with BASE_URL (which already includes /esf10).
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

  // slice data for the current page
  const paginate = (fullList, curPage = page, size = pageSize) => {
    const total = fullList.length;
    const pages = Math.max(1, Math.ceil(total / size));
    const safePage = Math.min(Math.max(1, curPage), pages);
    const start = (safePage - 1) * size;
    const end = start + size;

    setSubjects(fullList.slice(start, end));
    setPage(safePage);
    setTotalPages(pages);
    setTotalItems(total);
  };

  // --- fetch subjects via SEARCH API ---
  const fetchAndCacheSubjects = async (searchQuery = query, gl = gradeLevel) => {
    if (!token || inFlight.current) return;
    try {
      setLoading(true);
      inFlight.current = true;

      const params = new URLSearchParams();
      if (searchQuery?.trim()) params.append("query", searchQuery.trim());
      if (gl) params.append("grade_level", gl);

      const url = `/subjects/search-subjects${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await apiFetch(url, { method: "GET" });
      if (!res.ok) throw new Error("Failed to fetch subjects");
      const data = await res.json();

      const list = Array.isArray(data?.data) ? data.data : [];
      setAllSubjects(list);
      paginate(list, 1, pageSize); // reset to page 1 on new fetch
    } catch (err) {
      if (err.message !== "Unauthorized") {
        showStatus("danger", "Error", err.message || "Something went wrong.");
      }
      setAllSubjects([]);
      paginate([], 1, pageSize);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  // --- fetch grade levels ---
  const fetchGradeLevels = async () => {
    try {
      const res = await apiFetch("/grade-levels", { method: "GET" });
      if (!res.ok) throw new Error("Failed to fetch grade levels");
      const data = await res.json();
      if (data?.success) {
        // sort by grade_order if present
        const sorted = [...data.data].sort((a, b) => (a.grade_order ?? 0) - (b.grade_order ?? 0));
        setGradeLevels(sorted);
      } else {
        setGradeLevels([]);
      }
    } catch (err) {
      console.error("Error fetching grade levels:", err.message);
      setGradeLevels([]);
    }
  };

  // initial load: grade levels then subjects
  useEffect(() => {
    fetchGradeLevels();
    fetchAndCacheSubjects("", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // debounce search + grade level filter
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchAndCacheSubjects(query, gradeLevel);
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, gradeLevel]);

  // page size change (re-slice locally)
  useEffect(() => {
    paginate(allSubjects, 1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // --- actions ---
  const onCreate = () => navigate("/subjects/create");
  const onAssign = () => navigate("/assign-subject-per-year-level");
  const onEdit = (id) => navigate(`/subjects/edit/${id}`);

  const startIndex = totalItems ? (page - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(page * pageSize, totalItems || subjects.length);

  return (
    <div className="container-xxl py-4 py-lg-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 mb-lg-4">
        <div>
          <h3 className="fw-bold mb-1">Subjects</h3>
          <div className="text-muted small">Manage curriculum subjects, search, and paginate.</div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-success rounded-3 d-inline-flex align-items-center gap-2" onClick={onAssign}>
            <FaPlus /> Assign Subject
          </button>
          <button className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2" onClick={onCreate}>
            <FaPlus /> Create Subject
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-2">
          {/* Search */}
          <div className="input-group">
            <span className="input-group-text"><FaSearch /></span>
            <input
              type="text"
              className="form-control"
              placeholder="Search code, name, or description…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Grade Level Dropdown */}
          <div style={{ minWidth: 220 }}>
            <select
              className="form-select"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
            >
              <option value="">All Grade Levels</option>
              {gradeLevels.map((gl) => (
                <option key={gl.grade_level_id} value={gl.grade_level_id}>
                  {gl.grade_name}
                </option>
              ))}
            </select>
          </div>

          {/* Page size */}
          <div className="d-flex align-items-center gap-2 ms-lg-auto">
            <label className="form-label mb-0 small text-muted">Show</label>
            <select
              className="form-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ maxWidth: 140 }}
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>{s} / page</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table / States */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-0">
          {loading ? (
            <div className="py-5 text-center">
              <div className="spinner-border" role="status" />
              <div className="mt-2 small text-muted">Loading subjects…</div>
            </div>
          ) : (subjects?.length || 0) === 0 ? (
            <div className="p-5 text-center">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-secondary"
                style={{ width: 72, height: 72 }}
              >
                <FaBook size={28} className="text-muted" />
              </div>
              <h5 className="fw-semibold mt-3 mb-1">No subjects found</h5>
              <p className="text-muted mb-3">Try adjusting your search or create a new subject.</p>
              <button className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2" onClick={onCreate}>
                <FaPlus /> Create Subject
              </button>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 140 }}>Code</th>
                      <th style={{ minWidth: 220 }}>Name</th>
                      <th>Description</th>
                      <th className="text-end" style={{ width: 140 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((s) => (
                      <tr key={s.subject_id}>
                        <td className="fw-medium">{s.subject_code}</td>
                        <td>{s.subject_name}</td>
                        <td className="text-truncate" style={{ maxWidth: 520 }}>
                          {s.description || <span className="text-muted">—</span>}
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                            onClick={() => onEdit(s.subject_id)}
                          >
                            <FaEdit /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer / Pagination */}
              <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-2 p-3">
                <div className="small text-muted">
                  Showing <strong>{startIndex ? startIndex : 0}–{endIndex}</strong> of <strong>{totalItems}</strong> subjects
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    disabled={page <= 1}
                    onClick={() => {
                      const next = Math.max(1, page - 1);
                      paginate(allSubjects, next, pageSize);
                    }}
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
                    value={page}
                    onChange={(e) => {
                      const v = Number(e.target.value || 1);
                      const next = Math.min(Math.max(1, v), totalPages);
                      paginate(allSubjects, next, pageSize);
                    }}
                  />
                  <span className="small text-muted">of {totalPages}</span>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    disabled={page >= totalPages}
                    onClick={() => {
                      const next = Math.min(totalPages, page + 1);
                      paginate(allSubjects, next, pageSize);
                    }}
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

export default SubjectList;
