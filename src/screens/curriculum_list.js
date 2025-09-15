import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FaBookOpen,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaEdit,
  FaExclamationTriangle,
  FaInfoCircle,
  FaPlus,
  FaSearch,
  FaTimesCircle,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL; // already includes /esf10
const PAGE_SIZES = [5, 10, 20, 50];

const icons = {
  success: <FaCheckCircle size={20} />,
  danger: <FaTimesCircle size={20} />,
  warning: <FaExclamationTriangle size={20} />,
  info: <FaInfoCircle size={20} />,
};

const CurriculumList = () => {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);

  // --- UI state ---
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
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
  const [curriculums, setCurriculums] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);

  // Filters
  const [query, setQuery] = useState("");
  const [schoolYearId, setSchoolYearId] = useState("");
  const [isActive, setIsActive] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1]); // default 10
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const inFlight = useRef(false);

  // --- helpers ---
  const handleUnauthorized = () => {
    showStatus("danger", "Unauthorized", "Access denied. Please log in.");
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 900);
  };

  const checkToken = () => {
    if (!token) {
      handleUnauthorized();
      return false;
    }
    return true;
  };

  // Accepts absolute URL or relative path. If relative, prefix with BASE_URL.
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

  // --- initial load: school years ---
  useEffect(() => {
    if (!checkToken()) return;
    (async () => {
      try {
        const res = await apiFetch(`/school-year/all-school-years`, { method: "GET" });
        const data = await res.json();
        if (data?.success) setSchoolYears(data.schoolYears || []);
      } catch {
        showStatus("danger", "Error", "Failed to load school years.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // --- data loader ---
  const fetchCurriculums = async (
    pageNumber = page,
    currentQuery = query,
    size = pageSize,
    currentSy = schoolYearId,
    currentActive = isActive
  ) => {
    if (!checkToken() || inFlight.current) return;
    try {
      setLoading(true);
      inFlight.current = true;

      const params = new URLSearchParams();
      if (currentQuery) params.append("query", currentQuery);
      if (currentSy) params.append("school_year_id", currentSy);
      if (currentActive) params.append("is_active", currentActive);
      params.append("page", pageNumber);
      params.append("limit", size);

      const res = await apiFetch(`/curriculum/search-curriculums?${params.toString()}`, {
        method: "GET",
      });
      const data = await res.json();

      if (data?.success) {
        const list = Array.isArray(data.data) ? data.data : [];
        setCurriculums(list);

        const pg = data.pagination || {};
        const newPage = Number(pg.page ?? pageNumber ?? 1);
        const newTotalPages = Number(pg.totalPages ?? pg.total_pages ?? 1);
        const newTotalItems = Number(pg.totalItems ?? pg.total_items ?? pg.total ?? list.length);

        setPage(newPage);
        setTotalPages(Math.max(1, newTotalPages));
        setTotalItems(Math.max(list.length, newTotalItems));
      } else {
        setCurriculums([]);
        setPage(1);
        setTotalPages(1);
        setTotalItems(0);
      }
    } catch {
      showStatus("danger", "Error", "Failed to load curriculums.");
      setCurriculums([]);
      setPage(1);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  // initial list load
  useEffect(() => {
    fetchCurriculums(1, "", pageSize, "", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // debounce filters
  useEffect(() => {
    const t = setTimeout(() => fetchCurriculums(1, query, pageSize, schoolYearId, isActive), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, schoolYearId, isActive]);

  // page size change
  useEffect(() => {
    fetchCurriculums(1, query, pageSize, schoolYearId, isActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // --- actions ---
  const createCurriculum = () => {
    if (!checkToken()) return;
    navigate("/curriculum/create");
  };
  const editCurriculum = (id) => {
    if (!checkToken()) return;
    navigate(`/curriculum/edit/${id}`);
  };
  const assignSubject = (id) => {
    if (!checkToken()) return;
    navigate(`/curriculum/assign-subject/${id}`);
  };

  // --- toggle status ---
  const toggleStatus = async (curr) => {
    if (!checkToken() || togglingId) return;
    try {
      setTogglingId(curr.curriculum_id);

      const res = await apiFetch(`/curriculum/toggle-status/${curr.curriculum_id}`, {
        method: "PATCH",
      });
      const data = await res.json();

      if (data?.success) {
        const becameActive = Boolean(data?.data?.new_status);

        // Optimistic local update:
        setCurriculums((prev) => {
          if (becameActive) {
            // ensure only one active per school year
            return prev.map((item) =>
              item.school_year_id === curr.school_year_id
                ? { ...item, is_active: item.curriculum_id === curr.curriculum_id }
                : item
            );
          }
          // just turned inactive
          return prev.map((item) =>
            item.curriculum_id === curr.curriculum_id ? { ...item, is_active: false } : item
          );
        });

        showStatus(
          "success",
          "Status Updated",
          `${data.message || "Curriculum status updated."} ${
            data?.data?.curriculum_name
              ? `${data.data.curriculum_name} is now ${becameActive ? "Active" : "Inactive"}.`
              : ""
          }`
        );

        // Keep UI consistent with server (esp. if server also deactivated others):
        fetchCurriculums(page, query, pageSize, schoolYearId, isActive);
      } else {
        showStatus("danger", "Update Failed", data?.message || "Failed to toggle status.");
      }
    } catch {
      showStatus("danger", "Error", "Failed to toggle status.");
    } finally {
      setTogglingId(null);
    }
  };

  // computed
  const startIndex = totalItems ? (page - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(page * pageSize, totalItems || curriculums.length);

  return (
    <div className="container-xxl py-4 py-lg-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 mb-lg-4">
        <div>
          <h3 className="fw-bold mb-1">Curriculums</h3>
          <div className="text-muted small">
            Manage school curriculums per year. Only one active curriculum is allowed per school year.
          </div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2" onClick={createCurriculum}>
            <FaPlus /> Create Curriculum
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
              placeholder="Search name or school year…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Filters */}
          <div className="d-flex flex-column flex-sm-row align-items-stretch gap-2 ms-lg-auto">
            <select
              className="form-select"
              value={schoolYearId}
              onChange={(e) => setSchoolYearId(e.target.value)}
              aria-label="Filter by school year"
              style={{ minWidth: 200 }}
            >
              <option value="">All School Years</option>
              {schoolYears.map((sy) => (
                <option key={sy.school_year_id} value={sy.school_year_id}>
                  {sy.start_year} - {sy.end_year}
                </option>
              ))}
            </select>

            <select
              className="form-select"
              value={isActive}
              onChange={(e) => setIsActive(e.target.value)}
              aria-label="Filter by status"
              style={{ minWidth: 160 }}
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>

            {/* Page size */}
            <div className="d-flex align-items-center gap-2">
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
      </div>

      {/* Table / States */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-0">
          {loading ? (
            <div className="py-5 text-center">
              <div className="spinner-border" role="status" />
              <div className="mt-2 small text-muted">Loading curriculums…</div>
            </div>
          ) : (curriculums?.length || 0) === 0 ? (
            <div className="p-5 text-center">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-secondary"
                style={{ width: 72, height: 72 }}
              >
                <FaBookOpen size={28} className="text-muted" />
              </div>
              <h5 className="fw-semibold mt-3 mb-1">No curriculums found</h5>
              <p className="text-muted mb-3">Try adjusting your search or create a new curriculum.</p>
              <button className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2" onClick={createCurriculum}>
                <FaPlus /> Create Curriculum
              </button>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ minWidth: 240 }}>Name</th>
                      <th style={{ width: 180 }}>School Year</th>
                      <th style={{ width: 180 }}>Status</th>
                      <th className="text-end" style={{ width: 240 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {curriculums.map((curr) => (
                      <tr key={curr.curriculum_id}>
                        <td className="fw-medium text-wrap">{curr.curriculum_name}</td>
                        <td className="text-wrap">
                          {curr.school_year_period ||
                            (curr.school_year?.start_year && curr.school_year?.end_year
                              ? `${curr.school_year.start_year} - ${curr.school_year.end_year}`
                              : curr.school_year_id)}
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="form-check form-switch m-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                role="switch"
                                id={`sw-${curr.curriculum_id}`}
                                checked={!!curr.is_active}
                                disabled={togglingId === curr.curriculum_id}
                                onChange={() => toggleStatus(curr)}
                                aria-checked={!!curr.is_active}
                                aria-label={`Set ${curr.curriculum_name} ${curr.is_active ? "inactive" : "active"}`}
                              />
                              <label className="form-check-label small ms-1" htmlFor={`sw-${curr.curriculum_id}`}>
                                {curr.is_active ? "Active" : "Inactive"}
                              </label>
                            </div>
                            {togglingId === curr.curriculum_id && (
                              <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                            )}
                          </div>
                        </td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-2">
                            <button
                              className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                              onClick={() => editCurriculum(curr.curriculum_id)}
                            >
                              <FaEdit /> Edit
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
                  Showing <strong>{startIndex ? startIndex : 0}–{endIndex}</strong> of{" "}
                  <strong>{totalItems || curriculums.length}</strong> curriculums
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    disabled={page <= 1}
                    onClick={() => fetchCurriculums(Math.max(1, page - 1), query, pageSize, schoolYearId, isActive)}
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
                      fetchCurriculums(next, query, pageSize, schoolYearId, isActive);
                    }}
                  />
                  <span className="small text-muted">of {totalPages}</span>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    disabled={page >= totalPages}
                    onClick={() => fetchCurriculums(Math.min(totalPages, page + 1), query, pageSize, schoolYearId, isActive)}
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

export default CurriculumList;
