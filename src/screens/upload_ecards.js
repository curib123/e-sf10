import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";

export default function StudentRecord() {
  const { lrn } = useParams();
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [eCards, setECards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolYears, setSchoolYears] = useState([]);
  const [form, setForm] = useState({
    sf10: null,
    school_year_id: "",
    start_year: "",
    end_year: "",
    section: "",
    grade_level: ""
  });
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });

  useEffect(() => { checkToken(); }, []);

  useEffect(() => {
    const fetchDetails = async () => {
      const token = sessionStorage.getItem("token");
      if (!token) return alert("Token missing. Please log in.");
      try {
        const res = await fetch(`http://localhost:3001/esf10/students/${lrn}/details`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch student details");
        const data = await res.json();
        setStudentId(data.student?.student_id || null);
        setStudentName(`${data.student?.last_name}, ${data.student?.first_name} ${data.student?.middle_name || ""}`);
        setECards(data.eCards || []);
      } catch (err) {
        setModal({ show: true, title: `❌ ${err.message}`, message: err.message, variant: "danger" });
      } finally {
        setLoading(false);
      }
    };
    if (lrn) fetchDetails();
  }, [lrn]);

  useEffect(() => {
    const fetchSchoolYears = async () => {
      const token = sessionStorage.getItem("token");
      if (!token) return alert("Missing authorization token for fetching school years.");
      try {
        const res = await fetch("http://localhost:3001/esf10/school-year/all-school-years", {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch school years");
        const data = await res.json();
        if (data.success) setSchoolYears(data.schoolYears);
      } catch (err) {
        setModal({ show: true, title: "❌ Error", message: "Failed to fetch school years", variant: "danger" });
      }
    };
    fetchSchoolYears();
  }, []);

  const handleUploadChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "school_year_id") {
      const selected = schoolYears.find(sy => sy.school_year_id === parseInt(value));
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
    if (!token) return alert("Missing authorization token.");
    if (!form.sf10) return alert("Please select a file to upload.");
    if (!studentId) return alert("Student ID not available.");

    const formData = new FormData();
    formData.append("sf10", form.sf10);
    formData.append("school_year_id", form.school_year_id);
    formData.append("start_year", form.start_year);
    formData.append("end_year", form.end_year);
    formData.append("section", form.section);
    formData.append("grade_level", form.grade_level);

    try {
      const res = await fetch(`http://localhost:3001/esf10/students/upload-sf10/${studentId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Upload failed.");
      }
      const data = await res.json();
      setModal({ show: true, title: "✅ Upload Successful", message: data.message, variant: "success" });
      setECards((prev) => [...prev, data.document]);
      setForm({ sf10: null, school_year_id: "", start_year: "", end_year: "", section: "", grade_level: "" });
    } catch (err) {
      setModal({ show: true, title: "❌ Error", message: err.message, variant: "danger" });
    }
  };

  if (loading) return <div className="py-5 text-center fw-semibold fs-5">Loading student records...</div>;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-start mb-4">
        <button className="btn btn-outline-primary rounded-pill px-4 shadow-sm d-flex align-items-center gap-2" onClick={() => window.history.back()}>
          <i className="bi bi-arrow-left-circle fs-5"></i> Back
        </button>
      </div>

      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />

      {/* Student Info Card */}
      <div className="p-4 rounded shadow-sm mb-4 border-start border-4 border-primary bg-white">
        <h6 className="text-secondary mb-1"><strong>LRN:</strong> <span className="text-dark">{lrn}</span></h6>
        <h6 className="text-secondary mb-0"><strong>Student Name:</strong> <span className="text-dark">{studentName}</span></h6>
      </div>

      {/* Upload Form */}
      <div className="card shadow-sm border-0 mb-5">
        <div className="card-header bg-primary text-white fw-bold fs-5 d-flex align-items-center gap-2">
          <i className="bi bi-upload fs-4"></i> Upload New SF10 eCard
        </div>
        <form onSubmit={handleUpload} className="card-body row g-3" encType="multipart/form-data" noValidate>
          <div className="col-md-4">
            <label className="form-label small fw-bold text-uppercase">School Year</label>
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

          <div className="col-md-4">
            <label className="form-label small fw-bold text-uppercase">Section</label>
            <input type="text" name="section" className="form-control shadow-sm border border-secondary rounded-pill" value={form.section} onChange={handleUploadChange} />
          </div>

          <div className="col-md-4">
            <label className="form-label small fw-bold text-uppercase">Grade Level</label>
            <input type="text" name="grade_level" className="form-control shadow-sm border border-secondary rounded-pill" value={form.grade_level} onChange={handleUploadChange} />
          </div>

          <div className="col-md-12">
            <label htmlFor="sf10" className="form-label fw-bold text-uppercase small">Select SF10 File</label>
            <input
              type="file"
              className="form-control shadow-sm border border-secondary rounded-pill"
              id="sf10"
              name="sf10"
              onChange={handleUploadChange}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              required
            />
          </div>

          <div className="col-md-12 d-grid">
            <button type="submit" className="btn btn-success py-3 fw-bold rounded-pill shadow-sm">
              <i className="bi bi-cloud-arrow-up-fill me-2 fs-5"></i> Upload Document
            </button>
          </div>
        </form>
      </div>

      {/* eCards Display */}
      <div className="card shadow-sm border-0">
        <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
          <div><i className="bi bi-cloud-check-fill me-2"></i> Uploaded SF10 eCards</div>
          <Link to={`/record_student/${lrn}`} className="btn btn-light btn-sm rounded-pill fw-bold d-flex align-items-center gap-2 shadow-sm">
            <i className="bi bi-folder2-open text-success"></i> <span className="text-success">View Student Record</span>
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
                    <div className="card h-100 shadow-sm border-start border-4 border-success-subtle">
                      <div className="card-body">
                        <h6 className="card-title text-success mb-2 d-flex align-items-center gap-2">
                          <i className="bi bi-check-circle-fill"></i> Successfully Uploaded
                        </h6>
                        <p className="card-text small text-muted mb-0">{new Date(ecard.uploaded_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="alert alert-success border-success-subtle d-flex align-items-center gap-2" role="alert">
                <i className="bi bi-info-circle"></i>
                To <strong>view or download</strong> the uploaded SF10 documents, please go to the <strong>"Student Records"</strong> section.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
