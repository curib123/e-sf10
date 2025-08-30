import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";
import { FaCloudUploadAlt, FaSync, FaArchive } from "react-icons/fa";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

export default function BackupManager() {
  const navigate = useNavigate();

  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
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

  useEffect(() => {
    checkToken();
    loadBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleAxiosError = (err, fallbackMessage) => {
    if (err?.response?.status === 401) {
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
        message: err?.response?.data?.message || fallbackMessage,
        variant: "danger",
      });
    }
  };

  const loadBackups = useCallback(async () => {
    const t = getTokenOrRedirect();
    if (!t) return;

    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/backups`, { headers: authHeaders });
      setBackups(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      handleAxiosError(err, "Error loading backups.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, navigate]);

  const handleCreate = async () => {
    const t = getTokenOrRedirect();
    if (!t) return;

    setCreating(true);
    try {
      const res = await axios.post(
        `${BASE_URL}/backups/create`,
        {},
        { headers: authHeaders, responseType: "blob" }
      );

      // Try to parse filename from header; fallback to timestamped name
      const disposition = res.headers?.["content-disposition"];
      const headerName = disposition?.match(/filename="?(.+)"?/)?.[1];
      const fallback = `backup_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.zip`;
      const filename = headerName || fallback;

      const blob = new Blob([res.data], { type: "application/zip" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await loadBackups();
      setModal({
        show: true,
        title: "Success",
        message: `Backup created and downloaded: ${filename}`,
        variant: "success",
      });
    } catch (err) {
      handleAxiosError(err, "Backup creation failed.");
    } finally {
      setCreating(false);
    }
  };

  const latest = backups[0];
  const total = backups.length;

  return (
    <div className="container my-4 my-md-5">
      <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
        {/* Sticky, clean header */}
        <div
          className="card-header bg-white border-0 d-flex flex-wrap align-items-center justify-content-between gap-2 sticky-top"
          style={{ top: 0, zIndex: 1 }}
        >
          <div className="d-flex align-items-center gap-2">
            <span
              className="d-inline-flex justify-content-center align-items-center rounded-circle"
              style={{ width: 38, height: 38, background: "var(--bs-primary)" }}
            >
              <FaArchive className="text-white" />
            </span>
            <div>
              <h4 className="mb-0 fw-bold">Database Backup</h4>
              <small className="text-muted d-block">
                {total ? `${total} backup${total === 1 ? "" : "s"} found` : "No backups yet"}
              </small>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm text-nowrap"
              onClick={loadBackups}
              disabled={loading || creating}
              aria-label="Refresh backups list"
              title="Refresh"
            >
              <FaSync className={loading ? "me-2 rotate" : "me-2"} />
              Refresh
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm text-nowrap"
              onClick={handleCreate}
              disabled={creating || loading}
              aria-label="Create backup"
              title="Create Backup"
            >
              {creating ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Creating…
                </>
              ) : (
                <>
                  <FaCloudUploadAlt className="me-2" />
                  Create Backup
                </>
              )}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="card-body p-0">
          {/* Latest backup highlight */}
          {latest && (
            <div className="p-3 p-md-4 border-bottom bg-body-tertiary">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div className="text-truncate" style={{ maxWidth: "100%" }}>
                  <div className="text-muted small">Latest backup</div>
                  <div className="fw-semibold text-truncate" title={latest.backup_filename}>
                    {latest.backup_filename}
                  </div>
                  <small className="text-muted">
                    {new Date(latest.backup_date).toLocaleString()} &middot; by {latest.user_name}
                  </small>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
              <div className="mt-2 text-muted">Loading backups…</div>
            </div>
          ) : total === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-archive fs-1 d-block mb-2" />
              No backups available.
            </div>
          ) : (
            <div
              className="table-responsive"
              style={
                total > 10
                  ? { maxHeight: 420, overflowY: "auto", display: "block" }
                  : undefined
              }
            >
              <table className="table align-middle mb-0">
                <thead className="table-light">
                  <tr className="text-muted">
                    <th className="px-3">#</th>
                    <th className="px-3">Filename</th>
                    <th className="px-3">Date</th>
                    <th className="px-3">Created By</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b) => (
                    <tr key={b.backup_id}>
                      <td className="px-3 text-muted">{b.backup_id}</td>
                      <td className="px-3">
                        <span
                          className="text-truncate d-inline-block"
                          style={{ maxWidth: 520 }}
                          title={b.backup_filename}
                        >
                          {b.backup_filename}
                        </span>
                      </td>
                      <td className="px-3">
                        {new Date(b.backup_date).toLocaleString()}
                      </td>
                      <td className="px-3">{b.user_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <StatusModal
        {...modal}
        onHide={() => setModal((m) => ({ ...m, show: false }))}
      />

      {/* Keep buttons single-line & improve truncation */}
      <style>{`
        .btn, .input-group-text, .form-select { white-space: nowrap; }
        .rotate { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
