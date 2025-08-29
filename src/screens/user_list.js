import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaSearch } from "react-icons/fa";
import { getUserPermissions } from '../components/get_permission'; 
import { checkToken } from '../components/token_checker'; 

// Base API URL
const BASE_URL = "http://localhost:3001/esf10";

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;
  const token = sessionStorage.getItem("token");
  const [permissions, setPermissions] = useState([]);

  useEffect(() => { checkToken(); }, []);
  useEffect(() => { setPermissions(getUserPermissions()); }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${BASE_URL}/users`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`Error: ${res.status}`);
        const data = await res.json();
        setUsers(data);
        setFilteredUsers(data);

        const allRoles = data.flatMap(u => Array.isArray(u.roles) ? u.roles : [u.roles]);
        setRoles([...new Set(allRoles)]);

        const loggedInEmail = sessionStorage.getItem("user_email");
        setCurrentUser(data.find(u => u.email === loggedInEmail) || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [token]);

  useEffect(() => {
    const term = search.toLowerCase();
    let filtered = users.filter(user => {
      const fullName = `${user.first_name} ${user.middle_name || ""} ${user.last_name}`.toLowerCase();
      const rolesString = Array.isArray(user.roles) ? user.roles.join(", ").toLowerCase() : (user.roles || "").toLowerCase();
      return (fullName.includes(term) || user.email.toLowerCase().includes(term) || rolesString.includes(term))
        && (selectedRole === "" || rolesString.includes(selectedRole.toLowerCase()));
    });
    if (currentUser) {
      filtered = filtered.filter(u => u.user_id !== currentUser.user_id);
      filtered.unshift(currentUser);
    }
    setFilteredUsers(filtered);
    setCurrentPage(1);
  }, [search, users, selectedRole, currentUser]);

  const handleRemove = async () => {
    if (!userToDelete) return;
    try {
      const res = await fetch(`${BASE_URL}/users/${userToDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete user");
      setUsers(users.filter(u => u.user_id !== userToDelete));
      setShowConfirm(false);
      setUserToDelete(null);
    } catch (err) {
      setErrorMessage(err.message);
      setShowErrorModal(true);
      setShowConfirm(false);
      setUserToDelete(null);
    }
  };

  const indexOfLastUser = currentPage * usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfLastUser - usersPerPage, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const handlePageChange = page => { if (page > 0 && page <= totalPages) setCurrentPage(page); };

  if (loading) return <div className="container mt-5">Loading users...</div>;
  if (error) return <div className="container mt-5 text-danger">Error: {error}</div>;

  return (
    <div className="container py-4">

      {/* Search & Role Filter */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-center">
            <div className="col-md-4">
              <div className="input-group">
                <span className="input-group-text bg-light"><FaSearch /></span>
                <input type="text" className="form-control" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="col-md-4">
              <select className="form-select" value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>
                <option value="">All Roles</option>
                {roles.map((role, i) => <option key={i} value={role}>{role}</option>)}
              </select>
            </div>
            <div className="col-md-4 d-flex justify-content-end gap-2">
              <Link to="/create_roles" className={`btn btn-primary shadow-sm ${permissions.manage_roles ? "" : "disabled"}`}><FaPlus className="me-1" /> Add User Roles</Link>
              <Link to="/add_user" className={`btn btn-primary shadow-sm ${permissions.manage_users ? "" : "disabled"}`}><FaPlus className="me-1" /> Create User Account</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Logged-in User Table */}
      {currentUser && (
        <div className="card border-success shadow-sm mb-4">
          <div className="card-header bg-success text-white fw-bold">Logged-in User Info</div>
          <div className="card-body table-responsive">
            <table className="table table-bordered table-striped table-hover align-middle text-center">
              <thead className="table-success">
                <tr>
                  <th>First Name</th><th>Middle Name</th><th>Last Name</th><th>Email</th><th>Roles</th><th>Created At</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{currentUser.first_name}</td>
                  <td>{currentUser.middle_name || "-"}</td>
                  <td>{currentUser.last_name}</td>
                  <td>{currentUser.email}</td>
                  <td><span className="badge bg-success">{Array.isArray(currentUser.roles) ? currentUser.roles.join(", ") : currentUser.roles}</span></td>
                  <td>{new Date(currentUser.created_at).toLocaleString()}</td>
                  <td><span className="badge bg-success p-2 px-3 rounded-pill">Logged In</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Users Table */}
      <div className="card shadow-sm border-0">
        <div className="card-body table-responsive">
          <table className="table table-bordered table-striped table-hover align-middle text-center">
            <thead className="table-light">
              <tr>
                <th>First Name</th><th>Middle Name</th><th>Last Name</th><th>Email</th><th>Roles</th><th>Created At</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentUsers.length === 0 ? <tr><td colSpan="7" className="text-muted">No users found</td></tr> :
                currentUsers.map(u => (
                  <tr key={u.user_id}>
                    <td>{u.first_name}</td>
                    <td>{u.middle_name || "-"}</td>
                    <td>{u.last_name}</td>
                    <td>{u.email}</td>
                    <td><span className="badge bg-secondary">{Array.isArray(u.roles) ? u.roles.join(", ") : u.roles}</span></td>
                    <td>{new Date(u.created_at).toLocaleString()}</td>
                  <td>
  <Link 
    to={`/edit-user/${u.user_id}`} 
    className={`btn btn-sm btn-outline-primary me-1 ${permissions.manage_users ? "" : "disabled"}`}
  >
    Edit
  </Link>

  <button 
    className={`btn btn-sm btn-outline-danger me-1 ${permissions.manage_users ? "" : "disabled"}`}
    disabled={!permissions.manage_users || (currentUser && u.user_id === currentUser.user_id)} // Disable if active account
    onClick={() => { setUserToDelete(u.user_id); setShowConfirm(true); }}
    title={currentUser && u.user_id === currentUser.user_id ? "Cannot remove the active account" : "Remove user"}
  >
    Remove
  </button>

  <Link 
    to={`/edit_permission/${u.user_id}`} 
    className={`btn btn-sm btn-outline-warning ${permissions.manage_permissions ? "" : "disabled"}`}
  >
    Permissions
  </Link>
</td>

                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="d-flex justify-content-center my-4">
          <ul className="pagination">
            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => handlePageChange(currentPage - 1)}>Previous</button>
            </li>
            {Array.from({ length: totalPages }, (_, i) => (
              <li key={i} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                <button className="page-link" onClick={() => handlePageChange(i + 1)}>{i + 1}</button>
              </li>
            ))}
            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => handlePageChange(currentPage + 1)}>Next</button>
            </li>
          </ul>
        </nav>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Confirm Deletion</h5>
                  <button type="button" className="btn-close" onClick={() => setShowConfirm(false)} aria-label="Close"></button>
                </div>
                <div className="modal-body"><p>Are you sure you want to delete this user?</p></div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
                  <button type="button" className="btn btn-danger" onClick={handleRemove}>Delete</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content border-danger">
                <div className="modal-header bg-danger text-white">
                  <h5 className="modal-title">Error</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowErrorModal(false)} aria-label="Close"></button>
                </div>
                <div className="modal-body"><p>{errorMessage}</p></div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-danger" onClick={() => setShowErrorModal(false)}>Close</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}

    </div>
  );
};

export default UserList;
