import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { checkToken } from '../components/token_checker';

const UserForm = () => {
  const { userId } = useParams();
  const isEditing = !!userId;

  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    password: '',
    role: '', // Stores role_name
    currentPassword: '',
    newPassword: '',
  });

  const [roles, setRoles] = useState([]);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const selectedRoleId = roles.find((r) => r.role_name === formData.role)?.role_id || '';

  useEffect(() => {
    checkToken();
  }, []);

  useEffect(() => {
    const fetchRoles = async () => {
      const token = sessionStorage.getItem('token');
      if (!token) return;

      try {
        const res = await fetch('http://localhost:3001/esf10/roles/Roles-and-Permissions', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.roles)) {
          setRoles(data.roles);

          // Set default role for new users
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

        const data = await res.json();
        if (!res.ok) throw new Error('Failed to fetch user data');

        setFormData({
          first_name: data.first_name || '',
          middle_name: data.middle_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          password: '',
          role: data.roles, // This should be role_name
          currentPassword: '',
          newPassword: '',
        });
      } catch (error) {
        console.error(error);
        setResponse({ type: 'danger', message: 'Failed to load user data' });
      }
    };

    fetchUserData();
  }, [isEditing, userId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "role") {
      const selectedRole = roles.find((r) => r.role_id === parseInt(value));
      if (selectedRole) {
        setFormData((prev) => ({
          ...prev,
          role: selectedRole.role_name, // Always store role_name
        }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

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
          }),
        });

        const userData = await resUser.json();
        if (!resUser.ok) {
          setResponse({ type: 'danger', message: userData.message || 'Failed to update user' });
          return;
        }

        const resRole = await fetch('http://localhost:3001/esf10/roles/update-user-role', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: Number(userId),
            role_ids: [roles.find(r => r.role_name === formData.role)?.role_id],
          }),
        });

        const roleData = await resRole.json();
        if (!resRole.ok || !roleData.success) {
          setResponse({ type: 'danger', message: roleData.message || 'Failed to update role.' });
          return;
        }

        if (formData.currentPassword || formData.newPassword) {
          if (!formData.currentPassword || !formData.newPassword) {
            setResponse({ type: 'danger', message: 'Both current and new passwords are required.' });
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

          setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '' }));
          setResponse({ type: 'success', message: passwordData.message || 'Password updated successfully' });
        }

        setResponse({ type: 'success', message: 'User updated successfully' });
      } else {
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
            role: formData.role, // role_name
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

              <div className="col-md-6">
                <label className="form-label">Role</label>
                <select
                  className="form-select rounded-pill px-4"
                  name="role"
                  value={selectedRoleId}
                  onChange={handleChange}
                  required
                >
                  <option disabled value="">Select a role</option>
                  {roles.map((roleObj) => (
                    <option key={roleObj.role_id} value={roleObj.role_id}>
                      {roleObj.role_name.charAt(0).toUpperCase() + roleObj.role_name.slice(1).replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

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
