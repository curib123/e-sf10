import React, { useState, useEffect } from "react";

export default function StudentRecordDisplay({ lrn, onBack }) {
  const [student, setStudent] = useState(null);
  const [eCards, setECards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (lrn) {
      fetchStudentDetails();
    }
  }, [lrn]);

  const fetchStudentDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get token from localStorage or wherever it's stored
      const token = localStorage.getItem("token");
      
      if (!token) {
        throw new Error("Authorization token not found. Please log in.");
      }

      const response = await fetch(`http://localhost:3001/esf10/students/${lrn}/details`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setStudent(data.student);
      setECards(data.eCards || []);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching student details:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return "N/A";
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Loading student details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        <strong>Error:</strong> {error}
        <div className="mt-2">
          <button className="btn btn-outline-danger btn-sm me-2" onClick={fetchStudentDetails}>
            <i className="bi bi-arrow-clockwise me-1"></i>
            Retry
          </button>
          {onBack && (
            <button className="btn btn-outline-secondary btn-sm" onClick={onBack}>
              <i className="bi bi-arrow-left me-1"></i>
              Back
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="alert alert-warning" role="alert">
        <i className="bi bi-person-x-fill me-2"></i>
        No student found with LRN: {lrn}
      </div>
    );
  }

  return (
    <div className="container-fluid p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-primary mb-0">
          <i className="bi bi-person-badge-fill me-2"></i>
          Student Record
        </h2>
        {onBack && (
          <button className="btn btn-outline-secondary" onClick={onBack}>
            <i className="bi bi-arrow-left-circle me-2"></i>
            Back
          </button>
        )}
      </div>

      {/* Student Information Card */}
      <div className="card mb-4 shadow-sm">
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">
            <i className="bi bi-person-lines-fill me-2"></i>
            Personal Information
          </h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            {/* Basic Info */}
            <div className="col-md-6">
              <div className="border rounded p-3 h-100">
                <h6 className="text-secondary mb-3">Basic Details</h6>
                <div className="row g-2">
                  <div className="col-12">
                    <strong>LRN:</strong> <span className="badge bg-secondary fs-6">{student.lrn}</span>
                  </div>
                  <div className="col-12">
                    <strong>Full Name:</strong> {student.first_name} {student.middle_name} {student.last_name}
                  </div>
                  <div className="col-12">
                    <strong>Date of Birth:</strong> {formatDate(student.date_of_birth)}
                  </div>
                  <div className="col-12">
                    <strong>Age:</strong> {calculateAge(student.date_of_birth)} years old
                  </div>
                  <div className="col-12">
                    <strong>Gender:</strong> 
                    <span className={`ms-2 badge ${student.gender === 'Male' ? 'bg-info' : 'bg-warning'}`}>
                      {student.gender === 'Male' ? '♂' : '♀'} {student.gender}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="col-md-6">
              <div className="border rounded p-3 h-100">
                <h6 className="text-secondary mb-3">
                  <i className="bi bi-geo-alt-fill me-1"></i>
                  Address
                </h6>
                <div className="row g-2">
                  <div className="col-12">
                    <strong>Street:</strong> {student.street || "N/A"}
                  </div>
                  <div className="col-12">
                    <strong>City:</strong> {student.city || "N/A"}
                  </div>
                  <div className="col-12">
                    <strong>Province:</strong> {student.province || "N/A"}
                  </div>
                  <div className="col-12">
                    <strong>ZIP Code:</strong> {student.zip_code || "N/A"}
                  </div>
                </div>
              </div>
            </div>

            {/* Guardian Info */}
            <div className="col-12">
              <div className="border rounded p-3">
                <h6 className="text-secondary mb-3">
                  <i className="bi bi-person-hearts me-1"></i>
                  Guardian Information
                </h6>
                <div className="row g-2">
                  <div className="col-md-6">
                    <strong>Guardian's Name:</strong> {student.guardian_name || "N/A"}
                  </div>
                  <div className="col-md-6">
                    <strong>Contact Number:</strong> {student.contact_number || "N/A"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* eCards Section */}
      <div className="card shadow-sm">
        <div className="card-header bg-success text-white">
          <h5 className="mb-0">
            <i className="bi bi-credit-card-2-front-fill me-2"></i>
            Associated eCards ({eCards.length})
          </h5>
        </div>
        <div className="card-body">
          {eCards.length === 0 ? (
            <div className="text-center py-4">
              <i className="bi bi-credit-card-2-front text-muted" style={{ fontSize: "3rem" }}></i>
              <p className="text-muted mt-2 mb-0">No eCards associated with this student.</p>
            </div>
          ) : (
            <div className="row g-3">
              {eCards.map((card, index) => (
                <div key={index} className="col-md-6 col-lg-4">
                  <div className="card border-success">
                    <div className="card-body">
                      <h6 className="card-title text-success">eCard #{index + 1}</h6>
                      <p className="card-text small text-muted">
                        {/* Display eCard details here based on your eCard structure */}
                        Card ID: {card.id || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="row mt-4">
        <div className="col-12 text-center">
          <button className="btn btn-outline-primary me-2" onClick={fetchStudentDetails}>
            <i className="bi bi-arrow-clockwise me-1"></i>
            Refresh Data
          </button>
          <button className="btn btn-outline-success">
            <i className="bi bi-printer me-1"></i>
            Print Record
          </button>
        </div>
      </div>
    </div>
  );
}