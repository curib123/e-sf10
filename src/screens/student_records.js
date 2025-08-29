import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUserPermissions } from "../components/get_permission";
import { checkToken } from "../components/token_checker";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

export default function StudentRecord() {
  const { lrn } = useParams();
  const navigate = useNavigate();

  const [student, setStudent] = useState(null);
  const [eCards, setECards] = useState([]);
  const [transferRequest, setTransferRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewingFile, setViewingFile] = useState(null);
  const [permissions, setPermissions] = useState([]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(null);

  const token = sessionStorage.getItem("token");

  // Permission & Token
  useEffect(() => {
    if (checkToken()) navigate("/login");
    setPermissions(getUserPermissions());
  }, []);

  // Fetch student & transfer request
  useEffect(() => {
    if (!token) return setLoading(false);

    const fetchTransferRequest = async () => {
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
          if (!res.ok) throw new Error("Failed to fetch transfer requests");
          const data = await res.json();
          const match = data?.data?.find((req) => req.lrn === lrn);
          if (match) {
            found = match;
            setTransferRequest(match);
          }
          if (data.data.length < pageSize) break;
          page++;
        }
      } catch (err) {
        console.error("Transfer request error:", err);
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
      } catch (err) {
        console.error(err);
      }
    };

    setLoading(true);
    Promise.all([fetchTransferRequest(), fetchStudent()]).finally(() => setLoading(false));
  }, [lrn, token]);

  const getFileExtension = (filename) => filename?.split(".").pop().toLowerCase();

  const handleDownload = async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = url.split("/").pop();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleDownloadAll = async () => {
    for (const card of eCards) {
      if (card.sf10_document_path) {
        await handleDownload(card.sf10_document_path);
        await new Promise((r) => setTimeout(r, 300));
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
      if (!res.ok) throw new Error("Failed to delete eCard");
      const result = await res.json();
      if (result.success) {
        setShowDeleteModal(false);
        setECards((prev) => prev.filter((c) => c.record_id !== selectedCardId));
      } else throw new Error(result.message || "Unknown error.");
    } catch (err) {
      console.error(err.message);
      setShowDeleteModal(false);
    }
  };

  const openFileViewer = (file) => setViewingFile(file);
  const closeFileViewer = () => setViewingFile(null);

  if (loading)
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );

  if (!student)
    return (
      <div className="py-5 text-center fs-5 text-danger">
        <i className="bi bi-exclamation-triangle-fill me-2"></i> Student not found.
      </div>
    );

  return (
    <div className="container py-4">
      <button className="btn btn-outline-secondary mb-3" onClick={() => navigate(-1)}>
        <i className="bi bi-arrow-left me-2"></i> Go Back
      </button>

      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="fw-bold fs-2 text-primary">{student.first_name} {student.last_name}</h1>
        {eCards.length > 0 && (
          <button
            className="btn btn-success btn-lg"
            onClick={handleDownloadAll}
            disabled={!permissions.download_documents}
          >
            <i className="bi bi-download me-2"></i> Download All
          </button>
        )}
      </div>

      <div className="card shadow-sm rounded-4 border-0 mb-5">
        <div className="card-body p-4">
          {transferRequest?.request_status === "Approved" && (
            <div className="alert alert-success text-center fw-bold fs-5 mb-4">
              TRANSFERRED STUDENT
            </div>
          )}
          <div className="row gy-3">
            <div className="col-md-4"><strong>LRN:</strong> {student.lrn}</div>
            <div className="col-md-8"><strong>Full Name:</strong> {student.first_name} {student.middle_name} {student.last_name}</div>
            <div className="col-md-4"><strong>Gender:</strong> {student.gender}</div>
            <div className="col-md-4"><strong>Date of Birth:</strong> {new Date(student.date_of_birth).toLocaleDateString()}</div>
            <div className="col-md-4"><strong>Guardian:</strong> {student.guardian_name}</div>
            <div className="col-md-4"><strong>Contact:</strong> {student.contact_number}</div>
            <div className="col-md-8"><strong>Address:</strong> {`${student.street}, ${student.city}, ${student.province}, ${student.zip_code}`}</div>
          </div>
        </div>
      </div>

      {/* E-Cards Section */}
      <h2 className="fw-bold text-secondary mb-3"><i className="bi bi-journal-text me-2"></i>E-Cards</h2>
      {eCards.length === 0 ? (
        <p className="text-muted fst-italic text-center">No eCards available.</p>
      ) : (
        <div className="row row-cols-1 row-cols-md-3 g-4">
          {eCards.map((card) => {
            const ext = getFileExtension(card.sf10_document_path);
            const isImage = ["png","jpg","jpeg","gif","bmp","webp"].includes(ext);
            const isPDF = ext === "pdf";

            return (
              <div key={card._id} className="col">
                <div className="card h-100 shadow-sm rounded-4 border-0">
                  <div className="card-body d-flex flex-column justify-content-between">
                    <div className="d-flex align-items-center gap-3 mb-3">
                      {isImage && <img src={card.sf10_document_path} alt="Preview" className="rounded shadow-sm" style={{ width: "60px", height: "60px", objectFit: "cover" }} />}
                      {isPDF && <div className="bg-danger d-flex align-items-center justify-content-center text-white rounded" style={{ width: "60px", height: "60px" }}><i className="bi bi-file-earmark-pdf-fill fs-2"></i></div>}
                      {!isImage && !isPDF && <div className="bg-secondary d-flex align-items-center justify-content-center text-white rounded" style={{ width: "60px", height: "60px" }}><i className="bi bi-file-earmark-text-fill fs-2"></i></div>}
                      <h5 className="mb-0 text-truncate">{card.sf10_document_path?.split("/").pop() || "Unnamed eCard"}</h5>
                    </div>
                    <p className="card-text small text-muted">
                      Grade: {card.grade_level} | Section: {card.section} <br />
                      SY: {card.start_year}-{card.end_year} <br />
                      Uploaded: {new Date(card.uploaded_at).toLocaleString()}
                    </p>
                    <div className="d-flex flex-column gap-2">
                      <div className="d-flex gap-2">
                        <button disabled={!permissions.view_ecards} className="btn btn-outline-primary flex-grow-1" onClick={() => openFileViewer(card)}>
                          <i className="bi bi-eye-fill me-1"></i> View
                        </button>
                        <button disabled={!permissions.download_documents} className="btn btn-outline-success flex-grow-1" onClick={() => handleDownload(card.sf10_document_path)}>
                          <i className="bi bi-download me-1"></i> Download
                        </button>
                      </div>
                      <button disabled={!permissions.delete_documents} className="btn btn-outline-danger" onClick={() => { setSelectedCardId(card.record_id); setShowDeleteModal(true); }}>
                        <i className="bi bi-trash-fill me-1"></i> Delete
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
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={() => setShowDeleteModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 shadow-lg">
              <div className="modal-header border-0">
                <h5 className="modal-title">Confirm Delete</h5>
                <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
              </div>
              <div className="modal-body">Are you sure you want to delete this eCard? This action cannot be undone.</div>
              <div className="modal-footer border-0">
                <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={handleDeleteECard}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      {viewingFile && viewingFile.sf10_document_path && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={closeFileViewer}>
          <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 shadow-lg" style={{ height: "80vh" }}>
              <div className="modal-header border-0">
                <h5 className="modal-title text-truncate">{viewingFile.sf10_document_path.split("/").pop()}</h5>
                <button type="button" className="btn-close" onClick={closeFileViewer}></button>
              </div>
              <div className="modal-body p-0 bg-light" style={{ height: "calc(100% - 56px)" }}>
                {["png","jpg","jpeg","gif","bmp","webp"].includes(getFileExtension(viewingFile.sf10_document_path)) ? (
                  <img src={viewingFile.sf10_document_path} className="img-fluid h-100 mx-auto d-block" style={{ objectFit: "contain" }} alt="Document" />
                ) : getFileExtension(viewingFile.sf10_document_path) === "pdf" ? (
                  <iframe src={viewingFile.sf10_document_path} title="PDF Viewer" className="w-100 h-100 border-0" />
                ) : (
                  <p className="text-center fs-5 fw-semibold my-auto text-muted">Preview not available for this file type.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
