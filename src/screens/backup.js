import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";

const BASE_URL = "http://localhost:3001/esf10"; 

export default function BackupManager() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });

  const navigate = useNavigate();

  useEffect(() => {
    checkToken();
    loadBackups();
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

  const loadBackups = async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/backups`, { headers: { Authorization: `Bearer ${token}` } });
      setBackups(res.data);
    } catch (err) {
      handleAxiosError(err, "Error loading backups.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const token = getToken();
    if (!token) return;

    setCreating(true);
    try {
      const res = await axios.post(`${BASE_URL}/backups/create`, {}, { headers: { Authorization: `Bearer ${token}` }, responseType: "blob" });

      const disposition = res.headers["content-disposition"];
      const filename = disposition?.match(/filename="?(.+)"?/)?.[1] || "backup.zip";

      const blob = new Blob([res.data], { type: "application/zip" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await loadBackups();
      setModal({ show: true, title: "Success", message: `Backup created and downloaded: ${filename}`, variant: "success" });
    } catch (err) {
      handleAxiosError(err, "Backup creation failed.");
    } finally {
      setCreating(false);
    }
  };

  const handleAxiosError = (err, fallbackMessage) => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem("token");
      setModal({ show: true, title: "Access Denied", message: "Please log in.", variant: "danger" });
      navigate("/login");
    } else {
      setModal({ show: true, title: "Error", message: err.response?.data?.message || fallbackMessage, variant: "danger" });
    }
  };

  return (
    <div className="container my-4">
      <div className="card shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h4 className="mb-0">Database Backup Management</h4>
          <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
            {creating ? <span className="spinner-border spinner-border-sm"></span> : <><i className="bi bi-cloud-arrow-up me-2"></i>Create Backup</>}
          </button>
        </div>

        <div className="card-body">
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
            <div className="table-responsive" style={backups.length > 10 ? { maxHeight: "400px", overflowY: "auto", display: "block" } : {}}>
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

      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />
    </div>
  );
}
