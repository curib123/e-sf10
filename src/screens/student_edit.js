import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AddStudent from "./student_form";
import StatusModal from "../components/status_modal";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

export default function StudentEdit() {
  const { lrn } = useParams();
  const navigate = useNavigate();

  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusModal, setStatusModal] = useState({ show: false, title: "", message: "", variant: "info" });

  const token = sessionStorage.getItem("token");

  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: "Unauthorized", message: "Access denied. Please log in.", variant: "danger" });
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 1500);
  };

  useEffect(() => {
    if (!token) {
      handleUnauthorized();
      return;
    }

    const fetchStudent = async () => {
      try {
        const res = await fetch(`${BASE_URL}/students/${lrn}/details`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to fetch student.");

        const data = await res.json();
        setStudentData(data.student || null);
      } catch (err) {
        setStatusModal({ show: true, title: "Error", message: err.message, variant: "danger" });
      } finally {
        setLoading(false);
      }
    };

    if (lrn) fetchStudent();
  }, [lrn, token, navigate]);

  return (
    <div className="container-fluid mt-4">
      {loading ? (
        <p>Loading student data...</p>
      ) : studentData ? (
        <AddStudent initialData={studentData} onSubmit={(updated) => console.log("Updated:", updated)} />
      ) : (
        <p className="text-center text-muted">Student not found.</p>
      )}

      <StatusModal {...statusModal} onHide={() => setStatusModal({ ...statusModal, show: false })} />
    </div>
  );
}
