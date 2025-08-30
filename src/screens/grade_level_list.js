import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusModal from "../components/status_modal";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const GradeLevelList = () => {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);

  const [gradeLevels, setGradeLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusModal, setStatusModal] = useState({ show: false, title: "", message: "", variant: "info" });
  const [selectedId, setSelectedId] = useState(null);

  // UI state
  const [q, setQ] = useState("");        // search
  const [sortBy, setSortBy] = useState("order"); // order | code | name
  const [sortDir, setSortDir] = useState("asc"); // asc | desc

  const authHeaders = () => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: "Unauthorized", message: "Access denied. Please log in.", variant: "danger" });
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 900);
  };

  const checkToken = () => {
    if (!token) {
      handleUnauthorized();
      return false;
    }
    return true;
  };

  const fetchGradeLevels = async () => {
    if (!checkToken()) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/grade-levels`, {
        headers: authHeaders(),
      });
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      if (data?.success) setGradeLevels(data.data || []);
      else {
        setGradeLevels([]);
        setStatusModal({ show: true, title: "Error", message: "Failed to load grade levels.", variant: "danger" });
      }
    } catch {
      setStatusModal({ show: true, title: "Error", message: "Something went wrong.", variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGradeLevels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchGradeLevels();
    setRefreshing(false);
  };

  const handleDelete = async () => {
    if (!selectedId || !checkToken()) return;
    try {
      const res = await fetch(`${BASE_URL}/grade-levels/delete/${selectedId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      setStatusModal({
        show: true,
        title: data?.success ? "Success" : "Error",
        message: data?.message || (data?.success ? "Deleted." : "Delete failed."),
        variant: data?.success ? "success" : "danger",
      });
      if (data?.success) {
        setGradeLevels((prev) => prev.filter((g) => g.grade_level_id !== selectedId));
      }
    } catch {
      setStatusModal({ show: true, title: "Error", message: "Something went wrong.", variant: "danger" });
    } finally {
      setSelectedId(null);
    }
  };

  // Client-side search + sort
  const filteredSorted = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = gradeLevels.filter((g) => {
      const text = `${g.grade_code ?? ""} ${g.grade_name ?? ""} ${g.grade_order ?? ""}`.toLowerCase();
      return term === "" || text.includes(term);
    });
    const sorted = [...list].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "order") return (Number(a.grade_order) - Number(b.grade_order)) * dir;
      if (sortBy === "code") return a.grade_code.localeCompare(b.grade_code) * dir;
      return a.grade_name.localeCompare(b.grade_name) * dir;
    });
    return sorted;
  }, [gradeLevels, q, sortBy, sortDir]);

  return (
    <div className="container-xxl my-4">
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          {/* Header */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
           <div className="row mb-0">
  <div className="col-12">
    <h4 className="fw-bold mb-0">Grade Levels</h4>
    <p className="text-muted mb-0">
      Manage grade levels and their ordering in the curriculum.
    </p>
  </div>
</div>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary d-flex align-items-center gap-2 px-3"
                onClick={handleRefresh}
                disabled={loading || refreshing}
              >
                {refreshing ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" />
                    Refreshing
                  </>
                ) : (
                  <>Refresh</>
                )}
              </button>
              <button
                className="btn btn-primary d-flex align-items-center gap-2 px-3"
                onClick={() => navigate("/grade_level/create")}
              >
                <FaPlus /> Add New
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="row g-2 mb-3">
            <div className="col-12 col-md-6">
              <div className="input-group">
                <span className="input-group-text">Search</span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Code, Name, or Order"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="col-6 col-md-3">
              <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="order">Sort by Order</option>
                <option value="code">Sort by Code</option>
                <option value="name">Sort by Name</option>
              </select>
            </div>
            <div className="col-6 col-md-3">
              <select className="form-select" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>

          {/* Table / Empty / Loading */}
          {loading ? (
            <div className="text-center py-5 text-muted">⏳ Loading…</div>
          ) : filteredSorted.length === 0 ? (
            <div className="text-center bg-body-tertiary rounded-4 p-5">
              <div className="mb-2">No grade levels found</div>
              <p className="text-muted mb-4 small">Try adjusting search or sorting.</p>
              <button
                className="btn btn-primary d-inline-flex align-items-center gap-2 px-3"
                onClick={() => navigate("/grade_level/create")}
              >
                <FaPlus /> Create grade level
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Order</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSorted.map((g) => (
                    <tr key={g.grade_level_id}>
                      <td className="fw-medium">{g.grade_code}</td>
                      <td>{g.grade_name}</td>
                      <td>{g.grade_order}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <button
                            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2 px-3"
                            onClick={() => navigate(`/grade_level/edit/${g.grade_level_id}`)}
                          >
                            <FaEdit /> Edit
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger d-flex align-items-center gap-2 px-3"
                            onClick={() => setSelectedId(g.grade_level_id)}
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
          )}
        </div>
      </div>

      {/* Delete Confirmation (Bootstrap utilities only) */}
      {selectedId && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} />
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{ zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 rounded-4 shadow">
                <div className="modal-header border-0">
                  <h5 className="modal-title fw-semibold">Delete Grade Level</h5>
                  <button type="button" className="btn-close" onClick={() => setSelectedId(null)} />
                </div>
                <div className="modal-body">
                  <p className="mb-0 text-muted">
                    Are you sure you want to delete this grade level? This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer border-0">
                  <button type="button" className="btn btn-light rounded-3 px-3" onClick={() => setSelectedId(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-danger rounded-3 px-3" onClick={handleDelete}>
                    Yes, Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <StatusModal {...statusModal} onHide={() => setStatusModal((s) => ({ ...s, show: false }))} />
    </div>
  );
};

export default GradeLevelList;
