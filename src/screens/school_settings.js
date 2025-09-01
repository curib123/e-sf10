import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { checkToken } from "../components/token_checker";
import StatusModal from "../components/status_modal";

const SchoolDefaultUpdateForm = () => {
  // --- ENV / CONSTS ---
  const BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const LOGO_URL = process.env.REACT_APP_API_LOGO_URL;
  const schoolId = "1234567890";

  // --- STATE ---
  const [schoolData, setSchoolData] = useState({});
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "danger",
  });

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  // readonly/system keys that we won't render as inputs
  const READ_ONLY_FIELDS = ["school_id", "created_at", "updated_at", "user", "id", "_id"];

  // Pretty label helper
  const labelize = (k) =>
    String(k)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  // --- EFFECT: initial fetch ---
  useEffect(() => {
    checkToken();
    const fetchData = async () => {
      try {
        const { data } = await axios.get(
          `${BASE_URL}/school-defaults/${schoolId}`,
          { headers: authHeaders }
        );
        setSchoolData(data || {});

        // Keep your original logo fallback logic, but use LOGO_URL when provided
        const raw = data?.school_logo;
        const src =
          raw
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
  }, [BASE_URL, LOGO_URL, authHeaders]);

  // --- HANDLERS ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setSchoolData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSchoolData((prev) => ({ ...prev, logo: file }));
    // revoke old blob preview to avoid leaks
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoPreview(URL.createObjectURL(file));
  };

  const clearLogo = () => {
    setSchoolData((prev) => {
      const next = { ...prev };
      delete next.logo;
      // keep existing school_logo field as-is; this only clears pending upload
      return next;
    });
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
  };

  const resetLogoToServer = async () => {
    // Re-fetch (logo only) from server without touching other form fields
    try {
      const { data } = await axios.get(
        `${BASE_URL}/school-defaults/${schoolId}`,
        { headers: authHeaders }
      );
      const raw = data?.school_logo;
      const src =
        raw
          ? raw.startsWith("http")
            ? raw
            : `${LOGO_URL || "http://localhost:3001"}${raw}`
          : null;
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
      setLogoPreview(src);
      setSchoolData((prev) => {
        const next = { ...prev };
        delete next.logo; // clear pending upload
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
          formData.append("school_logo", value); // server expects 'school_logo'
        } else if (value !== undefined && value !== null && key !== "school_logo") {
          formData.append(key, value);
        }
      });

      await axios.put(`${BASE_URL}/school-defaults/${schoolId}`, formData, {
        headers: {
          ...authHeaders,
          "Content-Type": "multipart/form-data",
        },
      });

      // refresh the data (no hard reload)
      const { data } = await axios.get(
        `${BASE_URL}/school-defaults/${schoolId}`,
        { headers: authHeaders }
      );
      setSchoolData(data || {});
      const raw = data?.school_logo;
      const src =
        raw
          ? raw.startsWith("http")
            ? raw
            : `${LOGO_URL || "http://localhost:3001"}${raw}`
          : null;
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
      setLogoPreview(src);

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

  // --- RENDER: loading ---
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="spinner-border text-primary" role="status" />
        <span className="ms-3 fs-5 text-muted">Loading school data...</span>
      </div>
    );
  }

  // --- RENDER: form ---
  return (
    <div className="container my-4 my-md-5">
      <StatusModal
        {...modal}
        onHide={() => setModal((m) => ({ ...m, show: false }))}
      />

      <div className="card shadow-sm rounded-4 border-0">
        {/* Header */}
        <div className="card-body p-4 p-md-5">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
            <div>
              <h4 className="fw-bold mb-1 text-primary text-truncate">
                Update School Information
              </h4>
              <small className="text-muted">
                Edit general details and logo. Changes save for the entire system.
              </small>
            </div>
          
          </div>

          {/* Logo Uploader */}
          <section className="border rounded-3 p-3 p-md-4 bg-white shadow-sm mb-4">
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <div
                className="rounded-circle overflow-hidden shadow-sm flex-shrink-0"
                style={{
                  width: 96,
                  height: 96,
                  border: "2px solid #0d6efd",
                  backgroundColor: "#f1f3f5",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="School Logo"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span className="text-muted small">No Logo</span>
                )}
              </div>

              <div className="flex-grow-1">
                <div className="row g-2">
                  <div className="col-12 col-md-8">
                    <label htmlFor="school_logo" className="form-label fw-semibold mb-1">
                      Upload New Logo
                    </label>
                    <input
                      type="file"
                      id="school_logo"
                      accept="image/*"
                      className="form-control"
                      onChange={handleLogoChange}
                    />
                    <small className="text-muted">
                      Recommended: square image (e.g., 512×512). PNG with transparent background looks best.
                    </small>
                  </div>
                  <div className="col d-flex gap-2 align-items-end">
                    <button
                      type="button"
                      className="btn btn-outline-secondary text-nowrap"
                      onClick={resetLogoToServer}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger text-nowrap"
                      onClick={clearLogo}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="row g-3">
              {Object.entries(schoolData).map(([key, value]) => {
                // hide system or upload-only fields
                if (READ_ONLY_FIELDS.includes(key)) return null;
                if (key === "logo" || key === "school_logo") return null;

                return (
                  <div className="col-12 col-md-6" key={key}>
                    <div className="form-floating">
                      <input
                        type="text"
                        className="form-control"
                        id={key}
                        name={key}
                        placeholder={labelize(key)}
                        value={value ?? ""}
                        onChange={handleChange}
                        style={{ borderRadius: 12 }}
                      />
                      <label htmlFor={key} className="text-muted fw-semibold">
                        {labelize(key)}
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="d-flex justify-content-end gap-2 mt-4">
              <button
                type="button"
                className="btn btn-light border text-nowrap"
                onClick={() => window.history.back()}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg rounded-pill px-4 text-nowrap"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Keep all action buttons to one line on any screen */}
      <style>{`
        .btn, .input-group-text, .form-select { white-space: nowrap; }
        @media (max-width: 480px) {
          .btn.btn-lg { padding-top: .5rem; padding-bottom: .5rem; }
        }
      `}</style>
    </div>
  );
};

export default SchoolDefaultUpdateForm;