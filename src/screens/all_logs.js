import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";
import { FaUser, FaClock, FaList } from "react-icons/fa";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

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
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });

  const navigate = useNavigate();

  useEffect(() => {
    checkToken();
    fetchLogs(page);
  }, []);

  const getToken = () => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      setModal({ show: true, title: "Access Denied", message: "Please log in.", variant: "danger" });
      navigate("/login");
      return null;
    }
    return token;
  };

  const fetchLogs = useCallback(async (pageNumber = 1) => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/activity-log`, {
        params: { page: pageNumber, limit },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        setLogs(data.logs);
        setPage(data.page);
        setTotalPages(data.totalPages);
      } else {
        setModal({ show: true, title: "Error", message: "Failed to load logs.", variant: "danger" });
      }
    } catch (err) {
      if (err.response?.status === 401) {
        sessionStorage.removeItem("token");
        setModal({ show: true, title: "Access Denied", message: "Please log in.", variant: "danger" });
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
  }, [limit, navigate]);

  const handlePrev = () => page > 1 && setPage((p) => p - 1);
  const handleNext = () => page < totalPages && setPage((p) => p + 1);

  useEffect(() => { fetchLogs(page); }, [fetchLogs, page]);

  return (
    <main className="container my-5">
      <section className="card shadow-sm border rounded-4">
        <header className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h2 className="mb-0 fs-5 fw-bold d-flex align-items-center gap-2"><FaList /> Activity Log</h2>
          <Pagination page={page} totalPages={totalPages} onPrev={handlePrev} onNext={handleNext} disabled={loading} />
        </header>

        <div className="card-body p-0">
          {loading ? (
            <div className="text-center my-4">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="mt-2 text-muted">Loading logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center text-muted py-5 d-flex flex-column align-items-center">
              <FaClock size={50} className="mb-2" />
              <p className="mb-0">No activity logs found.</p>
            </div>
          ) : (
            <div className="table-responsive" tabIndex={0} aria-label="Activity logs table">
              <table className="table table-bordered table-striped table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">User</th>
                    <th className="py-2 px-2">Email</th>
                    <th className="py-2 px-2">Action</th>
                    <th className="py-2 px-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(({ log_id, first_name, middle_name, last_name, email, action, log_timestamp }) => (
                    <tr key={log_id}>
                      <td className="py-2 px-2">{log_id}</td>
                      <td className="py-2 px-2"><FaUser className="me-1" /> {first_name} {middle_name ? `${middle_name} ` : ""}{last_name}</td>
                      <td className="py-2 px-2">{email}</td>
                      <td className="py-2 px-2">{action}</td>
                      <td className="py-2 px-2">{new Date(log_timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center mt-3 px-2">
            <small className="text-muted">
              Page {page} of {totalPages} | Showing {logs.length} logs
            </small>
            <Pagination page={page} totalPages={totalPages} onPrev={handlePrev} onNext={handleNext} disabled={loading} />
          </div>
        </div>
      </section>

      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />
    </main>
  );
}
