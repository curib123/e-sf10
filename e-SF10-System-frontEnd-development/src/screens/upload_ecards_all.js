import React, { useState, useEffect } from "react";
import {  Link } from "react-router-dom";
import AsyncSelect from "react-select/async";
import StatusModal from "../components/status_modal";
import { checkToken } from '../components/token_checker'; 
export default function StudentRecord() {
  const [lrn, setLrn] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [eCards, setECards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [form, setForm] = useState({
    sf10: null,
    start_year: "",
    end_year: "",
    section: "",
    grade_level: "",
  });
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });

   useEffect(() => {
                checkToken();
               }, []);
               
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ type: "", text: "" }), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchStudentOptions = async (inputValue) => {
    const token = sessionStorage.getItem("token");
    if (!token || !inputValue) return [];

    try {
      const res = await fetch(`http://localhost:3001/esf10/students/all?page=1&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      return data.students
        .filter(
          (s) =>
            s.lrn.includes(inputValue) ||
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(inputValue.toLowerCase())
        )
        .map((s) => ({
          value: s.lrn,
          label: `${s.lrn} - ${s.last_name}, ${s.first_name}`,
        }));
    } catch (err) {
      console.error("Error fetching students:", err);
      return [];
    }
  };

  const fetchDetails = async (selectedLrn) => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      setMessage({ type: "error", text: "Missing authorization token." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/esf10/students/${selectedLrn}/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to fetch student details");

      const data = await res.json();
      setLrn(selectedLrn);
      setStudentId(data.student?.student_id || null);
      setStudentName(
        `${data.student?.last_name}, ${data.student?.first_name} ${data.student?.middle_name || ""}`
      );
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
    setForm({ ...form, [name]: files ? files[0] : value });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem("token");

    if (!token) return setMessage({ type: "error", text: "Missing authorization token." });
    if (!form.sf10) return setMessage({ type: "error", text: "Please select a file." });
    if (!studentId) return setMessage({ type: "error", text: "Student not loaded." });

    const formData = new FormData();
    formData.append("sf10", form.sf10);
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
        const errorData = await res.json();
        throw new Error(errorData.error || "Upload failed.");
      }

      const data = await res.json();
      setModal({
        show: true,
        title: "✅ Upload Successful",
        message: data.message,
        variant: "success",
      });
      setECards((prev) => [...prev, data.document]);
      setForm({ sf10: null, start_year: "", end_year: "", section: "", grade_level: "" });
    } catch (err) {
      setModal({
        show: true,
        title: "❌ Error",
        message: err.message,
        variant: "danger",
      });
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-end mb-4">
        <button
          className="btn btn-outline-secondary rounded-pill px-4"
          onClick={() => window.history.back()}
        >
          <i className="bi bi-arrow-left-circle me-2"></i> Back
        </button>
      </div>

      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />

      {message.text && (
        <div className={`alert alert-${message.type === "success" ? "success" : "danger"}`}>
          {message.text}
        </div>
      )}

      <div className="mb-4">
        <label className="form-label fw-semibold">Search Student by LRN or Name</label>
        <AsyncSelect
          cacheOptions
          loadOptions={fetchStudentOptions}
          defaultOptions
          onChange={(selected) => selected && fetchDetails(selected.value)}
          placeholder="Type LRN or Name..."
        />
      </div>

      {loading ? (
        <p className="text-center">Loading student details...</p>
      ) : lrn ? (
        <>
    

          <div className="card mb-5 shadow">
            <div className="card-header bg-dark text-white fw-bold">
              <i className="bi bi-upload me-2"></i> Upload New SF10 eCard
            </div>
            <form
              className="card-body row g-3"
              onSubmit={handleUpload}
              encType="multipart/form-data"
            >
            {["start_year", "end_year", "section", "grade_level"].map((field, i) => (
  <div className="col-md-3" key={i}>
    <label className="form-label text-uppercase small fw-semibold">
      {field.replace("_", " ")}
    </label>
    <input
      type="text"
      name={field}
      className="form-control border-dark shadow-sm"
      value={form[field]}
      onChange={handleUploadChange}
      required={field !== "section"} // 👈 Only require if not "section"
    />
  </div>
))}

              <div className="col-md-12">
                <label className="form-label text-uppercase small fw-semibold">Select File</label>
                <input
                  type="file"
                  name="sf10"
                  className="form-control border-dark shadow-sm"
                  onChange={handleUploadChange}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  required
                />
              </div>

              <div className="col-12 d-grid">
                <button className="btn btn-dark rounded-pill py-2 fw-semibold">
                  <i className="bi bi-cloud-arrow-up-fill me-2"></i> Upload Document
                </button>
              </div>
            </form>
          </div>

          <div className="card shadow border-0">
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
      <div className="alert alert-warning mb-0" role="alert">
        <i className="bi bi-exclamation-circle me-2"></i>
        No eCards uploaded yet.
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
        <div className="alert alert-success border-success-subtle" role="alert">
          <i className="bi bi-info-circle me-2"></i>
          To <strong>view or download</strong> the uploaded SF10 documents, please go to the{" "}
          <strong>"Student Records"</strong> section.
        </div>
      </>
    )}
  </div>
</div>
        </>
      ) : (
        <p className="text-muted fst-italic">Please select a student from the dropdown above.</p>
      )}
    </div>
  );
}
