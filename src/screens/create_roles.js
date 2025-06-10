import React, { useEffect, useState } from "react";
import { checkToken } from '../components/token_checker'; 

function CreateRoleForm() {
  const [roleName, setRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [errorPermissions, setErrorPermissions] = useState(null);
  const [errorRoles, setErrorRoles] = useState(null);

  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState(null);

  const getToken = () => sessionStorage.getItem("token");

    useEffect(() => {
              checkToken();
             }, []);
       

  useEffect(() => {
    const token = getToken();

    if (!token) {
      setErrorPermissions("No authorization token found.");
      setLoadingPermissions(false);
      setErrorRoles("No authorization token found.");
      setLoadingRoles(false);
      return;
    }

    fetch("http://localhost:3001/esf10/roles/roles-and-permissions/all", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.permissions) {
          setPermissions(data.data.permissions);
        } else {
          setErrorPermissions("Failed to load permissions.");
        }
      })
      .catch((err) => setErrorPermissions("Error fetching permissions: " + err.message))
      .finally(() => setLoadingPermissions(false));

    fetch("http://localhost:3001/esf10/roles/Roles-and-Permissions", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.roles) {
          setRoles(data.roles);
        } else {
          setErrorRoles("Failed to load roles and permissions.");
        }
      })
      .catch((err) => setErrorRoles("Error fetching roles: " + err.message))
      .finally(() => setLoadingRoles(false));
  }, []);

  const handleCheckboxChange = (id) => {
    setSelectedPermissions((prev) =>
      prev.includes(id) ? prev.filter((perm) => perm !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setMessageType(null);

    if (!roleName.trim()) {
      setMessage("Role name is required");
      setMessageType("danger");
      return;
    }

    if (selectedPermissions.length === 0) {
      setMessage("Select at least one permission");
      setMessageType("danger");
      return;
    }

    const payload = {
      role_name: roleName.trim(),
      permission_ids: selectedPermissions,
    };

    try {
      const token = getToken();
      if (!token) {
        setMessage("Authorization token missing.");
        setMessageType("danger");
        return;
      }

      const response = await fetch("http://localhost:3001/esf10/roles/create-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Status ${response.status}`);

      const data = await response.json();

      if (data.success) {
        setRoleName("");
        setSelectedPermissions([]);

        const rolesResponse = await fetch("http://localhost:3001/esf10/roles/roles-and-permissions", {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (!rolesResponse.ok) throw new Error(`Status ${rolesResponse.status}`);

        const rolesData = await rolesResponse.json();
        if (rolesData.success && rolesData.data && rolesData.data.roles) {
          setRoles(rolesData.data.roles);
        }

        setMessage("✅ Role created successfully!");
        setMessageType("success");

        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setMessage("❌ Error: " + (data.message || "Unknown error"));
        setMessageType("danger");
      }
    } catch (error) {
      setMessage("❌ Request failed: " + error.message);
      setMessageType("danger");
    }
  };

  return (
    
    <div className="container my-5" >
      
      <div className="card shadow rounded-4 border-0">
        <div className="card-body p-5">
          {message && (
            <div className={`alert alert-${messageType} text-center py-3`} role="alert">
              {message}
            </div>
          )}

 <div className="w-100 d-flex justify-content-end align-items-start" >
        <button
          type="button"
          className="btn btn-outline-dark d-flex align-items-center gap-2 px-3 py-2 rounded-pill shadow-sm"
          onClick={() => window.history.back()}
        >
          <i className="bi bi-arrow-left-circle-fill fs-5"></i>
          <span>Back</span>
        </button>
      </div>
          {/* Form Section */}
          <section className="mb-5">
            <h5 className="mb-4 fw-semibold border-bottom pb-2 text-secondary">
              Create New Role
            </h5>

          

            {loadingPermissions && (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading permissions...</span>
                </div>
              </div>
            )}

            {errorPermissions && (
              <div className="alert alert-danger">{errorPermissions}</div>
            )}

            {!loadingPermissions && !errorPermissions && (
              <form onSubmit={handleSubmit} noValidate>
                <div className="form-floating mb-4">
                  <input
                    type="text"
                    id="roleName"
                    className="form-control"
                    placeholder="Role Name"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    required
                  />
                  <label htmlFor="roleName">Role Name</label>
                </div>

                <label className="form-label fw-semibold mb-3 d-block text-secondary">
                  Assign Permissions
                </label>

                <div
                  className="permissions-select border rounded-3 bg-white p-3 mb-4"
                  style={{
                    maxHeight: "260px",
                    overflowY: "auto",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  {permissions.map((perm) => {
                    const selected = selectedPermissions.includes(perm.permission_id);
                    return (
                      <button
                        type="button"
                        key={perm.permission_id}
                        onClick={() => handleCheckboxChange(perm.permission_id)}
                        className={`btn btn-sm rounded-pill ${
                          selected ? "btn-primary text-white" : "btn-outline-primary"
                        }`}
                        style={{ userSelect: "none" }}
                      >
                        {perm.permission_name}
                      </button>
                    );
                  })}
                </div>

                <button type="submit" className="btn btn-success w-100 fw-semibold shadow-sm">
                  Create Role
                </button>
              </form>
            )}
          </section>

          {/* Roles Table Section */}
          <section>
            <h5 className="mb-4 fw-semibold border-bottom pb-2 text-secondary">
              Roles and Their Permissions
            </h5>

            {loadingRoles && (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading roles...</span>
                </div>
              </div>
            )}

            {errorRoles && <div className="alert alert-danger">{errorRoles}</div>}

            {!loadingRoles && !errorRoles && roles.length === 0 && (
              <p className="text-muted fst-italic">No roles found.</p>
            )}

            {!loadingRoles && !errorRoles && roles.length > 0 && (
              <div
                className="table-responsive shadow-sm rounded-3"
                style={{ maxHeight: "420px", overflowY: "auto" }}
              >
                <table className="table table-hover align-middle text-nowrap mb-0">
                  <thead className="table-light sticky-top">
                    <tr>
                      <th style={{ width: "80px" }}>Role ID</th>
                      <th style={{ width: "180px" }}>Role Name</th>
                      <th>Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((role) => (
                      <tr
                        key={role.role_id}
                        className="align-middle"
                        style={{ cursor: "default", transition: "background-color 0.2s" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "#f1f7ff")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = "transparent")
                        }
                      >
                        <td>{role.role_id}</td>
                        <td className="fw-semibold">{role.role_name}</td>
                        <td style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                          {role.permissions.length > 0 ? (
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "6px",
                              }}
                            >
                              {role.permissions.map((perm) => (
                                <span
                                  key={perm.permission_id}
                                  className="badge bg-primary"
                                  style={{ cursor: "default" }}
                                  title={perm.permission_name}
                                >
                                  {perm.permission_name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <em className="text-muted fst-italic">No permissions assigned</em>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Scrollbar styling */}
      <style>{`
        .permissions-select::-webkit-scrollbar {
          width: 8px;
        }
        .permissions-select::-webkit-scrollbar-thumb {
          background-color: rgba(0, 123, 255, 0.3);
          border-radius: 4px;
        }
        .permissions-select::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0, 123, 255, 0.5);
        }
        .table-responsive::-webkit-scrollbar {
          width: 8px;
        }
        .table-responsive::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

export default CreateRoleForm;
