import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Spinner, Button, Modal, Card, Form, InputGroup } from "react-bootstrap";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const CurriculumAssign = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);

  const [subjects, setSubjects] = useState([]);
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [selectedToAssign, setSelectedToAssign] = useState([]);
  const [loading, setLoading] = useState(false);

  const [statusModal, setStatusModal] = useState({ show: false, title: "", message: "", variant: "info" });
  const [showConfirm, setShowConfirm] = useState(false);
  const [subjectToRemove, setSubjectToRemove] = useState(null);

  // simple search (kept inside Available card)
  const [query, setQuery] = useState("");

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: "Unauthorized", message: "Please log in.", variant: "danger" });
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 900);
  };

  useEffect(() => {
    if (!token) return handleUnauthorized();
    fetchSubjects();
    fetchAssignedSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`${BASE_URL}/subjects/view-all-subjects`, { headers });
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      if (data?.success) setSubjects(data.data || []);
    } catch {
      setStatusModal({ show: true, title: "Error", message: "Failed to load subjects.", variant: "danger" });
    }
  };

  const fetchAssignedSubjects = async () => {
    try {
      const res = await fetch(`${BASE_URL}/curriculum/curriculum-subjects/${id}`, { headers });
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      if (data?.success) setAssignedSubjects(data.data || []);
    } catch {
      setStatusModal({ show: true, title: "Error", message: "Failed to load assigned subjects.", variant: "danger" });
    }
  };

  // available = all - assigned
  const availableSubjects = subjects.filter(
    (s) => !assignedSubjects.some((a) => a.subject_id === s.subject_id)
  );

  const filteredAvailable = query.trim()
    ? availableSubjects.filter((s) =>
        `${s.subject_name ?? ""} ${s.subject_code ?? ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      )
    : availableSubjects;

  const toggleSelect = (subject_id) => {
    setSelectedToAssign((prev) =>
      prev.includes(subject_id) ? prev.filter((i) => i !== subject_id) : [...prev, subject_id]
    );
  };

  const assignSubjects = async () => {
    if (!selectedToAssign.length) {
      return setStatusModal({
        show: true,
        title: "Select subjects",
        message: "Pick at least one subject to assign.",
        variant: "warning",
      });
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/curriculum/add-subjects/${id}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ subject_ids: selectedToAssign }),
      });
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      if (data?.success) {
        setStatusModal({ show: true, title: "Done", message: data.message || "Subjects assigned.", variant: "success" });
        setSelectedToAssign([]);
        await fetchAssignedSubjects();
      } else {
        setStatusModal({ show: true, title: "Error", message: data?.message || "Could not assign subjects.", variant: "danger" });
      }
    } catch {
      setStatusModal({ show: true, title: "Error", message: "Could not assign subjects.", variant: "danger" });
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
        headers,
      });
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      if (data?.success) {
        setStatusModal({ show: true, title: "Removed", message: "Subject removed.", variant: "success" });
        await fetchAssignedSubjects();
      } else {
        setStatusModal({ show: true, title: "Error", message: data?.message || "Could not remove subject.", variant: "danger" });
      }
    } catch {
      setStatusModal({ show: true, title: "Error", message: "Could not remove subject.", variant: "danger" });
    } finally {
      setSubjectToRemove(null);
    }
  };

  return (
    <div className="container-xxl py-3">
    

      {/* Assigned */}
      <Card className="shadow-sm border-0 rounded-4 mb-3">
        <Card.Header className="bg-white fw-semibold py-3 border-0">Assigned Subjects</Card.Header>
        <Card.Body className="p-0" style={{ maxHeight: 320, overflowY: "auto" }}>
          {assignedSubjects.length ? (
            <div className="list-group list-group-flush">
              {assignedSubjects.map((subj) => (
                <div
                  key={subj.subject_id}
                  className="list-group-item d-flex justify-content-between align-items-center"
                >
                  <div className="me-3">
                    <div className="fw-semibold">{subj.subject_name}</div>
                    <div className="text-muted small">{subj.subject_code}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    className="text-nowrap"
                    onClick={() => confirmRemoveSubject(subj.subject_id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted">No subjects assigned yet.</div>
          )}
        </Card.Body>
      </Card>

      {/* Available */}
      <Card className="shadow-sm border-0 rounded-4">
        <Card.Header className="bg-white fw-semibold py-3 border-0">Available Subjects</Card.Header>

        {/* simple search bar */}
        <div className="px-3 pb-2">
          <InputGroup>
            <Form.Control
              placeholder="Search code or name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <Button variant="outline-secondary" onClick={() => setQuery("")} className="text-nowrap">
                Clear
              </Button>
            )}
          </InputGroup>
        </div>

        <Card.Body className="p-0" style={{ maxHeight: 360, overflowY: "auto" }}>
          {filteredAvailable.length ? (
            <div className="list-group list-group-flush">
              {filteredAvailable.map((subj) => {
                const selected = selectedToAssign.includes(subj.subject_id);
                return (
                  <button
                    key={subj.subject_id}
                    type="button"
                    className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${selected ? "active" : ""}`}
                    onClick={() => toggleSelect(subj.subject_id)}
                    aria-pressed={selected}
                  >
                    <div className="me-3 text-start">
                      <div className="fw-semibold">{subj.subject_name}</div>
                      <div className={`small ${selected ? "text-white-50" : "text-muted"}`}>{subj.subject_code}</div>
                    </div>
                    <Form.Check type="checkbox" readOnly checked={selected} className="ms-2" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-muted">
              {availableSubjects.length ? "No matches for your search." : "No subjects available."}
            </div>
          )}
        </Card.Body>

        {/* Actions */}
        <Card.Footer className="d-flex justify-content-between align-items-center gap-2 border-0">
          <Button
            variant="success"
            className="text-nowrap px-3"
            onClick={assignSubjects}
            disabled={loading || selectedToAssign.length === 0}
          >
            {loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
            Assign Selected
          </Button>
          <Button variant="light" className="border text-nowrap px-3" onClick={() => navigate(-1)}>
            Back
          </Button>
        </Card.Footer>
      </Card>

      {/* Status Modal */}
      <StatusModal {...statusModal} onHide={() => setStatusModal((s) => ({ ...s, show: false }))} />

      {/* Confirm remove */}
      <Modal show={showConfirm} onHide={() => setShowConfirm(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Remove subject?</Modal.Title>
        </Modal.Header>
        <Modal.Body>This subject will be removed from the curriculum.</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={removeSubject}>Remove</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CurriculumAssign;
