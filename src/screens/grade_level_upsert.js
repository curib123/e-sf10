import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaInfoCircle,
} from "react-icons/fa";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const icons = {
  success: <FaCheckCircle size={24} />,
  danger: <FaTimesCircle size={24} />,
  warning: <FaExclamationTriangle size={24} />,
  info: <FaInfoCircle size={24} />,
};

const GradeLevelUpsert = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const [formData, setFormData] = useState({
    grade_code: "",
    grade_name: "",
    grade_order: "",
  });
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusModal, setStatusModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "info",
    icon: icons.info,
  });
  const inFlight = useRef(false);

  const showStatus = (variant, title, message) =>
    setStatusModal({ show: true, title, message, variant, icon: icons[variant] });

  const handleUnauthorized = () => {
    showStatus("danger", "Unauthorized", "Please login to continue.");
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 1000);
  };

  const apiFetch = async (path, options = {}) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error("Unauthorized");
    }
    return res;
  };

  useEffect(() => {
    if (!isEdit || !token) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await apiFetch(`/grade-levels/${id}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error("Failed to fetch grade level");
        const data = await res.json();
        const grade = data.data ?? data;
        if (!grade?.grade_code) throw new Error("Grade level data invalid");

        const initial = {
          grade_code: grade.grade_code || "",
          grade_name: grade.grade_name || "",
          grade_order:
            grade.grade_order === 0 || grade.grade_order
              ? String(grade.grade_order)
              : "",
        };
        setFormData(initial);
        setInitialData(initial);
      } catch (err) {
        if (err.name !== "AbortError" && err.message !== "Unauthorized") {
          showStatus("danger", "Error", err.message || "Something went wrong.");
        }
      }
    })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id, token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const v =
      name === "grade_order" ? value.replace(/[^\d]/g, "").slice(0, 3) : value;
    setFormData((prev) => ({ ...prev, [name]: v }));
  };

  const validate = () => {
    const code = formData.grade_code.trim();
    const name = formData.grade_name.trim();
    const orderStr = String(formData.grade_order).trim();

    if (!code || !name || orderStr === "")
      return showStatus("warning", "Missing info", "Complete all fields."), null;

    const orderNum = Number(orderStr);
    if (!Number.isInteger(orderNum) || orderNum < 0)
      return showStatus("warning", "Invalid order", "Use a whole number (0+)."), null;

    return { grade_code: code, grade_name: name, grade_order: orderNum };
  };

  const noChanges = (payload) =>
    isEdit &&
    initialData &&
    payload.grade_code === initialData.grade_code &&
    payload.grade_name === initialData.grade_name &&
    String(payload.grade_order) === String(initialData.grade_order);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return handleUnauthorized();
    if (loading || inFlight.current) return;

    const payload = validate();
    if (!payload) return;
    if (noChanges(payload))
      return showStatus("info", "No changes", "Nothing to save.");

    setLoading(true);
    inFlight.current = true;
    try {
      const path = isEdit
        ? `/grade-levels/update/${id}`
        : `/grade-levels/create`;
      const method = isEdit ? "PUT" : "POST";
      const res = await apiFetch(path, { method, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      const success = data?.success ?? res.ok;

      if (success) {
        showStatus(
          "success",
          "Saved",
          data?.message || (isEdit ? "Updated." : "Created.")
        );
        if (!isEdit) {
          setFormData({ grade_code: "", grade_name: "", grade_order: "" });
          setInitialData(null);
        } else {
          setInitialData({
            grade_code: payload.grade_code,
            grade_name: payload.grade_name,
            grade_order: String(payload.grade_order),
          });
        }
      } else {
        showStatus("danger", "Error", data?.message || "Request failed.");
      }
    } catch (err) {
      if (err.message !== "Unauthorized")
        showStatus("danger", "Error", "Something went wrong.");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  return (
    <div className="container-xxl py-5">
      <div className="row justify-content-center">
        {/* Wider container: up to 9/12 columns on XL, 8/12 on LG */}
        <div className="col-12 col-lg-8 col-xl-9">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4 p-lg-5">
              <h4 className="fw-bold mb-4">
                {isEdit ? "Edit Grade Level" : "New Grade Level"}
              </h4>

              <form
                onSubmit={handleSubmit}
                noValidate
                className="d-flex flex-column gap-3"
              >
                <div className="form-floating">
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    id="grade_code"
                    name="grade_code"
                    placeholder="G1"
                    value={formData.grade_code}
                    onChange={handleChange}
                    autoComplete="off"
                    maxLength={16}
                    required
                  />
                  <label htmlFor="grade_code">Code</label>
                </div>

                <div className="form-floating">
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    id="grade_name"
                    name="grade_name"
                    placeholder="Grade 1"
                    value={formData.grade_name}
                    onChange={handleChange}
                    autoComplete="off"
                    maxLength={64}
                    required
                  />
                  <label htmlFor="grade_name">Name</label>
                </div>

                <div className="form-floating">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-control form-control-lg"
                    id="grade_order"
                    name="grade_order"
                    placeholder="1"
                    value={formData.grade_order}
                    onChange={handleChange}
                    required
                  />
                  <label htmlFor="grade_order">Order</label>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-3">
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
                    {loading && (
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                      />
                    )}
                    {isEdit ? "Save" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Processing pill */}
      {loading && (
        <div className="position-fixed bottom-0 start-50 translate-middle-x mb-3 px-3 py-2 d-inline-flex align-items-center gap-2 bg-body border rounded-pill shadow-sm">
          <span className="spinner-border spinner-border-sm" role="status" />
          <span>Processing…</span>
        </div>
      )}

      <StatusModal
        {...statusModal}
        onHide={() => setStatusModal((s) => ({ ...s, show: false }))}
      />
    </div>
  );
};

export default GradeLevelUpsert;
