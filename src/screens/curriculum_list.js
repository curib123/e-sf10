import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const CurriculumList = () => {
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);

  const [curriculums, setCurriculums] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [query, setQuery] = useState("");
  const [schoolYearId, setSchoolYearId] = useState("");
  const [isActive, setIsActive] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusModal, setStatusModal] = useState({ show: false, title: "", message: "", variant: "info" });

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: "Unauthorized", message: "Access denied. Please log in.", variant: "danger" });
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 900);
  };

  const checkToken = () => {
    if (!token) { handleUnauthorized(); return false; }
    return true;
  };

  useEffect(() => {
    if (!checkToken()) return;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/school-year/all-school-years`, { headers });
        if (res.status === 401) return handleUnauthorized();
        const data = await res.json();
        if (data?.success) setSchoolYears(data.schoolYears || []);
      } catch {
        setStatusModal({ show: true, title: "Error", message: "Failed to load school years.", variant: "danger" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCurriculums = async () => {
    if (!checkToken()) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append("query", query);
      if (schoolYearId) params.append("school_year_id", schoolYearId);
      if (isActive) params.append("is_active", isActive);

      const res = await fetch(`${BASE_URL}/curriculum/search-curriculums?${params}`, { headers });
      if (res.status === 401) return handleUnauthorized();

      const data = await res.json();
      setCurriculums(data?.success ? (data.data || []) : []);
    } catch {
      setStatusModal({ show: true, title: "Error", message: "Failed to load curriculums.", variant: "danger" });
      setCurriculums([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchCurriculums, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, schoolYearId, isActive]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCurriculums();
    setRefreshing(false);
  };

  const editCurriculum = (id) => { if (!checkToken()) return; navigate(`/curriculum/edit/${id}`); };
  const assignSubject = (id) => { if (!checkToken()) return; navigate(`/curriculum/assign-subject/${id}`); };
  const createCurriculum = () => { if (!checkToken()) return; navigate("/curriculum/create"); };

  return (
    <div className="container-xxl my-3">
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          <h4 className="fw-bold mb-3">Curriculums</h4>

          {/* Responsive toolbar: prevents squish + keeps buttons on one line */}
          <div className="row g-2 align-items-stretch mb-3">
            <div className="col-12 col-lg-5">
              <div className="input-group">
                <span className="input-group-text">Search</span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Name or school year"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button className="btn btn-outline-secondary text-nowrap" onClick={() => setQuery("")}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <select
                className="form-select w-100"
                value={schoolYearId}
                onChange={(e) => setSchoolYearId(e.target.value)}
                aria-label="Filter by school year"
              >
                <option value="">All School Years</option>
                {schoolYears.map((sy) => (
                  <option key={sy.school_year_id} value={sy.school_year_id}>
                    {sy.start_year} - {sy.end_year}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-sm-6 col-lg-2">
              <select
                className="form-select w-100"
                value={isActive}
                onChange={(e) => setIsActive(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <div className="col-12 col-lg-2 d-flex gap-2 justify-content-lg-end">
            
              <button
                className="btn btn-primary text-nowrap px-3"
                onClick={createCurriculum}
              >
                Create Curriculum
              </button>
            </div>
          </div>

          {/* Meta */}
          <div className="d-flex justify-content-between align-items-center text-muted small mb-2">
            <span>{loading ? "Loading…" : `${curriculums.length} result${curriculums.length === 1 ? "" : "s"}`}</span>
          </div>

          {/* Table / Loading / Empty */}
          <div className="border rounded-3 overflow-hidden">
            {loading ? (
              <div className="text-center py-5 text-muted">⏳ Loading…</div>
            ) : curriculums.length === 0 ? (
              <div className="text-center bg-body-tertiary p-5">
                <div className="mb-2">No curriculums found</div>
                <p className="text-muted small mb-4">Try adjusting your filters or create a new curriculum.</p>
                <button className="btn btn-primary text-nowrap px-3" onClick={createCurriculum}>
                  Create Curriculum
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Name</th>
                      <th>School Year</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {curriculums.map((curr) => (
                      <tr key={curr.curriculum_id}>
                        {/* allow wrapping so words are visible; remove text-truncate */}
                        <td className="fw-medium text-wrap">{curr.curriculum_name}</td>
                        <td className="text-wrap">{curr.school_year_period || curr.school_year_id}</td>
                        <td>
                          <span className={`badge ${curr.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                            {curr.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-2">
                            <button
                              className="btn btn-sm btn-outline-primary text-nowrap px-3"
                              onClick={() => editCurriculum(curr.curriculum_id)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-sm btn-outline-success text-nowrap px-3"
                              onClick={() => assignSubject(curr.curriculum_id)}
                            >
                              Assign Subject
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
      </div>

      <StatusModal {...statusModal} onHide={() => setStatusModal((s) => ({ ...s, show: false }))} />
    </div>
  );
};

export default CurriculumList;
