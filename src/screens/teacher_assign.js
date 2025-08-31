import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaPlus,
  FaEdit,
  FaUserTie,
  FaChalkboardTeacher,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL; 
const PAGE_SIZES = [5, 10, 20, 50];

const icons = {
  success: <FaCheckCircle size={18} />,
  danger: <FaTimesCircle size={18} />,
  info: <FaInfoCircle size={18} />,
};

const VIEW_BY = [
  { value: "teacher", label: "By Teacher" },
  { value: "subject", label: "By Subject" },
  { value: "section", label: "By Section" },
  { value: "year", label: "By School Year" },
];

const TeacherAssignmentsList = () => {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);

  // UI
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

  // Data
  const [assignments, setAssignments] = useState([]);

  // Dropdown-driven view
  const [viewBy, setViewBy] = useState("teacher"); // teacher | subject | section | year
  const [selectedKey, setSelectedKey] = useState(""); // id or year string depending on viewBy

  // Pagination state (client-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const inFlight = useRef(false);

  // --- helpers ---
  const handleUnauthorized = () => {
    showStatus("danger", "Unauthorized", "Please login to continue.");
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 800);
  };
  const checkToken = () => {
    if (!token) {
      handleUnauthorized();
      return false;
    }
    return true;
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

  // --- load all assignments ---
  const loadAssignments = async () => {
    if (!checkToken() || inFlight.current) return;
    try {
      setLoading(true);
      inFlight.current = true;
      const res = await apiFetch(`/teacher-assignments`, { method: "GET" });
      const data = await res.json();
      setAssignments(Array.isArray(data?.data) ? data.data : []);
    } catch {
      showStatus("danger", "Error", "Failed to load teacher assignments.");
      setAssignments([]);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  useEffect(() => {
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // --- unique dropdown options ---
  const teacherOptions = useMemo(() => {
    const map = new Map();
    assignments.forEach((a) => {
      if (!map.has(a.teacher_id)) map.set(a.teacher_id, a.teacher_name);
    });
    return Array.from(map, ([value, label]) => ({ value, label })).sort((x, y) =>
      String(x.label || "").localeCompare(String(y.label || ""))
    );
  }, [assignments]);

  const subjectOptions = useMemo(() => {
    const map = new Map();
    assignments.forEach((a) => {
      const label = [a.subject_code, a.subject_name].filter(Boolean).join(" — ");
      if (!map.has(a.subject_id)) map.set(a.subject_id, label);
    });
    return Array.from(map, ([value, label]) => ({ value, label })).sort((x, y) =>
      String(x.label || "").localeCompare(String(y.label || ""))
    );
  }, [assignments]);

  const sectionOptions = useMemo(() => {
    const map = new Map();
    assignments.forEach((a) => {
      const label = [a.section_name, a.grade_name ? `(${a.grade_name})` : ""]
        .filter(Boolean)
        .join(" ");
      if (!map.has(a.section_id)) map.set(a.section_id, label);
    });
    return Array.from(map, ([value, label]) => ({ value, label })).sort((x, y) =>
      String(x.label || "").localeCompare(String(y.label || ""))
    );
  }, [assignments]);

  const yearOptions = useMemo(() => {
    const set = new Set();
    assignments.forEach((a) => a.school_year && set.add(a.school_year));
    return Array.from(set)
      .sort()
      .map((y) => ({ value: y, label: y }));
  }, [assignments]);

  const optionsByView = useMemo(() => {
    switch (viewBy) {
      case "teacher":
        return teacherOptions;
      case "subject":
        return subjectOptions;
      case "section":
        return sectionOptions;
      case "year":
        return yearOptions;
      default:
        return [];
    }
  }, [viewBy, teacherOptions, subjectOptions, sectionOptions, yearOptions]);

  // --- filtered rows ---
  const rows = useMemo(() => {
    if (!selectedKey) return [];
    switch (viewBy) {
      case "teacher":
        return assignments.filter((a) => String(a.teacher_id) === String(selectedKey));
      case "subject":
        return assignments.filter((a) => String(a.subject_id) === String(selectedKey));
      case "section":
        return assignments.filter((a) => String(a.section_id) === String(selectedKey));
      case "year":
        return assignments.filter((a) => String(a.school_year) === String(selectedKey));
      default:
        return [];
    }
  }, [assignments, selectedKey, viewBy]);

  // --- pagination derived ---
  const totalPages = useMemo(() => Math.max(1, Math.ceil(rows.length / pageSize)), [rows.length, pageSize]);
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);
  const rangeStart = useMemo(() => (rows.length ? (page - 1) * pageSize + 1 : 0), [rows.length, page, pageSize]);
  const rangeEnd = useMemo(() => Math.min(rows.length, page * pageSize), [rows.length, page, pageSize]);

  // reset page on key/view/pageSize change and keep page in bounds
  useEffect(() => { setPage(1); }, [selectedKey, viewBy, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  const buildPageList = useMemo(() => {
    // returns an array of page numbers and "…" strings for display
    const pages = [];
    const maxToShow = 7;
    if (totalPages <= maxToShow) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    const showAround = 1; // neighbors around current
    const start = Math.max(2, page - showAround);
    const end = Math.min(totalPages - 1, page + showAround);

    pages.push(1);
    if (start > 2) pages.push("…");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("…");
    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  const headerTitle = useMemo(() => {
    if (!selectedKey) {
      switch (viewBy) {
        case "teacher": return "Select a teacher";
        case "subject": return "Select a subject";
        case "section": return "Select a section";
        case "year":    return "Select a school year";
        default:          return "";
      }
    }
    const opt = optionsByView.find((x) => String(x.value) === String(selectedKey));
    const label = opt?.label || "";
    switch (viewBy) {
      case "teacher": return `${label} — Subjects`;
      case "subject": return `${label} — Teachers`;
      case "section": return `${label} — Assignments`;
      case "year":    return `${label} — Assignments`;
      default:          return label;
    }
  }, [selectedKey, viewBy, optionsByView]);

  // actions
  const onCreate = () => navigate("/teacher-assignments/create");
  const onUpdate = (assignmentId) => navigate(`/teacher-assignments/update/${assignmentId}`);

  // reset when changing view mode
  useEffect(() => { setSelectedKey(""); }, [viewBy]);

  // small chip
  const Chip = ({ children, onClear }) => (
    <span className="badge rounded-pill bg-body-tertiary border text-body me-1 mb-1 d-inline-flex align-items-center gap-2">
      <span className="small">{children}</span>
      {onClear && (
        <button
          type="button"
          className="btn btn-sm btn-link p-0 text-muted"
          onClick={onClear}
          aria-label="Clear"
          title="Clear"
        >
          <FaTimes />
        </button>
      )}
    </span>
  );

  return (
    <div className="container-xxl py-4 py-lg-5">
      {/* subtle polish */}
      <style>{`
        .table thead th { position: sticky; top: 0; z-index: 1; background: var(--bs-light,#f8f9fa); }
        .form-select:focus { box-shadow: 0 0 0 .2rem rgba(13,110,253,.15); border-color: #86b7fe; }
        .btn-outline-primary:hover { transform: translateY(-1px); }
        .pagination .page-link { cursor: pointer; }
      `}</style>

      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 mb-lg-4">
        <div>
          <h3 className="fw-bold mb-1">Teacher Assignments</h3>
          <div className="text-muted small">Switch views with one dropdown. Clean and focused.</div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2" onClick={onCreate}>
            <FaPlus /> Assign Teacher
          </button>
        </div>
      </div>

      {/* Minimal toolbar: ViewBy + dynamic selector */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body d-flex flex-column flex-lg-row gap-2 align-items-stretch align-items-lg-center">
          {/* View By */}
          <div className="d-flex flex-column" style={{ minWidth: 220 }}>
            <label className="form-label small text-muted mb-1">View</label>
            <select
              className="form-select"
              aria-label="View by"
              value={viewBy}
              onChange={(e) => setViewBy(e.target.value)}
            >
              {VIEW_BY.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="form-text">Choose a perspective to explore assignments.</div>
          </div>

          {/* Dynamic selector */}
          <div className="d-flex flex-column flex-grow-1">
            <label className="form-label small text-muted mb-1">
              {viewBy === "teacher"
                ? "Teacher"
                : viewBy === "subject"
                ? "Subject"
                : viewBy === "section"
                ? "Section"
                : "School Year"}
            </label>
            <select
              className="form-select"
              aria-label="Primary filter"
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
            >
              <option value="">
                {viewBy === "teacher"
                  ? "Select teacher…"
                  : viewBy === "subject"
                  ? "Select subject…"
                  : viewBy === "section"
                  ? "Select section…"
                  : "Select school year…"}
              </option>
              {optionsByView.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="form-text">
              {viewBy === "teacher"
                ? "Shows all subjects handled by the selected teacher."
                : viewBy === "subject"
                ? "Shows all teachers handling the selected subject."
                : viewBy === "section"
                ? "Shows all assignments within the selected section."
                : "Shows all assignments within the selected school year."}
            </div>
          </div>

          {(selectedKey || viewBy) && (
            <div className="ms-lg-auto">
              <div className="small text-muted mb-1">Active</div>
              <Chip onClear={() => setSelectedKey("")}> 
                {(() => {
                  const opt = optionsByView.find((x) => String(x.value) === String(selectedKey));
                  const label = opt?.label || "—";
                  switch (viewBy) {
                    case "teacher": return `Teacher: ${label}`;
                    case "subject": return `Subject: ${label}`;
                    case "section": return `Section: ${label}`;
                    case "year":    return `Year: ${label}`;
                    default:         return label;
                  }
                })()}
              </Chip>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body py-4">
            <div className="placeholder-glow">
              {[...Array(5)].map((_, i) => (
                <p key={i} className="placeholder col-12 mb-2" style={{ height: 18 }} />
              ))}
            </div>
            <div className="text-center text-muted small mt-2">Loading assignments…</div>
          </div>
        </div>
      ) : assignments.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body text-center py-5">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle bg-body-secondary"
              style={{ width: 70, height: 70 }}
            >
              <FaChalkboardTeacher size={26} className="text-muted" />
            </div>
            <h5 className="fw-semibold mt-3 mb-1">No assignments yet</h5>
            <p className="text-muted mb-3 small">Create your first teacher assignment to get started.</p>
            <button className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2" onClick={onCreate}>
              <FaPlus /> Assign Teacher
            </button>
          </div>
        </div>
      ) : !selectedKey ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body text-center py-5 text-muted small">
            Select a {viewBy === "teacher" ? "teacher" : viewBy === "subject" ? "subject" : viewBy === "section" ? "section" : "school year"} to display results.
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body text-center py-5 text-muted small">
            No results found for your selection.
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-0">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-3 pb-2">
              <div>
                <h6 className="mb-0 fw-semibold">{headerTitle}</h6>
                <div className="text-muted small">
                  Showing {rangeStart}–{rangeEnd} of {rows.length} assignment{rows.length > 1 ? "s" : ""}
                </div>
              </div>

              {/* Page size selector */}
              <div className="d-flex align-items-center gap-2">
                <span className="text-muted small">Rows per page</span>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 90 }}
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>

                {/* Pagination */}
                <nav aria-label="Assignments pagination">
                  <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                      <button className="page-link" onClick={() => setPage(1)} aria-label="First">
                        <span aria-hidden="true">«</span>
                      </button>
                    </li>
                    <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                      <button className="page-link" onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous">
                        <FaChevronLeft />
                      </button>
                    </li>

                    {buildPageList.map((p, idx) => (
                      typeof p === "string" ? (
                        <li key={`ellipsis-${idx}`} className="page-item disabled">
                          <span className="page-link">…</span>
                        </li>
                      ) : (
                        <li key={`pg-${p}`} className={`page-item ${p === page ? "active" : ""}`}>
                          <button className="page-link" onClick={() => setPage(p)}>{p}</button>
                        </li>
                      )
                    ))}

                    <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
                      <button className="page-link" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next">
                        <FaChevronRight />
                      </button>
                    </li>
                    <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
                      <button className="page-link" onClick={() => setPage(totalPages)} aria-label="Last">
                        <span aria-hidden="true">»</span>
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>

            <div className="table-responsive" style={{ maxHeight: "65vh" }}>
              <table className="table align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    {/* Columns adapt to view */}
                    {viewBy !== "teacher" && <th style={{ minWidth: 200 }}>Teacher</th>}
                    {viewBy !== "subject" && <th style={{ minWidth: 160 }}>Subject</th>}
                    {viewBy !== "section" && <th style={{ minWidth: 140 }}>Section</th>}
                    {viewBy !== "year" && <th style={{ width: 140 }}>School Year</th>}
                    <th style={{ width: 120 }}>Grade</th>
                    <th style={{ width: 120 }}>Assign ID</th>
                    <th className="text-end" style={{ width: 140 }}>Update</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((a) => (
                    <tr key={a.assignment_id} className="border-top">
                      {viewBy !== "teacher" && (
                        <td className="text-wrap">
                          <span className="d-inline-flex align-items-center gap-2">
                            <FaUserTie className="text-muted" /> {a.teacher_name}
                          </span>
                        </td>
                      )}
                      {viewBy !== "subject" && (
                        <td className="text-wrap">
                          <div className="fw-medium">{a.subject_code}</div>
                          <div className="text-muted small">{a.subject_name}</div>
                        </td>
                      )}
                      {viewBy !== "section" && <td className="text-wrap">{a.section_name}</td>}
                      {viewBy !== "year" && <td>{a.school_year}</td>}
                      <td>{a.grade_name}</td>
                      <td>{a.assignment_id}</td>
                      <td className="text-end">
                        <button className="btn btn-outline-primary btn-sm" onClick={() => onUpdate(a.assignment_id)}>
                          <FaEdit /> Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <StatusModal {...statusModal} onHide={() => setStatusModal((s) => ({ ...s, show: false }))} />
    </div>
  );
};

export default TeacherAssignmentsList;
