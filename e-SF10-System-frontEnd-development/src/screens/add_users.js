import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { checkToken } from '../components/token_checker';

const UserForm = () => {
  const { userId } = useParams();
  const isEditing = !!userId;

  // ----------------------------
  // Form State
  // ----------------------------
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    password: '',
    role: '',
    currentPassword: '',
    newPassword: '',
  });

  const [roles, setRoles] = useState([]);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  // ----------------------------
  // Token Check on Mount
  // ----------------------------
  useEffect(() => {
    checkToken();
  }, []);

  // ----------------------------
  // Fetch Roles
  // ----------------------------
  useEffect(() => {
    const fetchRoles = async () => {
      const token = sessionStorage.getItem('token');
      if (!token) return;

      try {
        const res = await fetch('http://localhost:3001/esf10/roles/Roles-and-Permissions', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Failed to fetch roles');
        const data = await res.json();

        if (data.success && Array.isArray(data.roles)) {
          setRoles(data.roles);

          // Preselect role for new user
          if (!isEditing && !formData.role && data.roles.length > 0) {
            setFormData(prev => ({ ...prev, role: data.roles[0].role_name }));
          }
        } else {
          throw new Error('Invalid roles response');
        }
      } catch (error) {
        console.error(error);
        setResponse({ type: 'danger', message: 'Failed to load roles.' });
      }
    };

    fetchRoles();
  }, [isEditing, formData.role]);

  // ----------------------------
  // Fetch Existing User Data for Editing
  // ----------------------------
  useEffect(() => {
    const fetchUserData = async () => {
      const token = sessionStorage.getItem('token');
      if (!token || !isEditing) return;

      try {
        const res = await fetch(`http://localhost:3001/esf10/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 404) {
          setResponse({ type: 'danger', message: 'User not found' });
          return;
        }

        if (!res.ok) throw new Error('Failed to fetch user data');
        const data = await res.json();

        setFormData({
          first_name: data.first_name || '',
          middle_name: data.middle_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          password: '',
          role: data.roles || '',
          currentPassword: '',
          newPassword: '',
        });

        console.log(data);
      } catch (error) {
        console.error(error);
        setResponse({ type: 'danger', message: 'Failed to load user data' });
      }
    };

    fetchUserData();
  }, [isEditing, userId]);

  // ----------------------------
  // Handle Input Changes
  // ----------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ----------------------------
  // Submit Handler
  // ----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('token');
    if (!token) {
      setResponse({ type: 'danger', message: 'No authorization token found.' });
      return;
    }

    if (!isEditing && formData.password.length < 6) {
      setResponse({ type: 'danger', message: 'Password must be at least 6 characters.' });
      return;
    }

    setLoading(true);

    try {
      if (isEditing) {
        // Update User Info (without role)
        const resUser = await fetch(`http://localhost:3001/esf10/users/${userId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            first_name: formData.first_name,
            middle_name: formData.middle_name,
            last_name: formData.last_name,
            email: formData.email,
            // role omitted on update as requested
          }),
        });

        const userData = await resUser.json();
        if (!resUser.ok) {
          setResponse({ type: 'danger', message: userData.message || 'Failed to update user' });
          return;
        }

        // Role update removed per request

        // Update Password (if provided)
        if (formData.currentPassword || formData.newPassword) {
          if (!formData.currentPassword || !formData.newPassword) {
            setResponse({ type: 'danger', message: 'Both current and new passwords are required to update the password.' });
            setLoading(false);
            return;
          }

          const resPassword = await fetch(`http://localhost:3001/esf10/user/${userId}/update-password`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              currentPassword: formData.currentPassword,
              newPassword: formData.newPassword,
            }),
          });

          const passwordData = await resPassword.json();

          if (!resPassword.ok) {
            setResponse({ type: 'danger', message: passwordData.message || 'Password update failed' });
            setLoading(false);
            return;
          }

          setFormData(prev => ({
            ...prev,
            currentPassword: '',
            newPassword: '',
          }));

          setResponse({ type: 'success', message: passwordData.message || 'Password updated successfully' });
        }

        setResponse({ type: 'success', message: 'User updated successfully' });
      } else {
        // Create New User
        const res = await fetch('http://localhost:3001/esf10/register-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            first_name: formData.first_name,
            middle_name: formData.middle_name,
            last_name: formData.last_name,
            email: formData.email,
            password: formData.password,
            role: formData.role,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setResponse({ type: 'success', message: data.message || 'User created successfully' });
        } else {
          setResponse({ type: 'danger', message: data.message || 'Failed to create user' });
        }
      }
    } catch (err) {
      console.error(err);
      setResponse({ type: 'danger', message: 'Network error or server unavailable' });
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------
  // Render UI
  // ----------------------------
  return (
    <div className="container-fluid d-flex flex-column align-items-center justify-content-start min-vh-100 py-5">
      <div className="w-100 d-flex justify-content-between align-items-center px-3 mb-3" style={{ maxWidth: '1140px' }}>
        <h2 className="text-center display-5 fw-bold mb-2">{isEditing ? 'Update' : 'Create'} User</h2>
        <button
          type="button"
          className="btn btn-outline-dark d-flex align-items-center gap-2 px-3 py-2 rounded-pill shadow-sm"
          onClick={() => window.history.back()}
        >
          <i className="bi bi-arrow-left-circle-fill fs-5"></i>
          <span>Back</span>
        </button>
      </div>

      <div className="card shadow-lg rounded-4 border-0 w-100" style={{ maxWidth: '1140px' }}>
        <div className="card-body p-5">
          <p className="text-center text-muted mb-4">
            Select a role and fill in the required information
          </p>

          {response && (
            <div className={`alert alert-${response.type} text-center`} role="alert">
              {response.message}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              {['first_name', 'middle_name', 'last_name'].map((field) => (
                <div className="col-md-4" key={field}>
                  <label className="form-label text-capitalize">{field.replace('_', ' ')}</label>
                  <input
                    type="text"
                    className="form-control rounded-pill px-4"
                    name={field}
                    value={formData[field]}
                    onChange={handleChange}
                    required={field !== 'middle_name'}
                  />
                </div>
              ))}

              <div className="col-md-6">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control rounded-pill px-4"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              {!isEditing && (
                <div className="col-md-6">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-control rounded-pill px-4"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>
              )}

              {isEditing && (
                <>
                  <div className="col-md-6">
                    <label className="form-label">Current Password</label>
                    <input
                      type="password"
                      className="form-control rounded-pill px-4"
                      name="currentPassword"
                      value={formData.currentPassword}
                      onChange={handleChange}
                      placeholder="Enter current password"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">New Password</label>
                    <input
                      type="password"
                      className="form-control rounded-pill px-4"
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleChange}
                      placeholder="Leave blank to keep old password"
                    />
                  </div>
                </>
              )}

                {!isEditing && (
                <>

                    <div className="col-md-6">
                <label className="form-label">Role</label>
                <select
                  className="form-select rounded-pill px-4"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                >
                  <option disabled>Select a role</option>
                  {roles.map((roleObj) => (
                    <option key={roleObj.role_id} value={roleObj.role_name}>
                      {roleObj.role_name.charAt(0).toUpperCase() + roleObj.role_name.slice(1).replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
                </>
              )} 
              
              



              <div className="col-12 mt-4">
                <button
                  type="submit"
                  className="btn btn-primary w-100 py-2 rounded-pill fs-5"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : isEditing ? 'Update User' : 'Create User'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserForm;
