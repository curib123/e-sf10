import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

// Utility: format role label (Admin_Assistant -> Admin Assistant)
const prettyRole = (name = "") =>
  name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " ");

const UserUpsert = () => {
  const { userId } = useParams();
  const isEditing = !!userId;

  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "",            // stores role_name
    currentPassword: "",
    newPassword: "",
  });

  const [roles, setRoles] = useState([]);
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "danger",
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const headers = useMemo(
    () =>
      token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" },
    [token]
  );

  // Map currently selected role_name to role_id for the <select> value
  const selectedRoleId =
    roles.find((r) => r.role_name === formData.role)?.role_id || "";

  useEffect(() => {
    checkToken();
  }, []);

  // Fetch roles
  useEffect(() => {
    const fetchRoles = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${BASE_URL}/roles/Roles-and-Permissions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.roles)) {
          setRoles(data.roles);
          // Preselect first role on create if none chosen
          if (!isEditing && !formData.role && data.roles.length > 0) {
            setFormData((prev) => ({ ...prev, role: data.roles[0].role_name }));
          }
        } else {
          throw new Error("Invalid roles response");
        }
      } catch (err) {
        setModal({
          show: true,
          title: "Error",
          message: "Failed to load roles.",
          variant: "danger",
        });
      }
    };
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isEditing]);

  // Fetch user data for editing
  useEffect(() => {
    const fetchUserData = async () => {
      if (!token || !isEditing) {
        setFetching(false);
        return;
      }
      try {
        const res = await fetch(`${BASE_URL}/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 404) {
          setModal({
            show: true,
            title: "Error",
            message: "User not found",
            variant: "danger",
          });
          return setFetching(false);
        }
        const data = await res.json();
        if (!res.ok) throw new Error("Failed to fetch user data");
        setFormData({
          first_name: data.first_name || "",
          middle_name: data.middle_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
          password: "",
          role: Array.isArray(data.roles) ? data.roles[0] : data.roles, // keep role_name for select mapping
          currentPassword: "",
          newPassword: "",
        });
      } catch (err) {
        setModal({
          show: true,
          title: "Error",
          message: "Failed to load user data",
          variant: "danger",
        });
      } finally {
        setFetching(false);
      }
    };
    fetchUserData();
  }, [token, isEditing, userId]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Role select provides role_id; convert to role_name to keep payloads consistent
    if (name === "role") {
      const selectedRole = roles.find((r) => r.role_id === parseInt(value, 10));
      if (selectedRole) {
        setFormData((prev) => ({ ...prev, role: selectedRole.role_name }));
      }
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      return setModal({
        show: true,
        title: "Error",
        message: "No authorization token found.",
        variant: "danger",
      });
    }

    if (!isEditing && formData.password.length < 6) {
      return setModal({
        show: true,
        title: "Error",
        message: "Password must be at least 6 characters.",
        variant: "danger",
      });
    }

    setLoading(true);

    try {
      if (isEditing) {
        // 1) Update user profile fields
        const resUser = await fetch(`${BASE_URL}/users/${userId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            first_name: formData.first_name,
            middle_name: formData.middle_name,
            last_name: formData.last_name,
            email: formData.email,
          }),
        });
        const userData = await resUser.json();
        if (!resUser.ok)
          throw new Error(userData.message || "Failed to update user");

        // 2) Update role (send role_id array)
        const roleId = roles.find((r) => r.role_name === formData.role)?.role_id;
        if (roleId) {
          const resRole = await fetch(
            `${BASE_URL}/roles/update-user-role`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                user_id: Number(userId),
                role_ids: [roleId],
              }),
            }
          );
          const roleData = await resRole.json();
          if (!resRole.ok || !roleData.success)
            throw new Error(roleData.message || "Failed to update role");
        }

        // 3) Update password if provided
        if (formData.currentPassword || formData.newPassword) {
          if (!formData.currentPassword || !formData.newPassword) {
            setLoading(false);
            return setModal({
              show: true,
              title: "Error",
              message: "Both current and new passwords are required.",
              variant: "danger",
            });
          }
          const resPassword = await fetch(
            `${BASE_URL}/user/${userId}/update-password`,
            {
              method: "PUT",
              headers,
              body: JSON.stringify({
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword,
              }),
            }
          );
          const passwordData = await resPassword.json();
          if (!resPassword.ok)
            throw new Error(passwordData.message || "Password update failed");

          setFormData((prev) => ({
            ...prev,
            currentPassword: "",
            newPassword: "",
          }));
          setModal({
            show: true,
            title: "Success",
            message:
              passwordData.message || "Password updated successfully",
            variant: "success",
          });
        } else {
          setModal({
            show: true,
            title: "Success",
            message: "User updated successfully",
            variant: "success",
          });
        }
      } else {
        // Create user (role by name)
        const res = await fetch(`${BASE_URL}/register-user`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            first_name: formData.first_name,
            middle_name: formData.middle_name,
            last_name: formData.last_name,
            email: formData.email,
            password: formData.password,
            role: formData.role, // backend expects role_name on create per your original
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to create user");
        setFormData((prev) => ({ ...prev, password: "" }));
        setModal({
          show: true,
          title: "Success",
          message: data.message || "User created successfully",
          variant: "success",
        });
      }
    } catch (err) {
      setModal({
        show: true,
        title: "Error",
        message: err.message || "Network error",
        variant: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-xxl py-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="fw-bold mb-1">
            {isEditing ? "Update User" : "Create User"}
          </h2>
          <div className="text-muted small">
            {isEditing ? "Edit account details and permissions" : "Fill out the details to add a new user"}
          </div>
        </div>

        <button
          type="button"
          className="btn btn-outline-secondary d-flex align-items-center gap-2 px-3 text-nowrap"
          onClick={() => window.history.back()}
        >
          <i className="bi bi-arrow-left-circle"></i>
          Back
        </button>
      </div>

      <div className="card shadow-sm border-0 rounded-4">
        <div className="card-body p-4 p-md-5">
          {fetching ? (
            <div className="text-center text-muted py-5">Loading…</div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {/* Basic Info */}
              <div className="row g-3">
                {["first_name", "middle_name", "last_name"].map((field) => (
                  <div className="col-md-4" key={field}>
                    <label className="form-label text-capitalize">
                      {field.replace("_", " ")}{" "}
                      {field !== "middle_name" && (
                        <span className="text-danger">*</span>
                      )}
                    </label>
                    <input
                      type="text"
                      name={field}
                      className="form-control rounded-3"
                      value={formData[field]}
                      onChange={handleChange}
                      required={field !== "middle_name"}
                      disabled={loading}
                      placeholder={
                        field === "middle_name" ? "(Optional)" : undefined
                      }
                    />
                  </div>
                ))}

                <div className="col-md-6">
                  <label className="form-label">
                    Email <span className="text-danger">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    className="form-control rounded-3"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    placeholder="name@example.com"
                  />
                  <div className="form-text">We'll never share this email.</div>
                </div>

                {!isEditing && (
                  <div className="col-md-6">
                    <label className="form-label">
                      Password <span className="text-danger">*</span>
                    </label>
                    <input
                      type="password"
                      name="password"
                      className="form-control rounded-3"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      disabled={loading}
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                )}

                {isEditing && (
                  <>
                    <div className="col-md-6">
                      <label className="form-label">Current Password</label>
                      <input
                        type="password"
                        name="currentPassword"
                        className="form-control rounded-3"
                        value={formData.currentPassword}
                        onChange={handleChange}
                        disabled={loading}
                        placeholder="Enter current password"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">New Password</label>
                      <input
                        type="password"
                        name="newPassword"
                        className="form-control rounded-3"
                        value={formData.newPassword}
                        onChange={handleChange}
                        disabled={loading}
                        placeholder="Leave blank to keep current"
                      />
                    </div>
                  </>
                )}

                <div className="col-md-6">
                  <label className="form-label">
                    Role <span className="text-danger">*</span>
                  </label>
                  <select
                    name="role"
                    className="form-select rounded-3"
                    value={selectedRoleId}
                    onChange={handleChange}
                    required
                    disabled={loading || roles.length === 0}
                  >
                    <option value="" disabled>
                      {roles.length ? "Select a role" : "Loading roles…"}
                    </option>
                    {roles.map((r) => (
                      <option key={r.role_id} value={r.role_id}>
                        {prettyRole(r.role_name)}
                      </option>
                    ))}
                  </select>
                  <div className="form-text">
                    Assign exactly one role to this account.
                  </div>
                </div>
              </div>

              <div className="d-flex justify-content-end mt-4">
                <button
                  type="submit"
                  className="btn btn-primary px-4 text-nowrap"
                  disabled={loading}
                >
                  {loading
                    ? "Processing…"
                    : isEditing
                    ? "Update User"
                    : "Create User"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <StatusModal
        {...modal}
        onHide={() => setModal((m) => ({ ...m, show: false }))}
      />
    </div>
  );
};

export default UserUpsert;
