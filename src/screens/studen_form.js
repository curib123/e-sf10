import React, { useState, useEffect } from "react";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

// Initial student structure
const initialStudent = {
  student_id: null,
  lrn: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  extension_name: "",
  date_of_birth: "",
  gender: "",
  street: "",
  city: "",
  province: "",
  zip_code: "",
  guardian_name: "",
  contact_number: "",
  created_at: "",
  updated_at: "",
};

export default function StudentForm({ initialData = null, onSubmit }) {
  const [student, setStudent] = useState(initialStudent);
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });
  const token = sessionStorage.getItem("token");

  // Check token on mount
  useEffect(() => {
    checkToken();
  }, []);

  // Pre-fill form if initialData exists
  useEffect(() => {
    if (initialData) {
      const formattedDate = initialData.date_of_birth
        ? new Date(new Date(initialData.date_of_birth).getTime() - new Date(initialData.date_of_birth).getTimezoneOffset() * 60000)
            .toISOString()
            .split("T")[0]
        : "";
      setStudent({ ...initialData, date_of_birth: formattedDate });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setStudent((prev) => ({ ...prev, [name]: value, updated_at: new Date().toISOString() }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      return setModal({
        show: true,
        title: "Authorization Error",
        message: "Authorization token not found. Please log in.",
        variant: "danger",
      });
    }

    const { student_id, created_at, updated_at, ...payload } = student;
    const url = student_id && student.lrn
      ? `${BASE_URL}/students/${student.lrn}/update`
      : `${BASE_URL}/students/register`;
    const method = student_id && student.lrn ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Something went wrong.");

      setModal({
        show: true,
        title: "Success",
        message: data.message || (student_id ? "Student updated successfully." : "Student registered successfully."),
        variant: "success",
      });

      if (onSubmit) onSubmit(data.student || payload);
      if (!student_id) setStudent(initialStudent);
    } catch (err) {
      setModal({ show: true, title: "Error", message: err.message, variant: "danger" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white rounded-3 shadow-sm border">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0 text-secondary fw-bold">
          <i className="bi bi-person-badge-fill me-2"></i>
          {student.student_id ? "Update Student" : "Register New Student"}
        </h4>
        {student.student_id && (
          <button type="button" className="btn btn-outline-secondary" onClick={() => window.history.back()}>
            <i className="bi bi-arrow-left-circle me-2"></i> Back
          </button>
        )}
      </div>

      {/* LRN */}
      <div className="mb-4">
        <label className="form-label fw-semibold">
          LRN <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          className="form-control"
          name="lrn"
          maxLength="12"
          value={student.lrn}
          onChange={handleChange}
          placeholder="Enter 12-digit LRN"
          required
        />
        <div className="form-text">Must be exactly 12 digits.</div>
      </div>

      {/* Sections */}
      {["Personal Information", "Address", "Guardian Information"].map((section, idx) => {
        const fields = {
          "Personal Information": [
            { label: "First Name", name: "first_name", required: true },
            { label: "Middle Name", name: "middle_name" },
            { label: "Last Name", name: "last_name", required: true },
            { label: "Extension", name: "extension_name" },
            { label: "Date of Birth", name: "date_of_birth", type: "date", required: true },
            { label: "Gender", name: "gender", type: "select", options: ["Male", "Female"], required: true },
          ],
          Address: [
            { label: "Street", name: "street" },
            { label: "City", name: "city" },
            { label: "Province", name: "province" },
            { label: "ZIP Code", name: "zip_code" },
          ],
          "Guardian Information": [
            { label: "Guardian's Name", name: "guardian_name" },
            { label: "Contact Number", name: "contact_number" },
          ],
        };

        return (
          <section key={idx} className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-primary text-white fw-semibold">
              <i className="bi bi-{idx === 0 ? 'person-lines-fill' : idx === 1 ? 'geo-alt-fill' : 'person-hearts'} me-2"></i> {section}
            </div>
            <div className="card-body row g-3">
              {fields[section].map((field, fIdx) => (
                <div key={fIdx} className={`col-md-${field.col || 6}`}>
                  {field.type === "select" ? (
                    <select
                      className="form-select"
                      name={field.name}
                      value={student[field.name]}
                      onChange={handleChange}
                      required={field.required}
                    >
                      <option value="">Select {field.label}</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type || "text"}
                      className="form-control"
                      name={field.name}
                      value={student[field.name]}
                      onChange={handleChange}
                      placeholder={field.placeholder || ""}
                      required={field.required}
                    />
                  )}
                  <label className="form-label">{field.label}</label>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Modal */}
      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />

      {/* Submit */}
      <button type="submit" className="btn btn-success w-100 py-2 fw-semibold">
        <i className="bi bi-check-circle-fill me-2"></i>
        {student.student_id ? "Update Student" : "Add Student"}
      </button>
    </form>
  );
}
