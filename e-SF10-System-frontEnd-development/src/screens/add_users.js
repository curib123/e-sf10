import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const UserForm = () => {
  const { userId } = useParams();
  const isEditing = !!userId;

  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    password: '',
    role: '',  // start empty, will set after roles load
    currentPassword: '',
    newPassword: '',
  });

  const [roles, setRoles] = useState([]);
  const [response, setResponse] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Fetch roles and permissions
    fetch('http://localhost:3001/esf10/roles/roles-and-permissions/all', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.roles) {
          setRoles(data.data.roles);

          // Set default role in formData if none set
          if (!formData.role) {
            setFormData((prev) => ({
              ...prev,
              role: data.data.roles[0]?.role_name || '',
            }));
          }
        } else {
          setResponse({ type: 'danger', message: 'Failed to load roles' });
        }
      })
      .catch(() =>
        setResponse({ type: 'danger', message: 'Error fetching roles' })
      );
  }, []); // Run once on mount

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (isEditing) {
      fetch(`http://localhost:3001/esf10/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(async (res) => {
          if (res.status === 404) {
            setResponse({ type: 'danger', message: 'User not found' });
            return null;
          }
          return res.json();
        })
        .then((data) => {
          if (data) {
            setFormData({
              first_name: data.first_name || '',
              middle_name: data.middle_name || '',
              last_name: data.last_name || '',
              email: data.email || '',
              password: '',
              // Assuming `data.roles` is an array of role names or role objects
              role:
                typeof data.roles === 'string'
                  ? data.roles
                  : data.roles?.[0]?.role_name || '', 
              currentPassword: '',
              newPassword: '',
            });
          }
        })
        .catch(() =>
          setResponse({ type: 'danger', message: 'Failed to load user data' })
        );
    }
  }, [isEditing, userId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      setResponse({ type: 'danger', message: 'No authorization token found.' });
      return;
    }

    try {
      if (isEditing) {
        // update user info, roles, and password (same as your original)
        // no change here, omitted for brevity
      } else {
        // create user logic (same as your original)
      }
    } catch (err) {
      setResponse({ type: 'danger', message: 'Network error or server unavailable' });
    }
  };

  return (
    <div className="container-fluid d-flex flex-column align-items-center justify-content-start min-vh-100 py-5">
      <div className="w-100 d-flex justify-content-end align-items-center px-3 mb-3" style={{ maxWidth: '1140px' }}>
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
                    required
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
                  value={formData.role}
                  onChange={handleChange}
                  required
                >
                  {roles.length > 0 ? (
                    roles.map(({ role_id, role_name }) => (
                      <option key={role_id} value={role_name}>
                        {role_name.charAt(0).toUpperCase() + role_name.slice(1).replace('_', ' ')}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      Loading roles...
                    </option>
                  )}
                </select>
              </div>

              <div className="col-12 mt-4">
                <button type="submit" className="btn btn-primary w-100 py-2 rounded-pill fs-5">
                  {isEditing ? 'Update User' : 'Create User'}
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
