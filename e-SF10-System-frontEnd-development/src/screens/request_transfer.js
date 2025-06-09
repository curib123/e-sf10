import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { checkToken } from '../components/token_checker'; 

const RequestTransferForm = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

    useEffect(() => {
              checkToken();
             }, []);
       

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem("token");
    if (!token) return setError("Missing token. Please log in again.");

    setLoading(true);
    setMessage("");
    setError("");

    

    try {
      const response = await axios.post(
        "http://localhost:3001/esf10/transfer-request/create-request",
        {
          student_id: parseInt(studentId),
          requesting_school: schoolName,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        setMessage("✅ Transfer request created successfully.");
        setTimeout(() => navigate("/student_information"), 2000);
      } else {
        setError("❌ Failed to create transfer request.");
      }
    } catch (err) {
      console.error(err);
      setError("❌ An error occurred while sending the request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid py-5">
      <div className="card shadow-sm border-0 mx-auto" style={{ maxWidth: "1000" }}>
        <div className="card-body p-4">
          <h4 className="mb-3 fw-bold text-success">Student Transfer Request</h4>
          <p className="text-muted">Submit a request to transfer a student to another school.</p>
          <form onSubmit={handleSubmit}>
           
            <div className="mb-3">
              <label className="form-label fw-semibold">Requesting School Name <span className="text-danger">*</span></label>
              <input
                type="text"
                className="form-control rounded-pill px-3 py-2"
                placeholder="e.g. Tagum Sur High School"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                required
              />
            </div>

            
            {message && <div className="alert alert-success rounded-pill text-center py-2">{message}</div>}
            {error && <div className="alert alert-danger rounded-pill text-center py-2">{error}</div>}

            <div className="d-flex justify-content-between mt-4">
              <button
                type="button"
                className="btn btn-outline-secondary rounded-pill px-4"
                onClick={() => navigate(-1)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-success rounded-pill px-4"
                disabled={loading}
              >
                {loading ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RequestTransferForm;
