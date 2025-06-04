
import { useState } from 'react';

const Add_User = () => {
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'admin',
  });

  const [response, setResponse] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch('http://localhost:3001/esf10/register-Admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setResponse({ type: 'success', message: data.message });
      } else {
        setResponse({ type: 'danger', message: data.message || 'Registration failed' });
      }
    } catch (err) {
      setResponse({ type: 'danger', message: 'Network error or server not available' });
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-start min-vh-100">
      <div className="card shadow-md p-4 rounded" style={{ maxWidth: '1000px', width: '100%' }}>
        <h3 className="text-center mb-3">Create Users Account</h3>
        <p className="text-muted text-center mb-4">Admin / Staff / Teacher /Student </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">First Name</label>
            <input
              type="text"
              className="form-control"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Middle Name</label>
            <input
              type="text"
              className="form-control"
              name="middle_name"
              value={formData.middle_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Last Name</label>
            <input
              type="text"
              className="form-control"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-4">
            <label className="form-label">Role</label>
            <select
              className="form-select"
              name="role"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
              {/* Add more roles if needed */}
            </select>
          </div>

          <button type="submit" className="btn btn-secondary w-100">
            Create User
          </button>
        </form>

        {response && (
          <div className={`alert alert-${response.type} mt-4`} role="alert">
            {response.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Add_User;
