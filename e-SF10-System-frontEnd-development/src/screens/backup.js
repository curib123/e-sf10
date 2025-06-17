import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { checkToken } from "../components/token_checker";

const API_URL = "http://localhost:3001/esf10/backups";

export default function BackupManager() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkToken();
  }, []);

  const loadBackups = async () => {
    const token = sessionStorage.getItem("token");
    console.log("Token (loadBackups):", token);
    if (!token) {
      setError("Access denied. Please log in.");
      navigate("/login");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBackups(res.data);
    } catch (err) {
      console.error("Error loading backups:", err);
      if (err.response?.status === 401) {
        setError("Access denied. Please log in.");
        sessionStorage.removeItem("token");
        navigate("/login");
      } else {
        setError(err.response?.data?.message || err.message || "Error loading backups.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const token = sessionStorage.getItem("token");
    console.log("Token (create):", token);
    if (!token) {
      setError("Access denied. No token provided.");
      navigate("/login");
      return;
    }

    setCreating(true);
    setError(null);
    setMessage(null);

    try {
  const res = await axios.post(
    `${API_URL}/create`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "blob",
    }
  );

  console.log("Create backup response headers:", res.data);

  // ✅ Extract filename from Content-Disposition
  const contentDisposition = res.headers["content-disposition"];
  let filename = "backup.zip"; // fallback default

  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?(.+?)"?$/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  // ✅ Download the zip file
  const blob = new Blob([res.data], { type: "application/zip" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  await loadBackups();
  setMessage(`✅ Backup created and downloaded: ${filename}`);
} catch (err) {
  console.error("Error creating backup:", err);
  if (err.response?.data instanceof Blob) {
    const errorText = await err.response.data.text();
    console.error("Error response (blob):", errorText);
  }
  setError(err.response?.data?.message || err.message || "Backup creation failed.");
} finally {
  setCreating(false);
}

  };

  useEffect(() => {
    const checkAndLoad = async () => {
      const token = sessionStorage.getItem("token");
      if (!token) {
        setError("Access denied. Please log in.");
        navigate("/login");
        return;
      }
      await loadBackups();
    };
    checkAndLoad();
  }, []);

  return (
    <div className="container my-4">
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
              <>
                <i className="bi bi-cloud-arrow-up me-2"></i>Create Backup
              </>
            )}
          </button>
        </div>

        <div className="card-body">
          {message && <div className="alert alert-success">{message}</div>}
          {error && (
            <div className="alert alert-danger">
              {error}
              <button className="btn btn-sm btn-link" onClick={loadBackups}>
                Retry
              </button>
            </div>
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
            <div
              className="table-responsive"
              style={
                backups.length > 10
                  ? { maxHeight: "400px", overflowY: "auto", display: "block" }
                  : {}
              }
            >
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
                      <td>
                        {b.backup_date
                          ? new Date(b.backup_date).toLocaleString()
                          : "N/A"}
                      </td>
                      <td>{b.user_name || "Unknown"}</td>
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
