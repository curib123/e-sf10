import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

async function apiFetch(path, { method = "GET", headers = {}, body } = {}) {
  const token = sessionStorage.getItem("token");
  if (!token) throw new Error("Missing authorization token. Please log in.");
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

const MAX_FILE_MB = 10;
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function StudentRecord() {
  const { lrn } = useParams();

  // data
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [eCards, setECards] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [sections, setSections] = useState([]);

  // ui
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });

  // form
  const [form, setForm] = useState({
    sf10: null,
    school_year_id: "",
    start_year: "",
    end_year: "",
    grade_level: "",
    section: "",
  });
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const fileRef = useRef(null);

  useEffect(() => { checkToken(); }, []);

  // fetch student
  useEffect(() => {
    (async () => {
      try {
        if (!lrn) return;
        const data = await apiFetch(`/students/${lrn}/details`);
        setStudentId(data.student?.student_id || null);
        setStudentName(
          `${data.student?.last_name || ""}, ${data.student?.first_name || ""} ${data.student?.middle_name || ""}`.trim()
        );
        setECards(data.eCards || []);
      } catch (err) {
        setModal({ show: true, title: "Error", message: err.message, variant: "danger" });
      } finally {
        setLoading(false);
      }
    })();
  }, [lrn]);

  // fetch school years / grades / sections
  useEffect(() => {
    (async () => {
      try {
        const [years, grades, secs] = await Promise.all([
          apiFetch(`/school-year/all-school-years`, { headers: { "Content-Type": "application/json" } }),
          apiFetch(`/grade-levels`, { headers: { "Content-Type": "application/json" } }),
          apiFetch(`/sections`, { headers: { "Content-Type": "application/json" } }),
        ]);
        if (years.success) setSchoolYears(years.schoolYears || []);
        if (grades.success) {
          const sorted = [...(grades.data || [])].sort((a, b) => (a.grade_order ?? 0) - (b.grade_order ?? 0));
          setGradeLevels(sorted);
        }
        if (secs.success) setSections(secs.data || []);
      } catch (err) {
        setModal({ show: true, title: "Error", message: "Failed to load dropdown data.", variant: "danger" });
      }
    })();
  }, []);

  const onHideModal = () => setModal((m) => ({ ...m, show: false }));
  const prettyDateTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

  const filteredSections = useMemo(() => {
    if (!selectedGradeId) return [];
    return sections.filter((s) => String(s.grade_level_id) === String(selectedGradeId));
  }, [sections, selectedGradeId]);

  // handlers
  const handleSchoolYear = (e) => {
    const val = e.target.value;
    const sy = schoolYears.find((x) => String(x.school_year_id) === String(val));
    setForm((p) => ({
      ...p,
      school_year_id: val,
      start_year: sy?.start_year || "",
      end_year: sy?.end_year || "",
    }));
  };

  const handleGrade = (e) => {
    const id = e.target.value;
    setSelectedGradeId(id);
    setSelectedSectionId("");
    const gl = gradeLevels.find((g) => String(g.grade_level_id) === String(id));
    setForm((p) => ({ ...p, grade_level: gl?.grade_name || "", section: "" }));
  };

  const handleSection = (e) => {
    const sid = e.target.value;
    setSelectedSectionId(sid);
    const sec = sections.find((s) => String(s.section_id) === String(sid));
    setForm((p) => ({
      ...p,
      section: sec?.section_name || "",
      grade_level:
        gradeLevels.find((g) => String(g.grade_level_id) === String(sec?.grade_level_id))?.grade_name || p.grade_level,
    }));
    if (sec?.grade_level_id && String(sec.grade_level_id) !== String(selectedGradeId)) {
      setSelectedGradeId(String(sec.grade_level_id));
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) return setForm((p) => ({ ...p, sf10: null }));
    if (!ALLOWED_TYPES.includes(file.type)) {
      setModal({ show: true, title: "Unsupported file", message: "Use PDF, JPG, PNG, DOC, or DOCX.", variant: "warning" });
      e.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setModal({ show: true, title: "File too large", message: `Max size is ${MAX_FILE_MB}MB.`, variant: "warning" });
      e.target.value = "";
      return;
    }
    setForm((p) => ({ ...p, sf10: file }));
  };

  const isFormValid = !!form.sf10 && !!form.school_year_id && !!form.grade_level && !!form.section;

  const clearForm = () => {
    setForm({ sf10: null, school_year_id: "", start_year: "", end_year: "", grade_level: "", section: "" });
    setSelectedGradeId("");
    setSelectedSectionId("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!studentId) return setModal({ show: true, title: "Error", message: "Student ID not available.", variant: "danger" });
    if (!isFormValid) return setModal({ show: true, title: "Incomplete", message: "Fill all fields and attach a file.", variant: "warning" });

    const fd = new FormData();
    fd.append("sf10", form.sf10);
    fd.append("school_year_id", form.school_year_id);
    fd.append("start_year", form.start_year);
    fd.append("end_year", form.end_year);
    fd.append("grade_level", form.grade_level);
    fd.append("section", form.section);

    try {
      setSubmitting(true);
      const data = await apiFetch(`/students/upload-sf10/${studentId}`, { method: "POST", body: fd });
      setModal({ show: true, title: "Uploaded", message: data.message || "Document uploaded.", variant: "success" });
      if (data.document) setECards((prev) => [data.document, ...prev]);
      clearForm();
    } catch (err) {
      setModal({ show: true, title: "Upload failed", message: err.message, variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-5 d-flex align-items-center gap-3">
        <div className="spinner-border" role="status" />
        <div>Loading…</div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <StatusModal {...modal} onHide={onHideModal} />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <button className="btn btn-outline-secondary" onClick={() => window.history.back()}>Back</button>
        <div className="text-muted small">LRN: <strong className="text-body">{lrn}</strong></div>
      </div>

      {/* Student summary */}
      <div className="p-3 mb-4 border rounded">
        <div className="d-flex justify-content-between align-items-center">
          <div className="fw-medium">{studentName || "Student"}</div>
          <div className="text-muted small">SF10 Records</div>
        </div>
      </div>

      {/* Upload */}
      <form onSubmit={handleUpload} className="border rounded p-3 mb-4" encType="multipart/form-data" noValidate>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label">School Year</label>
            <select
              name="school_year_id"
              className="form-select"
              value={form.school_year_id}
              onChange={handleSchoolYear}
              required
            >
              <option value="">Select...</option>
              {schoolYears.map((sy) => (
                <option key={sy.school_year_id} value={sy.school_year_id}>
                  {sy.start_year} - {sy.end_year}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-4">
            <label className="form-label">Grade Level</label>
            <select
              className="form-select"
              value={selectedGradeId}
              onChange={handleGrade}
              required
            >
              <option value="">Select...</option>
              {gradeLevels.map((g) => (
                <option key={g.grade_level_id} value={g.grade_level_id}>{g.grade_name}</option>
              ))}
            </select>
          </div>

          <div className="col-md-4">
            <label className="form-label">Section</label>
            <select
              className="form-select"
              value={selectedSectionId}
              onChange={handleSection}
              required
              disabled={!selectedGradeId}
            >
              <option value="">{selectedGradeId ? "Select..." : "Choose a grade first"}</option>
              {filteredSections.map((s) => (
                <option key={s.section_id} value={s.section_id}>{s.section_name}</option>
              ))}
            </select>
          </div>

          <div className="col-12">
            <label htmlFor="sf10" className="form-label">SF10 File</label>
            <input
              ref={fileRef}
              id="sf10"
              name="sf10"
              type="file"
              className="form-control"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFile}
              required
            />
          </div>

          <div className="col-12 d-grid">
            <button
              type="submit"
              className="btn btn-dark"
              disabled={!isFormValid || submitting}
            >
              {submitting ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>
      </form>

      {/* eCards */}
      <div className="border rounded p-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="fw-medium">Uploaded SF10 eCards</div>
          <Link to={`/record_student/${lrn}`} className="btn btn-outline-secondary btn-sm">View Student Record</Link>
        </div>

        {eCards.length === 0 ? (
          <div className="text-muted">No eCards uploaded yet.</div>
        ) : (
          <div className="row g-2">
            {eCards.map((ecard, i) => (
              <div className="col-12 col-md-6 col-lg-4" key={i}>
                <div className="border rounded p-3 h-100">
                  <div className="small mb-2">{prettyDateTime(ecard.uploaded_at)}</div>
                  <div className="d-flex flex-wrap gap-2 small">
                    {ecard.start_year && ecard.end_year && <span className="badge text-bg-light">SY {ecard.start_year}-{ecard.end_year}</span>}
                    {ecard.grade_level && <span className="badge text-bg-light">Grade {ecard.grade_level}</span>}
                    {ecard.section && <span className="badge text-bg-light">Section {ecard.section}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
