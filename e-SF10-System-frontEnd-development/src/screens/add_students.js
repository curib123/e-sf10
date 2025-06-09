import React, { useState, useEffect } from "react";
import StatusModal from "../components/status_modal";
import { checkToken } from '../components/token_checker'; 

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
  updated_at: ""
};

export default function StudentForm({ initialData = null, onSubmit }) {
  const [student, setStudent] = useState(initialStudent);
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });
  const token = sessionStorage.getItem("token");

  
   useEffect(() => {
  checkToken();
}, []);

  useEffect(() => {
    if (initialData) {
      if (initialData.date_of_birth) {
        let date = new Date(initialData.date_of_birth);
        date = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        const formattedDate = date.toISOString().split("T")[0];
        setStudent({
          ...initialData,
          date_of_birth: formattedDate,
        });
      } else {
        setStudent(initialData);
      }
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setStudent((prev) => ({
      ...prev,
      [name]: value,
      updated_at: new Date().toISOString(),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setModal({
        show: true,
        title: "Authorization Error",
        message: "Authorization token not found. Please log in.",
        variant: "danger",
      });
      return;
    }

    const { student_id, created_at, updated_at, ...payload } = student;

    try {
      let url = "";
      let method = "";

      if (student_id && student.lrn) {
        url = `http://localhost:3001/esf10/students/${student.lrn}/update`;
        method = "PUT";
      } else {
        url = "http://localhost:3001/esf10/students/register";
        method = "POST";
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      setModal({
        show: true,
        title: "Success",
        message: data.message || (student_id ? "Student updated successfully." : "Student registered successfully."),
        variant: "success",
      });

      if (onSubmit) {
        onSubmit(data.student || payload);
      }

      if (!student_id) {
        setStudent(initialStudent);
      }
    } catch (err) {
      setModal({
        show: true,
        title: "Error",
        message: err.message,
        variant: "danger",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-light rounded shadow-sm border">
      <div className="d-flex justify-content-between">
        <h4 className="mb-4 text-secondary">
          <i className="bi bi-person-badge-fill me-2"></i>
          {student.student_id ? "Update Student" : "Register New Student"}
        </h4>

        {!student.student_id ? (
          <h1></h1>
        ) : (
          <button
            type="button"
            className="btn btn-outline-secondary mb-3"
            onClick={() => window.history.back()}
          >
            <i className="bi bi-arrow-left-circle me-2"></i>
            Back
          </button>
        )}
      </div>

      {/* LRN */}
      <div className="mb-3">
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

      {/* Personal Info */}
      <div className="card mb-4">
        <div className="card-header bg-secondary text-white">
          <i className="bi bi-person-lines-fill me-2"></i> Personal Information
        </div>
        <div className="card-body row g-3">
          <div className="col-md-3">
            <label className="form-label">First Name</label>
            <input
              type="text"
              className="form-control"
              name="first_name"
              value={student.first_name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Middle Name</label>
            <input
              type="text"
              className="form-control"
              name="middle_name"
              value={student.middle_name}
              onChange={handleChange}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Last Name</label>
            <input
              type="text"
              className="form-control"
              name="last_name"
              value={student.last_name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Extension</label>
            <input
              type="text"
              className="form-control"
              name="extension_name"
              value={student.extension_name}
              onChange={handleChange}
              placeholder="e.g. Jr."
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Date of Birth</label>
            <input
              type="date"
              className="form-control"
              name="date_of_birth"
              value={student.date_of_birth}
              onChange={handleChange}
              required
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Gender</label>
            <select
              className="form-select"
              name="gender"
              value={student.gender}
              onChange={handleChange}
              required
            >
              <option value="">Select Gender</option>
              <option value="Male">♂ Male</option>
              <option value="Female">♀ Female</option>
            </select>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="card mb-4">
        <div className="card-header bg-secondary text-white">
          <i className="bi bi-geo-alt-fill me-2"></i> Address
        </div>
        <div className="card-body row g-3">
          <div className="col-md-12">
            <label className="form-label">Street</label>
            <input
              type="text"
              className="form-control"
              name="street"
              value={student.street}
              onChange={handleChange}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">City</label>
            <input
              type="text"
              className="form-control"
              name="city"
              value={student.city}
              onChange={handleChange}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Province</label>
            <input
              type="text"
              className="form-control"
              name="province"
              value={student.province}
              onChange={handleChange}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">ZIP Code</label>
            <input
              type="text"
              className="form-control"
              name="zip_code"
              value={student.zip_code}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* Guardian Info */}
      <div className="card mb-4">
        <div className="card-header bg-secondary text-white">
          <i className="bi bi-person-hearts me-2"></i> Guardian Information
        </div>
        <div className="card-body row g-3">
          <div className="col-md-6">
            <label className="form-label">Guardian's Name</label>
            <input
              type="text"
              className="form-control"
              name="guardian_name"
              value={student.guardian_name}
              onChange={handleChange}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Contact Number</label>
            <input
              type="text"
              className="form-control"
              name="contact_number"
              value={student.contact_number}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />

      <button type="submit" className="btn btn-success w-100">
        <i className="bi bi-check-circle-fill me-2"></i>
        {student.student_id ? "Update Student" : "Add Student"}
      </button>
    </form>
  );
}
