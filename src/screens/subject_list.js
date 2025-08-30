import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const SubjectList = () => {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  const fetchSubjects = async (pageNumber = 1, searchQuery = "") => {
    if (!token) return;
    setLoading(true);
    try {
      const url = new URL(`${BASE_URL}/subjects/view-all-subjects`);
      url.searchParams.append("page", pageNumber);
      url.searchParams.append("limit", limit);
      if (searchQuery) url.searchParams.append("query", searchQuery);

      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data?.success) {
        setSubjects(data.data || []);
        setPage(data.pagination?.page || 1);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setSubjects([]);
        setPage(1);
        setTotalPages(1);
      }
    } catch {
      setSubjects([]);
      setPage(1);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const editSubject = (subject) => navigate(`/subjects/edit/${subject.subject_id}`);
  const createSubject = () => navigate("/subjects/create");
  const assignSubject = () => navigate("/assign-subject-per-year-level");

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => fetchSubjects(1, query), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => { fetchSubjects(); /* on mount */ }, []); // eslint-disable-line

  const Pagination = () => (
    totalPages > 1 && (
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
    )
  );

  return (
    <div className="container-xxl my-4">
      <div className="card border-0 shadow-sm rounded-4">
        {/* Header Toolbar */}
        <div className="card-body pb-0">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <h4 className="fw-bold mb-0">Subjects</h4>
            <div className="d-flex gap-2">
              <button
                className="btn btn-success d-flex align-items-center gap-2 px-3"
                onClick={assignSubject}
              >
                <FaPlus /> Assign Subject
              </button>
              <button
                className="btn btn-primary d-flex align-items-center gap-2 px-3"
                onClick={createSubject}
              >
                <FaPlus /> Create Subject
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="row g-2 mt-3">
            <div className="col-12 col-md-6">
              <div className="input-group">
                <span className="input-group-text">Search</span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Code, name, or description"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="col-12 col-md-6 d-flex align-items-center justify-content-md-end">
              <span className="text-muted small">
                {loading ? "Loading…" : `${subjects.length} result${subjects.length === 1 ? "" : "s"} on page ${page}/${totalPages}`}
              </span>
            </div>
          </div>
        </div>

        {/* Table / Loading / Empty */}
        <div className="card-body p-0 mt-3">
          {loading ? (
            <div className="text-center py-5 text-muted">⏳ Loading…</div>
          ) : subjects.length === 0 ? (
            <div className="text-center bg-body-tertiary rounded-4 p-5 m-3">
              <div className="mb-2">No subjects found</div>
              <p className="text-muted mb-4 small">Try adjusting your search, or create a new subject.</p>
              <button className="btn btn-primary d-inline-flex align-items-center gap-2 px-3" onClick={createSubject}>
                <FaPlus /> Create Subject
              </button>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-striped table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Description</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((subj) => (
                      <tr key={subj.subject_id}>
                        <td className="fw-medium">{subj.subject_code}</td>
                        <td>{subj.subject_name}</td>
                        <td className="text-truncate" style={{ maxWidth: 520 }}>
                          {subj.description || "-"}
                        </td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-2">
                            <button
                              className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2 px-3"
                              onClick={() => editSubject(subj)}
                            >
                              <FaEdit /> Edit
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-2 px-3"
                              onClick={() => console.log("Delete", subj.subject_id)} // hook up when ready
                            >
                              <FaTrash /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubjectList;
