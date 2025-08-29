import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const CurriculumList = () => {
  const [curriculums, setCurriculums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [schoolYearId, setSchoolYearId] = useState("");
  const [isActive, setIsActive] = useState("");
  const [schoolYears, setSchoolYears] = useState([]);
  const [statusModal, setStatusModal] = useState({ show: false, title: "", message: "", variant: "info" });

  const navigate = useNavigate();
  const token = sessionStorage.getItem("token");

  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: "Unauthorized", message: "Access denied. Please log in.", variant: "danger" });
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 1500);
  };

  const checkToken = () => {
    if (!token) {
      handleUnauthorized();
      return false;
    }
    return true;
  };

  // Fetch school years
  useEffect(() => {
    if (!checkToken()) return;

    const fetchSchoolYears = async () => {
      try {
        const res = await fetch(`${BASE_URL}/school-year/all-school-years`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setSchoolYears(data.schoolYears || []);
      } catch (err) {
        setStatusModal({ show: true, title: "Error", message: err.message, variant: "danger" });
      }
    };

    fetchSchoolYears();
  }, [token]);

  // Fetch curriculums based on search and filters
  const fetchCurriculums = async () => {
    if (!checkToken()) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append("query", query);
      if (schoolYearId) params.append("school_year_id", schoolYearId);
      if (isActive) params.append("is_active", isActive);

      const res = await fetch(`${BASE_URL}/curriculum/search-curriculums?${params}`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success) setCurriculums(data.data || []);
      else setCurriculums([]);
    } catch (err) {
      setStatusModal({ show: true, title: "Error", message: err.message, variant: "danger" });
      setCurriculums([]);
    } finally {
      setLoading(false);
    }
  };

  // Automatic search/filter debounce
  useEffect(() => {
    const delayDebounce = setTimeout(fetchCurriculums, 300);
    return () => clearTimeout(delayDebounce);
  }, [query, schoolYearId, isActive]);

  const editCurriculum = (id) => {
    if (!checkToken()) return;
    navigate(`/curriculum/edit/${id}`);
  };

  const createCurriculum = () => {
    if (!checkToken()) return;
    navigate("/curriculum/create");
  };

  const assignSubject = (id) => {
    if (!checkToken()) return;
    navigate(`/curriculum/assign-subject/${id}`);
  };

  return (
    <div className="container ">
     
      <div className="card border-0 shadow-sm rounded-4">
        {/* Filters Row */}
        <div className="card-header bg-white border-0 rounded-top-4 px-3 py-3 d-flex flex-wrap align-items-center gap-2">
          <input
            type="text"
            className="form-control form-control-sm shadow-none w-auto"
            placeholder="🔍 Search curriculum..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="form-select form-select-sm shadow-none w-auto" value={schoolYearId} onChange={(e) => setSchoolYearId(e.target.value)}>
            <option value=""> All School Years </option>
            {schoolYears.map((sy) => (
              <option key={sy.school_year_id} value={sy.school_year_id}>
                {sy.start_year} - {sy.end_year}
              </option>
            ))}
          </select>
          <select className="form-select form-select-sm shadow-none w-auto" value={isActive} onChange={(e) => setIsActive(e.target.value)}>
            <option value=""> All Status </option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button className="btn btn-primary btn-sm px-3 fw-semibold shadow-sm ms-auto" onClick={createCurriculum}>
            Create Curriculum
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
              <table className="table table-bordered align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>School Year</th>
                    <th>Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {curriculums.length > 0 ? (
                    curriculums.map((curr) => (
                      <tr key={curr.curriculum_id}>
                        <td className="fw-semibold">{curr.curriculum_name}</td>
                        <td>{curr.school_year_period || curr.school_year_id}</td>
                        <td>
                          <span className={`badge ${curr.is_active ? "bg-success" : "bg-secondary"}`}>
                            {curr.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="d-flex justify-content-center gap-2">
                          <button className="btn btn-sm btn-outline-primary rounded-3" onClick={() => editCurriculum(curr.curriculum_id)}>Edit Subject</button>
                          <button className="btn btn-sm btn-outline-success rounded-3" onClick={() => assignSubject(curr.curriculum_id)}>Assign Subject</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">
                        No curriculums found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Status Modal */}
      <StatusModal {...statusModal} onHide={() => setStatusModal({ ...statusModal, show: false })} />
    </div>
  );
};

export default CurriculumList;
