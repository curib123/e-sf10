import React, { useEffect, useMemo, useRef, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { checkToken } from "../components/token_checker";
import { useNavigate, useParams } from "react-router-dom";
import StatusModal from "../components/status_modal";

// Single Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const SchoolYearUpsert = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [formData, setFormData] = useState({ start_year: "", end_year: "" });
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [modal, setModal] = useState({
    show: false, title: "", message: "", variant: "danger",
  });

  const inFlight = useRef(false);

  const authHeaders = () => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const showModal = (variant, title, message) =>
    setModal({ show: true, title, message, variant });

  const handleUnauthorized = () => {
    sessionStorage.removeItem("token");
    showModal("danger", "Unauthorized", "Please login to continue.");
    setTimeout(() => navigate("/login"), 900);
  };

  const apiFetch = async (path, options = {}) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error("Unauthorized");
    }
    return res;
  };

  // Load existing (Edit)
  useEffect(() => {
    checkToken();
    if (!isEdit || !token) return;

    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await apiFetch(`/school-year/school-year/${id}`, { signal: ctrl.signal });
        const data = await res.json();
        if (data?.success && data?.schoolYear) {
          const sy = data.schoolYear;
          setFormData({
            start_year: sy.start_year ?? "",
            end_year: sy.end_year ?? "",
          });
          setIsActive(sy.is_active === 1);
        } else {
          showModal("danger", "Failed", "Could not load the school year.");
        }
      } catch (err) {
        if (err.name !== "AbortError" && err.message !== "Unauthorized") {
          showModal("danger", "Error", "Something went wrong.");
        }
      }
    })();

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id, token]);

  // Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    const v = value.replace(/[^\d]/g, "").slice(0, 4); // only digits, 4 chars
    setFormData((prev) => {
      const next = { ...prev, [name]: v };
      if (name === "start_year" && v.length === 4) {
        const n = parseInt(v, 10);
        if (!Number.isNaN(n)) next.end_year = String(n + 1);
      }
      return next;
    });
  };

  const validate = () => {
    const s = String(formData.start_year).trim();
    const e = String(formData.end_year).trim();
    const sNum = parseInt(s, 10);
    const eNum = parseInt(e, 10);

    if (!s || !e) return [false, "Complete all fields."];
    if (s.length !== 4 || e.length !== 4) return [false, "Use 4-digit years."];
    if (!Number.isInteger(sNum) || !Number.isInteger(eNum)) return [false, "Years must be numbers."];
    if (eNum !== sNum + 1) return [false, "End year must be start year + 1."];
    if (sNum < 1990 || sNum > 2100) return [false, "Enter a valid range (1990–2100)."];
    return [true, { start_year: sNum, end_year: eNum }];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || inFlight.current) return;

    const [ok, payloadOrMsg] = validate();
    if (!ok) return showModal("warning", "Check fields", payloadOrMsg);

    setLoading(true);
    inFlight.current = true;
    try {
      const path = isEdit
        ? `/school-year/update-school-year/${id}`
        : `/school-year/create-school-year`;
      const method = isEdit ? "PUT" : "POST";

      const res = await apiFetch(path, { method, body: JSON.stringify(payloadOrMsg) });
      const data = await res.json().catch(() => ({}));
      const success = data?.success ?? res.ok;

      if (success) {
        showModal("success", "Saved", data?.message || (isEdit ? "Updated." : "Created."));
        if (isEdit) setTimeout(() => navigate(-1), 900);
        else setFormData({ start_year: "", end_year: "" });
      } else {
        showModal("danger", "Failed", data?.message || "Request failed.");
      }
    } catch (err) {
      if (err.message !== "Unauthorized") showModal("danger", "Error", "Something went wrong.");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  const handleToggleActive = async () => {
    if (!isEdit || toggleLoading) return;
    setToggleLoading(true);
    try {
      const res = await apiFetch(`/school-year/school-year/${id}/set-active`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive ? 0 : 1 }),
      });
      const data = await res.json().catch(() => ({}));
      const success = data?.success ?? res.ok;

      if (success) {
        setIsActive((v) => !v);
        showModal("success", "Updated", data?.message || "Status changed.");
      } else {
        showModal("danger", "Failed", data?.message || "Toggle failed.");
      }
    } catch {
      showModal("danger", "Error", "Toggle failed.");
    } finally {
      setToggleLoading(false);
    }
  };

  return (
    <div className="container-xxl py-5">
      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />

      {/* Wider centered column using Bootstrap grid only */}
      <div className="row justify-content-center">
        <div className="col-12 col-lg-10 col-xl-9 col-xxl-8">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4 p-lg-5">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold mb-0">{isEdit ? "Edit School Year" : "New School Year"}</h4>
                {isEdit && (
                  <div className="d-flex align-items-center gap-2">
                    <span className={`badge ${isActive ? "text-bg-success" : "text-bg-secondary"}`}>
                      {isActive ? "Active" : "Inactive"}
                    </span>
                    <div className="form-check form-switch m-0">
                      <input
                        id="toggleActive"
                        className="form-check-input"
                        type="checkbox"
                        checked={isActive}
                        onChange={handleToggleActive}
                        disabled={toggleLoading}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Vertical inputs */}
              <form onSubmit={handleSubmit} noValidate className="d-flex flex-column gap-3">
                <div className="form-floating">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-control form-control-lg"
                    id="start_year"
                    name="start_year"
                    placeholder="2027"
                    value={formData.start_year}
                    onChange={handleChange}
                    required
                  />
                  <label htmlFor="start_year">Start Year</label>
                </div>

                <div className="form-floating">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-control form-control-lg"
                    id="end_year"
                    name="end_year"
                    placeholder="2028"
                    value={formData.end_year}
                    onChange={handleChange}
                    required
                  />
                  <label htmlFor="end_year">End Year</label>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-2">
                  <button
                    type="button"
                    className="btn btn-light btn-lg rounded-3"
                    onClick={() => navigate(-1)}
                    disabled={loading}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg rounded-3 px-4"
                    disabled={loading}
                  >
                    {loading && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />}
                    {isEdit ? "Save" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Bootstrap-only non-blocking progress pill */}
      {loading && (
        <div className="position-fixed bottom-0 start-50 translate-middle-x mb-3 px-3 py-2 d-inline-flex align-items-center gap-2 bg-body border rounded-pill shadow-sm">
          <span className="spinner-border spinner-border-sm" role="status" />
          <span>Processing…</span>
        </div>
      )}
    </div>
  );
};

export default SchoolYearUpsert;
