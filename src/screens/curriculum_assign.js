import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Spinner, Button, Modal, Card } from "react-bootstrap";
import { FaArrowLeft, FaBookOpen, FaClipboardList } from "react-icons/fa";
import StatusModal from "../components/status_modal";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const CurriculumAssign = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = sessionStorage.getItem("token");

  const [subjects, setSubjects] = useState([]);
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [selectedToAssign, setSelectedToAssign] = useState([]);
  const [loading, setLoading] = useState(false);

  const [statusModal, setStatusModal] = useState({ show: false, title: "", message: "", variant: "info" });
  const [showConfirm, setShowConfirm] = useState(false);
  const [subjectToRemove, setSubjectToRemove] = useState(null);

  // Handle unauthorized access
  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: "Unauthorized", message: "Access denied. Please log in.", variant: "danger" });
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 1500);
  };

  useEffect(() => {
    if (!token) return handleUnauthorized();
    fetchSubjects();
    fetchAssignedSubjects();
  }, [token, navigate]);

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`${BASE_URL}/subjects/view-all-subjects`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setSubjects(data.data || []);
    } catch (err) {
      setStatusModal({ show: true, title: "Error", message: err.message, variant: "danger" });
    }
  };

  const fetchAssignedSubjects = async () => {
    try {
      const res = await fetch(`${BASE_URL}/curriculum/curriculum-subjects/${id}`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setAssignedSubjects(data.data || []);
    } catch (err) {
      setStatusModal({ show: true, title: "Error", message: err.message, variant: "danger" });
    }
  };

  const toggleSelect = (subject_id) => {
    setSelectedToAssign((prev) =>
      prev.includes(subject_id) ? prev.filter((id) => id !== subject_id) : [...prev, subject_id]
    );
  };

  const assignSubjects = async () => {
    if (!selectedToAssign.length)
      return setStatusModal({ show: true, title: "Warning", message: "⚠️ Select at least one subject.", variant: "warning" });

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/curriculum/add-subjects/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject_ids: selectedToAssign }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusModal({ show: true, title: "Success", message: `✅ ${data.message}`, variant: "success" });
        setSelectedToAssign([]);
        fetchAssignedSubjects();
      } else {
        setStatusModal({ show: true, title: "Error", message: "❌ Failed to assign subjects.", variant: "danger" });
      }
    } catch (err) {
      setStatusModal({ show: true, title: "Error", message: "❌ " + err.message, variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const confirmRemoveSubject = (subject_id) => {
    setSubjectToRemove(subject_id);
    setShowConfirm(true);
  };

  const removeSubject = async () => {
    setShowConfirm(false);
    if (!subjectToRemove) return;

    try {
      const res = await fetch(`${BASE_URL}/curriculum/remove-subject/${id}/${subjectToRemove}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStatusModal({ show: true, title: "Success", message: "✅ Subject removed successfully!", variant: "success" });
        fetchAssignedSubjects();
      } else {
        setStatusModal({ show: true, title: "Error", message: "❌ Failed to remove subject.", variant: "danger" });
      }
    } catch (err) {
      setStatusModal({ show: true, title: "Error", message: "❌ " + err.message, variant: "danger" });
    } finally {
      setSubjectToRemove(null);
    }
  };

  const availableSubjects = subjects.filter((s) => !assignedSubjects.some((a) => a.subject_id === s.subject_id));

  return (
    <div className="container mt-4">
      {/* Page Header */}
      <div className="text-center mb-5">
        <h2 className="fw-bold text-primary">
          <FaClipboardList className="me-2" /> Assign Subjects
        </h2>
        <p className="text-muted">Easily manage subjects for this curriculum.</p>
      </div>

      {/* Assigned Subjects */}
      <Card className="shadow-sm mb-4">
        <Card.Header className="fw-bold bg-primary text-white">
          <FaBookOpen className="me-2" /> Assigned Subjects
        </Card.Header>
        <Card.Body style={{ maxHeight: "300px", overflowY: "auto" }}>
          {assignedSubjects.length ? (
            assignedSubjects.map((subj) => (
              <div
                key={subj.subject_id}
                className="d-flex justify-content-between align-items-center p-2 mb-1 border rounded bg-light"
              >
                <span>{subj.subject_name} ({subj.subject_code})</span>
                <Button size="sm" variant="outline-danger" onClick={() => confirmRemoveSubject(subj.subject_id)}>
                  Remove
                </Button>
              </div>
            ))
          ) : (
            <p className="text-muted text-center">No subjects assigned yet</p>
          )}
        </Card.Body>
      </Card>

      {/* Available Subjects */}
      <Card className="shadow-sm">
        <Card.Header className="fw-bold bg-success text-white">
          <FaBookOpen className="me-2" /> Available Subjects
        </Card.Header>
        <Card.Body style={{ maxHeight: "300px", overflowY: "auto" }}>
          {availableSubjects.length ? (
            availableSubjects.map((subj) => (
              <div
                key={subj.subject_id}
                className={`p-2 mb-1 border rounded cursor-pointer ${
                  selectedToAssign.includes(subj.subject_id) ? "bg-success text-white" : "bg-light"
                }`}
                onClick={() => toggleSelect(subj.subject_id)}
              >
                {subj.subject_name} ({subj.subject_code})
              </div>
            ))
          ) : (
            <p className="text-muted text-center">No subjects available</p>
          )}
        </Card.Body>
        <Card.Footer className="text-end d-flex justify-content-between">
          <Button variant="success" onClick={assignSubjects} disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : "Assign Selected"}
          </Button>
          <Button variant="light" onClick={() => navigate(-1)}>
            <FaArrowLeft className="me-1" /> Back
          </Button>
        </Card.Footer>
      </Card>

      {/* Status Modal */}
      <StatusModal {...statusModal} onHide={() => setStatusModal({ ...statusModal, show: false })} />

      {/* Remove Confirmation Modal */}
      <Modal show={showConfirm} onHide={() => setShowConfirm(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Removal</Modal.Title>
        </Modal.Header>
        <Modal.Body>Are you sure you want to remove this subject?</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={removeSubject}>Remove</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CurriculumAssign;
