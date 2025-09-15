import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FaArrowLeft,
  FaSave,
} from 'react-icons/fa';
import {
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const joinUrl = (path = "") => `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

async function apiFetch(path, { method = "GET", headers = {}, body, signal } = {}) {
  const token = sessionStorage.getItem("token");
  if (!token) throw new Error("Missing authorization token.");

  let res;
  try {
    res = await fetch(joinUrl(path), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...headers,
      },
      body,
      signal,
    });
  } catch (networkErr) {
    console.error("Network error:", networkErr);
    throw new Error("Network error. Check BASE_URL / CORS / server availability.");
  }

  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json().catch(() => ({})) : null;

  if (!res.ok) {
    console.error("API error:", res.status, data);
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  }
  return data ?? {};
}

export default function SectionUpsert() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = !!id;

  // form state
  const [form, setForm] = useState({
    section_name: "",
    grade_level_id: "",
    school_year_id: "",
  });

  // dropdown data
  const [gradeLevels, setGradeLevels] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);

  // ui state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ show: false, title: "", message: "", variant: "danger" });
  const onHideStatus = () => setStatus((s) => ({ ...s, show: false }));

  const applySectionToForm = (section) => {
    setForm({
      section_name: section?.section_name ?? "",
      grade_level_id: String(section?.grade_level_id ?? ""),
      school_year_id: String(section?.school_year_id ?? ""),
    });
  };

  // Load dropdowns + (if editing) the current record from /sections
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        // 1) Load dropdown data
        const [grades, years] = await Promise.all([
          apiFetch("/grade-levels", { signal: ac.signal }),                 // GET with Bearer
          apiFetch("/school-year/all-school-years", { signal: ac.signal }), // GET with Bearer
        ]);

        if (grades?.success) {
          const sorted = [...(grades.data || [])].sort(
            (a, b) => (a.grade_order ?? 0) - (b.grade_order ?? 0)
          );
          setGradeLevels(sorted);
        }

        let yearsList = [];
        if (years?.success) {
          yearsList = [...(years.schoolYears || [])];
          // keep all fields (including is_active) and sort newest first
          yearsList.sort((a, b) => (b.start_year ?? 0) - (a.start_year ?? 0));
          setSchoolYears(yearsList);
        }

        // 2) Prefill from navigation state if available and matches id
        const fromState = location.state?.section;
        if (isEdit && fromState && String(fromState.section_id) === String(id)) {
          applySectionToForm(fromState);
        } else if (isEdit) {
          // 3) Otherwise, fetch all sections and find the one to edit
          const all = await apiFetch("/sections", { signal: ac.signal }); // GET /esf10/sections
          if (!all?.success) throw new Error("Failed to load sections.");
          const found = (all.data || []).find((s) => String(s.section_id) === String(id));
          if (!found) throw new Error("Section not found.");
          applySectionToForm(found);
        } else {
          // 4) Create mode: auto-select ACTIVE school year if available
          // Try flag from /school-year/all-school-years
          const activeYears = yearsList.filter((y) => Number(y.is_active) === 1);
          let chosen = null;
          if (activeYears.length) {
            // choose the latest active by start_year
            chosen = activeYears.sort((a, b) => (b.start_year ?? 0) - (a.start_year ?? 0))[0];
          }

          // Fallback: if none flagged active, try /curriculum/active-curriculums for school_year_id
          if (!chosen) {
            try {
              const cur = await apiFetch("/curriculum/active-curriculums", { signal: ac.signal });
              const syId = cur?.data?.school_year_id;
              if (syId) {
                const match = yearsList.find((y) => String(y.school_year_id) === String(syId));
                if (match) chosen = match;
              }
            } catch {
              /* ignore fallback errors silently */
            }
          }

          if (chosen && !ac.signal.aborted) {
            setForm((f) => ({ ...f, school_year_id: String(chosen.school_year_id) }));
          }
        }
      } catch (err) {
        if (ac.signal.aborted) return;
        setStatus({
          show: true,
          title: "❌ Error",
          message: err.message || "Failed to load data.",
          variant: "danger",
        });
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [isEdit, id, location.state]);

  // Enable once name non-empty + both selects chosen
  const canSubmit = useMemo(
    () =>
      form.section_name.trim().length > 0 &&
      String(form.grade_level_id).length > 0 &&
      String(form.school_year_id).length > 0,
    [form]
  );

  const selectedGrade = useMemo(
    () => gradeLevels.find((g) => String(g.grade_level_id) === String(form.grade_level_id)),
    [gradeLevels, form.grade_level_id]
  );

  const selectedYear = useMemo(
    () => schoolYears.find((y) => String(y.school_year_id) === String(form.school_year_id)),
    [schoolYears, form.school_year_id]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) {
      setStatus({
        show: true,
        title: "ℹ️ Check form",
        message: "Please complete all required fields.",
        variant: "warning",
      });
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        section_name: form.section_name.trim(),
        grade_level_id: Number(form.grade_level_id),
        school_year_id: Number(form.school_year_id),
      };

      // Create or Update
      const path = isEdit ? `/sections/update/${id}` : `/sections/create`;
      const method = isEdit ? "PUT" : "POST";

      const data = await apiFetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setStatus({
        show: true,
        title: isEdit ? "✅ Updated" : "✅ Created",
        message:
          data?.message || (isEdit ? "Section updated successfully." : "Section created successfully."),
        variant: "success",
      });

      setTimeout(() => navigate("/sections"), 800);
    } catch (err) {
      setStatus({
        show: true,
        title: isEdit ? "❌ Update failed" : "❌ Create failed",
        message: err.message || (isEdit ? "Unable to update section." : "Unable to create section."),
        variant: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border" role="status" />
      </div>
    );
  }

  return (
    <div className="container-xxl my-4">
      <StatusModal {...status} onHide={onHideStatus} />

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          {/* Header */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
            <h4 className="fw-bold mb-0">{isEdit ? "Edit Section" : "Create Section"}</h4>
            <div className="d-flex gap-2 flex-nowrap">
              <button
                type="button"
                className="btn btn-light border d-flex align-items-center gap-2 px-3"
                onClick={() => navigate(-1)}
              >
                <FaArrowLeft /> Back
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="row g-3 g-lg-4">
            <div className="col-12">
              <label className="form-label fw-semibold">Section Name</label>
              <input
                className="form-control"
                placeholder="e.g., Section A"
                value={form.section_name}
                onChange={(e) => setForm((f) => ({ ...f, section_name: e.target.value }))}
                required
              />
              <div className="form-text">Enter any non-empty name.</div>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">Grade Level</label>
              <select
                className="form-select"
                value={form.grade_level_id}
                onChange={(e) => setForm((f) => ({ ...f, grade_level_id: String(e.target.value) }))}
                required
              >
                <option value="" disabled>
                  Select grade level…
                </option>
                {gradeLevels.map((g) => (
                  <option key={g.grade_level_id} value={String(g.grade_level_id)}>
                    {g.grade_name} {g.grade_code ? `(${g.grade_code})` : ""}
                  </option>
                ))}
              </select>
              <div className="form-text">Sorted by grade order for convenience.</div>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">School Year</label>
              <select
                className="form-select"
                value={form.school_year_id}
                onChange={(e) => setForm((f) => ({ ...f, school_year_id: String(e.target.value) }))}
                required
              >
                <option value="" disabled>
                  Select school year…
                </option>
                {schoolYears.map((y) => {
                  const label =
                    y.start_year > 0 && y.end_year > 0 ? `${y.start_year}-${y.end_year}` : "Unknown";
                  const active = Number(y.is_active) === 1;
                  return (
                    <option key={y.school_year_id} value={String(y.school_year_id)}>
                      {label}{active ? " (Active)" : ""}
                    </option>
                  );
                })}
              </select>
              <div className="form-text">
                Defaults to the active school year when creating a section.
              </div>
            </div>

            {/* Chips */}
            <div className="col-12">
              <div className="d-flex flex-wrap gap-2 small">
                {form.section_name.trim() && (
                  <span className="badge text-bg-light text-nowrap">
                    Name: {form.section_name.trim()}
                  </span>
                )}
                {selectedGrade && (
                  <span className="badge text-bg-secondary text-nowrap">
                    Grade: {selectedGrade.grade_name}
                  </span>
                )}
                {selectedYear && (
                  <span className="badge text-bg-info text-nowrap">
                    SY: {selectedYear.start_year}-{selectedYear.end_year}
                    {Number(selectedYear.is_active) === 1 ? " (Active)" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="col-12 d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-light border text-nowrap"
                onClick={() => navigate("/sections")}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-dark d-flex align-items-center gap-2 text-nowrap"
                disabled={!canSubmit || submitting}
                aria-disabled={!canSubmit || submitting}
              >
                {submitting && <span className="spinner-border spinner-border-sm" role="status" />}
                <FaSave /> {isEdit ? "Update Section" : "Create Section"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
