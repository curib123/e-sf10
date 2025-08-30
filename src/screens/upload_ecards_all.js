import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AsyncSelect from "react-select/async";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const MAX_FILE_MB = 10;
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

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

// "Grade 12" -> "12"; prefer grade_order when numeric
const toNumericGrade = (g) => {
  if (!g) return "";
  if (!Number.isNaN(Number(g.grade_order))) return String(Number(g.grade_order));
  const m = String(g.grade_name || "").match(/\d+/);
  return m ? m[0] : "";
};

export default function StudentRecord() {
  const [lrn, setLrn] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [eCards, setECards] = useState([]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });

  const [schoolYears, setSchoolYears] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [sections, setSections] = useState([]);

  const [form, setForm] = useState({
    sf10: null,
    school_year_id: "",
    start_year: "",
    end_year: "",
    grade_level: "",          // numeric text for API (e.g. "12")
    grade_level_label: "",    // pretty label for UI
    section: "",              // section NAME for API (e.g. "emerald")
  });

  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");

  const fileRef = useRef(null);

  useEffect(() => { checkToken(); }, []);

  useEffect(() => {
    if (!message.text) return;
    const t = setTimeout(() => setMessage({ type: "", text: "" }), 4000);
    return () => clearTimeout(t);
  }, [message]);

  // Load dropdown data
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
      } catch {
        setMessage({ type: "error", text: "Failed to load dropdown data." });
      }
    })();
  }, []);

  // Student search options
  const fetchStudentOptions = async (inputValue) => {
    if (!inputValue) return [];
    try {
      const data = await apiFetch(`/students/all?page=1&limit=50`);
      const list = data.students || [];
      return list
        .filter(
          (s) =>
            String(s.lrn).includes(inputValue) ||
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(inputValue.toLowerCase())
        )
        .map((s) => ({ value: s.lrn, label: `${s.lrn} - ${s.last_name}, ${s.first_name}` }));
    } catch {
      return [];
    }
  };

  // Load student details
  const fetchDetails = async (selectedLrn) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/students/${selectedLrn}/details`);
      setLrn(selectedLrn);
      setStudentId(data.student?.student_id || null);
      setStudentName(
        `${data.student?.last_name || ""}, ${data.student?.first_name || ""} ${data.student?.middle_name || ""}`.trim()
      );
      setECards(data.eCards || []);
      setMessage({ type: "success", text: "Student loaded." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Derived: Sections filtered by grade
  const filteredSections = useMemo(() => {
    if (!selectedGradeId) return [];
    return sections.filter((s) => String(s.grade_level_id) === String(selectedGradeId));
  }, [sections, selectedGradeId]);

  // Handlers
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
    setForm((p) => ({
      ...p,
      grade_level: toNumericGrade(gl),          // numeric for API
      grade_level_label: gl?.grade_name || "",  // pretty for UI
      section: "",
    }));
  };

  const handleSection = (e) => {
    const sid = e.target.value;
    setSelectedSectionId(sid);
    const sec = sections.find((s) => String(s.section_id) === String(sid));
    const gl = gradeLevels.find((g) => String(g.grade_level_id) === String(sec?.grade_level_id));
    setForm((p) => ({
      ...p,
      section: sec?.section_name || "",
      grade_level: toNumericGrade(gl) || p.grade_level,
      grade_level_label: gl?.grade_name || p.grade_level_label,
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

  const isFormValid =
    !!form.sf10 &&
    !!form.start_year &&
    !!form.end_year &&
    !!form.section &&
    /^\d+$/.test(form.grade_level); // grade must be numeric text

  const clearForm = () => {
    setForm({
      sf10: null,
      school_year_id: "",
      start_year: "",
      end_year: "",
      grade_level: "",
      grade_level_label: "",
      section: "",
    });
    setSelectedGradeId("");
    setSelectedSectionId("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!studentId) return setMessage({ type: "error", text: "Student not loaded." });
    if (!isFormValid) return setMessage({ type: "error", text: "Fill all fields (grade must be numeric) and attach a file." });

    const fd = new FormData();
    fd.append("sf10", form.sf10);
    fd.append("start_year", form.start_year);
    fd.append("end_year", form.end_year);
    fd.append("section", form.section);
    fd.append("grade_level", form.grade_level);

    try {
      const data = await apiFetch(`/students/upload-sf10/${studentId}`, { method: "POST", body: fd });
      setModal({ show: true, title: "Uploaded", message: data.message || "Document uploaded.", variant: "success" });
      if (data.document) setECards((prev) => [data.document, ...prev]);
      clearForm();
    } catch (err) {
      setModal({ show: true, title: "Upload failed", message: err.message, variant: "danger" });
    }
  };

  const prettyDateTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
  const onHideModal = () => setModal((m) => ({ ...m, show: false }));

  return (
    <div className="container py-4">
      <StatusModal {...modal} onHide={onHideModal} />

      {message.text && (
        <div className={`alert alert-${message.type === "success" ? "success" : "danger"} mb-3`}>{message.text}</div>
      )}

      {/* Student Search */}
      <div className="mb-4">
        <label className="form-label">Search Student (LRN / Name)</label>
        <AsyncSelect
          cacheOptions
          defaultOptions
          loadOptions={fetchStudentOptions}
          onChange={(opt) => opt && fetchDetails(opt.value)}
          placeholder="Type to search…"
          classNamePrefix="react-select"
        />
      </div>

      {loading && <p className="text-muted">Loading student details…</p>}

      {lrn && (
        <>
          {/* Summary */}
          <div className="p-3 mb-4 border rounded">
            <div className="d-flex justify-content-between align-items-center">
              <div className="fw-medium">{studentName || "Student"}</div>
              <div className="text-muted small">LRN: <strong className="text-body">{lrn}</strong></div>
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
                  <option value="">Select…</option>
                  {schoolYears.map((sy) => (
                    <option key={sy.school_year_id} value={sy.school_year_id}>
                      {sy.start_year} - {sy.end_year}
                    </option>
                  ))}
                </select>
                {!!form.start_year && !!form.end_year && (
                  <div className="form-text">Auto-filled: {form.start_year}–{form.end_year}</div>
                )}
              </div>

              <div className="col-md-4">
                <label className="form-label">Grade Level</label>
                <select
                  className="form-select"
                  value={selectedGradeId}
                  onChange={handleGrade}
                  required
                >
                  <option value="">Select…</option>
                  {gradeLevels.map((g) => (
                    <option key={g.grade_level_id} value={g.grade_level_id}>{g.grade_name}</option>
                  ))}
                </select>
                {form.grade_level_label && (
                  <div className="form-text">Sending grade as: {form.grade_level}</div>
                )}
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
                  <option value="">{selectedGradeId ? "Select…" : "Choose a grade first"}</option>
                  {filteredSections.map((s) => (
                    <option key={s.section_id} value={s.section_id}>{s.section_name}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Start Year</label>
                <input
                  className="form-control"
                  value={form.start_year}
                  onChange={(e) => setForm((p) => ({ ...p, start_year: e.target.value }))}
                  required
                  inputMode="numeric"
                  placeholder="e.g. 2024"
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">End Year</label>
                <input
                  className="form-control"
                  value={form.end_year}
                  onChange={(e) => setForm((p) => ({ ...p, end_year: e.target.value }))}
                  required
                  inputMode="numeric"
                  placeholder="e.g. 2025"
                />
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
                <div className="form-text">Accepted: PDF, JPG, PNG, DOC/DOCX · Max {MAX_FILE_MB}MB</div>
              </div>

              <div className="col-12 d-grid">
                <button type="submit" className="btn btn-dark" disabled={!isFormValid}>
                  Upload
                </button>
              </div>
            </div>
          </form>

          {/* eCards */}
          <div className="border rounded p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="fw-medium">Uploaded SF10 eCards</div>
              <Link to={`/record_student/${lrn}`} className="btn btn-outline-secondary btn-sm">
                View Student Record
              </Link>
            </div>

            {eCards.length === 0 ? (
              <div className="text-muted">No eCards uploaded yet.</div>
            ) : (
              <div className="row g-2">
                {eCards.map((ecard, idx) => (
                  <div className="col-12 col-md-6 col-lg-4" key={idx}>
                    <div className="border rounded p-3 h-100">
                      <div className="small mb-2">{prettyDateTime(ecard.uploaded_at)}</div>
                      <div className="d-flex flex-wrap gap-2 small">
                        {ecard.start_year && ecard.end_year && (
                          <span className="badge text-bg-light">SY {ecard.start_year}-{ecard.end_year}</span>
                        )}
                        {ecard.grade_level && <span className="badge text-bg-light">Grade {ecard.grade_level}</span>}
                        {ecard.section && <span className="badge text-bg-light">Section {ecard.section}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
