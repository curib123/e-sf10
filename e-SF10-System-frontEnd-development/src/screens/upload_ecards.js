import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import StatusModal from "../components/status_modal";

export default function StudentRecord() {
  const { lrn } = useParams();
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [eCards, setECards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    sf10: null,
    start_year: "",
    end_year: "",
    section: "",
    grade_level: ""
  });
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });

  useEffect(() => {
    const fetchDetails = async () => {
      const token = localStorage.getItem("token");
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
        setModal({
          show: true,
          title: `❌ ${err.message}`,
          message: err.message,
          variant: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    if (lrn) fetchDetails();
  }, [lrn]);

  const handleUploadChange = (e) => {
    const { name, value, files } = e.target;
    setForm({ ...form, [name]: files ? files[0] : value });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return alert("Missing authorization token.");
    if (!form.sf10) return alert("Please select a file to upload.");
    if (!studentId) return alert("Student ID not available.");

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
        const errData = await res.json();
        throw new Error(errData.error || "Upload failed.");
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

  if (loading) return <div className="p-5 text-center fw-semibold fs-5">Loading student records...</div>;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-end align-items-center mb-4">
        <button
          className="btn btn-outline-secondary rounded-pill px-4 d-flex align-items-center gap-2"
          onClick={() => window.history.back()}
        >
          <i className="bi bi-arrow-left-circle fs-5"></i> Back
        </button>
        
      </div>

      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />


      <div className="mb-4 p-4 bg-gradient-light rounded shadow-sm border-start border-4 border-dark">
        <h5 className="mb-2 text-secondary">
          <strong>LRN:</strong> <span className="text-dark">{lrn}</span>
        </h5>
        <h5 className="mb-0 text-secondary">
          <strong>Student Name:</strong> <span className="text-dark">{studentName}</span>
        </h5>
      </div>

  
      <div className="card shadow border-0 mb-5">
        <div className="card-header bg-dark text-white fw-semibold fs-5 d-flex align-items-center gap-2">
          <i className="bi bi-upload fs-4"></i> Upload New SF10 eCard
        </div>
        <form
          onSubmit={handleUpload}
          className="card-body row g-3"
          encType="multipart/form-data"
          noValidate
        >
          {["start_year", "end_year", "section", "grade_level"].map((field, idx) => (
            <div key={idx} className="col-md-3">
              <label htmlFor={field} className="form-label text-dark fw-semibold text-uppercase small">
                {field.replace("_", " ")}
              </label>
              <input
                type="text"
                className="form-control shadow-sm border-dark"
                id={field}
                name={field}
                value={form[field]}
                onChange={handleUploadChange}
                placeholder={field === "grade_level" ? "1 - 12" : field === "section" ? "e.g., Emerald" : `e.g., ${field === "start_year" ? "2024" : "2025"}`}
                required
                autoComplete="off"
              />
            </div>
          ))}

          <div className="col-md-12">
            <label htmlFor="sf10" className="form-label text-dark fw-semibold text-uppercase small">
              Select SF10 File
            </label>
            <input
              type="file"
              className="form-control shadow-sm border-dark"
              id="sf10"
              name="sf10"
              onChange={handleUploadChange}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              required
            />
          </div>

          <div className="col-md-12 d-grid">
            <button
              type="submit"
              className="btn btn-dark py-3 fw-semibold rounded-pill shadow"
            >
              <i className="bi bi-cloud-arrow-up-fill me-2 fs-5"></i> Upload Document
            </button>
          </div>
        </form>
      </div>

     
      <div className="card shadow border-0">
        <div className="card-header bg-dark text-white fw-semibold fs-5 d-flex align-items-center gap-2">
          <i className="bi bi-card-list fs-4"></i> Uploaded SF10 eCards
        </div>
        <div className="card-body">
          {eCards.length === 0 ? (
            <p className="text-muted fst-italic">No eCards uploaded yet.</p>
          ) : (
            <div className="row g-4">
              {eCards.map((ecard, idx) => (
                <div key={ecard.id || idx} className="col-md-4">
                  <div className="card h-100 border-dark shadow-sm rounded">
                    <div className="card-body d-flex flex-column">
                      <h6
                        className="card-title text-truncate"
                        title={ecard.file_name || ecard.name}
                      >
                        {ecard.file_name || ecard.name}
                      </h6>
                      <p className="card-text mb-1 text-dark small fw-semibold">
                        Section: {ecard.section || "-"} | Grade: {ecard.grade_level || "-"}
                      </p>
                      <p className="card-text text-secondary small fst-italic">
                        School Year: {ecard.start_year || "-"} - {ecard.end_year || "-"}
                      </p>
                      <a
                        href={`http://localhost:3001${ecard.path || ecard.file_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline-dark mt-auto rounded-pill px-3"
                      >
                        View Document
                      </a>
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
