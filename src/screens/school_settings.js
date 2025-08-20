import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { checkToken } from '../components/token_checker'; 
const SchoolDefaultUpdateForm = () => {
  const [schoolData, setSchoolData] = useState({}); 
  const [logoPreview, setLogoPreview] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const schoolId = '1234567890';
  const token = sessionStorage.getItem('token');

   

  useEffect(() => {
    
    axios
      .get(`http://localhost:3001/esf10/school-defaults/${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setSchoolData(res.data || {});
        if (res.data?.school_logo) {
          const logoUrl = res.data.school_logo.startsWith('http')
            ? res.data.school_logo
            : `http://localhost:3001${res.data.school_logo}`;
          setLogoPreview(logoUrl);
        } else {
          setLogoPreview(null);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch school default data.');
        setLoading(false);
      });
  }, [schoolId, token]);

useEffect(() => {
                checkToken();
               }, []);
               
  const handleChange = (e) => {
    const { name, value } = e.target;
    setSchoolData((prev) => ({ ...prev, [name]: value }));
  };

 
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSchoolData((prev) => ({ ...prev, logo: file }));
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
      const blobUrl = URL.createObjectURL(file);
      setLogoPreview(blobUrl);
    }
  };

 
  const handleSubmit = async (e) => {

    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const formData = new FormData();

      Object.entries(schoolData).forEach(([key, value]) => {
        if (key === 'logo' && value instanceof File) {
          formData.append('school_logo', value);
        } else if (value !== undefined && value !== null && key !== 'school_logo' && key !== 'logo') {
          formData.append(key, value);
        }
      });

      await axios.put(
        `http://localhost:3001/esf10/school-defaults/${schoolId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }

      );

     
      const res = await axios.get(`http://localhost:3001/esf10/school-defaults/${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSchoolData(res.data || {});

      if (res.data?.school_logo) {
        const logoUrl = res.data.school_logo.startsWith('http')
          ? res.data.school_logo
          : `http://localhost:3001${res.data.school_logo}`;
        setLogoPreview(logoUrl);
      } else {
        setLogoPreview(null);
      }

      setSuccessMsg('School default data updated successfully.');
       window.location.reload();
    } catch (err) {
      console.error(err);
      setError('Failed to update school default data.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="spinner-border text-primary" role="status" />
        <span className="ms-3 fs-5 text-muted">Loading school data...</span>
      </div>
    );
  }

  const readOnlyFields = ['school_id', 'created_at', 'updated_at', 'user'];

  return (
    <div className="container">
      <div className="card shadow rounded-4 p-4 bg-white">
       
        <div
          className="mb-4 rounded-3 text-white text-center py-3"
          style={{
            background: 'linear-gradient(135deg, #0d6efd 0%, #0040d6 100%)',
            fontWeight: 600,
            fontSize: '1.6rem',
            letterSpacing: '1px',
            userSelect: 'none',
            boxShadow: '0 4px 15px rgba(13, 110, 253, 0.5)',
          }}
        >
          Update School Default Information
        </div>

        {successMsg && (
          <div className="alert alert-success alert-dismissible fade show" role="alert">
            {successMsg}
            <button
              type="button"
              className="btn-close"
              onClick={() => setSuccessMsg('')}
              aria-label="Close"
            />
          </div>
        )}
        {error && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            {error}
            <button
              type="button"
              className="btn-close"
              onClick={() => setError('')}
              aria-label="Close"
            />
          </div>
        )}

      
<section className="mb-5">
  <h6 className="text-secondary fw-semibold mb-3" style={{ letterSpacing: '0.05em' }}>
    School Information
  </h6>
  <div className="d-flex flex-wrap gap-3 align-items-center">
    
    <div
      className="rounded-circle overflow-hidden shadow-sm"
      style={{
        width: 100,
        height: 100,
        border: '2px solid #0d6efd',
        flexShrink: 0,
        backgroundColor: '#e9ecef',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {logoPreview ? (
        <img
          src={logoPreview}
          alt="School Logo"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span className="text-muted" style={{ fontSize: '0.8rem' }}>
          No Logo
        </span>
      )}
    </div>

   
    <div className="flex-grow-1">
      <label htmlFor="school_logo" className="form-label fw-semibold">
        Upload New Logo
      </label>
      <input
        type="file"
        className="form-control"
        id="school_logo"
        name="school_logo"
        accept="image/*"
        onChange={handleLogoChange}
      />
    </div>
  </div>
</section>


        
        <form onSubmit={handleSubmit}>
          <h6 className="text-secondary fw-semibold mb-4" style={{ letterSpacing: '0.05em' }}>
            Editable Fields
          </h6>

          <div className="row g-4">
            
            <div className="col-12 col-md-6">
              <label htmlFor="school_logo" className="form-label fw-semibold">
                School Logo
              </label>
              <input
                type="file"
                className="form-control"
                id="school_logo"
                name="school_logo"
                accept="image/*"
                onChange={handleLogoChange}
              />
            </div>

      
            {Object.entries(schoolData).map(([key, value]) => {
              if (readOnlyFields.includes(key)) return null;
              if (key === 'logo' || key === 'school_logo') return null;

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
                      autoComplete="off"
                      style={{ borderRadius: '12px' }}
                    />
                    <label htmlFor={key} className="text-muted" style={{ fontWeight: 600 }}>
                      {key.replace(/_/g, ' ')}
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-end">
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-lg px-5 rounded-pill"
              style={{ fontWeight: 600, letterSpacing: '0.05em' }}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SchoolDefaultUpdateForm;
