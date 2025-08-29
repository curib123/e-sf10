import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { checkToken } from '../components/token_checker';
import StatusModal from '../components/status_modal';

const SchoolDefaultUpdateForm = () => {
  const [schoolData, setSchoolData] = useState({});
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState({ show: false, title: '', message: '', variant: 'danger' });

  const BASE_URL = 'http://localhost:3001/esf10';
  const LOGO_URL = process.env.REACT_APP_API_LOGO_URL;
  const schoolId = '1234567890';
  const token = sessionStorage.getItem('token');

  useEffect(() => {
    checkToken();
    axios
      .get(`${BASE_URL}/school-defaults/${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(res => {
        setSchoolData(res.data || {});
        // Keep logo fetch logic unchanged
        setLogoPreview(
          res.data?.school_logo
            ? res.data.school_logo.startsWith('http')
              ? res.data.school_logo
              : `http://localhost:3001${res.data.school_logo}`
            : null
        );
      })
      .catch(() =>
        setModal({ show: true, title: '❌ Error', message: 'Failed to fetch school data.', variant: 'danger' })
      )
      .finally(() => setLoading(false));
  }, [schoolId, token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSchoolData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSchoolData(prev => ({ ...prev, logo: file }));
      if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData();
      Object.entries(schoolData).forEach(([key, value]) => {
        if (key === 'logo' && value instanceof File) formData.append('school_logo', value);
        else if (value !== undefined && value !== null && key !== 'school_logo') formData.append(key, value);
      });

      await axios.put(`${BASE_URL}/school-defaults/${schoolId}`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });

      const res = await axios.get(`${BASE_URL}/school-defaults/${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSchoolData(res.data || {});
      // Keep logo fetch logic unchanged
      setLogoPreview(
        res.data?.school_logo
          ? res.data.school_logo.startsWith('http')
            ? res.data.school_logo
            : `${LOGO_URL}${res.data.school_logo}`
          : null
      );

      setModal({ show: true, title: '✅ Success', message: 'School default data updated successfully.', variant: 'success' });
      window.location.reload();
    } catch {
      setModal({ show: true, title: '❌ Error', message: 'Failed to update school default data.', variant: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="spinner-border text-primary" role="status" />
        <span className="ms-3 fs-5 text-muted">Loading school data...</span>
      </div>
    );

  const READ_ONLY_FIELDS = ['school_id', 'created_at', 'updated_at', 'user'];

  return (
    <div className="container my-5">
      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />

      <div className="card shadow-sm rounded-4 p-4 bg-white">
        <h3 className="text-center text-primary mb-4 fw-semibold">Update School Information</h3>

        <section className="mb-4 d-flex flex-wrap align-items-center gap-3">
          <div
            className="rounded-circle overflow-hidden shadow-sm"
            style={{
              width: 100,
              height: 100,
              border: '2px solid #0d6efd',
              backgroundColor: '#e9ecef',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {logoPreview ? (
              <img src={logoPreview} alt="School Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span className="text-muted small">No Logo</span>
            )}
          </div>
          <div className="flex-grow-1">
            <label htmlFor="school_logo" className="form-label fw-semibold mb-1">
              Upload New Logo
            </label>
            <input type="file" className="form-control" id="school_logo" accept="image/*" onChange={handleLogoChange} />
          </div>
        </section>

        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            {Object.entries(schoolData).map(([key, value]) => {
              if (READ_ONLY_FIELDS.includes(key) || key === 'logo' || key === 'school_logo') return null;
              return (
                <div className="col-12 col-md-6" key={key}>
                  <div className="form-floating">
                    <input
                      type="text"
                      className="form-control"
                      id={key}
                      name={key}
                      placeholder={key.replace(/_/g, ' ')}
                      value={value || ''}
                      onChange={handleChange}
                      style={{ borderRadius: '12px' }}
                    />
                    <label htmlFor={key} className="text-muted fw-semibold">{key.replace(/_/g, ' ')}</label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-end">
            <button type="submit" disabled={submitting} className="btn btn-primary btn-lg rounded-pill px-5 fw-semibold">
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" /> Saving...
                </>
              ) : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SchoolDefaultUpdateForm;
