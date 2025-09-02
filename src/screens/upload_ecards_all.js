import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

async function apiFetch(path, { method = "GET", headers = {}, body, signal } = {}) {
  const token = sessionStorage.getItem("token");
  if (!token) throw new Error("Missing authorization token. Please log in.");
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body,
    signal,
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

// "Grade 12" -> "12"; prefer grade_order when numeric
const toNumericGrade = (g) => {
  if (!g) return "";
  if (!Number.isNaN(Number(g.grade_order))) return String(Number(g.grade_order));
  const m = String(g.grade_name || "").match(/\d+/);
  return m ? m[0] : "";
};

// debounce a promise-returning function
function debouncePromise(fn, delay = 350) {
  let timer = null;
  let resolvers = [];
  return (...args) =>
    new Promise((resolve) => {
      resolvers.push(resolve);
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const batch = [...resolvers];
        resolvers = [];
        try {
          const result = await fn(...args);
          batch.forEach((r) => r(result));
        } catch (e) {
          batch.forEach((r) => r(Promise.reject(e)));
        }
      }, delay);
    });
}

export default function UploadSf10WithSearch() {
  useEffect(() => { checkToken(); }, []);

  // ── Search state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]); // array from /esf10/students/search
  const [searching, setSearching] = useState(false);
  const [touched, setTouched] = useState(false);
  const searchAbortRef = useRef(null);

  // ── Selected student + details
  const [lrn, setLrn] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [eCards, setECards] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // ── Dropdown data
  const [schoolYears, setSchoolYears] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [sections, setSections] = useState([]);

  // ── Form + UI
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

  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState({ type: "", text: "" });
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });
  const onHideModal = () => setModal((m) => ({ ...m, show: false }));

  useEffect(() => {
    if (!banner.text) return;
    const t = setTimeout(() => setBanner({ type: "", text: "" }), 3500);
    return () => clearTimeout(t);
  }, [banner]);

  // ── Load dropdowns once
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

  // ── Scalable server-side search using your API
  const runSearch = async (term) => {
    const q = term.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return [];
    }
    if (searchAbortRef.current) searchAbortRef.current.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    try {
      setSearching(true);
      const data = await apiFetch(`/students/search?query=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      const arr = Array.isArray(data) ? data : [];
      setSuggestions(arr.slice(0, 10)); // cap suggestions
      return arr;
    } catch (err) {
      if (err.name !== "AbortError") {
        setModal({ show: true, title: "Search error", message: err.message, variant: "danger" });
        setSuggestions([]);
      }
      return [];
    } finally {
      setSearching(false);
    }
  };

  const debouncedSearch = useMemo(() => debouncePromise(runSearch, 350), []);

  useEffect(() => {
    if (!touched) return;
    debouncedSearch(query);
  }, [query, debouncedSearch, touched]);

  // ── When a suggestion is clicked -> load details and reveal upload UI
  const selectStudent = async (student) => {
    try {
      setLoadingDetails(true);
      setSuggestions([]); // hide list
      setQuery(`${student.lrn} — ${student.last_name}, ${student.first_name}${student.middle_name ? " " + student.middle_name : ""}`);
      const data = await apiFetch(`/students/${student.lrn}/details`);
      setLrn(student.lrn);
      setStudentId(data.student?.student_id || null);
      setStudentName(
        `${data.student?.last_name || ""}, ${data.student?.first_name || ""} ${data.student?.middle_name || ""}`.trim()
      );
      setECards(data.eCards || []);
      setBanner({ type: "success", text: "Student loaded." });
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    } finally {
      setLoadingDetails(false);
    }
  };

  // ── Derived
  const filteredSections = useMemo(() => {
    if (!selectedGradeId) return [];
    return sections.filter((s) => String(s.grade_level_id) === String(selectedGradeId));
  }, [sections, selectedGradeId]);

  // ── Handlers
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
      grade_level: toNumericGrade(gl),
      grade_level_label: gl?.grade_name || "",
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
    /^\d+$/.test(form.grade_level);

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
    if (!studentId) {
      setModal({ show: true, title: "Error", message: "Student not loaded.", variant: "danger" });
      return;
    }
    if (!isFormValid) {
      setModal({ show: true, title: "Incomplete", message: "Fill all fields and attach a file.", variant: "warning" });
      return;
    }

    const fd = new FormData();
    fd.append("sf10", form.sf10);
    fd.append("start_year", form.start_year);
    fd.append("end_year", form.end_year);
    fd.append("section", form.section);
    fd.append("grade_level", form.grade_level);

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

  const prettyDateTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

  return (
    <div className="container py-4">
      <StatusModal {...modal} onHide={onHideModal} />

      {/* Title + Subtitle */}
      <div className="mb-4 text-center">
        <h2 className="fw-bold mb-1">Upload SF10 File</h2>
        <p className="text-muted mb-0">
          Use the search box below to find a student, then upload their ESF10/SF10 record.
        </p>
      </div>

      {/* Banner message */}
      {banner.text && (
        <div className={`alert alert-${banner.type === "success" ? "success" : "danger"} mb-3`}>
          {banner.text}
        </div>
      )}

      {/* Search */}
      <div className="mb-3 position-relative">
        <label className="form-label">Search Student (LRN / Name)</label>
        <input
          className="form-control"
          placeholder="Type at least 2 characters… e.g., 123456789012 or Cutanda Quivir"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!touched) setTouched(true);
          }}
          autoComplete="off"
        />
        <div className="form-text">Start typing the student's LRN (fastest) or any part of their name.</div>

        {/* Suggestions dropdown (no table) */}
        {touched && query.trim().length >= 2 && suggestions.length > 0 && (
          <div
            className="list-group shadow position-absolute w-100 mt-1"
            style={{ zIndex: 1000, maxHeight: 320, overflowY: "auto" }}
          >
            {suggestions.map((s) => {
              const name = `${s.last_name || ""}, ${s.first_name || ""} ${s.middle_name || ""}`.trim();
              const dob = s.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString() : "—";
              return (
                <button
                  key={`${s.student_id}-${s.lrn}`}
                  type="button"
                  className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                  onClick={() => selectStudent(s)}
                >
                  <div>
                    <div className="fw-semibold">{name || "—"}</div>
                    <div className="small text-muted">
                      LRN: <code>{s.lrn}</code> • DOB: {dob} • {s.gender || "—"}
                    </div>
                  </div>
                  <span className="badge text-bg-light">Select</span>
                </button>
              );
            })}
            {searching && (
              <div className="list-group-item text-muted small">
                Searching…
              </div>
            )}
          </div>
        )}

        {/* Empty / loading states */}
        {touched && query.trim().length >= 2 && !searching && suggestions.length === 0 && (
          <div className="text-muted small mt-2">No matches found.</div>
        )}
        {searching && (
          <div className="d-flex align-items-center gap-2 text-muted small mt-2">
            <div className="spinner-border spinner-border-sm" role="status" />
            <span>Searching…</span>
          </div>
        )}
      </div>

      {/* Student summary + Upload UI (shown after selection) */}
      {lrn && (
        <>
          {/* Summary */}
          <div className="p-3 mb-4 border rounded">
            <div className="d-flex justify-content-between align-items-center">
              <div className="fw-medium">{studentName || "Student"}</div>
              <div className="text-muted small">LRN: <strong className="text-body">{lrn}</strong></div>
            </div>
          </div>

          {loadingDetails ? (
            <div className="d-flex align-items-center gap-2 text-muted mb-4">
              <div className="spinner-border spinner-border-sm" role="status" />
              <span>Loading student details…</span>
            </div>
          ) : (
            <>
              {/* Upload form */}
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
        </>
      )}
    </div>
  );
}
