import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FaPlus,
  FaSearch,
  FaUpload,
  FaDownload,
  FaEdit,
  FaBookOpen,
  FaExchangeAlt,
  FaChevronLeft,
  FaChevronRight,
  FaUndo,
  FaTimes,
  FaUserGraduate,
  FaInfoCircle,
} from "react-icons/fa";
import axios from "axios";
import { checkToken } from "../components/token_checker";
import { getUserPermissions } from "../components/get_permission";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const StudentInformation = () => {
  const [students, setStudents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [permissions, setPermissions] = useState([]);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "success" });

  // UI-only filters (no API)
  const [genderFilter, setGenderFilter] = useState("All"); // All | Male | Female
  const [yearFilter, setYearFilter] = useState("All");     // All | YYYY

  const token = useMemo(() => sessionStorage.getItem("token"), []);

  useEffect(() => {
    checkToken();
    setPermissions(getUserPermissions());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedQuery) {
      searchStudents(debouncedQuery);
    } else {
      fetchStudents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedQuery]);

  const buildQueryParams = () => new URLSearchParams({ page: currentPage, limit }).toString();

  const fetchStudents = async () => {
    setIsSearching(false);
    if (!token) return;
    try {
      const { data } = await axios.get(`${BASE_URL}/students/all?${buildQueryParams()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(data.students || []);
      setTotalPages(data.totalPages || 1);
      setLimit(data.limit || 10);
      setTotal(data.total || 0);
    } catch {
      setStudents([]);
      setModal({
        show: true,
        title: "Error",
        message: "Failed to fetch students.",
        variant: "danger",
      });
    }
  };

  const searchStudents = async (query) => {
    setIsSearching(true);
    setSearchLoading(true);
    if (!token) return;
    try {
      const { data } = await axios.get(
        `${BASE_URL}/students/search?query=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const arr = Array.isArray(data) ? data : [];
      setStudents(arr.slice(0, 10));
      setTotal(arr.length || 0);
      setCurrentPage(1);
      setTotalPages(1);
    } catch {
      setStudents([]);
      setTotal(0);
      setModal({
        show: true,
        title: "Error",
        message: "Search failed.",
        variant: "danger",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  // Birth year options from loaded rows
  const birthYears = useMemo(() => {
    const set = new Set();
    for (const s of students) {
      if (s?.date_of_birth) {
        const y = new Date(s.date_of_birth).getFullYear();
        if (!isNaN(y)) set.add(y);
      }
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [students]);

  // Apply UI-only filters
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (genderFilter !== "All" && String(s?.gender || "").toLowerCase() !== genderFilter.toLowerCase()) return false;
      if (yearFilter !== "All") {
        const y = s?.date_of_birth ? new Date(s.date_of_birth).getFullYear() : null;
        if (String(y) !== String(yearFilter)) return false;
      }
      return true;
    });
  }, [students, genderFilter, yearFilter]);

  // Handlers
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };
  const handleFileChange = (e) => setSelectedFile(e.target.files[0]);
  const clearFilters = () => {
    setGenderFilter("All");
    setYearFilter("All");
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      await axios.post(`${BASE_URL}/students/bulk-register`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      setModal({ show: true, title: "Success", message: "Bulk upload successful.", variant: "success" });
      fetchStudents();
    } catch (error) {
      setModal({
        show: true,
        title: "Error",
        message: error.response?.data?.message || "Bulk upload failed.",
        variant: "danger",
      });
    } finally {
      setShowUploadModal(false);
      setSelectedFile(null);
    }
  };

  return (
    <div className="container-xxl my-4">
      <div className="card border-0 shadow-sm rounded-4">
        {/* HEADER: Bigger title, more padding */}
        <div className="card-header bg-white border-0 py-4 px-4 px-md-5">
          <div className="d-flex flex-wrap align-items-center">
            <div className="me-auto">
              <h2 className="mb-1 d-flex align-items-center gap-2 fw-bold">
                <FaUserGraduate aria-hidden="true" /> Students
              </h2>
              <p className="text-muted mb-0 d-flex align-items-center gap-2">
                <FaInfoCircle aria-hidden="true" className="opacity-75" />
                Manage student directory, quick search, and E-SF10 records.
              </p>
            </div>

            {permissions.register_student && (
              <div className="d-flex gap-2 mt-3 mt-sm-0">
                <button
                  className="btn btn-outline-success text-nowrap px-3 py-2 d-inline-flex align-items-center gap-2"
                  onClick={() => setShowUploadModal(true)}
                >
                  <FaUpload aria-hidden="true" /> Bulk Upload
                </button>
                <Link
                  to="/add_student"
                  className="btn btn-primary text-nowrap px-3 py-2 d-inline-flex align-items-center gap-2"
                >
                  <FaPlus aria-hidden="true" /> Add Student
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* SUB-HEADER: Search + Inline Filters */}
        <div className="px-4 px-md-5 pb-4">
          <div className="d-flex flex-wrap align-items-center gap-3">
            {/* Search */}
            <div className="flex-grow-1">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white border-end-0">
                  <FaSearch aria-hidden="true" />
                </span>
                <input
                  type="text"
                  disabled={!permissions.search_student}
                  className="form-control border-start-0"
                  placeholder="Search by LRN or Name"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  aria-label="Search students by LRN or Name"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary text-nowrap d-inline-flex align-items-center gap-2"
                    onClick={() => setSearchQuery("")}
                    title="Clear search"
                  >
                    <FaTimes aria-hidden="true" /> Clear
                  </button>
                )}
              </div>
              <div className="form-text mt-1">
                {isSearching
                  ? searchLoading
                    ? "Searching…"
                    : `${filteredStudents.length} match${filteredStudents.length === 1 ? "" : "es"} (after filters)`
                  : `Page ${currentPage} of ${totalPages} • ${total} total • showing ${filteredStudents.length} after filters`}
              </div>
            </div>

            {/* Filters — Gender & Birth Year only */}
            <div className="d-flex align-items-center flex-grow-0 flex-shrink-1 flex-wrap gap-2">
              <select
                className="form-select form-select-sm w-auto"
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                aria-label="Filter by gender"
                title="Filter by gender"
              >
                <option>All</option>
                <option>Male</option>
                <option>Female</option>
              </select>

              <select
                className="form-select form-select-sm w-auto"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                aria-label="Filter by birth year"
                title="Filter by birth year"
              >
                <option value="All">All</option>
                {birthYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2"
                onClick={clearFilters}
                title="Reset filters"
              >
                <FaUndo aria-hidden="true" /> Reset
              </button>
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-striped align-middle mb-0">
              <thead className="table-light">
                <tr className="align-middle">
                  {["LRN", "Last Name", "First Name", "Middle Name", "Gender", "Date of Birth", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-nowrap"
                        style={{ position: "sticky", top: 0, background: "var(--bs-light)" }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {searchLoading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5">
                      <div className="spinner-border text-primary" role="status" aria-label="Loading" />
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      No students found.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr key={student.lrn}>
                      <td className="fw-semibold text-muted text-nowrap">{student.lrn}</td>
                      <td className="text-nowrap">{student.last_name}</td>
                      <td className="text-nowrap">{student.first_name}</td>
                      <td className="text-nowrap">{student.middle_name}</td>
                      <td className="text-nowrap">{student.gender}</td>
                      <td className="text-nowrap">
                        {student.date_of_birth
                          ? new Date(student.date_of_birth).toLocaleDateString("en-CA")
                          : ""}
                      </td>
                      <td className="text-end">
                        <div className="d-inline-flex flex-wrap gap-2">
                          <Link
                            to={`/edit_student/${student.lrn}`}
                            className={`btn btn-sm text-nowrap px-3 d-inline-flex align-items-center gap-2 ${
                              permissions.edit_student_info
                                ? "btn-outline-success"
                                : "btn-outline-secondary disabled"
                            }`}
                            title="Edit student"
                          >
                            <FaEdit aria-hidden="true" /> Edit
                          </Link>
                          <Link
                            to={`/record_student/${student.lrn}`}
                            className={`btn btn-sm text-nowrap px-3 d-inline-flex align-items-center gap-2 ${
                              permissions.view_student_info
                                ? "btn-outline-primary"
                                : "btn-outline-secondary disabled"
                            }`}
                            title="View records"
                          >
                            <FaBookOpen aria-hidden="true" /> Records
                          </Link>
                          <Link
                            to={`/upload_ecards/${student.lrn}`}
                            className={`btn btn-sm text-nowrap px-3 d-inline-flex align-items-center gap-2 ${
                              permissions.upload_documents
                                ? "btn-outline-secondary"
                                : "btn-outline-secondary disabled"
                            }`}
                            title="Upload E-SF10"
                          >
                            <FaUpload aria-hidden="true" /> Upload E-SF10
                          </Link>
                          <Link
                            to={`/request_transfer/${student.student_id}`}
                            className={`btn btn-sm text-nowrap px-3 d-inline-flex align-items-center gap-2 ${
                              permissions.request_transfers
                                ? "btn-outline-warning"
                                : "btn-outline-secondary disabled"
                            }`}
                            title="Request transfer"
                          >
                            <FaExchangeAlt aria-hidden="true" /> Transfer
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINATION */}
        {!isSearching && totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center p-4 px-md-5">
            <small className="text-muted">
              Showing {filteredStudents.length} of {total} students (after filters)
            </small>
            <nav>
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                  <button
                    className="page-link text-nowrap d-inline-flex align-items-center gap-1"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    aria-label="Previous page"
                  >
                    <FaChevronLeft aria-hidden="true" /> Prev
                  </button>
                </li>
                {Array.from({ length: totalPages }, (_, i) => (
                  <li key={i} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                    <button
                      className="page-link text-nowrap"
                      onClick={() => setCurrentPage(i + 1)}
                      aria-label={`Go to page ${i + 1}`}
                    >
                      {i + 1}
                    </button>
                  </li>
                ))}
                <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                  <button
                    className="page-link text-nowrap d-inline-flex align-items-center gap-1"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    aria-label="Next page"
                  >
                    Next <FaChevronRight aria-hidden="true" />
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>

      {/* BULK UPLOAD MODAL */}
      {showUploadModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content rounded-4 shadow-lg border-0">
              <div className="modal-header bg-white rounded-top-4">
                <h5 className="modal-title fw-semibold d-flex align-items-center gap-2">
                  <FaUpload aria-hidden="true" /> Bulk Student Upload
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowUploadModal(false)} />
              </div>
              <div className="modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
                <p className="mb-2">Download the official template:</p>
                <a
                  href={`${BASE_URL}/generate-excel`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2"
                >
                  <FaDownload aria-hidden="true" /> Download Template
                </a>
                <div className="alert alert-info mt-3 small mb-0">
                  <strong>Guidelines:</strong>
                  <ul className="mb-0 mt-1">
                    <li>Do not change column headers.</li>
                    <li>LRN must be unique and valid.</li>
                    <li>Use <code>YYYY-MM-DD</code> for dates.</li>
                    <li>Gender: <code>Male</code> or <code>Female</code>.</li>
                  </ul>
                </div>
                <div className="mt-3">
                  <label className="form-label">Choose Excel File</label>
                  <input type="file" accept=".xlsx" className="form-control" onChange={handleFileChange} />
                </div>
              </div>
              <div className="modal-footer bg-white rounded-bottom-4 border-0">
                <button className="btn btn-outline-secondary text-nowrap d-inline-flex align-items-center gap-2" onClick={() => setShowUploadModal(false)}>
                  <FaTimes aria-hidden="true" /> Cancel
                </button>
                <button className="btn btn-success text-nowrap d-inline-flex align-items-center gap-2" disabled={!selectedFile} onClick={handleUpload}>
                  <FaUpload aria-hidden="true" /> Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />
    </div>
  );
};

export default StudentInformation;
