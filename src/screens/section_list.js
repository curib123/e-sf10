import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusModal from "../components/status_modal";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const SectionsList = () => {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusModal, setStatusModal] = useState({ show: false, title: "", message: "", variant: "info" });
  const [selectedId, setSelectedId] = useState(null);

  // UI state
  const [q, setQ] = useState("");                // search
  const [sortBy, setSortBy] = useState("name");  // name | grade | year | id
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

  // Fetch sections
  const fetchSections = async () => {
    if (!checkToken()) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/sections`, { headers: authHeaders() });
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      if (data?.success) setSections(data.data || []);
      else {
        setSections([]);
        setStatusModal({ show: true, title: "Error", message: "Failed to load sections.", variant: "danger" });
      }
    } catch {
      setStatusModal({ show: true, title: "Error", message: "Something went wrong.", variant: "danger" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSections(); /* eslint-disable-next-line */ }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSections();
    setRefreshing(false);
  };

  const handleDelete = async () => {
    if (!selectedId || !checkToken()) return;
    try {
      const res = await fetch(`${BASE_URL}/sections/delete/${selectedId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json().catch(() => ({}));
      setStatusModal({
        show: true,
        title: data?.success ? "Success" : "Error",
        message: data?.message || (data?.success ? "Deleted." : "Delete failed."),
        variant: data?.success ? "success" : "danger",
      });
      if (data?.success) setSections((prev) => prev.filter((s) => s.section_id !== selectedId));
    } catch {
      setStatusModal({ show: true, title: "Error", message: "Something went wrong.", variant: "danger" });
    } finally {
      setSelectedId(null);
    }
  };

  // Client-side search + sort
  const filteredSorted = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = sections.filter((s) => {
      const txt = `${s.section_name ?? ""} ${s.grade_name ?? ""} ${s.school_year ?? ""} ${s.section_id ?? ""}`.toLowerCase();
      return term === "" || txt.includes(term);
    });

    const sorted = [...list].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "id") return (Number(a.section_id) - Number(b.section_id)) * dir;
      if (sortBy === "grade") return (a.grade_name || "").localeCompare(b.grade_name || "", undefined, { numeric: true }) * dir;
      if (sortBy === "year") return (a.school_year || "").localeCompare(b.school_year || "", undefined, { numeric: true }) * dir;
      // default name
      return (a.section_name || "").localeCompare(b.section_name || "", undefined, { numeric: true }) * dir;
    });

    return sorted;
  }, [sections, q, sortBy, sortDir]);

  return (
    <div className="container-xxl my-4">
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          {/* Header */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
            <div className="row mb-4">
  <div className="col-12">
    <h4 className="fw-bold mb-0">Sections</h4>
    <p className="text-muted mb-0">
      Manage class sections and link them to grade levels and school years.
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
                onClick={() => navigate("/sections/create")}
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
                  placeholder="Section, Grade or School Year"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="col-6 col-md-3">
              <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="name">Sort by Name</option>
                <option value="grade">Sort by Grade</option>
                <option value="year">Sort by School Year</option>
                <option value="id">Sort by ID</option>
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
              <div className="mb-2">No sections found</div>
              <p className="text-muted mb-4 small">Try adjusting search or add a new section.</p>
              <button
                className="btn btn-primary d-inline-flex align-items-center gap-2 px-3"
                onClick={() => navigate("/sections/create")}
              >
                <FaPlus /> Create section
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="text-nowrap">Section</th>
                    <th className="text-nowrap">Grade</th>
                    <th className="text-nowrap">School Year</th>
                    <th className="text-end text-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSorted.map((s) => (
                    <tr key={s.section_id}>
                      <td className="fw-medium">{s.section_name}</td>
                      <td>{s.grade_name || "—"}</td>
                      <td>{s.school_year || "—"}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2 flex-nowrap">
                          <button
                            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2 px-3"
                            onClick={() => navigate(`/sections/edit/${s.section_id}`)}
                            title="Edit section"
                          >
                            <FaEdit /> Edit
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

      <StatusModal {...statusModal} onHide={() => setStatusModal((s) => ({ ...s, show: false }))} />
    </div>
  );
};

export default SectionsList;
