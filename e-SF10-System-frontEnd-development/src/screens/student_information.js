import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaSearch } from "react-icons/fa";
import axios from "axios";
import { checkToken } from '../components/token_checker'; 
import { getUserPermissions } from '../components/get_permission'; 

const StudentInformation = () => {
  // === State Management ===
  const [students, setStudents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [permissions, setPermissions] = useState([]);

  // === Utility Function ===
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append("page", currentPage);
    params.append("limit", limit);
    return params.toString();
  };

   useEffect(() => {
                checkToken();
               }, []);
               
  // === Effects ===
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

  // === Data Fetching ===
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
      setStudents(Array.isArray(data) ? data : []);
      setTotal(data.length || 0);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error searching students:", error);
      setStudents([]);
      setTotal(0);
    } finally {
      setSearchLoading(false);
    }
  };

  // === Handlers ===
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setCurrentPage(1);

    if (value.trim() === "") {
      setIsSearching(false);
      fetchStudents();
    }
  };

  // === Render ===
  return (
    <div className="container-fluid my-1">
      {/* Search and Add Student */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-4">
        {/* Search Input */}
        <div className="position-relative flex-grow-1" style={{ maxWidth: "600px" }}>
          <FaSearch className="position-absolute" style={{
            top: "50%",
            left: "16px",
            transform: "translateY(-50%)",
            color: "#6c757d",
            fontSize: "20px"
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

        {/* Add Student Button */}
        {permissions.register_student ? (
          <Link to="/add_student" className="btn d-flex align-items-center gap-2 px-4 py-2 rounded-pill shadow text-white fw-semibold"
            style={{
              background: "linear-gradient(135deg, #28a745, #85e89d)",
              boxShadow: "0 4px 12px rgba(40, 167, 69, 0.5)",
              border: "none"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "linear-gradient(135deg, #218838, #70d870)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "linear-gradient(135deg, #28a745, #85e89d)")}
          >
            <FaPlus /> Add Student
          </Link>
        ) : (
          <button disabled className="btn d-flex align-items-center gap-2 px-4 py-2 rounded-pill shadow text-white fw-semibold"
            style={{
              background: "linear-gradient(135deg, #ccc, #ddd)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              cursor: "not-allowed",
              opacity: 0.6
            }}
            title="You don't have permission to add students"
          >
            <FaPlus /> Add Student
          </button>
        )}
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
                    <tr
                      key={student.lrn}
                      style={{ cursor: "default", transition: "background-color 0.3s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e9f7ef")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <td className="text-muted fw-medium">{student.lrn}</td>
                      <td>{student.last_name}</td>
                      <td>{student.first_name}</td>
                      <td>{student.middle_name}</td>
                      <td>{student.gender}</td>
                      <td>{student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("en-CA") : ""}</td>
                      <td>
                        <div className="d-flex flex-wrap gap-1 justify-content-center">
                          {/* Edit */}
                          {permissions.edit_student_info ? (
                            <Link to={`/edit_student/${student.lrn}`} className="btn btn-sm btn-outline-success rounded-pill px-3 fw-semibold"
                              style={{ minWidth: "70px" }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#28a745";
                                e.currentTarget.style.color = "#fff";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "transparent";
                                e.currentTarget.style.color = "#198754";
                              }}
                            >
                              Edit
                            </Link>
                          ) : (
                            <button disabled className="btn btn-sm btn-outline-success rounded-pill px-3 fw-semibold"
                              style={{ minWidth: "70px", cursor: "not-allowed", opacity: 0.6 }}
                              title="Disabled"
                            >
                              Edit
                            </button>
                          )}

                          {/* Records */}
                          {permissions.view_student_info ? (
                            <Link to={`/record_student/${student.lrn}`} className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-semibold"
                              style={{ minWidth: "70px" }}
                            >
                              Records
                            </Link>
                          ) : (
                            <button disabled className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-semibold"
                              style={{ minWidth: "70px", cursor: "not-allowed", opacity: 0.6 }}
                              title="Disabled"
                            >
                              Records
                            </button>
                          )}

                          {/* Upload E-SF10 */}
                          {permissions.upload_documents ? (
                            <Link to={`/upload_ecards/${student.lrn}`} className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold"
                              style={{ minWidth: "80px" }}
                            >
                              Upload E-SF10
                            </Link>
                          ) : (
                            <button disabled className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold"
                              style={{ minWidth: "80px", cursor: "not-allowed", opacity: 0.6 }}
                              title="Disabled"
                            >
                              Upload E-SF10
                            </button>
                          )}

                          {/* Request Transfer */}
                          {permissions.request_transfers ? (
                            <Link to={`/request_transfer/${student.student_id}`} className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold"
                              style={{ minWidth: "80px" }}
                            >
                              Request Transfer
                            </Link>
                          ) : (
                            <button disabled className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold"
                              style={{ minWidth: "80px", cursor: "not-allowed", opacity: 0.6 }}
                              title="Disabled"
                            >
                              Request Transfer
                            </button>
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
                <button className="page-link" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}>
                  &laquo;
                </button>
              </li>
              {Array.from({ length: totalPages }, (_, i) => (
                <li key={i} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                  <button className="page-link" onClick={() => setCurrentPage(i + 1)}>
                    {i + 1}
                  </button>
                </li>
              ))}
              <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}>
                  &raquo;
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
};

export default StudentInformation;
