// StudentInformation.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaPlus, FaSearch, FaUpload, FaDownload, FaEdit, FaBookOpen, FaExchangeAlt,
  FaChevronLeft, FaChevronRight, FaUndo, FaTimes, FaUserGraduate, FaInfoCircle,
  FaSort, FaSortUp, FaSortDown, FaRedoAlt
} from "react-icons/fa";
import axios from "axios";
import { checkToken } from "../components/token_checker";
import { getUserPermissions } from "../components/get_permission";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const PAGE_SIZES = [5, 10, 20, 50];
const DEFAULT_PAGE_SIZE = PAGE_SIZES[1];
const DEFAULT_SORT = "last:asc"; // lrn | last | first | gender | status

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
const readQP = (s, k, f) => new URLSearchParams(s).get(k) ?? f;
const writeQP = (navigate, location, next) => {
  const p = new URLSearchParams(location.search);
  Object.entries(next).forEach(([k, v]) =>
    v === undefined || v === null || v === "" || v === "All" ? p.delete(k) : p.set(k, String(v))
  );
  navigate({ search: p.toString() }, { replace: true });
};
const useDebounced = (val, d = 300) => {
  const [v, setV] = useState(val);
  useEffect(() => { const t = setTimeout(() => setV(val), d); return () => clearTimeout(t); }, [val, d]);
  return v;
};
const buildSorter = (sort) => {
  const [key, dir] = (sort || DEFAULT_SORT).split(":");
  const asc = dir !== "desc";
  const getter = {
    lrn: (s) => String(s?.lrn || ""),
    last: (s) => String(s?.last_name || "").toLowerCase(),
    first: (s) => String(s?.first_name || "").toLowerCase(),
    gender: (s) => String(s?.gender || "").toLowerCase(),
    status: (s) => String(s?.__status || "").toLowerCase(), // injected from enrollments map
  }[key] || ((s) => String(s?.last_name || "").toLowerCase());
  return (A, B) => (getter(A) < getter(B) ? (asc ? -1 : 1) : getter(A) > getter(B) ? (asc ? 1 : -1) : 0);
};
const SortIcon = ({ activeKey, col }) => {
  const [k, dir] = (activeKey || DEFAULT_SORT).split(":");
  if (k !== col) return <FaSort className="opacity-50" />;
  return dir === "asc" ? <FaSortUp /> : <FaSortDown />;
};
const ThSortable = ({ sort, setSort, col, width, children }) => (
  <th style={width ? { width } : undefined}>
    <button
      type="button"
      className="btn btn-link p-0 text-decoration-none d-inline-flex align-items-center gap-1"
      onClick={() => {
        const [k, dir] = (sort || DEFAULT_SORT).split(":");
        setSort(k === col ? `${col}:${dir === "asc" ? "desc" : "asc"}` : `${col}:asc`);
      }}
      aria-label={`Sort by ${children}`}
    >
      <span className="fw-semibold text-body">{children}</span>
      <SortIcon activeKey={sort} col={col} />
    </button>
  </th>
);

