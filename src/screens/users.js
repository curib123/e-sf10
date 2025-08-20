import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaSearch } from "react-icons/fa";
import { getUserPermissions } from '../components/get_permission'; 
import { checkToken } from '../components/token_checker'; 
const User = () => {
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


   useEffect(() => {
                checkToken();
               }, []);
               
  // === Effects ===
  useEffect(() => {
    const perms = getUserPermissions();
    setPermissions(perms);
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("http://localhost:3001/esf10/users", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) throw new Error(`Error: ${res.status}`);

        const data = await res.json();
        setUsers(data);
        setFilteredUsers(data);

        // Extract unique roles, handle roles as string or array
        const allRoles = data.flatMap((user) =>
          Array.isArray(user.roles) ? user.roles : [user.roles]
        );
        setRoles([...new Set(allRoles)]);

        const loggedInEmail = sessionStorage.getItem("user_email");
        const loggedUser = data.find((user) => user.email === loggedInEmail);
        setCurrentUser(loggedUser || null);
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
    let filtered = users.filter((user) => {
      const fullName = `${user.first_name} ${user.middle_name || ""} ${user.last_name}`.toLowerCase();
      const rolesString = Array.isArray(user.roles)
        ? user.roles.join(", ").toLowerCase()
        : (user.roles || "").toLowerCase();

      return (
        (fullName.includes(term) ||
          user.email.toLowerCase().includes(term) ||
          rolesString.includes(term)) &&
        (selectedRole === "" || rolesString.includes(selectedRole.toLowerCase()))
      );
    });

    if (currentUser) {
      filtered = filtered.filter((u) => u.user_id !== currentUser.user_id);
      filtered.unshift(currentUser);
    }

    setFilteredUsers(filtered);
    setCurrentPage(1);
  }, [search, users, selectedRole, currentUser]);

  // Remove user handler
  const handleRemove = async () => {
    if (!userToDelete) return;

    try {
      const res = await fetch(`http://localhost:3001/esf10/users/${userToDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to delete user");

      const updated = users.filter((u) => u.user_id !== userToDelete);
      setUsers(updated);
      setShowConfirm(false);
      setUserToDelete(null);
    } catch (err) {
      setErrorMessage(err.message);
      setShowErrorModal(true);
      setShowConfirm(false);
      setUserToDelete(null);
    }
  };

  // Pagination calculations
  const indexOfLastUser = currentPage * usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfLastUser - usersPerPage, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  const handlePageChange = (page) => {
    if (page > 0 && page <= totalPages) setCurrentPage(page);
  };

  if (loading) return <div className="container mt-5">Loading users...</div>;
  if (error) return <div className="container mt-5 text-danger">Error: {error}</div>;

  return (
    <div className="container py-4">

      {/* Search and Role Filter */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-center">
            <div className="col-md-4">
              <div className="input-group">
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
            </div>

            <div className="col-md-4">
              <select
                className="form-select"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="">All Roles</option>
                {roles.map((role, i) => (
                  <option key={i} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-4 d-flex justify-content-end gap-2">
              {permissions.manage_roles ? (
                <Link to="/create_roles" className="btn btn-primary shadow-sm">
                  <FaPlus className="me-1" />
                  Add User Roles
                </Link>
              ) : (
                <button
                  className="btn btn-primary shadow-sm disabled"
                  disabled
                  style={{ cursor: "not-allowed" }}
                >
                  <FaPlus className="me-1" />
                  Add User Roles
                </button>
              )}

              {permissions.manage_users ? (
                <Link to="/add_user" className="btn btn-primary shadow-sm">
                  <FaPlus className="me-1" />
                  Create User Account
                </Link>
              ) : (
                <button
                  className="btn btn-primary shadow-sm disabled"
                  disabled
                  style={{ cursor: "not-allowed" }}
                >
                  <FaPlus className="me-1" />
                  Create User Account
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Logged-in User Table */}
      {currentUser && (
        <div className="card border-success shadow-sm mb-4">
          <div className="card-header bg-success text-white fw-bold">
            Logged-in User Info
          </div>
          <div className="card-body table-responsive">
            <table className="table table-bordered align-middle text-center">
              <thead className="table-success">
                <tr>
                  <th>First Name</th>
                  <th>Middle Name</th>
                  <th>Last Name</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Created At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{currentUser.first_name}</td>
                  <td>{currentUser.middle_name || "-"}</td>
                  <td>{currentUser.last_name}</td>
                  <td>{currentUser.email}</td>
                  <td>
                    <span className="badge bg-success">
                      {Array.isArray(currentUser.roles)
                        ? currentUser.roles.join(", ")
                        : currentUser.roles}
                    </span>
                  </td>
                  <td>{new Date(currentUser.created_at).toLocaleString()}</td>
                  <td>
                    <span className="badge bg-success p-2 px-3 rounded-pill">
                      Logged In
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Users Table */}
      <div className="card shadow-sm border-0 ">
        <div className="card-body table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-light text-center">
              <tr>
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
              {currentUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-muted">
                    No users found
                  </td>
                </tr>
              ) : (
                currentUsers.map((user) => (
                  <tr key={user.user_id}>
                    <td>{user.first_name}</td>
                    <td>{user.middle_name || "-"}</td>
                    <td>{user.last_name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className="badge bg-secondary">
                        {Array.isArray(user.roles) ? user.roles.join(", ") : user.roles}
                      </span>
                    </td>
                    <td>{new Date(user.created_at).toLocaleString()}</td>
                    <td>
                      {permissions.manage_users ? (
                        <Link
                          to={`/edit-user/${user.user_id}`}
                          className="btn btn-sm btn-outline-primary me-1"
                        >
                          Edit
                        </Link>
                      ) : (
                        <button
                          className="btn btn-sm btn-outline-primary me-1 disabled"
                          disabled
                          style={{ cursor: "not-allowed" }}
                        >
                          Edit
                        </button>
                      )}

                      {permissions.manage_users ? (
                        <button
                          className="btn btn-sm btn-outline-danger me-1"
                          onClick={() => {
                            setUserToDelete(user.user_id);
                            setShowConfirm(true);
                          }}
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-outline-danger me-1 disabled"
                          disabled
                          style={{ cursor: "not-allowed" }}
                        >
                          Remove
                        </button>
                      )}

                      {permissions.manage_permissions ? (
                        <Link
                          to={`/edit_permission/${user.user_id}`}
                          className="btn btn-sm btn-outline-warning"
                        >
                          Permissions
                        </Link>
                      ) : (
                        <button
                          className="btn btn-sm btn-outline-warning disabled"
                          disabled
                          style={{ cursor: "not-allowed" }}
                        >
                          Permissions
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="d-flex justify-content-center mb-4">
          <ul className="pagination">
            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
              <button
                className="page-link"
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Previous
              </button>
            </li>
            {Array.from({ length: totalPages }, (_, i) => (
              <li
                key={i}
                className={`page-item ${currentPage === i + 1 ? "active" : ""}`}
              >
                <button className="page-link" onClick={() => handlePageChange(i + 1)}>
                  {i + 1}
                </button>
              </li>
            ))}
            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
              <button
                className="page-link"
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next
              </button>
            </li>
          </ul>
        </nav>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <>
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Confirm Deletion</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowConfirm(false)}
                    aria-label="Close"
                  ></button>
                </div>
                <div className="modal-body">
                  <p>Are you sure you want to delete this user?</p>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleRemove}
                  >
                    Delete
                  </button>
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
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content border-danger">
                <div className="modal-header bg-danger text-white">
                  <h5 className="modal-title">Error</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowErrorModal(false)}
                    aria-label="Close"
                  ></button>
                </div>
                <div className="modal-body">
                  <p>{errorMessage}</p>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => setShowErrorModal(false)}
                  >
                    Close
                  </button>
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

export default User;
