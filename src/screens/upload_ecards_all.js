import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import AsyncSelect from "react-select/async";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

export default function StudentRecord() {
  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

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
        message: `Failed to load ${endpoint}`,
        variant: "danger",
      });
    }
  };

  useEffect(() => {
    fetchData("school-year/all-school-years", setSchoolYears, "schoolYears");
  }, []);
  useEffect(() => {
    fetchData("grade-levels", setGradeLevels, "data");
  }, []);

  // AsyncSelect options loader
  const fetchStudentOptions = async (inputValue) => {
    if (!token || !inputValue) return [];
    try {
      const res = await fetch(`${BASE_URL}/students/all?page=1&limit=50`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch students");
      const data = await res.json();
      if (!data.students) return [];
      return data.students
        .filter(
          (s) =>
            String(s.lrn).includes(inputValue) ||
            `${s.first_name} ${s.last_name}`
              .toLowerCase()
              .includes(inputValue.toLowerCase())
        )
        .map((s) => ({
          value: s.lrn,
          label: `${s.lrn} — ${s.last_name}, ${s.first_name}`,
        }));
    } catch (err) {
      setModal({
        show: true,
        title: "Error",
        message: err.message,
        variant: "danger",
      });
      return [];
    }
  };

  // Load chosen student details
  const fetchDetails = async (selectedLrn) => {
    if (!token)
      return setModal({
        show: true,
        title: "Error",
        message: "Missing authorization token.",
        variant: "danger",
      });

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/students/${selectedLrn}/details`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch student details");
      const data = await res.json();

      setLrn(selectedLrn);
      setStudentId(data.student?.student_id || null);
      setStudentName(
        `${data.student?.last_name}, ${data.student?.first_name} ${
          data.student?.middle_name || ""
        }`.trim()
      );
      setECards(data.eCards || []);
      setModal({
        show: true,
        title: "Loaded",
        message: "Student loaded successfully.",
        variant: "success",
      });
    } catch (err) {
      setModal({ show: true, title: "Error", message: err.message, variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  // Form change handlers
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

  // Upload handler
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
        message: "Student not loaded.",
        variant: "danger",
      });

    const fd = new FormData();
    Object.entries(form).forEach(([key, val]) => fd.append(key, val));

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
        message: data.message,
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
      setModal({ show: true, title: "Error", message: err.message, variant: "danger" });
    }
  };

  return (
    <div className="container-xxl py-4">
      <StatusModal
        {...modal}
        onHide={() => setModal((m) => ({ ...m, show: false }))}
      />

      {/* Search + student summary */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-4">
          <div className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-3">
            <div className="flex-grow-1">
              <label className="form-label mb-2">Search Student</label>
              <div className="d-flex">
                <span className="input-group-text rounded-start-3">LRN / Name</span>
                <div className="flex-grow-1">
                  <AsyncSelect
                    cacheOptions
                    loadOptions={fetchStudentOptions}
                    defaultOptions
                    onChange={(selected) => selected && fetchDetails(selected.value)}
                    placeholder="Type to search…"
                    classNamePrefix="react-select"
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: 40,
                        borderRadius: "0 .5rem .5rem 0",
                        borderColor: "#dee2e6",
                        boxShadow: "none",
                      }),
                      valueContainer: (base) => ({ ...base, padding: "2px 8px" }),
                      indicatorsContainer: (base) => ({ ...base, paddingRight: 6 }),
                      menu: (base) => ({ ...base, zIndex: 5 }),
                    }}
                  />
                </div>
              </div>
              {loading && <div className="small text-muted mt-2">Loading…</div>}
            </div>

            {lrn && (
              <div className="border-start ps-lg-4 ms-lg-2">
                <div className="text-muted small mb-1">Selected</div>
                <div className="fw-semibold text-truncate">{studentName}</div>
                <div className="small text-muted">LRN: {lrn}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload card */}
      {lrn && (
        <div className="card border-0 shadow-sm rounded-4 mb-4">
          <div className="card-header bg-white border-0 rounded-top-4">
            <h5 className="mb-0 fw-semibold">Upload SF10 eCard</h5>
          </div>
          <form
            className="card-body p-4 row g-3"
            onSubmit={handleUpload}
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
                required
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
              <label className="form-label">Select File</label>
              <input
                type="file"
                name="sf10"
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
              <button
                className="btn btn-success text-nowrap px-4"
                type="submit"
              >
                Upload Document
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Uploaded eCards */}
      {lrn && (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-header bg-white border-0 rounded-top-4 d-flex justify-content-between align-items-center">
            <h6 className="mb-0 fw-semibold">Uploaded SF10 eCards</h6>
            <Link
              to={`/record_student/${lrn}`}
              className="btn btn-outline-primary btn-sm text-nowrap px-3"
            >
              View Student Record
            </Link>
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
      )}
    </div>
  );
}
