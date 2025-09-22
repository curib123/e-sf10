// StudentRecord.jsx
import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import { getUserPermissions } from '../components/get_permission';
import StatusModal from '../components/status_modal';
import { checkToken } from '../components/token_checker';

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

// ─── utils ───────────────────────────────────────────────────────────────────
const extOf = (name = "") => name.split(".").pop()?.toLowerCase() || "";
const isImg = (url = "") => ["png", "jpg", "jpeg", "gif", "bmp", "webp"].includes(extOf(url));
const isPdf = (url = "") => extOf(url) === "pdf";
const initialsOf = (s = {}) =>
  [s.first_name, s.last_name].filter(Boolean).map(n => String(n).trim()[0]).join("").toUpperCase() || "—";
const colorFromString = (str = "") => {
  const hues = [210, 260, 155, 20, 330, 120, 45];
  let hash = 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${hues[Math.abs(hash) % hues.length]} 80% 45%)`;
};
const fullName = (s = {}) => [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
const prettyDateTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

// tiny math helpers
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const mean = (arr) => {
  const vals = arr.map(num).filter(v => v !== null && !Number.isNaN(v));
  if (!vals.length) return null;
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(m * 100) / 100; // 2 decimals
};
const gradeStr = (g) => (g === null || g === undefined || Number.isNaN(Number(g)) ? "—" : `${Number(g) % 1 === 0 ? Number(g) : Number(g).toFixed(2)}`);

// unified fetch (token + json)
async function apiFetch(path, { method = "GET", headers = {}, body } = {}) {
  const token = sessionStorage.getItem("token");
  if (!token) throw new Error("Missing authorization token.");
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body,
  });
  const type = res.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await res.json().catch(() => ({})) : null;
  if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  return data ?? {};
}

// ─── component ───────────────────────────────────────────────────────────────
export default function StudentRecord() {
  const { lrn } = useParams();
  const navigate = useNavigate();

  const [permissions, setPermissions] = useState([]);
  const [student, setStudent] = useState(null);
  const [eCards, setECards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ type: "", text: "" });
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });

  const [viewingFile, setViewingFile] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(null);

  useEffect(() => { checkToken(); setPermissions(getUserPermissions()); }, []);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (!lrn) { setLoading(false); return; }
      setLoading(true);
      try {
        // NEW: single call returns everything we need
        const data = await apiFetch(`/students/${lrn}/details`);
        if (ignore) return;
        setStudent(data.student || null);
        setECards(data.eCards || []);
      } catch (err) {
        if (!ignore) setStudent(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    run();
    return () => { ignore = true; };
  }, [lrn]);

  useEffect(() => {
    if (!toast.text) return;
    const t = setTimeout(() => setToast({ type: "", text: "" }), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const onHideStatus = () => setModal((m) => ({ ...m, show: false }));
  const openViewer = (card) => setViewingFile(card);
  const askDelete = (id) => { setSelectedCardId(id); setShowDelete(true); };
  const confirmDelete = async () => {
    if (!selectedCardId) return;
    try {
      // keep as-is (adjust if your backend path differs)
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

  // derived
  const enrollments = useMemo(() => (student?.enrollments || []).slice()
    .sort((a, b) => {
      const ao = a?.grade_level?.grade_order ?? 0;
      const bo = b?.grade_level?.grade_order ?? 0;
      return ao - bo;
    }), [student]);

  // computing subject avg + general avg (fallback if null from API)
  const subjectAvg = (subj) => {
    if (subj?.subject_average !== null && subj?.subject_average !== undefined) return subj.subject_average;
    const vals = (subj?.grades || []).map(g => g?.grade);
    return mean(vals);
  };
  const enrollmentGeneralAvg = (enr) => {
    if (enr?.general_average !== null && enr?.general_average !== undefined) return enr.general_average;
    const avgs = (enr?.subjects || []).map(subjectAvg).filter(v => v !== null);
    return mean(avgs);
  };
  const periodAvgAcrossSubjects = (enr, periodName) => {
    const vals = (enr?.subjects || []).map(s => {
      const entry = (s.grades || []).find(g => String(g.grading_period).toLowerCase() === String(periodName).toLowerCase());
      return entry?.grade;
    });
    return mean(vals);
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
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  };

  // ─── render ────────────────────────────────────────────────────────────────
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
        <button className="btn btn-light border mb-3" onClick={() => navigate(-1)}>← Back</button>
        <div className="text-center text-danger fw-medium">Student not found.</div>
      </div>
    );
  }

  return (
    <div className="container-xxl py-3">
      <StatusModal {...modal} onHide={onHideStatus} />
      {toast.text && (
        <div className={`alert alert-${toast.type === "success" ? "success" : "danger"} mb-3 py-2`}>
          {toast.text}
        </div>
      )}

      {/* Profile Header */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
        <div className="w-100" style={{ height: 120, background: "linear-gradient(135deg, rgba(88,111,255,.8) 0%, rgba(16,22,47,.85) 100%)" }} />
        <div className="card-body pt-0">
          <div className="d-flex flex-wrap align-items-end justify-content-between gap-3" style={{ marginTop: -40 }}>
            <div className="d-flex align-items-end gap-3">
              <div className="rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: 80, height: 80, background: "#fff", border: `4px solid #fff`, outline: `4px solid rgba(0,0,0,.05)` }}>
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                  style={{ width: 72, height: 72, fontSize: 24, background: colorFromString(fullName(student) || String(student.lrn || "")) }}
                  title={fullName(student)}
                >
                  {initialsOf(student)}
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="h5 fw-bold mb-2 text-white">{fullName(student) || "Unnamed Student"}</h1>
                <div className="d-flex flex-wrap align-items-center gap-2 small">
                  <span className="badge rounded-pill text-bg-light border">LRN&nbsp;<span className="fw-semibold">{student.lrn}</span></span>
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
            <div className="col-md-3">
              <div className="text-muted">Guardian</div>
              <div className="fw-semibold text-truncate">{student.guardian_name || "—"}</div>
            </div>
            <div className="col-md-3">
              <div className="text-muted">Contact</div>
              <div className="fw-semibold text-truncate">{student.contact_number || "—"}</div>
            </div>
            <div className="col-md-6">
              <div className="text-muted">Address</div>
              <div className="fw-semibold text-truncate">
                {[student.street, student.city, student.province, student.zip_code].filter(Boolean).join(", ") || "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enrollments (from new API shape) */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="fs-6 fw-bold mb-0">Enrollments</h2>
            <small className="text-muted">{enrollments.length} record{enrollments.length === 1 ? "" : "s"}</small>
          </div>

          {enrollments.length === 0 ? (
            <div className="text-center text-muted py-4">No enrollment records.</div>
          ) : (
            <div className="vstack gap-3">
              {enrollments.map((enr, i) => {
                const gl = enr?.grade_level?.grade_name || "—";
                const sec = enr?.section?.section_name || "—";
                const sy = enr?.school_year?.school_year || "—";
                const cur = enr?.curriculum?.curriculum_name || "—";
                const subjects = enr?.subjects || [];
                const gAvg = enrollmentGeneralAvg(enr);

                // per-period overall averages (computed)
                const p1 = periodAvgAcrossSubjects(enr, "1st");
                const p2 = periodAvgAcrossSubjects(enr, "2nd");
                const p3 = periodAvgAcrossSubjects(enr, "3rd");
                const p4 = periodAvgAcrossSubjects(enr, "4th");

                return (
                  <div className="card border-0 shadow-sm rounded-4" key={enr.enrollment_id || i}>
                    <div className="card-body">
                      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
                        <div className="d-flex flex-wrap gap-3 small">
                          <span className="badge text-bg-primary">Grade: <b className="ms-1">{gl}</b></span>
                          <span className="badge text-bg-light border">Section: <b className="ms-1">{sec}</b></span>
                          <span className="badge text-bg-light border">SY: <b className="ms-1">{sy}</b></span>
                          <span className="badge text-bg-light border">Curriculum: <b className="ms-1">{cur}</b></span>
                        </div>
                        <div className="small">
                          <span className="text-muted me-1">General Average:</span>
                          <span className="fw-bold">{gradeStr(gAvg)}</span>
                        </div>
                      </div>

                      {subjects.length === 0 ? (
                        <div className="text-muted small">No subjects for this enrollment.</div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-sm table-hover align-middle mb-0">
                            <thead className="table-light">
                              <tr>
                                <th style={{ minWidth: 220 }}>Subject</th>
                                <th className="text-center" style={{ width: 80 }}>1st</th>
                                <th className="text-center" style={{ width: 80 }}>2nd</th>
                                <th className="text-center" style={{ width: 80 }}>3rd</th>
                                <th className="text-center" style={{ width: 80 }}>4th</th>
                                <th className="text-center" style={{ width: 90 }}>Average</th>
                              </tr>
                            </thead>
                            <tbody>
                              {subjects.map((s, idx) => {
                                const g1 = (s.grades || []).find((g) => g.grading_period === "1st")?.grade ?? null;
                                const g2 = (s.grades || []).find((g) => g.grading_period === "2nd")?.grade ?? null;
                                const g3 = (s.grades || []).find((g) => g.grading_period === "3rd")?.grade ?? null;
                                const g4 = (s.grades || []).find((g) => g.grading_period === "4th")?.grade ?? null;
                                const sAvg = subjectAvg(s);

                                return (
                                  <tr key={s.subject_id || idx}>
                                    <td>
                                      <div className="fw-semibold text-truncate">{s.subject_name || "—"}</div>
                                      <div className="text-muted small text-truncate">{s.subject_code || ""}{s?.teacher?.teacher_name ? ` • ${s.teacher.teacher_name.trim()}` : ""}</div>
                                    </td>
                                    <td className="text-center">{gradeStr(g1)}</td>
                                    <td className="text-center">{gradeStr(g2)}</td>
                                    <td className="text-center">{gradeStr(g3)}</td>
                                    <td className="text-center">{gradeStr(g4)}</td>
                                    <td className="text-center fw-semibold">{gradeStr(sAvg)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="table-light">
                                <td className="fw-semibold">Period Average</td>
                                <td className="text-center fw-semibold">{gradeStr(p1)}</td>
                                <td className="text-center fw-semibold">{gradeStr(p2)}</td>
                                <td className="text-center fw-semibold">{gradeStr(p3)}</td>
                                <td className="text-center fw-semibold">{gradeStr(p4)}</td>
                                <td className="text-center fw-bold">{gradeStr(gAvg)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
