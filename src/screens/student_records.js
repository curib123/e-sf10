import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUserPermissions } from "../components/get_permission";
import { checkToken } from "../components/token_checker";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

// --- utils
const extOf = (name = "") => name.split(".").pop()?.toLowerCase() || "";
const isImg = (url = "") => ["png", "jpg", "jpeg", "gif", "bmp", "webp"].includes(extOf(url));
const isPdf = (url = "") => extOf(url) === "pdf";

async function apiFetch(path, { method = "GET", headers = {}, body } = {}) {
  const token = sessionStorage.getItem("token");
  if (!token) throw new Error("Missing authorization token.");
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body,
  });
  const type = res.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await res.json().catch(() => ({})) : null;
  if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  return data ?? {};
}

export default function StudentRecord() {
  const { lrn } = useParams();
  const navigate = useNavigate();

  const [permissions, setPermissions] = useState([]);
  const [student, setStudent] = useState(null);
  const [eCards, setECards] = useState([]);
  const [transferRequest, setTransferRequest] = useState(null);

  const [loading, setLoading] = useState(true);

  // lightweight feedback
  const [toast, setToast] = useState({ type: "", text: "" });

  // StatusModal (success/error with close)
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });

  // simple modals
  const [viewingFile, setViewingFile] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(null);

  useEffect(() => {
    checkToken();
    setPermissions(getUserPermissions());
  }, []);

  useEffect(() => {
    if (!lrn) {
      setLoading(false);
      return;
    }

    const fetchStudent = async () => {
      try {
        const data = await apiFetch(`/students/${lrn}/details`);
        setStudent(data.student || null);
        setECards(data.eCards || []);
      } catch {
        setStudent(null);
      }
    };

    const fetchTransfer = async () => {
      // kept simple: scan pages up to a cap
      const pageSize = 100;
      const maxPages = 30;
      let page = 1;
      try {
        while (page <= maxPages) {
          const data = await apiFetch(`/transfer-request/view-all-requests?page=${page}&limit=${pageSize}`);
          const found = data?.data?.find((r) => String(r.lrn) === String(lrn));
          if (found) {
            setTransferRequest(found);
            break;
          }
          if (!data?.data?.length || data.data.length < pageSize) break;
          page++;
        }
      } catch {
        // quiet failure for UX calmness
      }
    };

    setLoading(true);
    Promise.all([fetchStudent(), fetchTransfer()]).finally(() => setLoading(false));
  }, [lrn]);

  useEffect(() => {
    if (!toast.text) return;
    const t = setTimeout(() => setToast({ type: "", text: "" }), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const prettyDateTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
  const onHideStatus = () => setModal((m) => ({ ...m, show: false }));

  // actions
  const openViewer = (card) => setViewingFile(card);
  const closeViewer = () => setViewingFile(null);

  const askDelete = (id) => {
    setSelectedCardId(id);
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    if (!selectedCardId) return;
    try {
      const res = await apiFetch(`/students/${selectedCardId}/delete-sf10`, { method: "DELETE" });
      if (res?.success) {
        setECards((prev) => prev.filter((c) => c.record_id !== selectedCardId));
        setToast({ type: "success", text: "eCard deleted." });
      } else {
        setToast({ type: "error", text: "Failed to delete eCard." });
      }
    } catch (err) {
      setToast({ type: "error", text: err.message || "Delete failed." });
    } finally {
      setShowDelete(false);
      setSelectedCardId(null);
    }
  };

  const handleDownload = async (url) => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Download failed");
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = url.split("/").pop() || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setToast({ type: "error", text: "Download failed." });
    }
  };

  const handleDownloadAll = async () => {
    for (const c of eCards) {
      if (c.sf10_document_path) {
        await handleDownload(c.sf10_document_path);
        await new Promise((r) => setTimeout(r, 180));
      }
    }
  };

  // --- UI
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border" role="status" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="container-xxl py-5">
        <button className="btn btn-light border mb-3" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="text-center text-danger fw-medium">Student not found.</div>
      </div>
    );
  }

  return (
    <div className="container-xxl py-3">
      <StatusModal {...modal} onHide={onHideStatus} />

      {/* toast (subtle) */}
      {toast.text && (
        <div className={`alert alert-${toast.type === "success" ? "success" : "danger"} mb-3 py-2`}>
          {toast.text}
        </div>
      )}

      {/* Top bar */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <button className="btn btn-light border" onClick={() => navigate(-1)}>← Back</button>

        {eCards.length > 0 && (
          <button
            className="btn btn-dark"
            onClick={handleDownloadAll}
            disabled={!permissions.download_documents}
          >
            Download All
          </button>
        )}
      </div>

      {/* Header */}
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
        <h1 className="fs-4 fw-bold mb-0 text-truncate">
          {student.first_name} {student.last_name}
        </h1>
        {transferRequest?.request_status === "Approved" && (
          <span className="badge text-bg-success">Transferred Student</span>
        )}
      </div>

      {/* Student summary */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body p-4">
          <div className="row gy-2 small">
            <div className="col-md-3">
              <div className="text-muted">LRN</div>
              <div className="fw-semibold">{student.lrn}</div>
            </div>
            <div className="col-md-5">
              <div className="text-muted">Full Name</div>
              <div className="fw-semibold text-truncate">
                {student.first_name} {student.middle_name} {student.last_name}
              </div>
            </div>
            <div className="col-md-2">
              <div className="text-muted">Gender</div>
              <div className="fw-semibold">{student.gender || "—"}</div>
            </div>
            <div className="col-md-2">
              <div className="text-muted">Birthdate</div>
              <div className="fw-semibold">
                {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "—"}
              </div>
            </div>
            <div className="col-md-6">
              <div className="text-muted">Guardian</div>
              <div className="fw-semibold">{student.guardian_name || "—"}</div>
            </div>
            <div className="col-md-6">
              <div className="text-muted">Contact</div>
              <div className="fw-semibold text-truncate">{student.contact_number || "—"}</div>
            </div>
            <div className="col-12">
              <div className="text-muted">Address</div>
              <div className="fw-semibold text-truncate">
                {[student.street, student.city, student.province, student.zip_code].filter(Boolean).join(", ") || "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* E-Cards header */}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h2 className="fs-6 fw-bold mb-0">E-Cards</h2>
        <small className="text-muted">{eCards.length} item{eCards.length === 1 ? "" : "s"}</small>
      </div>

      {/* E-Cards */}
      {eCards.length === 0 ? (
        <div className="text-center text-muted py-5">No eCards available.</div>
      ) : (
        <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
          {eCards.map((card) => {
            const url = card.sf10_document_path;
            const fileName = url?.split("/").pop() || "eCard";

            return (
              <div key={card.record_id} className="col">
                <div className="card h-100 border-0 shadow-sm rounded-4">
                  <div className="card-body d-flex flex-column">
                    {/* file avatar + meta */}
                    <div className="d-flex align-items-center gap-3 mb-2">
                      {isImg(url) ? (
                        <img
                          src={url}
                          alt="Preview"
                          className="rounded"
                          style={{ width: 56, height: 56, objectFit: "cover" }}
                        />
                      ) : isPdf(url) ? (
                        <div className="bg-danger text-white d-flex align-items-center justify-content-center rounded"
                             style={{ width: 56, height: 56 }}>
                          <i className="bi bi-file-earmark-pdf-fill fs-4" />
                        </div>
                      ) : (
                        <div className="bg-secondary text-white d-flex align-items-center justify-content-center rounded"
                             style={{ width: 56, height: 56 }}>
                          <i className="bi bi-file-earmark-text-fill fs-4" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="fw-semibold text-truncate">{fileName}</div>
                        <div className="text-muted small text-truncate">
                          Grade {card.grade_level} • {card.section || "—"} • SY {card.start_year}-{card.end_year}
                        </div>
                      </div>
                    </div>

                    <div className="text-muted small mb-3">
                      Uploaded: {prettyDateTime(card.uploaded_at)}
                    </div>

                    {/* actions */}
                    <div className="mt-auto d-grid gap-2">
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-outline-primary flex-fill"
                          onClick={() => openViewer(card)}
                          disabled={!permissions.view_ecards}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-outline-success flex-fill"
                          onClick={() => handleDownload(url)}
                          disabled={!permissions.download_documents}
                        >
                          Download
                        </button>
                      </div>
                      <button
                        className="btn btn-outline-danger"
                        onClick={() => askDelete(card.record_id)}
                        disabled={!permissions.delete_documents}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete dialog (minimal) */}
      {showDelete && (
        <div
          className="modal fade show d-block"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowDelete(false)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0">
              <div className="modal-header border-0">
                <h6 className="modal-title">Delete eCard?</h6>
                <button className="btn-close" onClick={() => setShowDelete(false)} />
              </div>
              <div className="modal-body">This action cannot be undone.</div>
              <div className="modal-footer border-0">
                <button className="btn btn-light border" onClick={() => setShowDelete(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Viewer (minimal) */}
      {viewingFile?.sf10_document_path && (
        <div
          className="modal fade show d-block"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setViewingFile(null)}
        >
          <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0" style={{ height: "80vh" }}>
              <div className="modal-header border-0">
                <h6 className="modal-title text-truncate">
                  {viewingFile.sf10_document_path.split("/").pop()}
                </h6>
                <button className="btn-close" onClick={() => setViewingFile(null)} />
              </div>
              <div className="modal-body p-0 bg-light" style={{ height: "calc(100% - 56px)" }}>
                {isImg(viewingFile.sf10_document_path) ? (
                  <img
                    src={viewingFile.sf10_document_path}
                    className="img-fluid h-100 mx-auto d-block"
                    style={{ objectFit: "contain" }}
                    alt="Document"
                  />
                ) : isPdf(viewingFile.sf10_document_path) ? (
                  <iframe
                    src={viewingFile.sf10_document_path}
                    title="PDF"
                    className="w-100 h-100 border-0"
                  />
                ) : (
                  <div className="w-100 h-100 d-flex align-items-center justify-content-center">
                    <p className="text-muted fw-medium m-0">Preview not available.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
