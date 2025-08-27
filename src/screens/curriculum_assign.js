import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Spinner, Button, Modal, Card } from "react-bootstrap";
import { FaArrowLeft, FaBookOpen, FaClipboardList } from "react-icons/fa";

const CurriculumAssign = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = sessionStorage.getItem("token");

  const [subjects, setSubjects] = useState([]);
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [selectedToAssign, setSelectedToAssign] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [subjectToRemove, setSubjectToRemove] = useState(null);

  useEffect(() => {
    if (!token) navigate("/login");
    fetchSubjects();
    fetchAssignedSubjects();
  }, [token, navigate]);

  const fetchSubjects = async () => {
    try {
      const res = await fetch("http://localhost:3001/esf10/subjects/view-all-subjects", {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setSubjects(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAssignedSubjects = async () => {
    try {
      const res = await fetch(
        `http://localhost:3001/esf10/curriculum/curriculum-subjects/${id}`,
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) setAssignedSubjects(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSelect = (subject_id) => {
    setSelectedToAssign((prev) =>
      prev.includes(subject_id)
        ? prev.filter((id) => id !== subject_id)
        : [...prev, subject_id]
    );
  };

  const assignSubjects = async () => {
    if (!selectedToAssign.length) return setMessage("⚠️ Select at least one subject.");
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:3001/esf10/curriculum/add-subjects/${id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ subject_ids: selectedToAssign }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setMessage(`✅ ${data.message}`);
        setSelectedToAssign([]);
        fetchAssignedSubjects();
      } else setMessage("❌ Failed to assign subjects.");
    } catch (err) {
      console.error(err);
      setMessage("❌ Error occurred while assigning subjects.");
    } finally {
      setLoading(false);
    }
  };

  const confirmRemoveSubject = (id) => {
    setSubjectToRemove(id);
    setShowConfirm(true);
  };

  const removeSubject = async () => {
    setShowConfirm(false);
    if (!subjectToRemove) return;
    try {
      const res = await fetch(
        `http://localhost:3001/esf10/curriculum/remove-subject/${id}/${subjectToRemove}`,
        { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) {
        setMessage("✅ Subject removed successfully!");
        fetchAssignedSubjects();
      } else setMessage("❌ Failed to remove subject.");
    } catch (err) {
      console.error(err);
      setMessage("❌ Error occurred while removing subject.");
    } finally {
      setSubjectToRemove(null);
    }
  };

  // Filter subjects that are not assigned yet
  const availableSubjects = subjects.filter(
    (s) => !assignedSubjects.some((a) => a.subject_id === s.subject_id)
  );

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
                <Button
                  size="sm"
                  variant="outline-danger"
                  onClick={() => confirmRemoveSubject(subj.subject_id)}
                >
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
        <Card.Footer className="text-end">
          <Button variant="success" onClick={assignSubjects} disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : "Assign Selected"}
          </Button>
           <Button
          type="button"
          className="btn btn-light border rounded-3"
          onClick={() => navigate(-1)}
        >
          <FaArrowLeft className="me-1" /> Back
        </Button>
        </Card.Footer>
      </Card>

      {/* Feedback Message */}
      {message && <div className="alert alert-info mt-3" style={{ whiteSpace: "pre-line" }}>{message}</div>}

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
