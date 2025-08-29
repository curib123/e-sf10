import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaCheck, FaTimes, FaArrowLeft } from "react-icons/fa";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const AssignSubjectsForm = () => {
  const navigate = useNavigate();
  const [gradeLevels, setGradeLevels] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [formData, setFormData] = useState({ grade_level_id: 0, assignments: [] });
  const [selectAll, setSelectAll] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [showModal, setShowModal] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const token = sessionStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };

  // Fetch grade levels
  useEffect(() => {
    const fetchGradeLevels = async () => {
      try {
        const res = await fetch(`${BASE_URL}/grade-levels`, { headers });
        const data = await res.json();
        if (data.success) setGradeLevels(data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchGradeLevels();
  }, [token]);

  // Fetch assigned subjects and all subjects for selected grade level
  useEffect(() => {
    if (!formData.grade_level_id) {
      setAssignedSubjects([]);
      setAllSubjects([]);
      return;
    }

    const fetchAssignedSubjects = async () => {
      try {
        const res = await fetch(
          `${BASE_URL}/subject-grade-levels/by-grade-level/${formData.grade_level_id}`,
          { headers }
        );
        const data = await res.json();
        if (data.success) setAssignedSubjects(data.data.map(a => a.subject.subject_code));
        else setAssignedSubjects([]);
      } catch (err) {
        console.error(err);
        setAssignedSubjects([]);
      }
    };

    const fetchAllSubjects = async () => {
      try {
        const res = await fetch(`${BASE_URL}/subjects/view-all-subjects`, { headers });
        const data = await res.json();
        if (data.success) {
          let subjects = data.data.map(subj => ({
            subject_id: subj.subject_id,
            subject_code: subj.subject_code,
            subject_name: subj.subject_name,
            units: "",
            is_required: false,
          }));
          // filter out already assigned subjects
          subjects = subjects.filter(subj => !assignedSubjects.includes(subj.subject_code));
          setAllSubjects(subjects);
        }
      } catch (err) {
        console.error(err);
        setAllSubjects([]);
      }
    };

    fetchAssignedSubjects().then(fetchAllSubjects);

    setFormData(prev => ({ ...prev, assignments: [] }));
    setSelectAll(false);
    setCurrentPage(1);
  }, [formData.grade_level_id]);

  // Filter subjects by search query
  const filteredSubjects = allSubjects.filter(
    subj =>
      subj.subject_name.toLowerCase().includes(query.toLowerCase()) ||
      subj.subject_code.toLowerCase().includes(query.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredSubjects.length / itemsPerPage);
  const displayedSubjects = filteredSubjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
      setFormData(prev => ({ ...prev, assignments: displayedSubjects.map(subj => ({ ...subj })) }));
    } else {
      setFormData(prev => ({ ...prev, assignments: [] }));
    }
  };

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
      setShowModal(true);
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}/subject-grade-levels/bulk-create`, {
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
      setMessage({ text: data.message, type: data.success ? "success" : "danger" });
      setShowModal(true);
      if (data.success) {
        setFormData({ grade_level_id: 0, assignments: [] });
        setSelectAll(false);
        setAssignedSubjects([]);
        setAllSubjects([]);
        setQuery("");
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: "Error occurred while assigning subjects", type: "danger" });
      setShowModal(true);
    }
  };

  return (
    <div className="container">
    

      <StatusModal
        show={showModal}
        onHide={() => setShowModal(false)}
        message={message.text}
        type={message.type}
      />

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
                <option key={g.grade_level_id} value={g.grade_level_id}>
                  {g.grade_name} ({g.grade_code})
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Search subject..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setCurrentPage(1); }}
              disabled={formData.grade_level_id === 0}
            />
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
                      disabled={displayedSubjects.length === 0}
                    />
                  </th>
                  <th>Code</th>
                  <th>Subject Name</th>
                  <th>Units</th>
                  <th>Required</th>
                </tr>
              </thead>
              <tbody>
                {displayedSubjects.map(subj => {
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

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="d-flex justify-content-center mt-2">
              <ul className="pagination">
                <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                  <button className="page-link" onClick={() => setCurrentPage(prev => prev - 1)}>Prev</button>
                </li>
                {Array.from({ length: totalPages }, (_, i) => (
                  <li key={i} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                    <button className="page-link" onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
                  </li>
                ))}
                <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                  <button className="page-link" onClick={() => setCurrentPage(prev => prev + 1)}>Next</button>
                </li>
              </ul>
            </nav>
          )}

          {/* Action Buttons */}
          <div className="d-flex justify-content-end mt-3 gap-2">
            <button type="submit" className="btn btn-success" disabled={formData.grade_level_id === 0}>
              <FaCheck className="me-1" /> Assign Subjects
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => {
              setFormData({ grade_level_id: 0, assignments: [] });
              setSelectAll(false);
              setAssignedSubjects([]);
              setAllSubjects([]);
              setQuery("");
              setCurrentPage(1);
            }}>
              <FaTimes className="me-1" /> Reset
            </button>
            <button type="button" className="btn btn-light border rounded-3" onClick={() => navigate(-1)}>
              <FaArrowLeft className="me-1" /> Back
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignSubjectsForm;