// ────────────────────────────────────────────────────────────────────────────────
const StudentInformation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // URL-initialized
  const initial = useMemo(() => ({
    q: readQP(location.search, "q", ""),
    gender: readQP(location.search, "gender", "All"),
    year: readQP(location.search, "year", "All"),
    page: Number(readQP(location.search, "page", 1)) || 1,
    size: Number(readQP(location.search, "size", DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE,
    sort: readQP(location.search, "sort", DEFAULT_SORT),
  }), [location.search]);

  // Core state
  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [permissions, setPermissions] = useState([]);
  const [students, setStudents] = useState([]);
  const [enrollStatusByStudentId, setEnrollStatusByStudentId] = useState(new Map()); // student_id -> status
  const [total, setTotal] = useState(0);

  // Paging/sort
  const [currentPage, setCurrentPage] = useState(Math.max(1, initial.page));
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES.includes(initial.size) ? initial.size : DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState(initial.sort);

  // Search/filters
  const [searchQuery, setSearchQuery] = useState(initial.q);
  const debouncedQuery = useDebounced(searchQuery, 300);
  const [isSearching, setIsSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [genderFilter, setGenderFilter] = useState(initial.gender);
  const [yearFilter, setYearFilter] = useState(initial.year);

  // UI
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "success" });

  useEffect(() => { checkToken(); setPermissions(getUserPermissions()); }, []);

  // URL sync
  useEffect(() => {
    writeQP(navigate, location, {
      q: debouncedQuery || undefined,
      gender: genderFilter !== "All" ? genderFilter : undefined,
      year: yearFilter !== "All" ? yearFilter : undefined,
      page: currentPage, size: pageSize, sort,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, genderFilter, yearFilter, currentPage, pageSize, sort]);

  const showError = useCallback((message) => {
    setModal({ show: true, title: "Error", message, variant: "danger" });
  }, []);

  // Fetch enrollments once and build status map
  const fetchEnrollmentsStatus = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${BASE_URL}/enrollments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const rows = Array.isArray(data?.data) ? data.data : [];
      const map = new Map();
      for (const r of rows) {
        // last write wins; usually one active per SY — OK for status badge
        map.set(String(r.student_id), r.status || "Enrolled");
      }
      setEnrollStatusByStudentId(map);
    } catch {
      // If this fails, we’ll just show "Not yet enrolled" for everyone until it loads later.
      setEnrollStatusByStudentId(new Map());
    }
  }, [token]);

  // Fetch students (paged)
  const fetchStudents = useCallback(async () => {
    if (!token) return;
    setIsSearching(false);
    try {
      const params = new URLSearchParams({ page: currentPage, limit: pageSize }).toString();
      const { data } = await axios.get(`${BASE_URL}/students/all?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const rows = Array.isArray(data?.students) ? data.students : [];
      setStudents(rows);
      setTotalPages(data?.totalPages || 1);
      setTotal(data?.total ?? rows.length);
    } catch {
      setStudents([]);
      showError("Failed to fetch students.");
    }
  }, [token, currentPage, pageSize, showError]);

  // Search students (client-paged)
  const searchStudents = useCallback(async (q) => {
    if (!token) return;
    setIsSearching(true);
    setSearchLoading(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/students/search?query=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const rows = Array.isArray(data) ? data : [];
      setStudents(rows);
      setTotal(rows.length);
      setCurrentPage(1);
      setTotalPages(Math.max(1, Math.ceil(rows.length / pageSize)));
    } catch {
      setStudents([]); setTotal(0); showError("Search failed.");
    } finally {
      setSearchLoading(false);
    }
  }, [token, pageSize, showError]);

  // Initial + reactive loads
  useEffect(() => { fetchEnrollmentsStatus(); }, [fetchEnrollmentsStatus]);
  useEffect(() => {
    if (debouncedQuery.trim()) searchStudents(debouncedQuery.trim());
    else fetchStudents();
  }, [debouncedQuery, fetchStudents, searchStudents]);

  // Birth year options (from current list)
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

  // Decorate with status, then filter/sort/page
  const { filtered, pageRows } = useMemo(() => {
    const withStatus = students.map((s) => ({
      ...s,
      __status: enrollStatusByStudentId.get(String(s.student_id)) || "Not yet enrolled",
    }));

    const filtered = withStatus.filter((s) => {
      if (genderFilter !== "All" && String(s?.gender || "").toLowerCase() !== genderFilter.toLowerCase())
        return false;
      if (yearFilter !== "All") {
        const y = s?.date_of_birth ? new Date(s.date_of_birth).getFullYear() : null;
        if (String(y) !== String(yearFilter)) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort(buildSorter(sort));
    const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const clamped = Math.min(Math.max(1, currentPage), pages);
    const start = (clamped - 1) * pageSize;
    const slice = sorted.slice(start, start + pageSize);

    if (isSearching) {
      if (pages !== totalPages) setTotalPages(pages);
      if (clamped !== currentPage) setCurrentPage(clamped);
    }
    return { filtered: sorted, pageRows: slice };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, enrollStatusByStudentId, genderFilter, yearFilter, sort, pageSize, currentPage, isSearching]);

  // UX niceties
  useEffect(() => { setCurrentPage(1); }, [genderFilter, yearFilter, pageSize, sort]);
  const onReload = () => window.location.reload();
  const onClearSearch = () => setSearchQuery("");

  // Bulk upload
  const handleFileChange = (e) => setSelectedFile(e.target.files[0]);
  const handleUpload = async () => {
    if (!selectedFile || !token) return;
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      await axios.post(`${BASE_URL}/students/bulk-register`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      setModal({ show: true, title: "Success", message: "Bulk upload successful.", variant: "success" });
      setShowUploadModal(false); setSelectedFile(null);
      setSearchQuery(""); // back to paged
      fetchStudents();
      fetchEnrollmentsStatus(); // refresh statuses too
    } catch (error) {
      setModal({
        show: true, title: "Error",
        message: error.response?.data?.message || "Bulk upload failed.",
        variant: "danger",
      });
    }
  };

  const clearFilters = () => { setGenderFilter("All"); setYearFilter("All"); };

  return (
    <div className="container-xxl py-4 py-lg-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 mb-lg-4">
        <div>
          <h3 className="fw-bold mb-1 d-flex align-items-center gap-2"><FaUserGraduate /> Students</h3>
          <div className="text-muted small d-flex align-items-center gap-2">
            <FaInfoCircle className="opacity-75" /> Manage student directory, quick search, and E-SF10 records.
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-2" onClick={onReload} title="Reload">
            <FaRedoAlt /> Refresh
          </button>

          {permissions.register_student && (
            <button
              className="btn btn-outline-success rounded-3 d-inline-flex align-items-center gap-2"
              onClick={() => setShowUploadModal(true)}
            >
              <FaUpload /> Bulk Upload
            </button>
          )}

          {/* Enroll moved here beside Bulk/Add */}
          <Link
            to="/enrollments/create"
            className="btn btn-outline-dark rounded-3 d-inline-flex align-items-center gap-2"
            title="Enroll a student"
          >
            <FaUserGraduate /> Enroll
          </Link>

          {permissions.register_student && (
            <Link to="/add_student" className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2">
              <FaPlus /> Add Student
            </Link>
          )}
        </div>
      </div>

      {/* Toolbar (search + filters that expand when space) */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body d-flex flex-column gap-3">
          {/* Search */}
          <div className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-2">
            <div className="input-group">
              <span className="input-group-text"><FaSearch /></span>
              <input
                type="text"
                disabled={!permissions.search_student}
                className="form-control"
                placeholder="Search by LRN or name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") onClearSearch(); }}
                autoComplete="off"
              />
              {searchQuery && (
                <button className="btn btn-outline-secondary" onClick={onClearSearch}>
                  <FaTimes /> Clear
                </button>
              )}
            </div>
            <div className="form-text">
              {isSearching
                ? searchLoading
                  ? "Searching…"
                  : `${filtered.length} match${filtered.length === 1 ? "" : "es"} (after filters)`
                : `Page ${currentPage} of ${totalPages} • ${total} total • showing ${pageRows.length} after filters`}
            </div>
          </div>

          {/* Filters (expand if there’s room) */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: 220 }}>
              <label className="form-label small text-muted mb-0">Gender</label>
              <select
                className="form-select form-select-sm"
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                aria-label="Filter by gender"
              >
                <option>All</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>

            <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: 240 }}>
              <label className="form-label small text-muted mb-0">Birth Year</label>
              <select
                className="form-select form-select-sm"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                aria-label="Filter by birth year"
              >
                <option value="All">All</option>
                {birthYears.map((y) => (<option key={y} value={y}>{y}</option>))}
              </select>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2"
              onClick={clearFilters}
              title="Reset filters"
            >
              <FaUndo /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-0">
          {searchLoading ? (
            <div className="py-5 text-center">
              <div className="spinner-border" role="status" />
              <div className="mt-2 small text-muted">Loading students…</div>
            </div>
          ) : !pageRows.length ? (
            <div className="p-5 text-center">
              <h5 className="fw-semibold mt-2 mb-1">No students found</h5>
              <p className="text-muted mb-3">Try adjusting filters or add a new student.</p>
              {permissions.register_student && (
                <Link to="/add_student" className="btn btn-primary rounded-3 d-inline-flex align-items-center gap-2">
                  <FaPlus /> Add Student
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>
                      <ThSortable col="lrn" sort={sort} setSort={setSort} width={160}>LRN</ThSortable>
                      <ThSortable col="last" sort={sort} setSort={setSort}>Last Name</ThSortable>
                      <ThSortable col="first" sort={sort} setSort={setSort}>First Name</ThSortable>
                      <ThSortable col="gender" sort={sort} setSort={setSort} width={120}>Gender</ThSortable>
                      <ThSortable col="status" sort={sort} setSort={setSort} width={160}>Status</ThSortable>
                      <th style={{ width: 360 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((s) => {
                      const status = s.__status || "Not yet enrolled";
                      return (
                        <tr key={s.lrn}>
                          <td className="fw-semibold text-muted text-nowrap">{s.lrn}</td>
                          <td className="text-nowrap">{s.last_name}</td>
                          <td className="text-nowrap">{s.first_name}</td>
                          <td className="text-nowrap">{s.gender || "—"}</td>
                          <td className="text-nowrap">
                            {status === "Not yet enrolled" ? (
                              <span className="badge text-bg-primary-subtle text-dark border">{status}</span>
                            ) : (
                              <span className="badge text-bg-success-subtle border">{status}</span>
                            )}
                          </td>
                          <td className="text-end">
                            <div className="d-inline-flex flex-nowrap gap-1">
                              <Link
                                to={`/edit_student/${s.lrn}`}
                                className={`btn btn-sm px-3 d-inline-flex align-items-center gap-2 ${
                                  permissions.edit_student_info ? "btn-outline-success" : "btn-outline-secondary disabled"
                                }`}
                                title="Edit student"
                              >
                                <FaEdit /> Edit
                              </Link>
                              <Link
                                to={`/record_student/${s.lrn}`}
                                className={`btn btn-sm px-3 d-inline-flex align-items-center gap-2 ${
                                  permissions.view_student_info ? "btn-outline-primary" : "btn-outline-secondary disabled"
                                }`}
                                title="View records"
                              >
                                <FaBookOpen /> Records
                              </Link>
                              <Link
                                to={`/upload_ecards/${s.lrn}`}
                                className={`btn btn-sm px-3 d-inline-flex align-items-center gap-2 ${
                                  permissions.upload_documents ? "btn-outline-secondary" : "btn-outline-secondary disabled"
                                }`}
                                title="Upload E-SF10"
                              >
                                <FaUpload /> Upload
                              </Link>
                              <Link
                                to={`/request_transfer/${s.student_id}`}
                                className={`btn btn-sm px-3 d-inline-flex align-items-center gap-2 ${
                                  permissions.request_transfers ? "btn-outline-warning" : "btn-outline-secondary disabled"
                                }`}
                                title="Request transfer"
                              >
                                <FaExchangeAlt /> Transfer
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer / Pagination */}
              <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-2 p-3">
                <div className="small text-muted">
                  Showing <strong>{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)}</strong> of{" "}
                  <strong>{filtered.length}</strong> students (after filters)
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button className="btn btn-outline-secondary btn-sm" disabled={currentPage <= 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                    <FaChevronLeft /> Prev
                  </button>
                  <span className="small text-muted">Page</span>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: 80 }}
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const v = Number(e.target.value || 1);
                      setCurrentPage(Math.min(Math.max(1, v), totalPages));
                    }}
                  />
                  <span className="small text-muted">of {totalPages}</span>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 120 }}
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    {PAGE_SIZES.map((s) => (<option key={s} value={s}>{s} / page</option>))}
                  </select>
                  <button className="btn btn-outline-secondary btn-sm" disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                    Next <FaChevronRight />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* BULK UPLOAD MODAL */}
      {showUploadModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content rounded-4 shadow-lg border-0">
              <div className="modal-header bg-white rounded-top-4">
                <h5 className="modal-title fw-semibold d-flex align-items-center gap-2">
                  <FaUpload /> Bulk Student Upload
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowUploadModal(false)} />
              </div>
              <div className="modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
                <p className="mb-2">Download the official template:</p>
                <a href={`${BASE_URL}/generate-excel`} target="_blank" rel="noopener noreferrer"
                   className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2">
                  <FaDownload /> Download Template
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
                  <input type="file" accept=".xlsx" className="form-control" onChange={(e) => setSelectedFile(e.target.files[0])} />
                </div>
              </div>
              <div className="modal-footer bg-white rounded-bottom-4 border-0">
                <button className="btn btn-outline-secondary d-inline-flex align-items-center gap-2" onClick={() => setShowUploadModal(false)}>
                  <FaTimes /> Cancel
                </button>
                <button className="btn btn-success d-inline-flex align-items-center gap-2" disabled={!selectedFile} onClick={handleUpload}>
                  <FaUpload /> Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />
    </div>
  );
};

export default StudentInformation;
