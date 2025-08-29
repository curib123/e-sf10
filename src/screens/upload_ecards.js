import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

export default function StudentRecord() {
  const { lrn } = useParams();
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [eCards, setECards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolYears, setSchoolYears] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [form, setForm] = useState({
    sf10: null,
    school_year_id: "",
    start_year: "",
    end_year: "",
    section: "",
    grade_level_id: "",
    grade_level_name: ""
  });
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });

  const token = sessionStorage.getItem("token");
  const authHeaders = () => ({ Authorization: token ? `Bearer ${token}` : undefined });

  useEffect(() => { checkToken(); }, []);

  // Generic fetch helper
  const fetchData = async (endpoint, setter, key = "data") => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/${endpoint}`, { headers: { "Content-Type": "application/json", ...authHeaders() } });
      if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
      const data = await res.json();
      if (data.success) setter(data[key]);
    } catch (err) {
      console.error(err);
      setModal({ show: true, title: "❌ Error", message: `Failed to fetch ${endpoint}`, variant: "danger" });
    }
  };

  // Fetch student details
  useEffect(() => {
    const fetchStudentDetails = async () => {
      if (!token || !lrn) return;
      setLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/students/${lrn}/details`, { headers: authHeaders() });
        if (!res.ok) throw new Error("Failed to fetch student details");
        const data = await res.json();
        setStudentId(data.student?.student_id || null);
        setStudentName(`${data.student?.last_name}, ${data.student?.first_name} ${data.student?.middle_name || ""}`);
        setECards(data.eCards || []);
      } catch (err) {
        setModal({ show: true, title: "❌ Error", message: err.message, variant: "danger" });
      } finally {
        setLoading(false);
      }
    };
    fetchStudentDetails();
  }, [lrn, token]);

  // Fetch school years & grade levels
  useEffect(() => { fetchData("school-year/all-school-years", setSchoolYears, "schoolYears"); }, [token]);
  useEffect(() => { fetchData("grade-levels", setGradeLevels, "data"); }, [token]);

  // Handle form changes
  const handleUploadChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "school_year_id") {
      const selected = schoolYears.find(sy => sy.school_year_id === parseInt(value));
      setForm(prev => ({
        ...prev,
        school_year_id: value || "",
        start_year: selected?.start_year || "",
        end_year: selected?.end_year || ""
      }));
    } else if (name === "grade_level_id") {
      const selected = gradeLevels.find(gl => gl.grade_level_id === parseInt(value));
      setForm(prev => ({
        ...prev,
        grade_level_id: value || "",
        grade_level_name: selected?.grade_name || ""
      }));
    } else {
      setForm(prev => ({ ...prev, [name]: files ? files[0] : value }));
    }
  };

  // Handle upload
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!token) return setModal({ show: true, title: "❌ Error", message: "Missing authorization token.", variant: "danger" });
    if (!form.sf10) return setModal({ show: true, title: "❌ Error", message: "Please select a file.", variant: "danger" });
    if (!studentId) return setModal({ show: true, title: "❌ Error", message: "Student ID not available.", variant: "danger" });

    const fd = new FormData();
    Object.entries(form).forEach(([key, val]) => fd.append(key, val));

    try {
      const res = await fetch(`${BASE_URL}/students/upload-sf10/${studentId}`, { method: "POST", headers: authHeaders(), body: fd });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Upload failed.");
      }
      const data = await res.json();
      setModal({ show: true, title: "✅ Upload Successful", message: data.message, variant: "success" });
      setECards(prev => [...prev, data.document]);
      setForm({ sf10: null, school_year_id: "", start_year: "", end_year: "", section: "", grade_level_id: "", grade_level_name: "" });
    } catch (err) {
      setModal({ show: true, title: "❌ Error", message: err.message, variant: "danger" });
    }
  };

  if (loading) return <div className="py-5 text-center fw-semibold fs-5">Loading student records...</div>;

  return (
    <div className="container py-4">
      <div className="mb-4">
        <button className="btn btn-outline-primary rounded-pill px-4 shadow-sm" onClick={() => window.history.back()}>
          ← Back
        </button>
      </div>

      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />

      <div className="p-4 rounded shadow-sm mb-4 bg-white">
        <h6 className="text-muted mb-1"><strong>LRN:</strong> <span className="text-dark">{lrn}</span></h6>
        <h6 className="text-muted mb-0"><strong>Student Name:</strong> <span className="text-dark">{studentName}</span></h6>
      </div>

      {/* Upload Form */}
      <div className="card shadow-sm border-0 mb-5">
        <div className="card-header bg-primary text-white fw-bold fs-5">Upload SF10 eCard</div>
        <form onSubmit={handleUpload} className="card-body row g-3" encType="multipart/form-data" noValidate>
          <div className="col-md-4">
            <label className="form-label small fw-bold text-uppercase">School Year</label>
            <select name="school_year_id" className="form-select rounded-pill shadow-sm" value={form.school_year_id} onChange={handleUploadChange} required>
              <option value="">Select School Year</option>
              {schoolYears.map(sy => <option key={sy.school_year_id} value={sy.school_year_id}>{sy.start_year} - {sy.end_year}</option>)}
            </select>
          </div>

          <div className="col-md-4">
            <label className="form-label small fw-bold text-uppercase">Section</label>
            <input type="text" name="section" className="form-control rounded-pill shadow-sm" value={form.section} onChange={handleUploadChange} />
          </div>

          <div className="col-md-4">
            <label className="form-label small fw-bold text-uppercase">Grade Level</label>
            <select name="grade_level_id" className="form-select rounded-pill shadow-sm" value={form.grade_level_id} onChange={handleUploadChange} required>
              <option value="">Select Grade Level</option>
              {gradeLevels.map(gl => <option key={gl.grade_level_id} value={gl.grade_level_id}>{gl.grade_name}</option>)}
            </select>
          </div>

          <div className="col-md-12">
            <label htmlFor="sf10" className="form-label fw-bold small">Select SF10 File</label>
            <input type="file" className="form-control rounded-pill shadow-sm" id="sf10" name="sf10" onChange={handleUploadChange} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" required />
          </div>

          <div className="col-md-12 d-grid">
            <button type="submit" className="btn btn-success py-3 fw-bold rounded-pill shadow-sm">Upload Document</button>
          </div>
        </form>
      </div>

      {/* eCards Display */}
      <div className="card shadow-sm border-0">
        <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
          Uploaded SF10 eCards
          <Link to={`/record_student/${lrn}`} className="btn btn-light btn-sm rounded-pill fw-bold shadow-sm">View Student Record</Link>
        </div>
        <div className="card-body">
          {eCards.length === 0 ? (
            <div className="alert alert-warning mb-0 d-flex align-items-center gap-2">No eCards uploaded yet.</div>
          ) : (
            <div className="row g-3 mb-3">
              {eCards.map((ecard, idx) => (
                <div className="col-12 col-md-6 col-lg-4" key={idx}>
                  <div className="card h-100 shadow-sm border-0 rounded-3">
                    <div className="card-body">
                      <h6 className="text-success mb-2">Successfully Uploaded</h6>
                      <p className="small text-muted mb-0">{new Date(ecard.uploaded_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
