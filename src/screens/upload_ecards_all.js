import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AsyncSelect from "react-select/async";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";

export default function StudentRecord() {
  const [lrn, setLrn] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [eCards, setECards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [schoolYears, setSchoolYears] = useState([]);
  const [form, setForm] = useState({
    sf10: null,
    school_year_id: "",
    start_year: "",
    end_year: "",
    section: "",
    grade_level: "",
  });
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "danger",
  });

  useEffect(() => { checkToken(); }, []);

  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ type: "", text: "" }), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Fetch school years for dropdown
  useEffect(() => {
    const fetchSchoolYears = async () => {
      const token = sessionStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch("http://localhost:3001/esf10/school-year/all-school-years", {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch school years");
        const data = await res.json();
        if (data.success) setSchoolYears(data.schoolYears);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSchoolYears();
  }, []);

  const fetchStudentOptions = async (inputValue) => {
    const token = sessionStorage.getItem("token");
    if (!token || !inputValue) return [];
    try {
      const res = await fetch(`http://localhost:3001/esf10/students/all?page=1&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      return [];
    }
  };

  const fetchDetails = async (selectedLrn) => {
    const token = sessionStorage.getItem("token");
    if (!token) return setMessage({ type: "error", text: "Missing authorization token." });

    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/esf10/students/${selectedLrn}/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch student details");
      const data = await res.json();

      setLrn(selectedLrn);
      setStudentId(data.student?.student_id || null);
      setStudentName(`${data.student?.last_name}, ${data.student?.first_name} ${data.student?.middle_name || ""}`);
      setECards(data.eCards || []);
      setMessage({ type: "success", text: "Student loaded successfully." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "school_year_id") {
      const selected = schoolYears.find((sy) => sy.school_year_id === parseInt(value));
      if (selected) {
        setForm({ ...form, school_year_id: value, start_year: selected.start_year, end_year: selected.end_year });
      } else {
        setForm({ ...form, school_year_id: "", start_year: "", end_year: "" });
      }
    } else {
      setForm({ ...form, [name]: files ? files[0] : value });
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem("token");
    if (!token) return setMessage({ type: "error", text: "Missing authorization token." });
    if (!form.sf10) return setMessage({ type: "error", text: "Please select a file." });
    if (!studentId) return setMessage({ type: "error", text: "Student not loaded." });

    const formData = new FormData();
    Object.entries(form).forEach(([key, val]) => formData.append(key, val));

    try {
      const res = await fetch(`http://localhost:3001/esf10/students/upload-sf10/${studentId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Upload failed.");
      }
      const data = await res.json();
      setModal({ show: true, title: "✅ Upload Successful", message: data.message, variant: "success" });
      setECards((prev) => [...prev, data.document]);
      setForm({ sf10: null, school_year_id: "", start_year: "", end_year: "", section: "", grade_level: "" });
    } catch (err) {
      setModal({ show: true, title: "❌ Error", message: err.message, variant: "danger" });
    }
  };

  return (
    <div className="container py-5">
      {/* Status Modal */}
      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />

      {/* Message Alert */}
      {message.text && (
        <div className={`alert alert-${message.type === "success" ? "success" : "danger"} shadow-sm`}>
          {message.text}
        </div>
      )}

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
              {/* School Year Dropdown */}
              <div className="col-md-3">
                <label className="form-label small text-uppercase fw-semibold">School Year</label>
                <select
                  name="school_year_id"
                  className="form-select shadow-sm border border-secondary rounded-pill"
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

              {/* Section & Grade Level */}
              {["section", "grade_level"].map((field, i) => (
                <div className="col-md-3" key={i}>
                  <label className="form-label small text-uppercase fw-semibold">{field.replace("_", " ")}</label>
                  <input
                    type="text"
                    name={field}
                    className="form-control border-1 shadow-sm"
                    value={form[field]}
                    onChange={handleUploadChange}
                    required
                  />
                </div>
              ))}

              <div className="col-12">
                <label className="form-label small text-uppercase fw-semibold">Select File</label>
                <input
                  type="file"
                  name="sf10"
                  className="form-control border-1 shadow-sm"
                  onChange={handleUploadChange}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  required
                />
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
              <Link
                to={`/record_student/${lrn}`}
                className="btn btn-light btn-sm rounded-pill px-3 fw-semibold d-flex align-items-center gap-2 shadow-sm"
              >
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
                <>
                  <div className="row g-3 mb-3">
                    {eCards.map((ecard, idx) => (
                      <div className="col-12 col-md-6 col-lg-4" key={idx}>
                        <div className="card border-start border-4 border-success-subtle shadow-sm h-100">
                          <div className="card-body">
                            <h6 className="card-title text-success mb-2">
                              <i className="bi bi-check-circle-fill me-2"></i> Successfully Uploaded
                            </h6>
                            <p className="card-text small text-muted mb-0">
                              {new Date(ecard.uploaded_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="alert alert-success border-success-subtle d-flex align-items-center gap-2" role="alert">
                    <i className="bi bi-info-circle"></i>
                    To <strong>view or download</strong> the uploaded SF10 documents, go to the <strong>"Student Records"</strong> section.
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
