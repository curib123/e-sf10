import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaSearch } from "react-icons/fa";
import 'bootstrap/dist/css/bootstrap.min.css';

const User = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("http://localhost:3001/esf10/users", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) throw new Error(`Error: ${res.status} ${res.statusText}`);

        const data = await res.json();
        setUsers(data);
        setFilteredUsers(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [token]);

  useEffect(() => {
    const lowerSearch = search.toLowerCase();
    const filtered = users.filter(user =>
      `${user.first_name} ${user.middle_name || ""} ${user.last_name}`.toLowerCase().includes(lowerSearch) ||
      user.email.toLowerCase().includes(lowerSearch) ||
      user.roles.toLowerCase().includes(lowerSearch)
    );
    setFilteredUsers(filtered);
  }, [search, users]);

  const handleEdit = (userId) => {
    console.log("Edit user:", userId);
  };

  const handleRemove = async (userId) => {
    if (window.confirm("Are you sure you want to remove this user?")) {
      try {
        const res = await fetch(`http://localhost:3001/esf10/users/${userId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error("Failed to delete user");

        const updatedUsers = users.filter(user => user.user_id !== userId);
        setUsers(updatedUsers);
      } catch (err) {
        alert("Error removing user: " + err.message);
      }
    }
  };

  if (loading) return <div className="container mt-5">Loading users...</div>;
  if (error) return <div className="container mt-5 text-danger">Error: {error}</div>;

  return (
    <div className="container-fluid mt-4">
      {/* Search + Button Row */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div className="input-group shadow-sm" style={{ maxWidth: "300px" }}>
          <span className="input-group-text bg-light">
            <FaSearch />
          </span>
          <input
            type="text"
            className="form-control"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Link to="/add_user" className="btn btn-primary d-flex align-items-center gap-2 shadow-sm">
          <FaPlus />
          <span>Create Users Account</span>
        </Link>
      </div>

      {/* Table */}
      <div className="table-responsive shadow-sm rounded border">
        <table className="table table-hover table-striped align-middle mb-0">
          <thead className="table-dark text-center">
            <tr>
              <th>User ID</th>
              <th>First Name</th>
              <th>Middle Name</th>
              <th>Last Name</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="text-center">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-muted py-3">No users found</td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.user_id}>
                  <td>{user.user_id}</td>
                  <td>{user.first_name}</td>
                  <td>{user.middle_name || "-"}</td>
                  <td>{user.last_name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className="badge bg-secondary">{user.roles}</span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleString()}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => handleEdit(user.user_id)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleRemove(user.user_id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default User;
