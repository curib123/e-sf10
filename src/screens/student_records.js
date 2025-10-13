// StudentRecord.jsx — Modern blue→cyan gradient + glassmorphism polish (Bootstrap-only)
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
  return Math.round(m * 100) / 100;
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
    const t = setTimeout(() => setToast({ type: "", text: "" }), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const onHideStatus = () => setModal((m) => ({ ...m, show: false }));
  const openViewer = (card) => setViewingFile(card);
  const askDelete = (id) => { setSelectedCardId(id); setShowDelete(true); };
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

  // derived
  const enrollments = useMemo(() => (student?.enrollments || []).slice()
    .sort((a, b) => {
      const ao = a?.grade_level?.grade_order ?? 0;
      const bo = b?.grade_level?.grade_order ?? 0;
      return ao - bo;
    }), [student]);

  // averages
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
        await new Promise((r) => setTimeout(r, 120));
      }
    }
  };

  // ─── render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-gradient-soft">
        <div className="spinner-border text-primary" role="status" />
        <style>{baseStyles}</style>
      </div>
    );
  }
  if (!student) {
    return (
      <div className="container-xxl py-5">
        <button className="btn btn-light border mb-3" onClick={() => navigate(-1)}>← Back</button>
        <div className="text-center text-danger fw-medium">Student not found.</div>
        <style>{baseStyles}</style>
      </div>
    );
  }

  return (
    <div className="container-xxl py-3">
      <StatusModal {...modal} onHide={onHideStatus} />

      {toast.text && (
        <div className={`alert modern-alert ${toast.type === "success" ? "alert-success" : "alert-danger"} mb-3 py-2`}>
          {toast.text}
        </div>
      )}

      {/* Banner + Profile Card (glass) */}
      <div className="gradient-banner rounded-4 position-relative overflow-hidden mb-4">
        <div className="banner-waves" />
        <div className="p-3 p-md-4">
          <div className="glass-card border-0 rounded-4 p-3 p-md-4">
            <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
              <div className="d-flex align-items-end gap-3">
                <div className="avatar-wrap shadow-sm">
                  <div
                    className="avatar-inner text-white fw-bold"
                    style={{ background: colorFromString(fullName(student) || String(student.lrn || "")) }}
                    title={fullName(student)}
                  >
                    {initialsOf(student)}
                  </div>
                </div>

                <div className="min-w-0">
                  <h1 className="h4 fw-bold mb-1 text-white text-shadow-sm">{fullName(student) || "Unnamed Student"}</h1>
                  <div className="d-flex flex-wrap align-items-center gap-2 small">
                    <span className="badge badge-soft-light">LRN&nbsp;<span className="fw-semibold">{student.lrn}</span></span>
                    {student.gender && <span className="chip">{student.gender}</span>}
                    {student.date_of_birth && <span className="chip">{new Date(student.date_of_birth).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2">
                <button className="btn btn-ghost-light" onClick={() => navigate(-1)}>← Back</button>
                {eCards.length > 0 && (
                  <button className="btn btn-cta" onClick={handleDownloadAll} title="Download all eCards">
                    Download All
                  </button>
                )}
              </div>
            </div>

            {/* Quick meta */}
            <div className="row gy-2 mt-3 small">
              <div className="col-md-3">
                <div className="text-light opacity-75">Guardian</div>
                <div className="fw-semibold text-truncate text-white">{student.guardian_name || "—"}</div>
              </div>
              <div className="col-md-3">
                <div className="text-light opacity-75">Contact</div>
                <div className="fw-semibold text-truncate text-white">{student.contact_number || "—"}</div>
              </div>
              <div className="col-md-6">
                <div className="text-light opacity-75">Address</div>
                <div className="fw-semibold text-truncate text-white">
                  {[student.street, student.city, student.province, student.zip_code].filter(Boolean).join(", ") || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enrollments */}
      <div className="card border-0 shadow-sm rounded-4 mb-4 soft-card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="fs-6 fw-bold mb-0 text-primary-700">Enrollments</h2>
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

                const p1 = periodAvgAcrossSubjects(enr, "1st");
                const p2 = periodAvgAcrossSubjects(enr, "2nd");
                const p3 = periodAvgAcrossSubjects(enr, "3rd");
                const p4 = periodAvgAcrossSubjects(enr, "4th");

                return (
                  <div className="card border-0 shadow-sm rounded-4 hover-lift" key={enr.enrollment_id || i}>
                    <div className="card-body">
                      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
                        <div className="d-flex flex-wrap gap-2 gap-sm-3 small">
                          <span className="badge badge-soft-primary">Grade: <b className="ms-1">{gl}</b></span>
                          <span className="badge badge-soft-slate">Section: <b className="ms-1">{sec}</b></span>
                          <span className="badge badge-soft-slate">SY: <b className="ms-1">{sy}</b></span>
                          <span className="badge badge-soft-slate">Curriculum: <b className="ms-1">{cur}</b></span>
                        </div>
                        <div className="small">
                          <span className="text-muted me-1">General Average:</span>
                          <span className="fw-bold text-primary-700">{gradeStr(gAvg)}</span>
                        </div>
                      </div>

                      {subjects.length === 0 ? (
                        <div className="text-muted small">No subjects for this enrollment.</div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-sm align-middle mb-0 modern-table">
                            <thead>
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
                                      <div className="text-muted small text-truncate">
                                        {s.subject_code || ""}
                                        {s?.teacher?.teacher_name ? ` • ${s.teacher.teacher_name.trim()}` : ""}
                                      </div>
                                    </td>
                                    <td className="text-center">{gradeStr(g1)}</td>
                                    <td className="text-center">{gradeStr(g2)}</td>
                                    <td className="text-center">{gradeStr(g3)}</td>
                                    <td className="text-center">{gradeStr(g4)}</td>
                                    <td className="text-center fw-semibold text-primary-700">{gradeStr(sAvg)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td className="fw-semibold">Period Average</td>
                                <td className="text-center fw-semibold">{gradeStr(p1)}</td>
                                <td className="text-center fw-semibold">{gradeStr(p2)}</td>
                                <td className="text-center fw-semibold">{gradeStr(p3)}</td>
                                <td className="text-center fw-semibold">{gradeStr(p4)}</td>
                                <td className="text-center fw-bold text-primary-700">{gradeStr(gAvg)}</td>
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
        <h2 className="fs-6 fw-bold mb-0 text-primary-700">E-Cards</h2>
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
                <div className="card h-100 border-0 shadow-sm rounded-4 hover-lift soft-card">
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex align-items-center gap-3 mb-2">
                      {isImg(url) ? (
                        <img src={url} alt="Preview" className="rounded obj-cover" style={{ width: 56, height: 56 }} />
                      ) : isPdf(url) ? (
                        <div className="badge-file badge-pdf">PDF</div>
                      ) : (
                        <div className="badge-file">FILE</div>
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
                        <button className="btn btn-outline-primary flex-fill btn-soft" onClick={() => openViewer(card)} disabled={!permissions.view_ecards}>View</button>
                        <button className="btn btn-outline-success flex-fill btn-soft" onClick={() => handleDownload(url)} disabled={!permissions.download_documents}>Download</button>
                      </div>
                      <button className="btn btn-outline-danger btn-soft" onClick={() => askDelete(card.record_id)} disabled={!permissions.delete_documents}>Delete</button>
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
        <div className="modal fade show d-block" style={{ background: "rgba(2,6,23,.55)" }} onClick={() => setShowDelete(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow-lg">
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
        <div className="modal fade show d-block" style={{ background: "rgba(2,6,23,.55)" }} onClick={() => setViewingFile(null)}>
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

      <style>{baseStyles}</style>
    </div>
  );
}

/* ─── styles (blue→cyan gradient theme) ───────────────────────────────────── */
const baseStyles = `
:root{
  --primary-600:#2563eb; /* blue-600 */
  --primary-700:#1d4ed8; /* blue-700 */
  --cyan-500:#06b6d4;    /* cyan-500 */
  --cyan-400:#22d3ee;    /* cyan-400 */
  --slate-50:#f8fafc;
  --slate-100:#f1f5f9;
  --slate-200:#e2e8f0;
  --slate-600:#475569;
  --card-bg: #ffffff;
  --glass-bg: rgba(255,255,255,0.12);
  --glass-brd: rgba(255,255,255,0.22);
}

/* soft app bg option (used on loading) */
.bg-gradient-soft{
  background: linear-gradient(135deg, rgba(29,78,216,.08) 0%, rgba(6,182,212,.08) 100%);
}

/* Banner */
.gradient-banner{
  background: radial-gradient(1200px 360px at -10% -10%, rgba(34,211,238,.35) 0%, rgba(34,211,238,0) 60%),
              radial-gradient(1000px 380px at 110% 20%, rgba(37,99,235,.35) 0%, rgba(37,99,235,0) 60%),
              linear-gradient(135deg, #1d4ed8 0%, #06b6d4 100%);
}
.banner-waves{
  position:absolute; inset:0;
  background:
    radial-gradient(80% 50% at 0% 0%, rgba(255,255,255,.14) 0%, rgba(255,255,255,0) 60%),
    radial-gradient(60% 60% at 100% 0%, rgba(255,255,255,.1) 0%, rgba(255,255,255,0) 60%);
  mix-blend-mode: overlay; opacity:.55;
  pointer-events:none;
}

/* Glass card inside banner */
.glass-card{
  background: var(--glass-bg);
  width: 100vw; max-width: 100%;
  border: 1px solid var(--glass-brd);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* Avatar */
.avatar-wrap{ width: 84px; height: 84px; border-radius: 999px; background: #fff; border: 4px solid #fff; outline: 4px solid rgba(255,255,255,.25); display:flex; align-items:center; justify-content:center;}
.avatar-inner{ width:72px; height:72px; border-radius:999px; display:flex; align-items:center; justify-content:center; font-size:24px; letter-spacing:.5px; }

/* Text subtle shadow on banner */
.text-shadow-sm{ text-shadow:0 1px 2px rgba(0,0,0,.25); }

/* Badges + chips */
.badge-soft-light{ background: rgba(255,255,255,.2); color: #fff; border: 1px solid rgba(255,255,255,.35); }
.badge-soft-primary{ background: rgba(37,99,235,.12); color: #1d4ed8; border: 1px solid rgba(37,99,235,.18); }
.badge-soft-slate{ background: var(--slate-50); color: var(--slate-600); border: 1px solid var(--slate-200); }

.chip{
  display:inline-flex;align-items:center;gap:.4rem;
  padding:.28rem .6rem;border-radius:999px;
  background: var(--slate-50);
  border:1px solid var(--slate-200); color:#334155;
}

/* Buttons */
.btn-ghost-light{
  color:#fff; border:1px solid rgba(255,255,255,.35); background:transparent;
}
.btn-ghost-light:hover{ background: rgba(255,255,255,.12); }

.btn-cta{
  color:#0b1220; font-weight:600;
  background: linear-gradient(135deg, #22d3ee 0%, #60a5fa 100%);
  border: none;
  box-shadow: 0 6px 18px rgba(14,165,233,.35);
}
.btn-cta:hover{ filter: brightness(.98); }

.btn-soft{
  border-color: var(--slate-200);
}
.btn-soft:hover{
  background: var(--slate-100);
}

/* Soft card */
.soft-card{ background: #fff; border-radius: 1rem; }

/* Table */
.modern-table thead tr{
  background: linear-gradient(180deg, #f7fafc 0%, #eef2f7 100%);
}
.modern-table thead th{
  border-bottom: 1px solid var(--slate-200)!important;
  color:#1f2937; font-weight:600;
}
.modern-table tbody tr:hover{ background: #fafbff; }
.modern-table tfoot td{
  background: #f8fafc; border-top: 1px solid var(--slate-200)!important;
}

/* File badges */
.badge-file{
  width:56px;height:56px;border-radius:.75rem;
  background: #0f172a; color:#fff; display:flex;align-items:center;justify-content:center;
  font-weight:700; letter-spacing:.5px;
}
.badge-pdf{ background: #dc2626; }
.obj-cover{ object-fit: cover; }

/* Hover lift */
.hover-lift{ transition: transform .18s ease, box-shadow .18s ease; }
.hover-lift:hover{ transform: translateY(-2px); box-shadow: 0 10px 24px rgba(2,6,23,.08); }

/* Alerts */
.modern-alert{
  border-radius: .75rem;
  border: 1px solid var(--slate-200);
}

/* Utility text colors */
.text-primary-700{ color: var(--primary-700) !important; }

/* Reduce motion prefs */
@media (prefers-reduced-motion: reduce){
  .hover-lift{ transition: none; }
}

/* Small polish */
.table td, .table th{ vertical-align: middle; }
.card{ border-radius: 1rem; }
`;
