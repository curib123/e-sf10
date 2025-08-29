import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const RequestTransferForm = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [schoolName, setSchoolName] = useState("");
  const [schoolSuggestions, setSchoolSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "success" });

  useEffect(() => { checkToken(); }, []);

  // Helper for authorized requests
  const request = async (method, url, data = null) => {
    const token = sessionStorage.getItem("token");
    if (!token) throw new Error("Missing authorization token. Please log in again.");
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: { Authorization: `Bearer ${token}` },
      data,
    };
    const res = await axios(config);
    return res.data;
  };

  const handleSchoolInputChange = async (e) => {
    const query = e.target.value;
    setSchoolName(query);

    if (query.length < 2) {
      setSchoolSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const data = await request("get", `/transfer-request/search-schools?query=${query}`);
      if (data.success && data.data.length > 0) {
        setSchoolSuggestions(data.data);
        setShowSuggestions(true);
      } else {
        setSchoolSuggestions([]);
        setShowSuggestions(false);
      }
    } catch {
      setSchoolSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setSchoolName(suggestion);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setModal({ show: false, title: "", message: "", variant: "success" });

    try {
      const data = await request("post", "/transfer-request/create-request", {
        student_id: parseInt(studentId),
        requesting_school: schoolName,
      });

      if (data.success) {
        setModal({ show: true, title: "Success", message: "✅ Transfer request created successfully.", variant: "success" });
        setTimeout(() => navigate("/student_information"), 2000);
      } else {
        setModal({ show: true, title: "Error", message: "❌ Failed to create transfer request.", variant: "danger" });
      }
    } catch (err) {
      setModal({ show: true, title: "Error", message: err.message || "❌ An error occurred while sending the request.", variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="card shadow-sm border-0 mx-auto" style={{ maxWidth: "600px" }}>
        <div className="card-body p-4">
          <h4 className="mb-3 fw-bold text-success">Student Transfer Request</h4>
          <p className="text-muted mb-4">Submit a request to transfer a student to another school.</p>

          <form onSubmit={handleSubmit}>
            <div className="mb-3 position-relative">
              <label className="form-label fw-semibold">
                Requesting School Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-control rounded-pill px-3 py-2"
                placeholder="e.g. Tagum Sur High School"
                value={schoolName}
                onChange={handleSchoolInputChange}
                onFocus={() => schoolSuggestions.length > 0 && setShowSuggestions(true)}
                required
              />
              {showSuggestions && (
                <ul className="list-group position-absolute w-100 z-100 shadow-sm" style={{ top: '100%', maxHeight: '200px', overflowY: 'auto', borderRadius: '0.5rem' }}>
                  {schoolSuggestions.map((school, index) => (
                    <li key={index} className="list-group-item list-group-item-action" onClick={() => handleSuggestionClick(school)} style={{ cursor: "pointer" }}>
                      {school}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="d-flex justify-content-between mt-4">
              <button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={() => navigate(-1)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-success rounded-pill px-4" disabled={loading}>
                {loading ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />
    </div>
  );
};

export default RequestTransferForm;
