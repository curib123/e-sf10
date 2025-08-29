import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AsyncSelect from "react-select/async";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

export default function StudentRecord() {
  const [lrn, setLrn] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [eCards, setECards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [schoolYears, setSchoolYears] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [form, setForm] = useState({
    sf10: null,
    school_year_id: "",
    start_year: "",
    end_year: "",
    section: "",
    grade_level_id: "",
    grade_level_name: "",
  });
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "danger",
  });

  const token = sessionStorage.getItem("token");
  const authHeaders = () => ({
    Authorization: token ? `Bearer ${token}` : undefined,
  });

  useEffect(() => { checkToken(); }, []);

  // Fetch helper
  const fetchData = async (endpoint, setter, key = "data") => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/${endpoint}`, { headers: { "Content-Type": "application/json", ...authHeaders() } });
      if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
      const data = await res.json();
      if (data.success) setter(data[key]);
    } catch (err) {
      console.error(err);
      setModal({ show: true, title: "Error", message: `Failed to load ${endpoint}`, variant: "danger" });
    }
  };

  useEffect(() => { fetchData("school-year/all-school-years", setSchoolYears, "schoolYears"); }, []);
  useEffect(() => { fetchData("grade-levels", setGradeLevels, "data"); }, []);

  // Fetch students for AsyncSelect
  const fetchStudentOptions = async (inputValue) => {
    if (!token || !inputValue) return [];
    try {
      const res = await fetch(`${BASE_URL}/students/all?page=1&limit=50`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch students");
      const data = await res.json();
      if (!data.students) return [];
      return data.students
        .filter(
          (s) =>
            String(s.lrn).includes(inputValue) ||
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(inputValue.toLowerCase())
        )
        .map((s) => ({ value: s.lrn, label: `${s.lrn} - ${s.last_name}, ${s.first_name}` }));
    } catch (err) {
      console.error(err);
      setModal({ show: true, title: "Error", message: err.message, variant: "danger" });
      return [];
    }
  };

  // Fetch student details
  const fetchDetails = async (selectedLrn) => {
    if (!token) return setModal({ show: true, title: "Error", message: "Missing authorization token.", variant: "danger" });
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/students/${selectedLrn}/details`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch student details");
      const data = await res.json();
      setLrn(selectedLrn);
      setStudentId(data.student?.student_id || null);
      setStudentName(`${data.student?.last_name}, ${data.student?.first_name} ${data.student?.middle_name || ""}`);
      setECards(data.eCards || []);
      setModal({ show: true, title: "Success", message: "Student loaded successfully.", variant: "success" });
    } catch (err) {
      setModal({ show: true, title: "Error", message: err.message, variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  // Handle form changes
  const handleUploadChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "school_year_id") {
      const selected = schoolYears.find((sy) => sy.school_year_id === parseInt(value));
      setForm((prev) => ({
        ...prev,
        school_year_id: value || "",
        start_year: selected?.start_year || "",
        end_year: selected?.end_year || "",
      }));
    } else if (name === "grade_level_id") {
      const selected = gradeLevels.find((gl) => gl.grade_level_id === parseInt(value));
      setForm((prev) => ({
        ...prev,
        grade_level_id: value || "",
        grade_level_name: selected?.grade_name || "",
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: files ? files[0] : value }));
    }
  };

  // Handle file upload
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!token) return setModal({ show: true, title: "Error", message: "Missing authorization token.", variant: "danger" });
    if (!form.sf10) return setModal({ show: true, title: "Error", message: "Please select a file.", variant: "danger" });
    if (!studentId) return setModal({ show: true, title: "Error", message: "Student not loaded.", variant: "danger" });

    const fd = new FormData();
    Object.entries(form).forEach(([key, val]) => fd.append(key, val));

    try {
      const res = await fetch(`${BASE_URL}/students/upload-sf10/${studentId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Upload failed.");
      }
      const data = await res.json();
      setModal({ show: true, title: "✅ Upload Successful", message: data.message, variant: "success" });
      setECards((prev) => [...prev, data.document]);
      setForm({ sf10: null, school_year_id: "", start_year: "", end_year: "", section: "", grade_level_id: "", grade_level_name: "" });
    } catch (err) {
      setModal({ show: true, title: "❌ Error", message: err.message, variant: "danger" });
    }
  };

  return (
    <div className="container py-5">
      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />

      {/* Student Search */}
      <div className="mb-4">
        <label className="form-label fw-semibold text-muted">Search Student by LRN or Name</label>
        <AsyncSelect
          cacheOptions
          loadOptions={fetchStudentOptions}
          defaultOptions
          onChange={(selected) => selected && fetchDetails(selected.value)}
          placeholder="Type LRN or Name..."
          classNamePrefix="react-select"
        />
      </div>

      {loading && <p className="text-center text-muted">Loading student details...</p>}

      {lrn && (
        <>
          {/* Upload Card */}
          <div className="card mb-5 shadow-sm border-0">
            <div className="card-header bg-primary text-white fw-bold d-flex align-items-center">
              <i className="bi bi-upload me-2"></i> Upload New SF10 eCard
            </div>
            <form className="card-body row g-3" onSubmit={handleUpload} encType="multipart/form-data">
              {/* School Year */}
              <div className="col-md-3">
                <label className="form-label small text-uppercase fw-semibold">School Year</label>
                <select
                  name="school_year_id"
                  className="form-select shadow-sm rounded-pill"
                  value={form.school_year_id}
                  onChange={handleUploadChange}
                  required
                >
                  <option value="">Select School Year</option>
                  {schoolYears.map((sy) => (
                    <option key={sy.school_year_id} value={sy.school_year_id}>
                      {sy.start_year} - {sy.end_year}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section */}
              <div className="col-md-3">
                <label className="form-label small text-uppercase fw-semibold">Section</label>
                <input type="text" name="section" className="form-control shadow-sm" value={form.section} onChange={handleUploadChange} required />
              </div>

              {/* Grade Level */}
              <div className="col-md-3">
                <label className="form-label small text-uppercase fw-semibold">Grade Level</label>
                <select name="grade_level_id" className="form-select shadow-sm rounded-pill" value={form.grade_level_id} onChange={handleUploadChange} required>
                  <option value="">Select Grade Level</option>
                  {gradeLevels.map((gl) => <option key={gl.grade_level_id} value={gl.grade_level_id}>{gl.grade_name}</option>)}
                </select>
              </div>

              {/* File */}
              <div className="col-12">
                <label className="form-label small text-uppercase fw-semibold">Select File</label>
                <input type="file" name="sf10" className="form-control shadow-sm" onChange={handleUploadChange} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" required />
              </div>

              <div className="col-12 d-grid">
                <button className="btn btn-success rounded-pill py-2 fw-semibold">
                  <i className="bi bi-cloud-arrow-up-fill me-2"></i> Upload Document
                </button>
              </div>
            </form>
          </div>

          {/* Uploaded eCards */}
          <div className="card shadow-sm border-0">
            <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
              <div>
                <i className="bi bi-cloud-check-fill me-2"></i> Uploaded SF10 eCards
              </div>
              <Link to={`/record_student/${lrn}`} className="btn btn-light btn-sm rounded-pill px-3 fw-semibold d-flex align-items-center gap-2 shadow-sm">
                <i className="bi bi-folder2-open text-success"></i>
                <span className="text-success">View Student Record</span>
              </Link>
            </div>
            <div className="card-body">
              {eCards.length === 0 ? (
                <div className="alert alert-warning mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-circle"></i> No eCards uploaded yet.
                </div>
              ) : (
                <div className="row g-3 mb-3">
                  {eCards.map((ecard, idx) => (
                    <div className="col-12 col-md-6 col-lg-4" key={idx}>
                      <div className="card border-start border-4 border-success-subtle shadow-sm h-100">
                        <div className="card-body">
                          <h6 className="card-title text-success mb-2">
                            <i className="bi bi-check-circle-fill me-2"></i> Successfully Uploaded
                          </h6>
                          <p className="card-text small text-muted mb-0">{new Date(ecard.uploaded_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
