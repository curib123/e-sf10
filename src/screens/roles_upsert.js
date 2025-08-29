import React, { useEffect, useState } from "react";
import { checkToken } from "../components/token_checker";
import StatusModal from "../components/status_modal";
import { FaArrowLeft, FaUserShield, FaCheck } from "react-icons/fa";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

function CreateRoleForm() {
  const [roleName, setRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });

  const getToken = () => sessionStorage.getItem("token");

  useEffect(() => {
    checkToken();
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setModal({ show: true, title: "Unauthorized", message: "No authorization token found.", variant: "danger" });
      setLoadingPermissions(false);
      setLoadingRoles(false);
      return;
    }

    // Fetch permissions
    fetch(`${BASE_URL}/roles/roles-and-permissions/all`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.permissions) setPermissions(data.data.permissions);
        else setModal({ show: true, title: "Error", message: "Failed to load permissions.", variant: "danger" });
      })
      .catch((err) => setModal({ show: true, title: "Error", message: "Error fetching permissions: " + err.message, variant: "danger" }))
      .finally(() => setLoadingPermissions(false));

    // Fetch roles
    fetch(`${BASE_URL}/roles/Roles-and-Permissions`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.roles) setRoles(data.roles);
        else setModal({ show: true, title: "Error", message: "Failed to load roles.", variant: "danger" });
      })
      .catch((err) => setModal({ show: true, title: "Error", message: "Error fetching roles: " + err.message, variant: "danger" }))
      .finally(() => setLoadingRoles(false));
  }, []);

  const handleCheckboxChange = (id) => {
    setSelectedPermissions((prev) =>
      prev.includes(id) ? prev.filter((perm) => perm !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return setModal({ show: true, title: "Unauthorized", message: "Authorization token missing.", variant: "danger" });

    if (!roleName.trim())
      return setModal({ show: true, title: "Validation", message: "Role name is required.", variant: "danger" });

    if (selectedPermissions.length === 0)
      return setModal({ show: true, title: "Validation", message: "Select at least one permission.", variant: "danger" });

    const payload = { role_name: roleName.trim(), permission_ids: selectedPermissions };

    try {
      const response = await fetch(`${BASE_URL}/roles/create-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (data.success) {
        setRoleName("");
        setSelectedPermissions([]);
        setRoles((prev) => [...prev, data.role || {}]);
        setModal({ show: true, title: "Success", message: "✅ Role created successfully!", variant: "success" });
      } else {
        setModal({ show: true, title: "Error", message: data.message || "Failed to create role.", variant: "danger" });
      }
    } catch (error) {
      setModal({ show: true, title: "Error", message: error.message, variant: "danger" });
    }
  };

  return (
    <div className="container my-5">
      <div className="card shadow-lg rounded-4 border-0">
        <div className="card-body p-5">
          {/* Back Button */}
          <div className="w-100 d-flex justify-content-end mb-4">
            <button
              type="button"
              className="btn btn-outline-dark d-flex align-items-center gap-2 px-3 py-2 rounded-pill shadow-sm"
              onClick={() => window.history.back()}
            >
              <FaArrowLeft />
              <span>Back</span>
            </button>
          </div>

          {/* Form Section */}
          <section className="mb-5">
            <h5 className="mb-4 fw-semibold border-bottom pb-2 text-secondary d-flex align-items-center gap-2">
              <FaUserShield /> Create New Role
            </h5>

            {loadingPermissions && (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status"></div>
              </div>
            )}

            {!loadingPermissions && permissions.length > 0 && (
              <form onSubmit={handleSubmit} noValidate>
                <div className="form-floating mb-4">
                  <input
                    type="text"
                    id="roleName"
                    className="form-control"
                    placeholder="Role Name"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                  />
                  <label htmlFor="roleName">Role Name</label>
                </div>

                <label className="form-label fw-semibold mb-3 d-block text-secondary">
                  Assign Permissions
                </label>

                <div
                  className="permissions-select border rounded-3 bg-white p-3 mb-4"
                  style={{ maxHeight: "260px", overflowY: "auto", display: "flex", flexWrap: "wrap", gap: "8px" }}
                >
                  {permissions.map((perm) => {
                    const selected = selectedPermissions.includes(perm.permission_id);
                    return (
                      <button
                        type="button"
                        key={perm.permission_id}
                        onClick={() => handleCheckboxChange(perm.permission_id)}
                        className={`btn btn-sm rounded-pill ${
                          selected ? "btn-primary text-white d-flex align-items-center gap-1" : "btn-outline-primary"
                        }`}
                        style={{ userSelect: "none" }}
                      >
                        {selected && <FaCheck />}
                        {perm.permission_name}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="submit"
                  className="btn btn-success w-100 fw-semibold shadow-sm d-flex justify-content-center align-items-center gap-2"
                >
                  <FaUserShield /> Create Role
                </button>
              </form>
            )}
          </section>

          {/* Roles Table */}
          <section>
            <h5 className="mb-4 fw-semibold border-bottom pb-2 text-secondary">
              Roles and Their Permissions
            </h5>

            {loadingRoles && (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status"></div>
              </div>
            )}

            {!loadingRoles && roles.length === 0 && <p className="text-muted fst-italic">No roles found.</p>}

            {!loadingRoles && roles.length > 0 && (
              <div className="table-responsive shadow-sm rounded-3" style={{ maxHeight: "420px", overflowY: "auto" }}>
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
                        style={{ cursor: "default", transition: "background-color 0.2s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f7ff")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <td>{role.role_id}</td>
                        <td className="fw-semibold">{role.role_name}</td>
                        <td>
                          {role.permissions.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {role.permissions.map((perm) => (
                                <span
                                  key={perm.permission_id}
                                  className="badge bg-primary d-flex align-items-center gap-1"
                                  title={perm.permission_name}
                                >
                                  <FaCheck /> {perm.permission_name}
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

      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />

      {/* Scrollbar styling */}
      <style>{`
        .permissions-select::-webkit-scrollbar { width: 8px; }
        .permissions-select::-webkit-scrollbar-thumb { background-color: rgba(0,123,255,0.3); border-radius: 4px; }
        .permissions-select::-webkit-scrollbar-thumb:hover { background-color: rgba(0,123,255,0.5); }
        .table-responsive::-webkit-scrollbar { width: 8px; }
        .table-responsive::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.1); border-radius: 4px; }
      `}</style>
    </div>
  );
}

export default CreateRoleForm;
