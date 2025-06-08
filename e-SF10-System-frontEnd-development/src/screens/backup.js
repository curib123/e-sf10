import React, { useEffect, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const API_URL = "http://localhost:3001/esf10/backups";
const token = localStorage.getItem("token");

export default function BackupManager() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Fetch backups
  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBackups(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || "Error loading backups.");
    } finally {
      setLoading(false);
    }
  };

  // Create backup
  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await axios.post(`${API_URL}/create`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(res.data.message);
      loadBackups();
    } catch (err) {
      setError(err?.response?.data?.message || "Backup creation failed.");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  return (
    <div className="container my-4" style={{ maxWidth: "950px" }}>
      <div className="card shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h4 className="mb-0">Database Backup Management</h4>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <span className="spinner-border spinner-border-sm"></span>
            ) : (
              <i className="bi bi-cloud-arrow-up me-2"></i>
            )}
            {creating ? "Creating..." : "Create Backup"}
          </button>
        </div>

        <div className="card-body">
          {message && (
            <div className="alert alert-success">{message}</div>
          )}
          {error && (
            <div className="alert alert-danger">{error}</div>
          )}

          {loading ? (
            <div className="text-center my-4">
              <div className="spinner-border text-primary" role="status"></div>
              <div>Loading backups...</div>
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center text-muted py-4">
              <i className="bi bi-archive fs-1"></i>
              <p>No backups available.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-hover">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Filename</th>
                    <th>Date</th>
                    <th>Created By</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b) => (
                    <tr key={b.backup_id}>
                      <td>{b.backup_id}</td>
                      <td className="text-break">{b.backup_filename}</td>
                      <td>{new Date(b.backup_date).toLocaleString()}</td>
                      <td>{b.user_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
