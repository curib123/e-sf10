import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaCheck, FaTimes,FaArrowLeft } from "react-icons/fa";

const AssignSubjectsForm = () => {
  const navigate = useNavigate();
  const [gradeLevels, setGradeLevels] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [formData, setFormData] = useState({
    grade_level_id: 0,
    assignments: [],
  });
  const [message, setMessage] = useState({ text: "", type: "" });
  const [selectAll, setSelectAll] = useState(false);
  const token = sessionStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };

  // Fetch grade levels
  useEffect(() => {
    const fetchGradeLevels = async () => {
      try {
        const res = await fetch("http://localhost:3001/esf10/grade-levels", { headers });
        const data = await res.json();
        if (data.success) setGradeLevels(data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchGradeLevels();
  }, [token]);

  // Fetch all subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await fetch("http://localhost:3001/esf10/subjects/view-all-subjects", { headers });
        const data = await res.json();
        if (data.success) {
          setAllSubjects(
            data.data.map(subj => ({
              subject_id: subj.subject_id,
              subject_code: subj.subject_code,
              subject_name: subj.subject_name,
              units: "", // keep as string to allow typing
              is_required: false,
            }))
          );
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSubjects();
  }, [token]);

  // Fetch assigned subjects for selected grade level
  useEffect(() => {
    if (!formData.grade_level_id) {
      setAssignedSubjects([]);
      return;
    }

    const fetchAssignedSubjects = async () => {
      try {
        const res = await fetch(
          `http://localhost:3001/esf10/subject-grade-levels/by-grade-level/${formData.grade_level_id}`,
          { headers }
        );
        const data = await res.json();
        if (data.success) {
          setAssignedSubjects(data.data.map(a => a.subject.subject_code));
        } else {
          setAssignedSubjects([]);
        }
      } catch (err) {
        console.error(err);
        setAssignedSubjects([]);
      }
    };

    fetchAssignedSubjects();
    setFormData(prev => ({ ...prev, assignments: [] }));
    setSelectAll(false);
  }, [formData.grade_level_id]);

  const handleSelectSubject = (subject, checked) => {
    if (checked) {
      setFormData(prev => ({ ...prev, assignments: [...prev.assignments, { ...subject }] }));
    } else {
      setFormData(prev => ({
        ...prev,
        assignments: prev.assignments.filter(a => a.subject_id !== subject.subject_id),
      }));
    }
  };

  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    if (checked) {
      const unassignedSubjects = allSubjects.filter(subj => !assignedSubjects.includes(subj.subject_code));
      setFormData(prev => ({ ...prev, assignments: unassignedSubjects.map(subj => ({ ...subj })) }));
    } else {
      setFormData(prev => ({ ...prev, assignments: [] }));
    }
  };

  // Store the input as string while typing
  const handleUpdateAssignment = (subject_id, field, value) => {
    setFormData(prev => ({
      ...prev,
      assignments: prev.assignments.map(a => (a.subject_id === subject_id ? { ...a, [field]: value } : a)),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.grade_level_id || formData.assignments.length === 0) {
      setMessage({ text: "Select grade and at least one subject", type: "danger" });
      return;
    }
    try {
      const res = await fetch("http://localhost:3001/esf10/subject-grade-levels/bulk-create", {
        method: "POST",
        headers,
        body: JSON.stringify({
          assignments: formData.assignments.map(a => ({
            subject_id: a.subject_id,
            grade_level_id: formData.grade_level_id,
            is_required: a.is_required,
            units: Number(a.units) || 0,
          }))
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: data.message, type: "success" });
        setFormData({ grade_level_id: 0, assignments: [] });
        setSelectAll(false);
        setAssignedSubjects([]);
      } else {
        setMessage({ text: data.message || "Failed to assign subjects", type: "danger" });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: "Error occurred while assigning subjects", type: "danger" });
    }
  };

  return (
    <div className="container mt-5">
    {/* Page Header */}
<div className="text-center mb-5">
  <h3 className="fw-bold text-primary mb-2">Assign Subjects to Grade Level</h3>
  <p className="text-muted mb-0">
    Assign and manage subjects for each grade or year level efficiently.
  </p>
</div>

      {message.text && (
        <div className={`alert alert-${message.type} text-center`} role="alert">
          {message.text}
        </div>
      )}

      <div className="card shadow-sm p-4">
        <form onSubmit={handleSubmit}>
          {/* Grade Selector */}
          <div className="mb-3">
            <label className="form-label fw-semibold">Select Grade Level</label>
            <select
              className="form-select"
              value={formData.grade_level_id}
              onChange={(e) => setFormData({ ...formData, grade_level_id: Number(e.target.value) })}
            >
              <option value={0}>Select Grade</option>
              {gradeLevels.map(g => (
                <option key={g.grade_level_id} value={g.grade_level_id}>{g.grade_name} ({g.grade_code})</option>
              ))}
            </select>
          </div>

          {/* Subjects Table */}
          <div className="table-responsive">
            <table className="table table-hover table-bordered align-middle">
              <thead className="table-light sticky-top">
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      disabled={allSubjects.filter(subj => !assignedSubjects.includes(subj.subject_code)).length === 0}
                    />
                  </th>
                  <th>Code</th>
                  <th>Subject Name</th>
                  <th>Units</th>
                  <th>Required</th>
                </tr>
              </thead>
              <tbody>
                {allSubjects
                  .filter(subj => !assignedSubjects.includes(subj.subject_code))
                  .map(subj => {
                    const selected = formData.assignments.find(a => a.subject_id === subj.subject_id);
                    return (
                      <tr key={subj.subject_id} className={selected ? "table-primary" : ""}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!selected}
                            onChange={(e) => handleSelectSubject(subj, e.target.checked)}
                          />
                        </td>
                        <td className="fw-semibold">{subj.subject_code}</td>
                        <td>{subj.subject_name}</td>
                        <td>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            value={selected ? selected.units : ""}
                            onChange={(e) => handleUpdateAssignment(subj.subject_id, "units", e.target.value)}
                            disabled={!selected}
                          />
                        </td>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={selected ? selected.is_required : subj.is_required}
                            onChange={(e) => handleUpdateAssignment(subj.subject_id, "is_required", e.target.checked)}
                            disabled={!selected}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
<div className="d-flex justify-content-end mt-3 gap-2">
  <button type="submit" className="btn btn-success" disabled={formData.grade_level_id === 0}>
    <FaCheck className="me-1" /> Assign Subjects
  </button>
  <button type="button" className="btn btn-secondary" onClick={() => {
    setFormData({ grade_level_id: 0, assignments: [] });
    setSelectAll(false);
    setAssignedSubjects([]);
  }}>
    <FaTimes className="me-1" /> Reset
  </button>
  <button
    type="button"
    className="btn btn-light border rounded-3"
    onClick={() => navigate(-1)}
  >
    <FaArrowLeft className="me-1" /> Back
  </button>
</div>

        </form>
      </div>
    </div>
  );
};

export default AssignSubjectsForm;
