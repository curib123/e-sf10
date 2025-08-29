import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import StatusModal from '../components/status_modal';
import { checkToken } from '../components/token_checker';

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const UserUpsert = () => {
  const { userId } = useParams();
  const isEditing = !!userId;

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
  const [modal, setModal] = useState({ show: false, title: '', message: '', variant: 'danger' });
  const [loading, setLoading] = useState(false);

  const selectedRoleId = roles.find((r) => r.role_name === formData.role)?.role_id || '';

  useEffect(() => { checkToken(); }, []);

  // Fetch roles
  useEffect(() => {
    const fetchRoles = async () => {
      const token = sessionStorage.getItem('token');
      if (!token) return;

      try {
        const res = await fetch(`${BASE_URL}/roles/Roles-and-Permissions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.roles)) {
          setRoles(data.roles);
          if (!isEditing && !formData.role && data.roles.length > 0) {
            setFormData(prev => ({ ...prev, role: data.roles[0].role_name }));
          }
        } else throw new Error('Invalid roles response');
      } catch (err) {
        console.error(err);
        setModal({ show: true, title: 'Error', message: 'Failed to load roles.', variant: 'danger' });
      }
    };
    fetchRoles();
  }, [isEditing, formData.role]);

  // Fetch user data for editing
  useEffect(() => {
    const fetchUserData = async () => {
      const token = sessionStorage.getItem('token');
      if (!token || !isEditing) return;

      try {
        const res = await fetch(`${BASE_URL}/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 404) {
          return setModal({ show: true, title: 'Error', message: 'User not found', variant: 'danger' });
        }
        const data = await res.json();
        if (!res.ok) throw new Error('Failed to fetch user data');
        setFormData({
          first_name: data.first_name || '',
          middle_name: data.middle_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          password: '',
          role: data.roles,
          currentPassword: '',
          newPassword: '',
        });
      } catch (err) {
        console.error(err);
        setModal({ show: true, title: 'Error', message: 'Failed to load user data', variant: 'danger' });
      }
    };
    fetchUserData();
  }, [isEditing, userId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'role') {
      const selectedRole = roles.find((r) => r.role_id === parseInt(value));
      if (selectedRole) setFormData(prev => ({ ...prev, role: selectedRole.role_name }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('token');
    if (!token) return setModal({ show: true, title: 'Error', message: 'No authorization token found.', variant: 'danger' });

    if (!isEditing && formData.password.length < 6) {
      return setModal({ show: true, title: 'Error', message: 'Password must be at least 6 characters.', variant: 'danger' });
    }

    setLoading(true);

    try {
      if (isEditing) {
        // Update user
        const resUser = await fetch(`${BASE_URL}/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            first_name: formData.first_name,
            middle_name: formData.middle_name,
            last_name: formData.last_name,
            email: formData.email,
          }),
        });
        const userData = await resUser.json();
        if (!resUser.ok) throw new Error(userData.message || 'Failed to update user');

        // Update role
        const resRole = await fetch(`${BASE_URL}/roles/update-user-role`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            user_id: Number(userId),
            role_ids: [roles.find(r => r.role_name === formData.role)?.role_id],
          }),
        });
        const roleData = await resRole.json();
        if (!resRole.ok || !roleData.success) throw new Error(roleData.message || 'Failed to update role');

        // Update password if provided
        if (formData.currentPassword || formData.newPassword) {
          if (!formData.currentPassword || !formData.newPassword) {
            setLoading(false);
            return setModal({ show: true, title: 'Error', message: 'Both current and new passwords are required.', variant: 'danger' });
          }
          const resPassword = await fetch(`${BASE_URL}/user/${userId}/update-password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ currentPassword: formData.currentPassword, newPassword: formData.newPassword }),
          });
          const passwordData = await resPassword.json();
          if (!resPassword.ok) throw new Error(passwordData.message || 'Password update failed');
          setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '' }));
          setModal({ show: true, title: 'Success', message: passwordData.message || 'Password updated successfully', variant: 'success' });
        } else {
          setModal({ show: true, title: 'Success', message: 'User updated successfully', variant: 'success' });
        }
      } else {
        // Create user
        const res = await fetch(`${BASE_URL}/register-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
        if (!res.ok) throw new Error(data.message || 'Failed to create user');
        setFormData(prev => ({ ...prev, password: '' }));
        setModal({ show: true, title: 'Success', message: data.message || 'User created successfully', variant: 'success' });
      }
    } catch (err) {
      console.error(err);
      setModal({ show: true, title: 'Error', message: err.message || 'Network error', variant: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid d-flex flex-column align-items-center justify-content-start min-vh-100 py-5">
      <div className="w-100 d-flex justify-content-between align-items-center px-3 mb-3" style={{ maxWidth: '1140px' }}>
        <h2 className="text-center display-5 fw-bold mb-2">{isEditing ? 'Update' : 'Create'} User</h2>
        <button type="button" className="btn btn-outline-dark d-flex align-items-center gap-2 px-3 py-2 rounded-pill shadow-sm" onClick={() => window.history.back()}>
          <i className="bi bi-arrow-left-circle-fill fs-5"></i>
          <span>Back</span>
        </button>
      </div>

      <div className="card shadow-lg rounded-4 border-0 w-100" style={{ maxWidth: '1140px' }}>
        <div className="card-body p-5">
          <p className="text-center text-muted mb-4">Select a role and fill in the required information</p>

          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              {['first_name', 'middle_name', 'last_name'].map((field) => (
                <div className="col-md-4" key={field}>
                  <label className="form-label text-capitalize">{field.replace('_', ' ')}</label>
                  <input type="text" className="form-control rounded-pill px-4" name={field} value={formData[field]} onChange={handleChange} required={field !== 'middle_name'} />
                </div>
              ))}

              <div className="col-md-6">
                <label className="form-label">Email</label>
                <input type="email" className="form-control rounded-pill px-4" name="email" value={formData.email} onChange={handleChange} required />
              </div>

              {!isEditing && (
                <div className="col-md-6">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-control rounded-pill px-4" name="password" value={formData.password} onChange={handleChange} required />
                </div>
              )}

              {isEditing && (
                <>
                  <div className="col-md-6">
                    <label className="form-label">Current Password</label>
                    <input type="password" className="form-control rounded-pill px-4" name="currentPassword" value={formData.currentPassword} onChange={handleChange} placeholder="Enter current password" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">New Password</label>
                    <input type="password" className="form-control rounded-pill px-4" name="newPassword" value={formData.newPassword} onChange={handleChange} placeholder="Leave blank to keep old password" />
                  </div>
                </>
              )}

              <div className="col-md-6">
                <label className="form-label">Role</label>
                <select className="form-select rounded-pill px-4" name="role" value={selectedRoleId} onChange={handleChange} required>
                  <option disabled value="">Select a role</option>
                  {roles.map((roleObj) => (
                    <option key={roleObj.role_id} value={roleObj.role_id}>
                      {roleObj.role_name.charAt(0).toUpperCase() + roleObj.role_name.slice(1).replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 mt-4">
                <button type="submit" className="btn btn-primary w-100 py-2 rounded-pill fs-5" disabled={loading}>
                  {loading ? 'Processing...' : isEditing ? 'Update User' : 'Create User'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />
    </div>
  );
};

export default UserUpsert;
