import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { checkToken } from '../components/token_checker';

const LOGS_API_URL = "http://localhost:3001/esf10/activity-log";

function Pagination({ page, totalPages, onPrev, onNext, disabled }) {
  return (
    <div className="d-flex gap-2">
      <button
        className="btn btn-outline-primary btn-sm"
        onClick={onPrev}
        disabled={page <= 1 || disabled}
        aria-label="Previous page"
      >
        &laquo; Prev
      </button>
      <button
        className="btn btn-outline-primary btn-sm"
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
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => { checkToken(); }, []);

  const fetchLogs = useCallback(async (pageNumber = 1) => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      setError("Access denied. Please log in.");
      navigate("/login");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await axios.get(LOGS_API_URL, {
        params: { page: pageNumber, limit },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        setLogs(data.logs);
        setPage(data.page);
        setTotalPages(data.totalPages);
      } else {
        setError("Failed to load logs.");
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Access denied. Please log in.");
        sessionStorage.removeItem("token");
        navigate("/login");
      } else {
        setError(err.response?.data?.message || "Error loading logs.");
      }
    } finally {
      setLoading(false);
    }
  }, [limit, navigate]);

  useEffect(() => { fetchLogs(page); }, [fetchLogs, page]);

  const handlePrev = () => page > 1 && setPage(p => p - 1);
  const handleNext = () => page < totalPages && setPage(p => p + 1);

  return (
    <main className="container my-5">
      <section className="card shadow-sm rounded-4">
        <header className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h2 className="mb-0 fs-5 fw-bold">Activity Log</h2>
          <Pagination page={page} totalPages={totalPages} onPrev={handlePrev} onNext={handleNext} disabled={loading} />
        </header>

        <div className="card-body">
          {error && <div className="alert alert-danger">{error}</div>}

          {loading ? (
            <div className="text-center my-4">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="mt-2 text-muted">Loading logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-journal-text fs-1 mb-2"></i>
              <p className="mb-0">No activity logs found.</p>
            </div>
          ) : (
            <div className="table-responsive" tabIndex={0} aria-label="Activity logs table">
              <table className="table table-striped table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>User</th>
                    <th>Email</th>
                    <th>Action</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(({ log_id, first_name, middle_name, last_name, email, action, log_timestamp }) => (
                    <tr key={log_id}>
                      <td>{log_id}</td>
                      <td>{first_name} {middle_name ? `${middle_name} ` : ""}{last_name}</td>
                      <td>{email}</td>
                      <td>{action}</td>
                      <td>{new Date(log_timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center mt-3">
            <small className="text-muted">
              Page {page} of {totalPages} | Showing {logs.length} logs
            </small>
            <Pagination page={page} totalPages={totalPages} onPrev={handlePrev} onNext={handleNext} disabled={loading} />
          </div>
        </div>
      </section>
    </main>
  );
}
