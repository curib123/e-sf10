import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

const SubjectList = () => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);

  const token = sessionStorage.getItem("token");
  const navigate = useNavigate();

  const fetchSubjects = async (pageNumber = 1, searchQuery = "") => {
    setLoading(true);
    try {
      const url = new URL("http://localhost:3001/esf10/subjects/view-all-subjects");
      url.searchParams.append("page", pageNumber);
      url.searchParams.append("limit", limit);
      if (searchQuery) url.searchParams.append("query", searchQuery);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
    } finally {
      setLoading(false);
    }
  };

  const searchSubjects = (searchQuery) => {
    fetchSubjects(1, searchQuery);
  };

  const editSubject = (subject) => navigate(`/subjects/edit/${subject.subject_id}`);
  const createSubject = () => navigate("/subjects/create");

  useEffect(() => { fetchSubjects(); }, []);

  return (
    <div className="container mt-5">
      {/* Page Header */}
      <div className="text-center mb-4">
        <h3 className="fw-bold text-primary mb-2">Subjects Management</h3>
        <p className="text-muted mb-0">View, search, and manage all subjects in the system.</p>
      </div>

      <div className="card border-0 shadow-sm rounded-4">
        {/* Header: Search + Create */}
        <div className="card-header bg-white border-0 rounded-top-4 px-3 py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="input-group input-group-sm w-auto">
            <input
              type="text"
              className="form-control border-end-0 shadow-none"
              placeholder="🔍 Search subject..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchSubjects(query)}
            />
            <button className="btn btn-primary border-start-0" onClick={() => searchSubjects(query)}>
              Search
            </button>
          </div>
          <button
            className="btn btn-primary btn-sm px-3 fw-semibold shadow-sm"
            onClick={createSubject}
          >
            Create Subject
          </button>
        </div>

        {/* Table */}
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="fw-semibold">Code</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.length > 0 ? (
                    subjects.map((subj) => (
                      <tr key={subj.subject_id}>
                        <td className="fw-semibold">{subj.subject_code}</td>
                        <td>{subj.subject_name}</td>
                        <td>{subj.description || "-"}</td>
                        <td className="text-center">
                          <button
                            className="btn btn-sm btn-outline-warning"
                            onClick={() => editSubject(subj)}
                          >
                            Edit
                          </button>
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
                    {[...Array(totalPages)].map((_, i) => (
                      <li key={i} className={`page-item ${page === i + 1 ? "active" : ""}`}>
                        <button className="page-link" onClick={() => fetchSubjects(i + 1, query)}>
                          {i + 1}
                        </button>
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
