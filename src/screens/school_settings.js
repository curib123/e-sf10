import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const LOGO_URL = process.env.REACT_APP_API_LOGO_URL;

const SCHOOL_ID = "1234567890";
const READ_ONLY_FIELDS = ["school_id", "created_at", "updated_at", "user", "id", "_id"];

// Prefer showing these first (if they exist)
const FIELD_ORDER = [
  "school_name",
  "school_code",
  "address",
  "city",
  "province",
  "country",
  "zip",
  "email",
  "phone",
  "website",
];

const labelize = (k) =>
  String(k)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const guessType = (key) => {
  if (/email/i.test(key)) return "email";
  if (/phone|tel|mobile/i.test(key)) return "tel";
  if (/zip|postal/i.test(key)) return "text";
  if (/website|url/i.test(key)) return "url";
  if (/date/i.test(key)) return "date";
  if (/code|number|order|no$/i.test(key)) return "text";
  return "text";
};

const sortEntries = (entries) => {
  const orderIndex = new Map(FIELD_ORDER.map((k, i) => [k, i]));
  return entries
    .filter(([k]) => !READ_ONLY_FIELDS.includes(k) && k !== "logo" && k !== "school_logo")
    .sort(([a], [b]) => {
      const ai = orderIndex.has(a) ? orderIndex.get(a) : Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.has(b) ? orderIndex.get(b) : Number.MAX_SAFE_INTEGER;
      return ai - bi || a.localeCompare(b);
    });
};

