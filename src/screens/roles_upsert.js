import React, { useEffect, useMemo, useState } from "react";
import { checkToken } from "../components/token_checker";
import StatusModal from "../components/status_modal";
import { FaArrowLeft, FaUserShield, FaCheck, FaTimes, FaSearch } from "react-icons/fa";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

function CreateRoleForm() {
  const [roleName, setRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);

  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "danger",
  });

  // Small, client-side filter for permissions list
  const [permSearch, setPermSearch] = useState("");

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}`, Accept: "application/json" } : { Accept: "application/json" }),
    [token]
  );

  useEffect(() => {
    checkToken();
  }, []);

  useEffect(() => {
    if (!token) {
      setModal({
        show: true,
        title: "Unauthorized",
        message: "No authorization token found.",
        variant: "danger",
      });
      setLoadingPermissions(false);
      setLoadingRoles(false);
      return;
    }

    // Fetch permissions
    fetch(`${BASE_URL}/roles/roles-and-permissions/all`, { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.data?.permissions) {
          // Sort A→Z for easier scan
          const sorted = [...data.data.permissions].sort((a, b) =>
            a.permission_name.localeCompare(b.permission_name)
          );
          setPermissions(sorted);
        } else {
          setModal({
            show: true,
            title: "Error",
            message: "Failed to load permissions.",
            variant: "danger",
          });
        }
      })
      .catch((err) =>
        setModal({
          show: true,
          title: "Error",
          message: "Error fetching permissions: " + err.message,
          variant: "danger",
        })
      )
      .finally(() => setLoadingPermissions(false));

    // Fetch roles
    fetch(`${BASE_URL}/roles/Roles-and-Permissions`, { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.roles) {
          setRoles(data.roles);
        } else {
          setModal({
            show: true,
            title: "Error",
            message: "Failed to load roles.",
            variant: "danger",
          });
        }
      })
      .catch((err) =>
        setModal({
          show: true,
          title: "Error",
          message: "Error fetching roles: " + err.message,
          variant: "danger",
        })
      )
      .finally(() => setLoadingRoles(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const togglePermission = (id) => {
    setSelectedPermissions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const allIds = filteredPermissions.map((p) => p.permission_id);
    setSelectedPermissions((prev) => {
      const set = new Set(prev);
      allIds.forEach((id) => set.add(id));
      return Array.from(set);
    });
  };

  const clearAll = () => setSelectedPermissions((_) => []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      return setModal({
        show: true,
        title: "Unauthorized",
        message: "Authorization token missing.",
        variant: "danger",
      });
    }
    if (!roleName.trim()) {
      return setModal({
        show: true,
        title: "Validation",
        message: "Role name is required.",
        variant: "danger",
      });
    }
    if (selectedPermissions.length === 0) {
      return setModal({
        show: true,
        title: "Validation",
        message: "Select at least one permission.",
        variant: "danger",
      });
    }

    const payload = {
      role_name: roleName.trim(),
      permission_ids: selectedPermissions,
    };

    try {
      const response = await fetch(`${BASE_URL}/roles/create-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (data?.success) {
        setRoleName("");
        setSelectedPermissions([]);
        setRoles((prev) => [...prev, data.role || {}]);
        setModal({
          show: true,
          title: "Success",
          message: "✅ Role created successfully!",
          variant: "success",
        });
      } else {
        setModal({
          show: true,
          title: "Error",
          message: data?.message || "Failed to create role.",
          variant: "danger",
        });
      }
    } catch (error) {
      setModal({
        show: true,
        title: "Error",
        message: error.message,
        variant: "danger",
      });
    }
  };

  const filteredPermissions = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter((p) => p.permission_name.toLowerCase().includes(q));
  }, [permissions, permSearch]);

  return (
    <div className="container my-4">
      <div className="card shadow-sm rounded-4 border-0">
        <div className="card-body p-4 p-md-5">
          {/* Top bar */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h4 className="fw-bold mb-1">Create Role</h4>
              <div className="text-muted small">
                Define a role and assign permissions.
              </div>
            </div>

            <button
              type="button"
              className="btn btn-outline-secondary d-flex align-items-center gap-2 text-nowrap"
              onClick={() => window.history.back()}
            >
              <FaArrowLeft />
              Back
            </button>
          </div>

          {/* Form */}
          <section className="mb-4">
            <h6 className="fw-semibold text-secondary d-flex align-items-center gap-2 mb-3">
              <FaUserShield /> Role Details
            </h6>

            {loadingPermissions ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status"></div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                {/* Role name */}
                <div className="form-floating mb-3">
                  <input
                    type="text"
                    id="roleName"
                    className="form-control"
                    placeholder="Role Name"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                  />
                  <label htmlFor="roleName">Role Name</label>
                  <div className="form-text">e.g. Registrar, Guidance, Principal</div>
                </div>

                {/* Permission picker header */}
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                  <label className="fw-semibold text-secondary m-0">
                    Assign Permissions
                  </label>

                  <div className="d-flex align-items-center gap-2">
                    <div className="input-group input-group-sm" style={{ minWidth: 260 }}>
                      <span className="input-group-text bg-light">
                        <FaSearch />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search permission…"
                        value={permSearch}
                        onChange={(e) => setPermSearch(e.target.value)}
                      />
                      {permSearch && (
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setPermSearch("")}
                        >
                          <FaTimes />
                        </button>
                      )}
                    </div>

                    <div className="btn-group">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm text-nowrap"
                        onClick={selectAll}
                      >
                        Select Visible
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm text-nowrap"
                        onClick={clearAll}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                </div>

                {/* Permissions chips */}
                <div
                  className="border rounded-3 bg-white p-3"
                  style={{
                    maxHeight: 280,
                    overflowY: "auto",
                  }}
                >
                  {filteredPermissions.length === 0 ? (
                    <div className="text-muted small fst-italic">
                      No permissions match your search.
                    </div>
                  ) : (
                    <div className="d-flex flex-wrap gap-2">
                      {filteredPermissions.map((perm) => {
                        const active = selectedPermissions.includes(perm.permission_id);
                        return (
                          <button
                            type="button"
                            key={perm.permission_id}
                            onClick={() => togglePermission(perm.permission_id)}
                            className={`btn btn-sm rounded-pill text-nowrap d-flex align-items-center gap-2 ${
                              active ? "btn-primary" : "btn-outline-primary"
                            }`}
                            title={perm.permission_name}
                          >
                            {active && <FaCheck />}
                            {perm.permission_name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="d-flex justify-content-between align-items-center mt-3">
                  <small className="text-muted">
                    Selected: <strong>{selectedPermissions.length}</strong>
                  </small>
                  <button
                    type="submit"
                    className="btn btn-success text-nowrap d-inline-flex align-items-center gap-2 px-3"
                  >
                    <FaUserShield />
                    Create Role
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Roles table */}
          <section className="mt-4">
            <h6 className="fw-semibold text-secondary mb-3">
              Existing Roles
            </h6>

            {loadingRoles ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status"></div>
              </div>
            ) : roles.length === 0 ? (
              <p className="text-muted fst-italic mb-0">No roles found.</p>
            ) : (
              <div
                className="table-responsive border rounded-3"
                style={{ maxHeight: 420, overflowY: "auto" }}
              >
                <table className="table table-hover align-middle text-nowrap mb-0">
                  <thead className="table-light sticky-top">
                    <tr>
                      <th style={{ width: 90 }}>Role ID</th>
                      <th style={{ width: 220 }}>Role Name</th>
                      <th>Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((role) => (
                      <tr key={role.role_id}>
                        <td>{role.role_id}</td>
                        <td className="fw-semibold">{role.role_name}</td>
                        <td>
                          {Array.isArray(role.permissions) && role.permissions.length > 0 ? (
                            <div className="d-flex flex-wrap gap-2">
                              {role.permissions.map((perm) => (
                                <span
                                  key={perm.permission_id}
                                  className="badge bg-primary d-inline-flex align-items-center gap-1 text-wrap"
                                  title={perm.permission_name}
                                >
                                  <FaCheck /> {perm.permission_name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <em className="text-muted">No permissions assigned</em>
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

      <StatusModal
        {...modal}
        onHide={() => setModal((m) => ({ ...m, show: false }))}
      />

      {/* Thin, subtle custom scrollbars for the two scroll areas */}
      <style>{`
        .table-responsive::-webkit-scrollbar,
        .border.rounded-3.bg-white.p-3::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        .table-responsive::-webkit-scrollbar-thumb,
        .border.rounded-3.bg-white.p-3::-webkit-scrollbar-thumb {
          background-color: rgba(0,0,0,0.15);
          border-radius: 6px;
        }
        .table-responsive::-webkit-scrollbar-thumb:hover,
        .border.rounded-3.bg-white.p-3::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}

export default CreateRoleForm;
