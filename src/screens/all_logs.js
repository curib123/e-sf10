import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";
import { FaUser, FaClock, FaList, FaSyncAlt, FaSearch } from "react-icons/fa";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

/** Compact, reusable pager */
function Pager({ page, totalPages, onPrev, onNext, disabled }) {
  return (
    <div className="d-flex align-items-center gap-2">
      <button
        type="button"
        className="btn btn-outline-primary btn-sm text-nowrap"
        onClick={onPrev}
        disabled={page <= 1 || disabled}
        aria-label="Previous page"
      >
        &laquo; Prev
      </button>
      <span className="small text-muted text-nowrap">
        {page} / {totalPages || 1}
      </span>
      <button
        type="button"
        className="btn btn-outline-primary btn-sm text-nowrap"
        onClick={onNext}
        disabled={page >= totalPages || disabled}
        aria-label="Next page"
      >
        Next &raquo;
      </button>
    </div>
  );
}

export default function ActivityLog() {
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "danger",
  });

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const authHeaders = useMemo(
    () => ({ Authorization: token ? `Bearer ${token}` : "" }),
    [token]
  );

  // initial auth check
  useEffect(() => {
    checkToken();
  }, []);

  const getTokenOrRedirect = () => {
    const t = sessionStorage.getItem("token");
    if (!t) {
      setModal({
        show: true,
        title: "Access Denied",
        message: "Please log in.",
        variant: "danger",
      });
      navigate("/login");
      return null;
    }
    return t;
  };

  const fetchLogs = useCallback(
    async (pageNumber = 1, pageLimit = limit) => {
      const t = getTokenOrRedirect();
      if (!t) return;

      setLoading(true);
      try {
        const { data } = await axios.get(`${BASE_URL}/activity-log`, {
          params: { page: pageNumber, limit: pageLimit },
          headers: authHeaders,
        });

        if (data?.success) {
          setLogs(Array.isArray(data.logs) ? data.logs : []);
          setPage(Number(data.page) || pageNumber);
          setTotalPages(Number(data.totalPages) || 1);
        } else {
          setLogs([]);
          setModal({
            show: true,
            title: "Error",
            message: data?.message || "Failed to load logs.",
            variant: "danger",
          });
        }
      } catch (err) {
        if (err.response?.status === 401) {
          sessionStorage.removeItem("token");
          setModal({
            show: true,
            title: "Access Denied",
            message: "Please log in.",
            variant: "danger",
          });
          navigate("/login");
        } else {
          setModal({
            show: true,
            title: "Error",
            message: err.response?.data?.message || "Error loading logs.",
            variant: "danger",
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [authHeaders, limit, navigate]
  );

  // Fetch when page or limit changes
  useEffect(() => {
    fetchLogs(page, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const prevPage = () => page > 1 && setPage((p) => p - 1);
  const nextPage = () => page < totalPages && setPage((p) => p + 1);

  // Client-side lightweight filter (no API change)
  const filteredLogs = useMemo(() => {
    if (!query.trim()) return logs;
    const q = query.toLowerCase();
    return logs.filter((l) => {
      const fullName = `${l.first_name || ""} ${l.middle_name || ""} ${l.last_name || ""}`.toLowerCase();
      return (
        fullName.includes(q) ||
        (l.email || "").toLowerCase().includes(q) ||
        (l.action || "").toLowerCase().includes(q)
      );
    });
  }, [logs, query]);

  // Small helper for relative time + exact tooltip
  const formatWhen = (iso) => {
    try {
      const d = new Date(iso);
      const abs = d.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
      const diffMs = Date.now() - d.getTime();
      const minutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      let rel =
        minutes < 1
          ? "just now"
          : minutes < 60
          ? `${minutes}m ago`
          : hours < 24
          ? `${hours}h ago`
          : `${days}d ago`;

      return { abs, rel };
    } catch {
      return { abs: iso, rel: "" };
    }
  };

  return (
    <main className="container my-4 my-md-5">
      <section className="card border-0 shadow-sm rounded-4 overflow-hidden">
        {/* Sticky header */}
        <header
          className="card-header bg-white border-0 sticky-top"
          style={{ top: 0, zIndex: 1 }}
        >
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div className="d-flex align-items-center gap-2">
              <span
                className="d-inline-flex justify-content-center align-items-center rounded-circle"
                style={{ width: 40, height: 40, background: "var(--bs-primary)" }}
              >
                <FaList className="text-white" />
              </span>
              <div>
                <h2 className="mb-0 fs-5 fw-bold">Activity Log</h2>
                <small className="text-muted">
                  Monitor system actions and user events
                </small>
              </div>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2">
              {/* Search */}
              <div className="input-group input-group-sm" style={{ minWidth: 260 }}>
                <span className="input-group-text bg-white">
                  <FaSearch aria-hidden />
                </span>
                <input
                  type="search"
                  className="form-control"
                  placeholder="Search name, email, action…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search logs"
                />
              </div>

              {/* Page size */}
              <select
                className="form-select form-select-sm"
                style={{ width: 110 }}
                value={limit}
                onChange={(e) => {
                  setPage(1);
                  setLimit(Number(e.target.value));
                }}
                aria-label="Rows per page"
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>

              {/* Refresh */}
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => fetchLogs(page, limit)}
                disabled={loading}
                aria-label="Refresh logs"
                title="Refresh"
              >
                <FaSyncAlt className={loading ? "spin" : ""} /> Refresh
              </button>

              {/* Pager */}
              <Pager
                page={page}
                totalPages={totalPages}
                onPrev={prevPage}
                onNext={nextPage}
                disabled={loading}
              />
            </div>
          </div>
        </header>

        <div className="card-body p-0">
          {loading ? (
            // Loading state with placeholders
            <div className="p-3">
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light">
                    <tr className="text-muted">
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">User</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3">Action</th>
                      <th className="py-2 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="placeholder-glow">
                    {Array.from({ length: Math.min(limit, 10) }).map((_, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3">
                          <span className="placeholder col-4"></span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="placeholder col-8"></span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="placeholder col-7"></span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="placeholder col-6"></span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="placeholder col-5"></span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-muted small px-3 mb-3">Loading logs…</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center text-muted py-5 d-flex flex-column align-items-center">
              <FaClock size={48} className="mb-2 opacity-75" />
              <p className="mb-1 fw-semibold">No activity logs found</p>
              <small className="text-muted">
                Try adjusting the search or refresh to check for new activity.
              </small>
            </div>
          ) : (
            <div
              className="table-responsive"
              tabIndex={0}
              aria-label="Activity logs table"
            >
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr className="text-muted">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">User</th>
                    <th className="py-2 px-3">Email</th>
                    <th className="py-2 px-3">Action</th>
                    <th className="py-2 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(
                    ({
                      log_id,
                      first_name,
                      middle_name,
                      last_name,
                      email,
                      action,
                      log_timestamp,
                    }) => {
                      const { abs, rel } = formatWhen(log_timestamp);
                      return (
                        <tr key={log_id}>
                          <td className="py-2 px-3 text-muted">{log_id}</td>
                          <td className="py-2 px-3">
                            <FaUser className="me-1 text-secondary" />
                            <span
                              className="text-truncate d-inline-block"
                              style={{ maxWidth: 280 }}
                              title={`${first_name || ""} ${middle_name || ""} ${last_name || ""}`}
                            >
                              {first_name} {middle_name ? `${middle_name} ` : ""}
                              {last_name}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className="text-truncate d-inline-block"
                              style={{ maxWidth: 260 }}
                              title={email}
                            >
                              {email}
                            </span>
                          </td>
                          <td className="py-2 px-3">{action}</td>
                          <td className="py-2 px-3">
                            <span title={abs}>{rel || abs}</span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer line with pager */}
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3 px-3 pb-3">
            <small className="text-muted">
              Page {page} of {totalPages || 1} &middot; Showing {filteredLogs.length}{" "}
              {filteredLogs.length === 1 ? "item" : "items"}
            </small>
            <Pager
              page={page}
              totalPages={totalPages}
              onPrev={prevPage}
              onNext={nextPage}
              disabled={loading}
            />
          </div>
        </div>
      </section>

      <StatusModal
        {...modal}
        onHide={() => setModal((m) => ({ ...m, show: false }))}
      />

      {/* Minimal utility styles */}
      <style>{`
        .btn, .input-group-text, .form-select { white-space: nowrap; }
        .table td, .table th { vertical-align: middle; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}
