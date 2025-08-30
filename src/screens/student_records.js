import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUserPermissions } from "../components/get_permission";
import { checkToken } from "../components/token_checker";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

export default function StudentRecord() {
  const { lrn } = useParams();
  const navigate = useNavigate();

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [permissions, setPermissions] = useState([]);

  const [student, setStudent] = useState(null);
  const [eCards, setECards] = useState([]);
  const [transferRequest, setTransferRequest] = useState(null);

  const [loading, setLoading] = useState(true);

  const [viewingFile, setViewingFile] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(null);

  // Helpers
  const getFileExtension = (filename) => filename?.split(".").pop().toLowerCase();
  const isImage = (url) => ["png", "jpg", "jpeg", "gif", "bmp", "webp"].includes(getFileExtension(url));
  const isPDF = (url) => getFileExtension(url) === "pdf";

  // Permissions & token
  useEffect(() => {
    checkToken();
    setPermissions(getUserPermissions());
  }, []);

  // Fetch student + transfer request
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchTransferRequest = async () => {
      // If there’s a dedicated endpoint to fetch request by LRN, prefer that.
      const pageSize = 100;
      let page = 1;
      const maxPages = 50;
      let found = null;
      try {
        while (!found && page <= maxPages) {
          const res = await fetch(
            `${BASE_URL}/transfer-request/view-all-requests?page=${page}&limit=${pageSize}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!res.ok) break;
          const data = await res.json();
          const match = data?.data?.find((req) => req.lrn === lrn);
          if (match) {
            found = match;
            setTransferRequest(match);
          }
          if (!data?.data?.length || data.data.length < pageSize) break;
          page++;
        }
      } catch {
        /* noop for UX calmness */
      }
    };

    const fetchStudent = async () => {
      try {
        const res = await fetch(`${BASE_URL}/students/${lrn}/details`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch student details");
        const data = await res.json();
        setStudent(data.student);
        setECards(data.eCards || []);
      } catch {
        setStudent(null);
      }
    };

    setLoading(true);
    Promise.all([fetchTransferRequest(), fetchStudent()]).finally(() => setLoading(false));
  }, [lrn, token]);

  const handleDownload = async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = url.split("/").pop() || "document";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      /* noop */
    }
  };

  const handleDownloadAll = async () => {
    for (const card of eCards) {
      if (card.sf10_document_path) {
        await handleDownload(card.sf10_document_path);
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  };

  const handleDeleteECard = async () => {
    if (!selectedCardId) return;
    try {
      const res = await fetch(`${BASE_URL}/students/${selectedCardId}/delete-sf10`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result?.success) {
        setECards((prev) => prev.filter((c) => c.record_id !== selectedCardId));
      }
    } finally {
      setShowDeleteModal(false);
      setSelectedCardId(null);
    }
  };

  const openFileViewer = (file) => setViewingFile(file);
  const closeFileViewer = () => setViewingFile(null);

  // Loading
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  // Not found
  if (!student) {
    return (
      <div className="container-xxl py-5">
        <button className="btn btn-light border mb-3 text-nowrap" onClick={() => navigate(-1)}>
          &laquo; Back
        </button>
        <div className="text-center fs-5 text-danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i> Student not found.
        </div>
      </div>
    );
  }

  return (
    <div className="container-xxl py-3">
      {/* Top toolbar */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3">
        <div className="d-flex gap-2">
          <button className="btn btn-light border text-nowrap" onClick={() => navigate(-1)}>
            &laquo; Back
          </button>
        </div>
        <div className="text-end">
          {eCards.length > 0 && (
            <button
              className="btn btn-success text-nowrap"
              onClick={handleDownloadAll}
              disabled={!permissions.download_documents}
            >
              Download All
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="d-flex flex-column flex-lg-row align-items-lg-end justify-content-between gap-2 mb-3">
        <h1 className="fw-bold fs-3 mb-0 text-truncate">
          {student.first_name} {student.last_name}
        </h1>
        {transferRequest?.request_status === "Approved" && (
          <span className="badge text-bg-success text-wrap">Transferred Student</span>
        )}
      </div>

      {/* Student details card */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body p-4">
          <div className="row gy-2 small">
            <div className="col-md-4">
              <span className="text-muted d-block">LRN</span>
              <span className="fw-semibold">{student.lrn}</span>
            </div>
            <div className="col-md-8">
              <span className="text-muted d-block">Full Name</span>
              <span className="fw-semibold text-truncate d-block">
                {student.first_name} {student.middle_name} {student.last_name}
              </span>
            </div>
            <div className="col-md-4">
              <span className="text-muted d-block">Gender</span>
              <span className="fw-semibold">{student.gender}</span>
            </div>
            <div className="col-md-4">
              <span className="text-muted d-block">Date of Birth</span>
              <span className="fw-semibold">
                {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : ""}
              </span>
            </div>
            <div className="col-md-4">
              <span className="text-muted d-block">Guardian</span>
              <span className="fw-semibold">{student.guardian_name || "-"}</span>
            </div>
            <div className="col-md-4">
              <span className="text-muted d-block">Contact</span>
              <span className="fw-semibold text-truncate d-block">{student.contact_number || "-"}</span>
            </div>
            <div className="col-md-8">
              <span className="text-muted d-block">Address</span>
              <span className="fw-semibold text-truncate d-block">
                {[student.street, student.city, student.province, student.zip_code].filter(Boolean).join(", ")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* E-Cards */}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h2 className="fw-bold fs-5 mb-0">E-Cards</h2>
        <small className="text-muted">{eCards.length} item{eCards.length === 1 ? "" : "s"}</small>
      </div>

      {eCards.length === 0 ? (
        <div className="text-center text-muted py-5">No eCards available.</div>
      ) : (
        <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
          {eCards.map((card) => {
            const url = card.sf10_document_path;
            const ext = getFileExtension(url);
            const fileName = url?.split("/").pop() || "Unnamed eCard";

            return (
              <div key={card.record_id} className="col">
                <div className="card h-100 border-0 shadow-sm rounded-4">
                  <div className="card-body d-flex flex-column">
                    {/* File row */}
                    <div className="d-flex align-items-center gap-3 mb-2">
                      {isImage(url) ? (
                        <img
                          src={url}
                          alt="Preview"
                          className="rounded"
                          style={{ width: 56, height: 56, objectFit: "cover" }}
                        />
                      ) : isPDF(url) ? (
                        <div
                          className="bg-danger text-white d-flex align-items-center justify-content-center rounded"
                          style={{ width: 56, height: 56 }}
                        >
                          <i className="bi bi-file-earmark-pdf-fill fs-4" />
                        </div>
                      ) : (
                        <div
                          className="bg-secondary text-white d-flex align-items-center justify-content-center rounded"
                          style={{ width: 56, height: 56 }}
                        >
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

                    {/* Meta */}
                    <div className="text-muted small mb-3">
                      Uploaded: {card.uploaded_at ? new Date(card.uploaded_at).toLocaleString() : "—"}
                    </div>

                    {/* Actions */}
                    <div className="mt-auto d-grid gap-2">
                      <div className="d-flex gap-2">
                        <button
                          disabled={!permissions.view_ecards}
                          className="btn btn-outline-primary flex-fill text-nowrap"
                          onClick={() => openFileViewer(card)}
                        >
                          View
                        </button>
                        <button
                          disabled={!permissions.download_documents}
                          className="btn btn-outline-success flex-fill text-nowrap"
                          onClick={() => handleDownload(url)}
                        >
                          Download
                        </button>
                      </div>
                      <button
                        disabled={!permissions.delete_documents}
                        className="btn btn-outline-danger text-nowrap"
                        onClick={() => {
                          setSelectedCardId(card.record_id);
                          setShowDeleteModal(true);
                        }}
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

      {/* Delete Modal */}
      {showDeleteModal && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 shadow">
              <div className="modal-header border-0">
                <h5 className="modal-title">Delete eCard?</h5>
                <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)} />
              </div>
              <div className="modal-body">
                This action cannot be undone.
              </div>
              <div className="modal-footer border-0">
                <button className="btn btn-light border" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={handleDeleteECard}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      {viewingFile?.sf10_document_path && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={closeFileViewer}
        >
          <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 shadow" style={{ height: "80vh" }}>
              <div className="modal-header border-0">
                <h5 className="modal-title text-truncate">
                  {viewingFile.sf10_document_path.split("/").pop()}
                </h5>
                <button type="button" className="btn-close" onClick={closeFileViewer} />
              </div>
              <div className="modal-body p-0 bg-light" style={{ height: "calc(100% - 56px)" }}>
                {isImage(viewingFile.sf10_document_path) ? (
                  <img
                    src={viewingFile.sf10_document_path}
                    className="img-fluid h-100 mx-auto d-block"
                    style={{ objectFit: "contain" }}
                    alt="Document"
                  />
                ) : isPDF(viewingFile.sf10_document_path) ? (
                  <iframe
                    src={viewingFile.sf10_document_path}
                    title="PDF Viewer"
                    className="w-100 h-100 border-0"
                  />
                ) : (
                  <div className="w-100 h-100 d-flex align-items-center justify-content-center">
                    <p className="text-muted fw-semibold mb-0">Preview not available for this file type.</p>
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
