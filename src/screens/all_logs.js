import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";
import { FaUser, FaClock, FaList } from "react-icons/fa";

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
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
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
    async (pageNumber = 1) => {
      const t = getTokenOrRedirect();
      if (!t) return;

      setLoading(true);
      try {
        const { data } = await axios.get(`${BASE_URL}/activity-log`, {
          params: { page: pageNumber, limit },
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

  useEffect(() => {
    fetchLogs(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const prevPage = () => page > 1 && setPage((p) => p - 1);
  const nextPage = () => page < totalPages && setPage((p) => p + 1);

  return (
    <main className="container my-4 my-md-5">
      <section className="card shadow-sm border-0 rounded-4 overflow-hidden">
        {/* Sticky header for better context while scrolling */}
        <header
          className="card-header bg-white border-0 d-flex flex-wrap justify-content-between align-items-center gap-2 sticky-top"
          style={{ top: 0, zIndex: 1 }}
        >
          <div className="d-flex align-items-center gap-2">
            <span
              className="d-inline-flex justify-content-center align-items-center rounded-circle"
              style={{
                width: 36,
                height: 36,
                background: "var(--bs-primary)",
              }}
            >
              <FaList className="text-white" />
            </span>
            <h2 className="mb-0 fs-5 fw-bold">Activity Log</h2>
          </div>

          <Pager
            page={page}
            totalPages={totalPages}
            onPrev={prevPage}
            onNext={nextPage}
            disabled={loading}
          />
        </header>

        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="mt-2 text-muted mb-0">Loading logs…</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center text-muted py-5 d-flex flex-column align-items-center">
              <FaClock size={48} className="mb-2 opacity-75" />
              <p className="mb-1 fw-semibold">No activity logs found</p>
              <small className="text-muted">New actions will appear here.</small>
            </div>
          ) : (
            <div className="table-responsive" tabIndex={0} aria-label="Activity logs table">
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
                  {logs.map(
                    ({
                      log_id,
                      first_name,
                      middle_name,
                      last_name,
                      email,
                      action,
                      log_timestamp,
                    }) => (
                      <tr key={log_id}>
                        <td className="py-2 px-3 text-muted">{log_id}</td>
                        <td className="py-2 px-3">
                          <FaUser className="me-1 text-secondary" />
                          <span className="text-truncate d-inline-block" style={{ maxWidth: 280 }}>
                            {first_name} {middle_name ? `${middle_name} ` : ""}
                            {last_name}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="text-truncate d-inline-block" style={{ maxWidth: 260 }}>
                            {email}
                          </span>
                        </td>
                        <td className="py-2 px-3">{action}</td>
                        <td className="py-2 px-3">
                          {new Date(log_timestamp).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer line with pager */}
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3 px-3 pb-3">
            <small className="text-muted">
              Page {page} of {totalPages || 1} &middot; Showing {logs.length}{" "}
              {logs.length === 1 ? "item" : "items"}
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

      {/* Keep action buttons to a single line and improve table truncation */}
      <style>{`
        .btn, .input-group-text, .form-select { white-space: nowrap; }
        .table td, .table th { vertical-align: middle; }
      `}</style>
    </main>
  );
}
