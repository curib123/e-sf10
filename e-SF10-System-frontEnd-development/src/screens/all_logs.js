import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
 import { checkToken } from '../components/token_checker'; 

const LOGS_API_URL = "http://localhost:3001/esf10/activity-log";

function Pagination({ page, totalPages, onPrev, onNext, disabled }) {
  return (
    <div className="d-flex justify-content-end align-items-center">
      <button
        className="btn btn-outline-primary btn-sm me-2"
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
  
     
       useEffect(() => {
            checkToken();
           }, []);

  const fetchLogs = useCallback(
    async (pageNumber = 1) => {
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
    },
    [limit, navigate]
  );

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  const handlePrev = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  const handleNext = () => {
    if (page < totalPages) setPage((p) => p + 1);
  };

  return (
    <main className="container my-5" >
      <section className="card shadow-sm" aria-labelledby="activity-log-heading">
        <header
          id="activity-log-heading"
          className="card-header bg-primary text-white d-flex justify-content-between align-items-center"
        >
          <h2 className="mb-0">Activity Log</h2>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPrev={handlePrev}
            onNext={handleNext}
            disabled={loading}
          />
        </header>

        <div className="card-body">
          {error && <div role="alert" className="alert alert-danger">{error}</div>}

          {loading ? (
            <div className="text-center my-4" aria-live="polite">
              <div className="spinner-border text-primary" role="status" aria-hidden="true"></div>
              <p className="mt-2">Loading logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-journal-text fs-1" aria-hidden="true"></i>
              <p>No activity logs found.</p>
            </div>
          ) : (
            <div className="table-responsive" tabIndex={0} aria-label="Activity logs table">
              <table className="table table-striped table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">User</th>
                    <th scope="col">Email</th>
                    <th scope="col">Action</th>
                    <th scope="col">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(({ log_id, first_name, middle_name, last_name, email, action, log_timestamp }) => (
                    <tr key={log_id}>
                      <td>{log_id}</td>
                      <td>
                        {first_name} {middle_name ? `${middle_name} ` : ""}{last_name}
                      </td>
                      <td>{email}</td>
                      <td>{action}</td>
                      <td>
                        {new Date(log_timestamp).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center mt-3">
            <small>
              Page {page} of {totalPages} &nbsp;|&nbsp; Showing {logs.length} logs
            </small>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPrev={handlePrev}
              onNext={handleNext}
              disabled={loading}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
