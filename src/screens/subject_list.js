import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

const SubjectList = () => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState({ show: false, type: "", message: "", onConfirm: null });

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);

  const token = sessionStorage.getItem("token");
  const navigate = useNavigate();

  // ✅ Fetch subjects with server-side pagination
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
    fetchSubjects(1, searchQuery); // reset to page 1 when searching
  };

  const showModal = (type, message, onConfirm = null) => {
    setModal({ show: true, type, message, onConfirm });
  };
  const closeModal = () => setModal({ show: false, type: "", message: "", onConfirm: null });

  const deleteSubject = async (id) => {
    showModal("confirm", "⚠️ Are you sure you want to delete this subject?", async () => {
      try {
        const res = await fetch(`http://localhost:3001/esf10/subjects/delete-subject/${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          showModal("success", `✅ ${data.message}`);
          fetchSubjects(page, query);
        } else showModal("error", `❌ Failed: ${data.message || "Unknown error"}`);
      } catch (err) {
        console.error("Error deleting subject:", err);
        showModal("error", "❌ An error occurred while deleting the subject.");
      }
    });
  };

  const editSubject = (subject) => navigate(`/subjects/edit/${subject.subject_id}`);
  const createSubject = () => navigate("/subjects/create");

  useEffect(() => { fetchSubjects(); }, []);

  return (
    <div className="container mt-5">
      <div className="card border-0 shadow-sm rounded-4">
        {/* Header */}
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
          <button className="btn btn-primary btn-sm px-3 fw-semibold shadow-sm" onClick={createSubject}>
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
                    <th>Code</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Grade Level</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.length > 0 ? (
                    subjects.map((subj) => (
                      <tr key={subj.subject_id}>
                        <td className="fw-semibold">{subj.subject_code}</td>
                        <td>{subj.subject_name}</td>
                        <td>{subj.description}</td>
                        <td>
                          <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill">
                            {subj.grade_level}
                          </span>
                        </td>
                        <td className="text-center">
                          <button className="btn btn-sm btn-outline-warning me-2" onClick={() => editSubject(subj)}>
                            Edit Subject
                          </button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => deleteSubject(subj.subject_id)}>
                            Delete Subject
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">
                        No subjects found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-3 d-flex justify-content-center">
                  <ul className="pagination">
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

      {/* Modal code remains the same */}
      {modal.show && (
        <div className="modal fade show" style={{ display: "block", background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 shadow">
              <div className={`modal-header ${
                  modal.type === "error" ? "bg-danger text-white" :
                  modal.type === "success" ? "bg-success text-white" :
                  modal.type === "confirm" ? "bg-warning text-dark" :
                  "bg-primary text-white"
                }`}>
                <h5 className="modal-title">
                  {modal.type === "confirm" ? "Confirm Action" :
                   modal.type === "error" ? "Error" :
                   modal.type === "success" ? "Success" :
                   "Info"}
                </h5>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>
              <div className="modal-body">
                <p className="mb-0">{modal.message}</p>
              </div>
              <div className="modal-footer">
                {modal.type === "confirm" ? (
                  <>
                    <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                    <button className="btn btn-danger" onClick={() => { modal.onConfirm(); closeModal(); }}>
                      Yes, Delete
                    </button>
                  </>
                ) : (
                  <button className="btn btn-primary" onClick={closeModal}>OK</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectList;
