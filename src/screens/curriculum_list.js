import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

const BASE_URL = "http://localhost:3001/esf10";

const CurriculumList = () => {
  const [curriculums, setCurriculums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [schoolYearId, setSchoolYearId] = useState("");
  const [isActive, setIsActive] = useState("");
  const [schoolYears, setSchoolYears] = useState([]);

  const token = sessionStorage.getItem("token");
  const navigate = useNavigate();

  const checkToken = () => {
    if (!token) {
      navigate("/login");
      return false;
    }
    return true;
  };

  // Fetch school years
  useEffect(() => {
    const fetchSchoolYears = async () => {
      try {
        const res = await fetch(`${BASE_URL}/school-year/all-school-years`, {
          method: "GET",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setSchoolYears(data.schoolYears || []);
      } catch (err) {
        console.error(err);
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
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success) setCurriculums(data.data || []);
      else setCurriculums([]);
    } catch (err) {
      console.error(err);
      setCurriculums([]);
    } finally {
      setLoading(false);
    }
  };

  // Trigger search automatically when filters change
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchCurriculums();
    }, 300); // wait 300ms for typing
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

  const assignSubject = (curriculumId) => {
    if (!checkToken()) return;
    navigate(`/curriculum/assign-subject/${curriculumId}`);
  };

  return (
    <div className="container mt-5">
      {/* Header */}
      <div className="text-center mb-4">
        <h3 className="fw-bold text-primary mb-2">Curriculum Management</h3>
        <p className="text-muted mb-0">
          View, organize, and manage all subjects and courses within the curriculum.
        </p>
      </div>

      <div className="card border-0 shadow-sm rounded-4">
        {/* Filters Row */}
        <div className="card-header bg-white border-0 rounded-top-4 px-3 py-3 d-flex flex-wrap align-items-center gap-2">
          {/* Search */}
          <input
            type="text"
            className="form-control form-control-sm shadow-none w-auto"
            placeholder="🔍 Search curriculum..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {/* School Year */}
          <select
            className="form-select form-select-sm shadow-none w-auto"
            value={schoolYearId}
            onChange={(e) => setSchoolYearId(e.target.value)}
          >
            <option value=""> All School Years </option>
            {schoolYears.map((sy) => (
              <option key={sy.school_year_id} value={sy.school_year_id}>
                {sy.start_year} - {sy.end_year}
              </option>
            ))}
          </select>

          {/* Active Filter */}
          <select
            className="form-select form-select-sm shadow-none w-auto"
            value={isActive}
            onChange={(e) => setIsActive(e.target.value)}
          >
            <option value=""> All Status </option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>

          <button
            className="btn btn-primary btn-sm px-3 fw-semibold shadow-sm ms-auto"
            onClick={createCurriculum}
          >
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
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>School Year</th>
                    <th>Status</th>
                    <th>Created At</th>
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
                          <span
                            className={`badge ${curr.is_active ? "bg-success" : "bg-secondary"}`}
                          >
                            {curr.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>{new Date(curr.created_at).toLocaleString()}</td>
                        <td className="d-flex justify-content-center gap-2">
                          <button
                            className="btn btn-sm btn-outline-primary rounded-3"
                            onClick={() => editCurriculum(curr.curriculum_id)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-outline-success rounded-3"
                            onClick={() => assignSubject(curr.curriculum_id)}
                          >
                            Assign Subject
                          </button>
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
    </div>
  );
};

export default CurriculumList;
