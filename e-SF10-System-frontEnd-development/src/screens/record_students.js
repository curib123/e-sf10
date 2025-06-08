import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function StudentRecord() {
  const { lrn } = useParams();
  const [student, setStudent] = useState(null);
  const [eCards, setECards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingFile, setViewingFile] = useState(null);

  useEffect(() => {
    const fetchStudentDetails = async () => {
      const token = localStorage.getItem("token");
      if (!token) return alert("Token missing. Please log in.");

      try {
        const res = await fetch(`http://localhost:3001/esf10/students/${lrn}/details`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch student details");

        const data = await res.json();
        setStudent(data.student);
        setECards(data.eCards || []);
      } catch (err) {
        alert(`❌ ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (lrn) fetchStudentDetails();
  }, [lrn]);

  const getFileExtension = (filename) => {
    if (!filename) return "";
    const parts = filename.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  };

  const openFileViewer = (file) => setViewingFile(file);
  const closeFileViewer = () => setViewingFile(null);

  const handleDownload = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to download: ${url}`);
      const blob = await response.blob();
      const link = document.createElement("a");
      const fileName = url.split("/").pop();
      link.href = window.URL.createObjectURL(blob);
      link.download = fileName || "document";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);
    } catch (err) {
      alert(`❌ ${err.message}`);
    }
  };

  const handleDownloadAll = async () => {
    for (const card of eCards) {
      if (card.sf10_document_path) {
        try {
          const response = await fetch(card.sf10_document_path);
          if (!response.ok) throw new Error(`Failed to download ${card.sf10_document_path}`);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          const fileName = card.sf10_document_path.split("/").pop();

          a.href = url;
          a.download = fileName || "document";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (err) {
          console.error(`❌ Error downloading ${card.sf10_document_path}:`, err);
        }
      }
    }
  };

  if (loading)
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status" aria-label="Loading spinner">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );

  if (!student)
    return (
      <div className="py-5 text-center fs-5 text-danger">
        <i className="bi bi-exclamation-triangle-fill me-2"></i> Student not found.
      </div>
    );

  return (
    <div className="container">
      {/* Header */}
      <div className="d-flex justify-content-end align-items-center mb-4">
     
        <button
          className="btn btn-outline-dark btn-lg d-flex align-items-center gap-2"
          onClick={() => window.history.back()}
          aria-label="Back"
          style={{ transition: "background-color 0.3s" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <i className="bi bi-arrow-left"></i> Back
        </button>
      </div>

      {/* Student Info Card */}
      <div className="card shadow-sm rounded-4 border-0 mb-5" style={{ transition: "transform 0.3s", cursor: "default" }}>
        <div className="card-header bg-dark text-white rounded-top-4 fs-4 fw-semibold d-flex align-items-center gap-3">
          <i className="bi bi-info-circle"></i> Student Information
        </div>
        <div className="card-body p-4">
          <div className="row gy-3">
            <div className="col-md-4">
              <div className="text-uppercase text-secondary fw-semibold small">LRN</div>
              <div className="fs-5">{student.lrn}</div>
            </div>
            <div className="col-md-8">
              <div className="text-uppercase text-secondary fw-semibold small">Full Name</div>
              <div className="fs-5">{`${student.first_name} ${student.middle_name} ${student.last_name}`}</div>
            </div>
            <div className="col-md-4">
              <div className="text-uppercase text-secondary fw-semibold small">Gender</div>
              <div className="fs-6">{student.gender}</div>
            </div>
            <div className="col-md-4">
              <div className="text-uppercase text-secondary fw-semibold small">Date of Birth</div>
              <div className="fs-6">{new Date(student.date_of_birth).toLocaleDateString()}</div>
            </div>
            <div className="col-md-4">
              <div className="text-uppercase text-secondary fw-semibold small">Guardian</div>
              <div className="fs-6">{student.guardian_name}</div>
            </div>
            <div className="col-md-4">
              <div className="text-uppercase text-secondary fw-semibold small">Contact</div>
              <div className="fs-6">{student.contact_number}</div>
            </div>
            <div className="col-md-8">
              <div className="text-uppercase text-secondary fw-semibold small">Address</div>
              <div className="fs-6">{`${student.street}, ${student.city}, ${student.province}, ${student.zip_code}`}</div>
            </div>
          </div>
        </div>
      </div>

      {/* E-Cards Section */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="fw-bold text-success fs-3 d-flex align-items-center gap-2">
          <i className="bi bi-journal-text"></i> E-Cards
        </h2>
        {eCards.length > 0 && (
          <button
            className="btn btn-success btn-lg d-flex align-items-center gap-2"
            onClick={handleDownloadAll}
            aria-label="Download all eCards"
            style={{ transition: "transform 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <i className="bi bi-download"></i> Download All
          </button>
        )}
      </div>

      {/* eCards Grid */}
      {eCards.length === 0 ? (
        <p className="text-muted fst-italic fs-5 text-center my-5">No eCards available.</p>
      ) : (
        <div className="row row-cols-1 row-cols-md-3 g-4">
          {eCards.map((card, index) => (
            <div key={index} className="col">
              <div
                className="card h-100 shadow-sm rounded-4 border-0"
                style={{
                  transition: "transform 0.3s, box-shadow 0.3s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.03)";
                  e.currentTarget.style.boxShadow = "0 10px 20px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
                }}
              >
                <div className="card-body d-flex flex-column justify-content-between">
                  <h5
                    className="card-title text-truncate fw-semibold"
                    title={card.sf10_document_path || `E-Card ${index + 1}`}
                  >
                    {card.sf10_document_path ? card.sf10_document_path.split("/").pop() : `E-Card ${index + 1}`}
                  </h5>
                  <p className="card-text text-muted small mb-3">
                    <b>Grade:</b> {card.grade_level} | <b>Section:</b> {card.section}
                    <br />
                    <b>School Year:</b> {card.start_year} - {card.end_year}
                    <br />
                    <b>Uploaded:</b> {new Date(card.uploaded_at).toLocaleString()}
                  </p>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-outline-primary flex-grow-1"
                      onClick={() => openFileViewer(card)}
                      aria-label={`View document ${index + 1}`}
                    >
                      <i className="bi bi-eye-fill me-1"></i> View
                    </button>
                    {card.sf10_document_path && (
                      <button
                        className="btn btn-outline-success flex-grow-1"
                        onClick={() => handleDownload(card.sf10_document_path)}
                        aria-label={`Download document ${index + 1}`}
                      >
                        <i className="bi bi-download me-1"></i> Download
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal File Viewer */}
      {viewingFile && viewingFile.sf10_document_path && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          onClick={closeFileViewer}
          style={{ backgroundColor: "rgba(0,0,0,0.6)", animation: "fadeIn 0.3s ease" }}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="modal-dialog modal-xl modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "90vh", animation: "scaleIn 0.3s ease" }}
          >
            <div className="modal-content rounded-4 shadow-lg" style={{ height: "80vh" }}>
              <div className="modal-header border-0">
                <h5 className="modal-title text-truncate" style={{ maxWidth: "80%" }}>
                  {viewingFile.sf10_document_path.split("/").pop()}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeFileViewer}
                  aria-label="Close modal"
                ></button>
              </div>
              <div
                className="modal-body p-0 bg-light"
                style={{ height: "calc(100% - 56px)", overflow: "auto" }}
              >
                {(() => {
                  const ext = getFileExtension(viewingFile.sf10_document_path.toLowerCase());
                  if (["pdf"].includes(ext)) {
                    return (
                      <iframe
                        src={viewingFile.sf10_document_path}
                        style={{ width: "100%", height: "100%", border: "none" }}
                        title="PDF Preview"
                      />
                    );
                  } else if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
                    return (
                      <div className="d-flex justify-content-center align-items-center h-100 p-3">
                        <img
                          src={viewingFile.sf10_document_path}
                          alt="E-Card"
                          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "0.5rem" }}
                        />
                      </div>
                    );
                  } else if (["doc", "docx", "docs"].includes(ext)) {
                    return (
                      <iframe
                        src={`https://docs.google.com/gview?url=${viewingFile.sf10_document_path}&embedded=true`}
                        style={{ width: "100%", height: "100%", border: "none" }}
                        title="Word Preview"
                      />
                    );
                  } else {
                    return (
                      <p className="p-4 text-center fst-italic text-muted">
                        Unsupported file type for preview.
                      </p>
                    );
                  }
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
