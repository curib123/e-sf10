

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaSearch } from "react-icons/fa";
import axios from "axios";
import { checkToken } from '../components/token_checker'; 
import { getUserPermissions } from '../components/get_permission'; 

const StudentInformation = () => {
  const [students, setStudents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [permissions, setPermissions] = useState([]);

  // === Bulk Upload State ===
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append("page", currentPage);
    params.append("limit", limit);
    return params.toString();
  };

  useEffect(() => { checkToken(); }, []);

  useEffect(() => {
    const perms = getUserPermissions();
    setPermissions(perms);
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      searchStudents(searchQuery);
    } else {
      fetchStudents();
    }
  }, [currentPage, searchQuery]);

  const fetchStudents = async () => {
    setIsSearching(false);
    const token = sessionStorage.getItem("token");
    if (!token) return;

    try {
      const response = await axios.get(
        `http://localhost:3001/esf10/students/all?${buildQueryParams()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = response.data;
      setStudents(data.students || []);
      setTotalPages(data.totalPages || 1);
      setLimit(data.limit || 10);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Error fetching students:", error);
      setStudents([]);
    }
  };

  const searchStudents = async (query) => {
  setIsSearching(true);
  setSearchLoading(true);
  const token = sessionStorage.getItem("token");
  if (!token) return;

  try {
    const response = await axios.get(
      `http://localhost:3001/esf10/students/search?query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = response.data;
    setStudents(Array.isArray(data) ? data.slice(0, 5) : []); // Show only first 10
    setTotal(data.length || 0); // Optional: if you want total for pagination info
    setCurrentPage(1);
  } catch (error) {
    console.error("Error searching students:", error);
    setStudents([]);
    setTotal(0);
  } finally {
    setSearchLoading(false);
  }
};


  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setCurrentPage(1);
    if (value.trim() === "") {
      setIsSearching(false);
      fetchStudents();
    }
  };

  // === Bulk Upload Handlers ===
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    const token = sessionStorage.getItem("token");
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await axios.post(
        "http://localhost:3001/esf10/students/bulk-register",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data"
          },
        }
      );
      setUploadStatus("success");
      setUploadResult(response.data);
      fetchStudents();
    } catch (error) {
      setUploadStatus("error");
      setUploadResult(error.response?.data || { message: "Upload failed." });
    }
  };

  return (
    <div className="container-fluid my-1">
      {/* Search and Buttons */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-4">
        {/* Search Input */}
        <div className="position-relative flex-grow-1" style={{ maxWidth: "600px" }}>
          <FaSearch className="position-absolute" style={{
            top: "50%", left: "16px", transform: "translateY(-50%)", color: "#6c757d", fontSize: "20px"
          }} />
          <input
            type="text"
            disabled={!permissions.search_student}
            className="form-control ps-5 py-3 rounded-pill shadow-sm border-0"
            placeholder="Search by LRN or names"
            value={searchQuery}
            onChange={handleSearchChange}
            style={{
              backgroundColor: "#fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              transition: "box-shadow 0.25s ease",
            }}
            onFocus={(e) => (e.target.style.boxShadow = "0 0 8px 2px rgba(56, 176, 0, 0.5)")}
            onBlur={(e) => (e.target.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)")}
          />
        </div>

        {/* Add + Upload Buttons */}
        <div className="d-flex gap-2">
          {permissions.register_student && (
          <>
  {/* Outline → Fill (Green) on Hover */}
  <button
    className="btn btn-outline-success fw-semibold rounded-pill px-4 py-2 d-flex align-items-center gap-2 shadow-sm"
    onClick={() => setShowUploadModal(true)}
  >
    <i className="bi bi-upload"></i>
    Bulk Upload Student (Excel)
  </button>

  {/* Fill (Blue) Button */}
  <Link
    to="/add_student"
    className="btn btn-primary d-flex align-items-center gap-2 px-4 py-2 rounded-pill shadow fw-semibold"
  >
    <FaPlus /> Add New Student
  </Link>
</>

          )}
        </div>
      </div>

      {/* Table */}
      <div className="card shadow border-0 rounded-3" style={{ overflow: "hidden" }}>
        <div className="card-body p-0">
          <div className="table-responsive shadow-sm rounded border">
            <table className="table table-hover table-striped align-middle mb-0">
              <thead className="table-dark text-center">
                <tr>
                  <th>LRN</th>
                  <th>Last Name</th>
                  <th>First Name</th>
                  <th>Middle Name</th>
                  <th>Gender</th>
                  <th>Date of Birth</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {searchLoading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5">
                      <div className="spinner-border text-success" role="status" />
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted fst-italic">
                      No students found.
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.lrn}>
                      <td className="text-muted fw-medium">{student.lrn}</td>
                      <td>{student.last_name}</td>
                      <td>{student.first_name}</td>
                      <td>{student.middle_name}</td>
                      <td>{student.gender}</td>
                      <td>{student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("en-CA") : ""}</td>
                      <td>
                        <div className="d-flex flex-wrap gap-1 justify-content-center">
                          {permissions.edit_student_info ? (
                            <Link to={`/edit_student/${student.lrn}`} className="btn btn-sm btn-outline-success rounded-pill px-3 fw-semibold">Edit</Link>
                          ) : (
                            <button disabled className="btn btn-sm btn-outline-success rounded-pill px-3 fw-semibold">Edit</button>
                          )}
                          {permissions.view_student_info ? (
                            <Link to={`/record_student/${student.lrn}`} className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-semibold">Records</Link>
                          ) : (
                            <button disabled className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-semibold">Records</button>
                          )}
                          {permissions.upload_documents ? (
                            <Link to={`/upload_ecards/${student.lrn}`} className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold">Upload E-SF10</Link>
                          ) : (
                            <button disabled className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold">Upload E-SF10</button>
                          )}
                          {permissions.request_transfers ? (
                            <Link to={`/request_transfer/${student.student_id}`} className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold">Request Transfer</Link>
                          ) : (
                            <button disabled className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold">Request Transfer</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {!isSearching && (
        <div className="d-flex justify-content-between align-items-center mt-4">
          <small className="text-muted fst-italic">
            Showing {students.length} of {total} students
          </small>
          <nav>
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}>&laquo;</button>
              </li>
              {Array.from({ length: totalPages }, (_, i) => (
                <li key={i} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                  <button className="page-link" onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
                </li>
              ))}
              <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}>&raquo;</button>
              </li>
            </ul>
          </nav>
        </div>
      )}

      
{/* Bulk Upload Modal */}
{showUploadModal && (
  <div
    className="modal fade show d-block"
    tabIndex="-1"
    style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
  >
    <div className="modal-dialog modal-lg modal-dialog-centered">
      <div className="modal-content rounded-4 shadow-lg border-0">
        <div className="modal-header bg-light rounded-top-4 px-4">
          <h5 className="modal-title fw-semibold">
            <i className="bi bi-upload me-2 text-success"></i>
            Bulk Student Upload
          </h5>
          <button
            type="button"
            className="btn-close"
            onClick={() => {
              setShowUploadModal(false);
              setSelectedFile(null);
              setUploadStatus(null);
              setUploadResult(null);
            }}
          ></button>
        </div>

        {/* Scrollable Body */}
        <div
          className="modal-body px-4 py-3"
          style={{ maxHeight: "65vh", overflowY: "auto" }}
        >
          <div className="mb-4">
            <p className="mb-2">📥 Download the official template:</p>
            <a
              href="http://localhost:3001/esf10/generate-excel"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-primary btn-sm"
            >
              <i className="bi bi-file-earmark-excel me-1"></i>
              Download Template
            </a>

            <div className="alert alert-info mt-3 small">
              <strong className="d-block mb-1">📝 Upload Guidelines:</strong>
              <ul className="mb-0">
                <li>Do not change column headers.</li>
                <li>Each LRN must be unique and valid.</li>
                <li>Use <code>YYYY-MM-DD</code> for dates.</li>
                <li>Only <code>Male</code> or <code>Female</code> as gender.</li>
                <li>Leave middle name empty if not available.</li>
              </ul>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label fw-medium">Choose Excel File</label>
            <input
              type="file"
              accept=".xlsx"
              className="form-control"
              onChange={handleFileChange}
            />
          </div>
             {/* ✅ Successfully Uploaded */}
{uploadResult.successful?.length > 0 && (
  <p className="mb-2 mt-2 text-success">
    ✅ Successfully uploaded rows:{" "}
    <strong>
      {uploadResult.successful.length > 1
        ? `${uploadResult.successful[0]?.row}–${uploadResult.successful[uploadResult.successful.length - 1]?.row}`
        : `${uploadResult.successful[0]?.row}`}
    </strong>
  </p>
)}

{/* ⚠️ Skipped Rows */}
{uploadResult.skipped?.length > 0 && (
  <div className="mt-2 text-warning small">
    <strong>⚠️ Skipped rows due to something wrong check it:</strong>
    <ul className="mb-0">
      {uploadResult.skipped.map((entry, i) => (
        <li key={i}>
         <em>{entry}</em>
        </li>
      ))}
    </ul>
  </div>
)}

{/* ❌ Errors */}
{uploadResult.errors?.length > 0 && (
  <div className="mt-3 text-danger small">
    <strong>❌ Validation/Database Errors:</strong>
    <ul className="mb-0">
      {uploadResult.errors
        .filter((err) => {
          const rowNum = parseInt(err.match(/Row\s+(\d+)/)?.[1], 10);
          return (
            !uploadResult.successful?.some((s) => s.row === rowNum) &&
            !uploadResult.skipped?.some((s) => s.row === rowNum)
          );
        })
        .map((err, i) => (
          <li key={i}>{err}</li>
        ))}
    </ul>
  </div>
)}

{/* General Upload Error */}
{uploadStatus === "error" && (
  <div className="alert alert-danger mt-4">
    <strong>❌ {uploadResult?.message || "Upload failed."}</strong>
  </div>
)}

        </div>

        <div className="modal-footer bg-light rounded-bottom-4 border-0 px-4 py-3">
          <button
            className="btn btn-outline-secondary"
            onClick={() => setShowUploadModal(false)}
          >
            <i className="bi bi-x-circle me-1"></i> Cancel
          </button>
          <button
            className="btn btn-success"
            disabled={!selectedFile}
            onClick={handleUpload}
          >
            <i className="bi bi-upload me-1"></i> Upload
          </button>
        </div>
      </div>
    </div>
  </div>
)}


    </div>
  );
};

export default StudentInformation;
