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
  FaTrash,
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
  const [subjects, setSubjects] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1]); // default 10
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const inFlight = useRef(false);

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

  // --- data loader ---
  const fetchSubjects = async (pageNumber = 1, searchQuery = query, size = pageSize) => {
    if (!token || inFlight.current) return;
    try {
      setLoading(true);
      inFlight.current = true;

      const params = new URLSearchParams();
      params.append("page", pageNumber);
      params.append("limit", size);
      if (searchQuery) params.append("query", searchQuery.trim());

      // IMPORTANT: use RELATIVE path; do NOT include /esf10 again.
      const res = await apiFetch(`/subjects/view-all-subjects?${params.toString()}`, {
        method: "GET",
      });
      if (!res.ok) throw new Error("Failed to fetch subjects");
      const data = await res.json();

      if (data?.success) {
        const list = Array.isArray(data.data) ? data.data : [];
        setSubjects(list);

        const pg = data.pagination || {};
        const newPage = Number(pg.page ?? pageNumber ?? 1);
        const newTotalPages = Number(pg.totalPages ?? pg.total_pages ?? 1);
        const newTotalItems = Number(pg.totalItems ?? pg.total_items ?? pg.total ?? list.length);

        setPage(newPage);
        setTotalPages(Math.max(1, newTotalPages));
        setTotalItems(Math.max(list.length, newTotalItems));
      } else {
        setSubjects([]);
        setPage(1);
        setTotalPages(1);
        setTotalItems(0);
      }
    } catch (err) {
      if (err.message !== "Unauthorized") {
        showStatus("danger", "Error", err.message || "Something went wrong.");
      }
      setSubjects([]);
      setPage(1);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  // initial load
  useEffect(() => {
    fetchSubjects(1, "", pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => fetchSubjects(1, query, pageSize), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // page size change
  useEffect(() => {
    fetchSubjects(1, query, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // --- actions ---
  const onCreate = () => navigate("/subjects/create");
  const onAssign = () => navigate("/assign-subject-per-year-level");
  const onEdit = (id) => navigate(`/subjects/edit/${id}`);
  const onDelete = (id) => {
    showStatus("warning", "Coming soon", "Delete action isn't wired yet.");
    console.log("Delete subject id:", id);
  };

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
              <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-secondary" style={{ width: 72, height: 72 }}>
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
                      <th className="text-end" style={{ width: 200 }}>Action</th>
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
                          <div className="d-flex justify-content-end gap-2">
                            <button className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" onClick={() => onEdit(s.subject_id)}>
                              <FaEdit /> Edit
                            </button>
                            <button className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1" onClick={() => onDelete(s.subject_id)}>
                              <FaTrash /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer / Pagination */}
              <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-2 p-3">
                <div className="small text-muted">
                  Showing <strong>{startIndex ? startIndex : 0}–{endIndex}</strong> of <strong>{totalItems || subjects.length}</strong> subjects
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    disabled={page <= 1}
                    onClick={() => fetchSubjects(Math.max(1, page - 1), query, pageSize)}
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
                      fetchSubjects(next, query, pageSize);
                    }}
                  />
                  <span className="small text-muted">of {totalPages}</span>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    disabled={page >= totalPages}
                    onClick={() => fetchSubjects(Math.min(totalPages, page + 1), query, pageSize)}
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

export default SubjectList;