const SchoolDefaultUpdateForm = () => {
  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [schoolData, setSchoolData] = useState({});
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "danger",
  });

  const dropRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initial fetch
  useEffect(() => {
    checkToken();
    const fetchData = async () => {
      try {
        const { data } = await axios.get(`${BASE_URL}/school-defaults/${SCHOOL_ID}`, {
          headers: authHeaders,
        });
        setSchoolData(data || {});
        const raw = data?.school_logo;
        const src = raw
          ? raw.startsWith("http")
            ? raw
            : `${LOGO_URL || "http://localhost:3001"}${raw}`
          : null;
        setLogoPreview(src);
      } catch (e) {
        setModal({
          show: true,
          title: "❌ Error",
          message: "Failed to fetch school data.",
          variant: "danger",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // warn on unsaved changes
    const beforeUnload = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [authHeaders, dirty]);

  // Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    setDirty(true);
    setSchoolData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoFile = (file) => {
    if (!file) return;
    setDirty(true);
    setSchoolData((prev) => ({ ...prev, logo: file }));
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleLogoChange = (e) => handleLogoFile(e.target.files?.[0]);

  const clearLogo = () => {
    setDirty(true);
    setSchoolData((prev) => {
      const next = { ...prev };
      delete next.logo;
      return next;
    });
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
  };

  const resetLogoToServer = async () => {
    try {
      const { data } = await axios.get(`${BASE_URL}/school-defaults/${SCHOOL_ID}`, {
        headers: authHeaders,
      });
      const raw = data?.school_logo;
      const src = raw
        ? raw.startsWith("http")
          ? raw
          : `${LOGO_URL || "http://localhost:3001"}${raw}`
        : null;
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
      setLogoPreview(src);
      setSchoolData((prev) => {
        const next = { ...prev };
        delete next.logo;
        return next;
      });
    } catch {
      setModal({
        show: true,
        title: "⚠️ Info",
        message: "Unable to reset logo from server.",
        variant: "warning",
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      return setModal({
        show: true,
        title: "Unauthorized",
        message: "Authorization token missing.",
        variant: "danger",
      });
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(schoolData).forEach(([key, value]) => {
        if (key === "logo" && value instanceof File) {
          formData.append("school_logo", value);
        } else if (value !== undefined && value !== null && key !== "school_logo") {
          formData.append(key, value);
        }
      });

      await axios.put(`${BASE_URL}/school-defaults/${SCHOOL_ID}`, formData, {
        headers: { ...authHeaders, "Content-Type": "multipart/form-data" },
      });

      // refresh
      const { data } = await axios.get(`${BASE_URL}/school-defaults/${SCHOOL_ID}`, {
        headers: authHeaders,
      });
      setSchoolData(data || {});
      const raw = data?.school_logo;
      const src = raw
        ? raw.startsWith("http")
          ? raw
          : `${LOGO_URL || "http://localhost:3001"}${raw}`
        : null;
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
      setLogoPreview(src);

      setDirty(false);
      setModal({
        show: true,
        title: "✅ Success",
        message: "School information updated successfully.",
        variant: "success",
      });
      window.location.reload();
    } catch (err) {
      setModal({
        show: true,
        title: "❌ Error",
        message: "Failed to update school information.",
        variant: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Drag & drop
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const prevent = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDrop = (e) => {
      prevent(e);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) handleLogoFile(file);
    };
    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) =>
      el.addEventListener(ev, prevent)
    );
    el.addEventListener("drop", onDrop);
    return () => {
      ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) =>
        el.removeEventListener(ev, prevent)
      );
      el.removeEventListener("drop", onDrop);
    };
  }, [logoPreview]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="container my-4 my-md-5">
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4 p-md-5">
            <div className="placeholder-glow mb-3">
              <span className="placeholder col-6"></span>
            </div>
            <div className="row g-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="col-12 col-md-6" key={i}>
                  <div className="placeholder-glow">
                    <span className="placeholder col-12" style={{ height: 58 }}></span>
                  </div>
                </div>
              ))}
            </div>
            <div className="d-flex justify-content-end gap-2 mt-4">
              <span className="placeholder col-2" style={{ height: 44 }}></span>
              <span className="placeholder col-3" style={{ height: 44 }}></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sorted = sortEntries(Object.entries(schoolData));

  return (
    <div className="container my-4 my-md-5">
      <StatusModal
        {...modal}
        onHide={() => setModal((m) => ({ ...m, show: false }))}
      />

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        {/* Top bar */}
        <div className="border-bottom bg-light px-4 px-md-5 py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center gap-3">
            <div className="rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center"
                 style={{ width: 44, height: 44 }}>
              <i className="bi bi-building fs-5 text-primary"></i>
            </div>
            <div>
              <h5 className="mb-0 fw-bold">Update School Information</h5>
              <small className="text-muted">
                Edit general details & logo. Applies system-wide.
              </small>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => window.history.back()}
            >
              <i className="bi bi-arrow-left"></i> Back
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="card-body p-4 p-md-5">
          {/* Logo */}
          <section className="rounded-4 border p-3 p-md-4 mb-4">
            <div className="row g-3 align-items-center">
              <div className="col-12 col-md-auto">
                <div
                  className="rounded-circle border position-relative overflow-hidden shadow-sm bg-body"
                  style={{ width: 104, height: 104 }}
                >
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="School Logo"
                      className="w-100 h-100"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted">
                      <i className="bi bi-image fs-3"></i>
                    </div>
                  )}
                </div>
              </div>

              <div className="col">
                <div
                  ref={dropRef}
                  className="dropzone border rounded-3 p-3 p-md-4 h-100 d-flex flex-column justify-content-center"
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => (e.key === "Enter" ? fileInputRef.current?.click() : null)}
                  aria-label="Upload logo"
                >
                  <div className="d-flex align-items-center gap-3 flex-wrap">
                    <div className="flex-grow-1">
                      <div className="fw-semibold">Upload New Logo</div>
                      <small className="text-muted">
                        Drag & drop or click to browse. Prefer square PNG (e.g., 512×512).
                      </small>
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetLogoToServer();
                        }}
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearLogo();
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="d-none"
                    onChange={handleLogoChange}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="row g-3">
              {sorted.map(([key, value]) => (
                <div className="col-12 col-md-6" key={key}>
                  <div className="form-floating">
                    <input
                      type={guessType(key)}
                      className="form-control modern-input"
                      id={key}
                      name={key}
                      placeholder={labelize(key)}
                      value={value ?? ""}
                      onChange={handleChange}
                      autoComplete="on"
                    />
                    <label htmlFor={key} className="text-muted fw-semibold">
                      {labelize(key)}
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {/* Sticky action bar */}
            <div className="sticky-actions mt-4">
              <div className="actions-inner d-flex flex-wrap justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-light border"
                  onClick={() => window.history.back()}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg rounded-pill px-4"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Saving…
                    </>
                  ) : dirty ? (
                    "Save Changes"
                  ) : (
                    "Saved"
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* System fields (read-only) */}
          <details className="mt-4">
            <summary className="text-muted">System fields</summary>
            <div className="row g-2 mt-2">
              {Object.entries(schoolData)
                .filter(([k]) => READ_ONLY_FIELDS.includes(k) || k === "school_logo")
                .map(([k, v]) => (
                  <div className="col-12 col-md-6" key={k}>
                    <div className="form-control bg-light-subtle">
                      <small className="text-uppercase text-muted">{labelize(k)}</small>
                      <div className="fw-semibold text-truncate" title={String(v ?? "")}>
                        {String(v ?? "—")}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </details>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        .modern-input {
          border-radius: 12px;
          transition: box-shadow .2s ease, border-color .2s ease;
        }
        .modern-input:focus {
          border-color: rgba(13,110,253,.45);
          box-shadow: 0 0 0 .25rem rgba(13,110,253,.15);
        }
        .dropzone {
          background: var(--bs-body-bg);
          transition: border-color .2s ease, box-shadow .2s ease;
          border-style: dashed !important;
        }
        .dropzone:hover, .dropzone:focus-visible {
          border-color: rgba(13,110,253,.6) !important;
          box-shadow: 0 0 0 .25rem rgba(13,110,253,.08);
        }
        .sticky-actions {
          position: sticky;
          bottom: 0;
          z-index: 5;
          padding-top: .25rem;
        }
        .actions-inner {
          backdrop-filter: blur(6px);
          background: color-mix(in srgb, var(--bs-body-bg) 88%, transparent);
          border: 1px solid var(--bs-border-color);
          border-radius: 999px;
          padding: .5rem;
          box-shadow: 0 8px 24px rgba(0,0,0,.06);
        }
        @media (max-width: 480px) {
          .btn.btn-lg { padding-top: .5rem; padding-bottom: .5rem; }
        }
      `}</style>
    </div>
  );
};

export default SchoolDefaultUpdateForm;
