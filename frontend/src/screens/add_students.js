import React, { useState, useEffect } from "react";
import 'bootstrap-icons/font/bootstrap-icons.css';

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

  useEffect(() => {
    if (initialData) setStudent({ ...initialData });
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setStudent((prev) => ({
      ...prev,
      [name]: value,
      updated_at: new Date().toISOString(),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const finalData = {
      ...student,
      created_at: student.created_at || now,
      updated_at: now,
    };
    onSubmit(finalData);
    setStudent(initialStudent);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white rounded shadow-sm border">
      <h4 className="mb-4 text-success">
        <i className="bi bi-person-lines-fill me-2"></i>
        {student.student_id ? "Update Student" : "Register New Student"}
      </h4>

      {/* LRN */}
      <div className="mb-3">
        <label className="form-label">LRN <span className="text-danger">*</span></label>
        <input
          type="text"
          className="form-control"
          name="lrn"
          maxLength="12"
          value={student.lrn}
          onChange={handleChange}
          placeholder="12-digit LRN"
          required
        />
      </div>

      {/* Name Section */}
      <div className="row">
        <div className="col-md-3 mb-3">
          <label className="form-label">First Name</label>
          <input type="text" className="form-control" name="first_name" value={student.first_name} onChange={handleChange} required />
        </div>
        <div className="col-md-3 mb-3">
          <label className="form-label">Middle Name</label>
          <input type="text" className="form-control" name="middle_name" value={student.middle_name} onChange={handleChange} />
        </div>
        <div className="col-md-3 mb-3">
          <label className="form-label">Last Name</label>
          <input type="text" className="form-control" name="last_name" value={student.last_name} onChange={handleChange} required />
        </div>
        <div className="col-md-3 mb-3">
          <label className="form-label">Extension (e.g. Jr.)</label>
          <input type="text" className="form-control" name="extension_name" value={student.extension_name} onChange={handleChange} />
        </div>
      </div>

      {/* DOB & Gender */}
      <div className="row">
        <div className="col-md-6 mb-3">
          <label className="form-label">Date of Birth</label>
          <input type="date" className="form-control" name="date_of_birth" value={student.date_of_birth} onChange={handleChange} required />
        </div>
        <div className="col-md-6 mb-3">
          <label className="form-label">Gender</label>
          <select className="form-select" name="gender" value={student.gender} onChange={handleChange} required>
            <option value="">Select Gender</option>
            <option value="Male">♂ Male</option>
            <option value="Female">♀ Female</option>
          </select>
        </div>
      </div>

      {/* Address Section */}
      <div className="border-top pt-3 mt-3">
        <h5 className="text-secondary"><i className="bi bi-house-door me-2"></i>Address</h5>
        <div className="mb-2">
          <label className="form-label">Street</label>
          <input type="text" className="form-control" name="street" value={student.street} onChange={handleChange} />
        </div>
        <div className="row">
          <div className="col-md-4 mb-2">
            <label className="form-label">City</label>
            <input type="text" className="form-control" name="city" value={student.city} onChange={handleChange} />
          </div>
          <div className="col-md-4 mb-2">
            <label className="form-label">Province</label>
            <input type="text" className="form-control" name="province" value={student.province} onChange={handleChange} />
          </div>
          <div className="col-md-4 mb-2">
            <label className="form-label">ZIP Code</label>
            <input type="text" className="form-control" name="zip_code" value={student.zip_code} onChange={handleChange} />
          </div>
        </div>
      </div>

      {/* Guardian Info */}
      <div className="border-top pt-3 mt-3">
        <h5 className="text-secondary"><i className="bi bi-people-fill me-2"></i>Guardian Info</h5>
        <div className="mb-2">
          <label className="form-label">Guardian's Name</label>
          <input type="text" className="form-control" name="guardian_name" value={student.guardian_name} onChange={handleChange} />
        </div>
        <div className="mb-3">
          <label className="form-label">Contact Number</label>
          <input type="text" className="form-control" name="contact_number" value={student.contact_number} onChange={handleChange} />
        </div>
      </div>

      {/* Submit */}
      <button type="submit" className="btn btn-success w-100 mt-3">
        <i className="bi bi-check2-circle me-1"></i>
        {student.student_id ? "Update Student" : "Add Student"}
      </button>
    </form>
  );
}
