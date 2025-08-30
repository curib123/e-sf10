import React, { useState, useEffect, useMemo } from "react";
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
  const token = useMemo(() => sessionStorage.getItem("token"), []);

  // Check token on mount
  useEffect(() => {
    checkToken();
  }, []);

  // Pre-fill form if initialData exists
  useEffect(() => {
    if (initialData) {
      const formattedDate = initialData.date_of_birth
        ? new Date(
            new Date(initialData.date_of_birth).getTime() -
              new Date(initialData.date_of_birth).getTimezoneOffset() * 60000
          )
            .toISOString()
            .split("T")[0]
        : "";
      setStudent({ ...initialData, date_of_birth: formattedDate });
    }
  }, [initialData]);

  const setField = (name, value) =>
    setStudent((prev) => ({ ...prev, [name]: value, updated_at: new Date().toISOString() }));

  const handleChange = (e) => {
    const { name, value } = e.target;
    // live-sanitize for specific fields
    if (name === "lrn") return setField(name, value.replace(/\D/g, "").slice(0, 12));
    if (name === "zip_code") return setField(name, value.replace(/\D/g, "").slice(0, 6));
    if (name === "contact_number") return setField(name, value.replace(/[^\d+]/g, "").slice(0, 15));
    setField(name, value);
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

    // Basic front-end validation
    if (!/^\d{12}$/.test(student.lrn)) {
      return setModal({
        show: true,
        title: "Check LRN",
        message: "LRN must be exactly 12 digits.",
        variant: "warning",
      });
    }
    if (!student.first_name.trim() || !student.last_name.trim() || !student.date_of_birth || !student.gender) {
      return setModal({
        show: true,
        title: "Missing info",
        message: "Please complete all required fields (First, Last, Birthdate, Gender).",
        variant: "warning",
      });
    }

    const { student_id, created_at, updated_at, ...payload } = student;
    const url =
      student_id && student.lrn
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
        message:
          data.message ||
          (student_id ? "Student updated successfully." : "Student registered successfully."),
        variant: "success",
      });

      if (onSubmit) onSubmit(data.student || payload);
      if (!student_id) setStudent(initialStudent);
    } catch (err) {
      setModal({ show: true, title: "Error", message: err.message, variant: "danger" });
    }
  };

  return (
    <div className="container-xxl my-4">
      <div className="mx-auto" style={{ maxWidth: 1000 }}>
        <form onSubmit={handleSubmit} className="bg-white rounded-4 shadow-sm border p-4 p-md-5">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className="mb-0 fw-bold">
              {student.student_id ? "Update Student" : "Register New Student"}
            </h4>
            {student.student_id && (
              <button
                type="button"
                className="btn btn-light border text-nowrap"
                onClick={() => window.history.back()}
              >
                Back
              </button>
            )}
          </div>

          {/* LRN */}
          <div className="mb-4">
            <div className="form-floating">
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{12}"
                className="form-control"
                id="lrn"
                name="lrn"
                maxLength={12}
                value={student.lrn}
                onChange={handleChange}
                placeholder="000000000000"
                required
              />
              <label htmlFor="lrn">LRN (12 digits) *</label>
            </div>
            <div className="form-text">Enter exactly 12 digits. No spaces or dashes.</div>
          </div>

          {/* Personal Information */}
          <section className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white border-0 fw-semibold">Personal Information</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <div className="form-floating">
                    <input
                      type="text"
                      className="form-control"
                      id="first_name"
                      name="first_name"
                      value={student.first_name}
                      onChange={handleChange}
                      placeholder="First Name"
                      required
                    />
                    <label htmlFor="first_name">First Name *</label>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <div className="form-floating">
                    <input
                      type="text"
                      className="form-control"
                      id="middle_name"
                      name="middle_name"
                      value={student.middle_name}
                      onChange={handleChange}
                      placeholder="Middle Name"
                    />
                    <label htmlFor="middle_name">Middle Name</label>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <div className="form-floating">
                    <input
                      type="text"
                      className="form-control"
                      id="last_name"
                      name="last_name"
                      value={student.last_name}
                      onChange={handleChange}
                      placeholder="Last Name"
                      required
                    />
                    <label htmlFor="last_name">Last Name *</label>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <div className="form-floating">
                    <input
                      type="text"
                      className="form-control"
                      id="extension_name"
                      name="extension_name"
                      value={student.extension_name}
                      onChange={handleChange}
                      placeholder="Extension (Jr., III, etc.)"
                    />
                    <label htmlFor="extension_name">Extension (Jr., III, etc.)</label>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <div className="form-floating">
                    <input
                      type="date"
                      className="form-control"
                      id="date_of_birth"
                      name="date_of_birth"
                      value={student.date_of_birth}
                      onChange={handleChange}
                      placeholder="YYYY-MM-DD"
                      required
                    />
                    <label htmlFor="date_of_birth">Date of Birth *</label>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <div className="form-floating">
                    <select
                      className="form-select"
                      id="gender"
                      name="gender"
                      value={student.gender}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                    <label htmlFor="gender">Gender *</label>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Address */}
          <section className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white border-0 fw-semibold">Address</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-12">
                  <div className="form-floating">
                    <input
                      type="text"
                      className="form-control"
                      id="street"
                      name="street"
                      value={student.street}
                      onChange={handleChange}
                      placeholder="House No. / Street / Barangay"
                    />
                    <label htmlFor="street">House No. / Street / Barangay</label>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <div className="form-floating">
                    <input
                      type="text"
                      className="form-control"
                      id="city"
                      name="city"
                      value={student.city}
                      onChange={handleChange}
                      placeholder="City/Municipality"
                    />
                    <label htmlFor="city">City / Municipality</label>
                  </div>
                </div>

                <div className="col-12 col-md-4">
                  <div className="form-floating">
                    <input
                      type="text"
                      className="form-control"
                      id="province"
                      name="province"
                      value={student.province}
                      onChange={handleChange}
                      placeholder="Province"
                    />
                    <label htmlFor="province">Province</label>
                  </div>
                </div>

                <div className="col-12 col-md-2">
                  <div className="form-floating">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d{4,6}"
                      className="form-control"
                      id="zip_code"
                      name="zip_code"
                      value={student.zip_code}
                      onChange={handleChange}
                      placeholder="Zip"
                    />
                    <label htmlFor="zip_code">ZIP</label>
                  </div>
                  <div className="form-text">4–6 digits.</div>
                </div>
              </div>
            </div>
          </section>

          {/* Guardian */}
          <section className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white border-0 fw-semibold">Guardian Information</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-12 col-md-8">
                  <div className="form-floating">
                    <input
                      type="text"
                      className="form-control"
                      id="guardian_name"
                      name="guardian_name"
                      value={student.guardian_name}
                      onChange={handleChange}
                      placeholder="Guardian's Name"
                    />
                    <label htmlFor="guardian_name">Guardian's Name</label>
                  </div>
                </div>

                <div className="col-12 col-md-4">
                  <div className="form-floating">
                    <input
                      type="tel"
                      inputMode="tel"
                      pattern="[\d+]{7,15}"
                      className="form-control"
                      id="contact_number"
                      name="contact_number"
                      value={student.contact_number}
                      onChange={handleChange}
                      placeholder="Contact Number"
                    />
                    <label htmlFor="contact_number">Contact Number</label>
                  </div>
                  <div className="form-text">Digits only, may start with “+”.</div>
                </div>
              </div>
            </div>
          </section>

          {/* Modal */}
          <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />

          {/* Submit */}
          <div className="d-grid">
            <button type="submit" className="btn btn-success py-2 fw-semibold text-nowrap">
              {student.student_id ? "Update Student" : "Add Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
