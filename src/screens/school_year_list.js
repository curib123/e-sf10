import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusModal from "../components/status_modal";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const SchoolYearList = () => {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);

  const [schoolYears, setSchoolYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusModal, setStatusModal] = useState({ show: false, title: "", message: "", variant: "info" });
  const [selectedId, setSelectedId] = useState(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const checkToken = () => {
    if (!token) {
      setStatusModal({ show: true, title: "Unauthorized", message: "Please login to continue.", variant: "danger" });
      setTimeout(() => navigate("/login"), 1000);
      return false;
    }
    return true;
  };

  const fetchSchoolYears = async () => {
    if (!checkToken()) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/school-year/all-school-years`, { headers: authHeaders() });
      const data = await res.json();
      if (data?.success) setSchoolYears(data.schoolYears || []);
      else setStatusModal({ show: true, title: "Error", message: "Failed to load school years.", variant: "danger" });
    } catch {
      setStatusModal({ show: true, title: "Error", message: "Something went wrong.", variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchoolYears();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSchoolYears();
    setRefreshing(false);
  };

  const handleDelete = async () => {
    if (!selectedId || !checkToken()) return;
    try {
      const res = await fetch(`${BASE_URL}/school-year/delete-school-year/${selectedId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      setStatusModal({
        show: true,
        title: data.success ? "Success" : "Error",
        message: data.message || (data.success ? "Deleted." : "Delete failed."),
        variant: data.success ? "success" : "danger",
      });
      if (data.success) setSchoolYears((prev) => prev.filter((sy) => sy.school_year_id !== selectedId));
    } catch {
      setStatusModal({ show: true, title: "Error", message: "Something went wrong.", variant: "danger" });
    } finally {
      setSelectedId(null);
    }
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return schoolYears.filter((sy) => {
      const matchesStatus =
        status === "all" ? true : status === "active" ? !!sy.is_active : !sy.is_active;
      const text = `${sy.start_year ?? ""} ${sy.end_year ?? ""}`.toLowerCase();
      return matchesStatus && (term === "" || text.includes(term));
    });
  }, [schoolYears, q, status]);

  return (
    <div className="container-xxl my-4">
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          {/* Header */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
            <div className="row mb-0">
  <div className="col-12">
    <h4 className="fw-bold mb-0">School Years</h4>
    <p className="text-muted mb-0">
      Manage academic school years and their active status.
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
                type="button"
                className="btn btn-primary d-flex align-items-center gap-2 px-3"
                onClick={() => navigate("/school_year/create")}
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
                  placeholder="Start or End year"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="col-12 col-md-3">
              <select
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>
            <div className="col-12 col-md-3 d-flex align-items-center justify-content-md-end">
              <span className="text-muted small">
                {loading ? "Loading…" : `${filtered.length} shown`}
              </span>
            </div>
          </div>

          {/* Table / Empty / Loading */}
          {loading ? (
            <div className="text-center py-5 text-muted">⏳ Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center bg-body-tertiary rounded-4 p-5">
              <div className="mb-2">No school years found</div>
              <p className="text-muted mb-4 small">Try adjusting search or status filters.</p>
              <button
                className="btn btn-primary d-inline-flex align-items-center gap-2 px-3"
                onClick={() => navigate("/school_year/create")}
              >
                <FaPlus /> Create school year
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Start Year</th>
                    <th>End Year</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sy) => (
                    <tr key={sy.school_year_id}>
                      <td className="fw-medium">{sy.start_year}</td>
                      <td>{sy.end_year}</td>
                      <td>
                        <span className={`badge ${sy.is_active ? "text-bg-success" : "text-bg-secondary"} px-3 py-2`}>
                          {sy.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <button
                            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2 px-3"
                            onClick={() => navigate(`/school_year/edit/${sy.school_year_id}`)}
                          >
                            <FaEdit /> Edit
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger d-flex align-items-center gap-2 px-3"
                            onClick={() => setSelectedId(sy.school_year_id)}
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

      {/* Delete Confirmation Modal */}
      {selectedId && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} />
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{ zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 rounded-4 shadow">
                <div className="modal-header border-0">
                  <h5 className="modal-title fw-semibold">Delete School Year</h5>
                  <button type="button" className="btn-close" onClick={() => setSelectedId(null)} />
                </div>
                <div className="modal-body">
                  <p className="mb-0 text-muted">
                    Are you sure you want to delete this school year? This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer border-0">
                  <button type="button" className="btn btn-light rounded-3 px-3" onClick={() => setSelectedId(null)}>Cancel</button>
                  <button type="button" className="btn btn-danger rounded-3 px-3" onClick={handleDelete}>Yes, Delete</button>
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

export default SchoolYearList;
