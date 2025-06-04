import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaSearch } from "react-icons/fa";
import axios from "axios";

const StudentInformationSimple = () => {
  const [students, setStudents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append("page", currentPage);
    params.append("limit", limit);
    return params.toString();
  };

  useEffect(() => {
    if (searchQuery.trim()) {
      searchStudents(searchQuery);
    } else {
      fetchStudents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchQuery]);

  const fetchStudents = async () => {
    setIsSearching(false);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await axios.get(`http://localhost:3001/esf10/students/all?${buildQueryParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await axios.get(`http://localhost:3001/esf10/students/search?query=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data;
      setStudents(Array.isArray(data) ? data : []);
      setTotalPages(1);
      setTotal(data.length || 0);
      setLimit(data.length || 10);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error searching students:", error);
      setStudents([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

 return (
  <div className="container-fluid my-5">
    {/* Search + Add Student Row */}
    <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-4">
      {/* Search Bar */}
      <div className="position-relative flex-grow-1" style={{ maxWidth: "400px" }}>
        <FaSearch
          className="position-absolute"
          style={{
            top: "50%",
            left: "16px",
            transform: "translateY(-50%)",
            color: "#888",
            fontSize: "18px",
          }}
        />
        <input
          type="text"
          className="form-control ps-5 py-2 rounded-pill shadow-sm border-0"
          placeholder="Search by LRN..."
          value={searchQuery}
          onChange={handleSearchChange}
          style={{
            backgroundColor: "#fff",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            transition: "box-shadow 0.25s ease",
          }}
          onFocus={(e) => (e.target.style.boxShadow = "0 4px 12px rgba(56, 176, 0, 0.4)")}
          onBlur={(e) => (e.target.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)")}
        />
      </div>

      {/* Add Student Button */}
      <Link
        to="/add_student"
        className="btn d-flex align-items-center gap-2 px-4 py-2 rounded-pill shadow"
        style={{
          background: "linear-gradient(135deg, #38b000, #70e000)",
          color: "#fff",
          fontWeight: "600",
          fontSize: "15px",
          boxShadow: "0 4px 12px rgba(56, 176, 0, 0.5)",
          border: "none",
          transition: "background 0.3s ease",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "linear-gradient(135deg, #2f8e00, #58c300)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "linear-gradient(135deg, #38b000, #70e000)")
        }
      >
        <FaPlus />
        Add Student
      </Link>
    </div>

    {/* Table Card */}
    <div
      className="card shadow border-0 rounded-3"
      style={{ overflow: "hidden", boxShadow: "0 6px 18px rgba(0,0,0,0.08)" }}
    >
      <div className="card-body p-0">
         {/* Table */}
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
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e6f2e6")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <td className="text-muted fw-medium">{student.lrn}</td>
                    <td>{student.last_name}</td>
                    <td>{student.first_name}</td>
                    <td>{student.middle_name}</td>
                    <td>{student.gender}</td>
                    <td>{student.date_of_birth.split("T")[0]}</td>
                   <td>
  <div className="d-flex flex-wrap gap-3 justify-content-center">
    <Link
      to={`/edit_student/${student.lrn}`}
      className="btn btn-sm btn-outline-success rounded-pill px-3 fw-semibold"
      style={{ minWidth: "70px", textDecoration: "none" }}
    >
      Edit
    </Link>
    <button
      className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-semibold"
      style={{ minWidth: "70px" }}
    >
      Records
    </button>
    <button
      className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold"
      style={{ minWidth: "100px" }}
    >
      Upload E-SF10
    </button>
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

    {!isSearching && (
      <div className="d-flex justify-content-between align-items-center mt-4">
        <small className="text-muted fst-italic">
          Showing {students.length} of {total} students
        </small>
        <nav>
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
              <button
                className="page-link"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                aria-label="Previous Page"
              >
                &laquo;
              </button>
            </li>
            {Array.from({ length: totalPages }, (_, i) => (
              <li key={i} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                <button
                  className="page-link"
                  onClick={() => setCurrentPage(i + 1)}
                  aria-current={currentPage === i + 1 ? "page" : undefined}
                >
                  {i + 1}
                </button>
              </li>
            ))}
            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
              <button
                className="page-link"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                aria-label="Next Page"
              >
                &raquo;
              </button>
            </li>
          </ul>
        </nav>
      </div>
    )}
  </div>
);
}


export default StudentInformationSimple;
