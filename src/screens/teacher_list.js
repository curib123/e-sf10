import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
} from "react-icons/fa";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const icons = {
  success: <FaCheckCircle size={20} />,
  danger: <FaTimesCircle size={20} />,
  warning: <FaExclamationTriangle size={20} />,
  info: <FaInfoCircle size={20} />,
};

const PAGE_SIZES = [5, 10, 20, 50];

const TeachersList = () => {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
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

  const [q, setQ] = useState("");
  const [active, setActive] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1]);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        inFlight.current = true;
        const res = await apiFetch(`/teachers`, { method: "GET" });
        if (!res.ok) throw new Error("Failed to fetch teachers");
        const data = await res.json();
        const list = data?.data ?? [];
        if (!Array.isArray(list)) throw new Error("Invalid teacher list");
        if (!cancelled) setTeachers(list);
      } catch (err) {
        if (err.message !== "Unauthorized") {
          showStatus("danger", "Error", err.message || "Something went wrong.");
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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return teachers.filter((t) => {
      const matchActive =
        active === "all" ? true : active === "active" ? t.is_active : !t.is_active;
      const hay =
        `${t.full_name ?? ""} ${t.first_name ?? ""} ${t.last_name ?? ""} ${
          t.email ?? ""
        } ${t.teacher_address ?? ""}`.toLowerCase();
      const matchNeedle = needle ? hay.includes(needle) : true;
      return matchActive && matchNeedle;
    });
  }, [teachers, q, active]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [q, active, pageSize]);

  const onCreate = () => navigate("/teacher/create");
  const onEdit = (id) => navigate(`/teacher/edit/${id}`);
  const onAssignSubject = () => navigate("/teacher-assignments/create");

  return (
    <div className="container-xxl py-4 py-lg-5">
      {/* Header with global Assign Subject button */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 mb-lg-4">
        <div>
          <h3 className="fw-bold mb-1">Teachers</h3>
          <div className="text-muted small">Manage teacher records, search, filter — and assign subjects.</div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-success rounded-3 d-inline-flex align-items-center gap-2" onClick={onAssignSubject}>
            <FaPlus /> Assign Subject
          </button>
          <button className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2" onClick={onCreate}>
            <FaPlus /> Add Teacher
          </button>
        </div>
      </div>

      {/* Toolbar: search + filters */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-2">
          <div className="input-group">
            <span className="input-group-text"><FaSearch /></span>
            <input
              type="text"
              className="form-control"
              placeholder="Search name, email, or address…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="d-flex align-items-center gap-2 ms-lg-auto">
            <label className="form-label mb-0 small text-muted">Status</label>
            <select
              className="form-select"
              value={active}
              onChange={(e) => setActive(e.target.value)}
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
                <option key={s} value={s}>{s} / page</option>
              ))}
            </select>
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
          ) : filtered.length === 0 ? (
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
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Address</th>
                      <th>DOB</th>
                      <th>Contact</th>
                      <th>Status</th>
                      <th style={{ width: 120 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((t) => (
                      <tr key={t.teacher_id}>
                        <td className="text-muted">#{t.teacher_id}</td>
                        <td className="fw-medium">{t.full_name}</td>
                        <td>{t.email || <span className="text-muted">—</span>}</td>
                        <td className="text-truncate" style={{ maxWidth: 260 }}>
                          {t.teacher_address || <span className="text-muted">—</span>}
                        </td>
                        <td>
                          {t.date_of_birth
                            ? new Date(t.date_of_birth).toLocaleDateString()
                            : <span className="text-muted">—</span>}
                        </td>
                        <td>{t.contact_number || <span className="text-muted">—</span>}</td>
                        <td>
                          <span className={`badge rounded-pill ${t.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                            {t.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
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
                  Showing {" "}
                  <strong>
                    {(currentPage - 1) * pageSize + 1}
                    {"–"}
                    {Math.min(currentPage * pageSize, filtered.length)}
                  </strong>{" "}
                  of <strong>{filtered.length}</strong> teachers
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
