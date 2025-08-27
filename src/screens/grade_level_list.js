import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

const GradeLevelList = () => {
  const [gradeLevels, setGradeLevels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ show: false, type: "", message: "" });
  const [query, setQuery] = useState(""); // ✅ Search state

  const token = sessionStorage.getItem("token");
  const navigate = useNavigate();

  const checkToken = () => {
    if (!token) {
      navigate("/login");
      return false;
    }
    return true;
  };

  const fetchGradeLevels = async (searchQuery = "") => {
    if (!checkToken()) return;

    setLoading(true);
    try {
      const url = new URL("http://localhost:3001/esf10/grade-levels");
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
        setGradeLevels(data.data || []);
      } else {
        setGradeLevels([]);
      }
    } catch (err) {
      console.error("Error fetching grade levels:", err);
      showModal("error", "❌ Failed to load grade levels.");
    } finally {
      setLoading(false);
    }
  };

  const searchGradeLevels = (searchQuery) => fetchGradeLevels(searchQuery);

  const showModal = (type, message) => setModal({ show: true, type, message });
  const closeModal = () => setModal({ show: false, type: "", message: "" });

  const editGradeLevel = (id) => {
    if (!checkToken()) return;
    navigate(`/grade_level/edit/${id}`);
  };

  const createGradeLevel = () => {
    if (!checkToken()) return;
    navigate("/grade_level/create");
  };

  useEffect(() => {
    fetchGradeLevels();
  }, []);

  return (
    <div className="container mt-5">
      {/* Title & Subtitle */}
      <div className="text-center mb-4">
        <h2 className="fw-bold text-primary">Grade Levels</h2>
        <p className="text-muted mb-0">
          Manage all grade levels. You can create, edit, and search existing grade levels.
        </p>
      </div>

      {/* Grade Levels Card */}
      <div className="card border-0 shadow-sm rounded-4">
        {/* Header with search + create button */}
        <div className="card-header bg-white border-0 rounded-top-4 px-3 py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="input-group input-group-sm w-auto">
            <input
              type="text"
              className="form-control border-end-0 shadow-none"
              placeholder="🔍 Search grade level..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchGradeLevels(query)}
            />
            <button
              className="btn btn-primary border-start-0"
              onClick={() => searchGradeLevels(query)}
            >
              Search
            </button>
          </div>
          <button
            className="btn btn-primary btn-sm px-3 fw-semibold shadow-sm"
            onClick={createGradeLevel}
          >
            Create Grade Level
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
                    <th>Order</th>
                    <th>Created At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeLevels.length > 0 ? (
                    gradeLevels
                      .sort((a, b) => a.grade_order - b.grade_order)
                      .map((grade) => (
                        <tr key={grade.grade_level_id}>
                          <td className="fw-semibold">{grade.grade_code}</td>
                          <td>{grade.grade_name}</td>
                          <td>
                            <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill">
                              {grade.grade_order}
                            </span>
                          </td>
                          <td>{new Date(grade.created_at).toLocaleString()}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-outline-primary rounded-3"
                              onClick={() =>
                                editGradeLevel(grade.grade_level_id)
                              }
                            >
                              ✏️ Edit
                            </button>
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">
                        No grade levels found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal.show && (
        <div
          className="modal fade show"
          style={{ display: "block", background: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 shadow">
              <div
                className={`modal-header ${
                  modal.type === "error"
                    ? "bg-danger text-white"
                    : "bg-primary text-white"
                }`}
              >
                <h5 className="modal-title">
                  {modal.type === "error" ? "Error" : "Info"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeModal}
                ></button>
              </div>
              <div className="modal-body">
                <p className="mb-0">{modal.message}</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-primary" onClick={closeModal}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradeLevelList;
