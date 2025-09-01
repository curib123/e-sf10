// StudentRecord.jsx
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
const initialsOf = (s = {}) => [s.first_name, s.last_name].filter(Boolean).map(n => String(n).trim()[0]).join("").toUpperCase() || "—";
const colorFromString = (str = "") => {
  const hues = [210, 260, 155, 20, 330, 120, 45];
  let hash = 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${hues[Math.abs(hash) % hues.length]} 80% 45%)`;
};
const fullName = (s = {}) => [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
const prettyDateTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
const prettyDate = (iso) => (iso ? new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" }) : "—");

// unified fetch
async function apiFetch(path, { method = "GET", headers = {}, body } = {}) {
  const token = sessionStorage.getItem("token");
  if (!token) throw new Error("Missing authorization token.");
  const res = await fetch(`${BASE_URL}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...headers }, body });
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

  // NEW: enrollments for this student
  const [enrollments, setEnrollments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ type: "", text: "" });
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });

  const [viewingFile, setViewingFile] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(null);

  useEffect(() => { checkToken(); setPermissions(getUserPermissions()); }, []);

  useEffect(() => {
    if (!lrn) { setLoading(false); return; }

    const fetchStudent = async () => {
      try {
        const data = await apiFetch(`/students/${lrn}/details`);
        setStudent(data.student || null);
        setECards(data.eCards || []);
      } catch { setStudent(null); }
    };

    const fetchTransfer = async () => {
      const pageSize = 100, maxPages = 30;
      let page = 1;
      try {
        while (page <= maxPages) {
          const data = await apiFetch(`/transfer-request/view-all-requests?page=${page}&limit=${pageSize}`);
          const found = data?.data?.find((r) => String(r.lrn) === String(lrn));
          if (found) { setTransferRequest(found); break; }
          if (!data?.data?.length || data.data.length < pageSize) break;
          page++;
        }
      } catch { /* ignore */ }
    };

    // NEW: fetch all enrollments, then filter by this student's id
    const fetchEnrollments = async () => {
      try {
        const res = await apiFetch(`/enrollments`); // GET /esf10/enrollments
        const list = Array.isArray(res?.data) ? res.data : [];
        // we may not have student_id yet until fetchStudent resolves; filter after
        return list;
      } catch {
        return [];
      }
    };

    setLoading(true);
    (async () => {
      const [_, __, allEnrollments] = await Promise.all([fetchStudent(), fetchTransfer(), fetchEnrollments()]);
      // After student loaded, filter enrollments by student_id or LRN fallback
      setEnrollments((() => {
        if (!student?.student_id) return allEnrollments.filter((e) => String(e.student_name || "").toLowerCase().includes(String(lrn).toLowerCase()));
        return allEnrollments.filter((e) => String(e.student_id) === String(student.student_id));
      })());
      setLoading(false);
    })();
  }, [lrn, student?.student_id]); // re-filter when student_id becomes available

  useEffect(() => {
    if (!toast.text) return;
    const t = setTimeout(() => setToast({ type: "", text: "" }), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const onHideStatus = () => setModal((m) => ({ ...m, show: false }));
  const openViewer = (card) => setViewingFile(card);
  const askDelete = (id) => { setSelectedCardId(id); setShowDelete(true); };
  const confirmDelete = async () => {
    if (!selectedCardId) return;
    try {
      const res = await apiFetch(`/students/${selectedCardId}/delete-sf10`, { method: "DELETE" });
      if (res?.success) { setECards((prev) => prev.filter((c) => c.record_id !== selectedCardId)); setToast({ type: "success", text: "eCard deleted." }); }
      else setToast({ type: "error", text: "Failed to delete eCard." });
    } catch (err) { setToast({ type: "error", text: err.message || "Delete failed." }); }
    finally { setShowDelete(false); setSelectedCardId(null); }
  };
  const handleDownload = async (url) => {
    try {
      const resp = await fetch(url); if (!resp.ok) throw new Error("Download failed");
      const blob = await resp.blob(); const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = url.split("/").pop() || "document";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { setToast({ type: "error", text: "Download failed." }); }
  };
  const handleDownloadAll = async () => {
    for (const c of eCards) { if (c.sf10_document_path) { await handleDownload(c.sf10_document_path); await new Promise((r) => setTimeout(r, 180)); } }
  };

  if (loading) {
    return <div className="d-flex justify-content-center align-items-center vh-100"><div className="spinner-border" role="status" /></div>;
  }
  if (!student) {
    return (
      <div className="container-xxl py-5">
        <button className="btn btn-light border mb-3" onClick={() => navigate(-1)}>← Back</button>
        <div className="text-center text-danger fw-medium">Student not found.</div>
      </div>
    );
  }

  return (
    <div className="container-xxl py-3">
      <StatusModal {...modal} onHide={onHideStatus} />
      {toast.text && <div className={`alert alert-${toast.type === "success" ? "success" : "danger"} mb-3 py-2`}>{toast.text}</div>}

      {/* Profile Header */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
        <div className="w-100" style={{ height: 120, background: "linear-gradient(135deg, rgba(88,111,255,.8) 0%, rgba(16,22,47,.85) 100%)" }} />
        <div className="card-body pt-0">
          <div className="d-flex flex-wrap align-items-end justify-content-between gap-3" style={{ marginTop: -40 }}>
            <div className="d-flex align-items-end gap-3">
              <div className="rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: 80, height: 80, background: "#fff", border: `4px solid #fff`, outline: `4px solid rgba(0,0,0,.05)` }}>
                <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold" style={{ width: 72, height: 72, fontSize: 24, background: colorFromString(fullName(student) || String(student.lrn || "")) }} title={fullName(student)}>
                  {initialsOf(student)}
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="h5 fw-bold mb-5 text-white">{fullName(student) || "Unnamed Student"}</h1>
                <div className="d-flex flex-wrap align-items-center gap-2 small">
                  <span className="badge rounded-pill text-bg-light border">LRN&nbsp;<span className="fw-semibold">{student.lrn}</span></span>
                  {transferRequest?.request_status === "Approved" ? (
                    <span className="badge rounded-pill text-bg-success">Transferred</span>
                  ) : transferRequest?.request_status ? (
                    <span className="badge rounded-pill text-bg-secondary">{transferRequest.request_status}</span>
                  ) : null}
                  {student.gender && <span className="chip">{student.gender}</span>}
                  {student.date_of_birth && <span className="chip">{new Date(student.date_of_birth).toLocaleDateString()}</span>}
                </div>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <button className="btn btn-light border" onClick={() => navigate(-1)}>← Back</button>
              {eCards.length > 0 && <button className="btn btn-dark" onClick={handleDownloadAll} title="Download all eCards">Download All</button>}
            </div>
          </div>

          {/* Quick meta */}
          <div className="row gy-2 mt-3 small">
            <div className="col-md-3"><div className="text-muted">Guardian</div><div className="fw-semibold text-truncate">{student.guardian_name || "—"}</div></div>
            <div className="col-md-3"><div className="text-muted">Contact</div><div className="fw-semibold text-truncate">{student.contact_number || "—"}</div></div>
            <div className="col-md-6"><div className="text-muted">Address</div><div className="fw-semibold text-truncate">{[student.street, student.city, student.province, student.zip_code].filter(Boolean).join(", ") || "—"}</div></div>
          </div>
        </div>
      </div>

      {/* NEW: Enrollments summary */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="fs-6 fw-bold mb-0">Enrollments</h2>
            <div className="d-flex gap-2">
              <small className="text-muted align-self-center">{enrollments.length} record{enrollments.length === 1 ? "" : "s"}</small>
             
            </div>
          </div>

          {enrollments.length === 0 ? (
            <div className="text-center text-muted py-4">No enrollment records.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 140 }}>Date</th>
                    <th>School Year</th>
                    <th>Section</th>
                    <th>Curriculum</th>
                    <th style={{ width: 140 }}>Status</th>
                    <th style={{ width: 130 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments
                    .slice()
                    .sort((a, b) => (a.enrollment_date < b.enrollment_date ? 1 : -1))
                    .map((r) => (
                      <tr key={r.enrollment_id}>
                        <td>{prettyDate(r.enrollment_date)}</td>
                        <td>{r.school_year || "—"}</td>
                        <td>{r.section_name || "—"}</td>
                        <td>{r.curriculum_name || "—"}</td>
                        <td>
                          <span className={`badge rounded-pill ${r.status === "Enrolled" ? "text-bg-success" : r.status === "Pending" ? "text-bg-warning" : "text-bg-secondary"}`}>
                            {r.status || "—"}
                          </span>
                        </td>
                        <td className="d-flex gap-2">
                          <button className="btn btn-sm btn-outline-primary" onClick={() => navigate(`/enrollments/edit/${r.enrollment_id}`)}>Edit</button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
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
                    <div className="d-flex align-items-center gap-3 mb-2">
                      {isImg(url) ? (
                        <img src={url} alt="Preview" className="rounded" style={{ width: 56, height: 56, objectFit: "cover" }} />
                      ) : isPdf(url) ? (
                        <div className="bg-danger text-white d-flex align-items-center justify-content-center rounded" style={{ width: 56, height: 56 }}>
                          <span className="fw-bold">PDF</span>
                        </div>
                      ) : (
                        <div className="bg-secondary text-white d-flex align-items-center justify-content-center rounded" style={{ width: 56, height: 56 }}>
                          <span className="fw-bold">FILE</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="fw-semibold text-truncate">{fileName}</div>
                        <div className="text-muted small text-truncate">
                          Grade {card.grade_level} • {card.section || "—"} • SY {card.start_year}-{card.end_year}
                        </div>
                      </div>
                    </div>

                    <div className="text-muted small mb-3">Uploaded: {prettyDateTime(card.uploaded_at)}</div>

                    <div className="mt-auto d-grid gap-2">
                      <div className="d-flex gap-2">
                        <button className="btn btn-outline-primary flex-fill" onClick={() => openViewer(card)} disabled={!permissions.view_ecards}>View</button>
                        <button className="btn btn-outline-success flex-fill" onClick={() => handleDownload(url)} disabled={!permissions.download_documents}>Download</button>
                      </div>
                      <button className="btn btn-outline-danger" onClick={() => askDelete(card.record_id)} disabled={!permissions.delete_documents}>Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete dialog */}
      {showDelete && (
        <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowDelete(false)}>
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

      {/* Viewer */}
      {viewingFile?.sf10_document_path && (
        <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setViewingFile(null)}>
          <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0" style={{ height: "80vh" }}>
              <div className="modal-header border-0">
                <h6 className="modal-title text-truncate">{viewingFile.sf10_document_path.split("/").pop()}</h6>
                <button className="btn-close" onClick={() => setViewingFile(null)} />
              </div>
              <div className="modal-body p-0 bg-light" style={{ height: "calc(100% - 56px)" }}>
                {isImg(viewingFile.sf10_document_path) ? (
                  <img src={viewingFile.sf10_document_path} className="img-fluid h-100 mx-auto d-block" style={{ objectFit: "contain" }} alt="Document" />
                ) : isPdf(viewingFile.sf10_document_path) ? (
                  <iframe src={viewingFile.sf10_document_path} title="PDF" className="w-100 h-100 border-0" />
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

      <style>{`
        .chip{display:inline-flex;align-items:center;gap:.35rem;padding:.25rem .55rem;border-radius:999px;background:#f6f7fb;border:1px solid #e9ecf5;color:#4f5565;}
        @media (max-width: 576px){.chip{font-size:.78rem}}
      `}</style>
    </div>
  );
}
