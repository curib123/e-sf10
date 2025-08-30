import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

export default function StudentRecord() {
  const { lrn } = useParams();

  const token = useMemo(() => sessionStorage.getItem("token"), []);
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
    grade_level_name: "",
  });

  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "danger",
  });

  const authHeaders = () =>
    token ? { Authorization: `Bearer ${token}` } : {};

  // Token check
  useEffect(() => {
    checkToken();
  }, []);

  // Generic fetch helper
  const fetchData = async (endpoint, setter, key = "data") => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/${endpoint}`, {
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
      const data = await res.json();
      if (data.success) setter(data[key] ?? []);
    } catch (err) {
      setModal({
        show: true,
        title: "Error",
        message: `Failed to fetch ${endpoint}`,
        variant: "danger",
      });
    }
  };

  // Fetch student details (+ their eCards)
  useEffect(() => {
    const fetchStudentDetails = async () => {
      if (!token || !lrn) return;
      setLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/students/${lrn}/details`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch student details");
        const data = await res.json();
        const st = data?.student;
        setStudentId(st?.student_id || null);
        setStudentName(
          [st?.last_name, ", ", st?.first_name, " ", st?.middle_name || ""]
            .join("")
            .trim()
        );
        setECards(data?.eCards || []);
      } catch (err) {
        setModal({
          show: true,
          title: "Error",
          message: err.message,
          variant: "danger",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchStudentDetails();
  }, [lrn, token]);

  // Fetch school years & grade levels
  useEffect(() => {
    fetchData("school-year/all-school-years", setSchoolYears, "schoolYears");
  }, [token]);
  useEffect(() => {
    fetchData("grade-levels", setGradeLevels, "data");
  }, [token]);

  // Form handlers
  const handleUploadChange = (e) => {
    const { name, value, files } = e.target;

    if (name === "school_year_id") {
      const selected = schoolYears.find(
        (sy) => sy.school_year_id === parseInt(value, 10)
      );
      setForm((prev) => ({
        ...prev,
        school_year_id: value || "",
        start_year: selected?.start_year || "",
        end_year: selected?.end_year || "",
      }));
      return;
    }

    if (name === "grade_level_id") {
      const selected = gradeLevels.find(
        (gl) => gl.grade_level_id === parseInt(value, 10)
      );
      setForm((prev) => ({
        ...prev,
        grade_level_id: value || "",
        grade_level_name: selected?.grade_name || "",
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: files ? files[0] : value }));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!token)
      return setModal({
        show: true,
        title: "Error",
        message: "Missing authorization token.",
        variant: "danger",
      });
    if (!form.sf10)
      return setModal({
        show: true,
        title: "Error",
        message: "Please select a file.",
        variant: "danger",
      });
    if (!studentId)
      return setModal({
        show: true,
        title: "Error",
        message: "Student ID not available.",
        variant: "danger",
      });

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));

    try {
      const res = await fetch(`${BASE_URL}/students/upload-sf10/${studentId}`, {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed.");
      setModal({
        show: true,
        title: "Upload Successful",
        message: data?.message || "Document uploaded.",
        variant: "success",
      });
      if (data?.document) setECards((prev) => [...prev, data.document]);
      setForm({
        sf10: null,
        school_year_id: "",
        start_year: "",
        end_year: "",
        section: "",
        grade_level_id: "",
        grade_level_name: "",
      });
    } catch (err) {
      setModal({
        show: true,
        title: "Error",
        message: err.message,
        variant: "danger",
      });
    }
  };

  if (loading)
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );

  return (
    <div className="container-xxl py-3">
      <StatusModal
        {...modal}
        onHide={() => setModal((m) => ({ ...m, show: false }))}
      />

      {/* Top bar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <button
          type="button"
          className="btn btn-light border text-nowrap"
          onClick={() => window.history.back()}
        >
          &laquo; Back
        </button>

        <div className="text-end small text-muted">
          LRN: <span className="fw-semibold">{lrn}</span>
        </div>
      </div>

      {/* Student summary */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-4">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-2">
            <div>
              <div className="text-muted small">Student</div>
              <h2 className="fw-bold fs-4 mb-0 text-truncate">{studentName}</h2>
            </div>
            <Link
              to={`/record_student/${lrn}`}
              className="btn btn-outline-primary text-nowrap"
            >
              View Student Record
            </Link>
          </div>
        </div>
      </div>

      {/* Upload form */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
      
        <form
          onSubmit={handleUpload}
          className="card-body p-4 row g-3"
          encType="multipart/form-data"
          noValidate
        >
          <div className="col-12 col-md-4">
            <label className="form-label">School Year</label>
            <select
              name="school_year_id"
              className="form-select"
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
            {form.start_year && form.end_year && (
              <div className="form-text">
                Selected SY: {form.start_year}-{form.end_year}
              </div>
            )}
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label">Section</label>
            <input
              type="text"
              name="section"
              className="form-control"
              value={form.section}
              onChange={handleUploadChange}
              placeholder="e.g., A or Emerald"
            />
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label">Grade Level</label>
            <select
              name="grade_level_id"
              className="form-select"
              value={form.grade_level_id}
              onChange={handleUploadChange}
              required
            >
              <option value="">Select Grade Level</option>
              {gradeLevels.map((gl) => (
                <option key={gl.grade_level_id} value={gl.grade_level_id}>
                  {gl.grade_name}
                </option>
              ))}
            </select>
            {form.grade_level_name && (
              <div className="form-text">Selected: {form.grade_level_name}</div>
            )}
          </div>

          <div className="col-12">
            <label htmlFor="sf10" className="form-label">
              Select SF10 File
            </label>
            <input
              id="sf10"
              name="sf10"
              type="file"
              className="form-control"
              onChange={handleUploadChange}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              required
            />
            <div className="form-text">
              Accepted: PDF, JPG, JPEG, PNG, DOC, DOCX
            </div>
          </div>

          <div className="col-12 d-flex justify-content-end">
            <button type="submit" className="btn btn-success text-nowrap px-4">
              Upload Document
            </button>
          </div>
        </form>
      </div>

      {/* Uploaded eCards */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-header bg-white border-0 rounded-top-4 d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-semibold">Uploaded SF10 eCards</h6>
          <span className="text-muted small">
            {eCards.length} item{eCards.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="card-body p-3">
          {eCards.length === 0 ? (
            <div className="text-center text-muted py-4">
              No eCards uploaded yet.
            </div>
          ) : (
            <div className="row g-3">
              {eCards.map((ecard, idx) => (
                <div className="col-12 col-md-6 col-lg-4" key={idx}>
                  <div className="card h-100 border-0 shadow-sm rounded-4">
                    <div className="card-body">
                      <div className="fw-semibold text-success mb-1">
                        Successfully Uploaded
                      </div>
                      <div className="small text-muted">
                        {ecard.uploaded_at
                          ? new Date(ecard.uploaded_at).toLocaleString()
                          : ""}
                      </div>
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
