import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const SubjectList = () => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  const token = sessionStorage.getItem("token");
  const navigate = useNavigate();

  const fetchSubjects = async (pageNumber = 1, searchQuery = "") => {
    setLoading(true);
    if (!token) return;

    try {
      const url = new URL(`${BASE_URL}/subjects/view-all-subjects`);
      url.searchParams.append("page", pageNumber);
      url.searchParams.append("limit", limit);
      if (searchQuery) url.searchParams.append("query", searchQuery);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success) {
        setSubjects(data.data || []);
        setPage(data.pagination.page || 1);
        setTotalPages(data.pagination.totalPages || 1);
      } else {
        setSubjects([]);
      }
    } catch (err) {
      console.error("Error fetching subjects:", err);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  const editSubject = (subject) => navigate(`/subjects/edit/${subject.subject_id}`);
  const createSubject = () => navigate("/subjects/create");
  const assignSubject = () => navigate("/assign-subject-per-year-level");

  useEffect(() => {
    const delay = setTimeout(() => fetchSubjects(1, query), 300);
    return () => clearTimeout(delay);
  }, [query]);

  useEffect(() => { fetchSubjects(); }, []);

  return (
    <div className="container my-4">
      <div className="card border shadow-sm rounded-4">
        {/* Header: Search + Create */}
        <div className="card-header bg-white border-0 rounded-top-4 px-3 py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="input-group input-group-sm w-auto">
            <input
              type="text"
              className="form-control border-end-0 shadow-none"
              placeholder="🔍 Search subject..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
         <div className="d-flex gap-2">
  <button
    className="btn btn-success btn-sm d-flex align-items-center gap-1 px-3 py-2"
    onClick={assignSubject}
  >
    <FaPlus /> Assign Subject
  </button>
  <button
    className="btn btn-primary btn-sm d-flex align-items-center gap-1 px-3 py-2"
    onClick={createSubject}
  >
    <FaPlus /> Create Subject
  </button>
</div>

        </div>

        {/* Table */}
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="fw-semibold text-dark py-3 px-2">Code</th>
                    <th className="text-dark py-3 px-2">Name</th>
                    <th className="text-dark py-3 px-2">Description</th>
                    <th className="text-dark text-center py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.length ? (
                    subjects.map((subj) => (
                      <tr key={subj.subject_id}>
                        <td className="fw-semibold py-2 px-2">{subj.subject_code}</td>
                        <td className="py-2 px-2">{subj.subject_name}</td>
                        <td className="py-2 px-2">{subj.description || "-"}</td>
                        <td className="text-end py-2 px-2">
                          <div className="d-inline-flex gap-2">
                            <button
                              className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1 px-2 py-1"
                              onClick={() => editSubject(subj)}
                            >
                              <FaEdit /> Edit
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 px-2 py-1"
                              // You can implement delete later
                              onClick={() => console.log("Delete", subj.subject_id)}
                            >
                              <FaTrash /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center text-muted py-4">
                        No subjects found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-3 d-flex justify-content-center">
                  <ul className="pagination mb-0">
                    <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                      <button className="page-link" onClick={() => fetchSubjects(page - 1, query)}>Previous</button>
                    </li>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <li key={i} className={`page-item ${page === i + 1 ? "active" : ""}`}>
                        <button className="page-link" onClick={() => fetchSubjects(i + 1, query)}>{i + 1}</button>
                      </li>
                    ))}
                    <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
                      <button className="page-link" onClick={() => fetchSubjects(page + 1, query)}>Next</button>
                    </li>
                  </ul>
                </nav>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubjectList;
