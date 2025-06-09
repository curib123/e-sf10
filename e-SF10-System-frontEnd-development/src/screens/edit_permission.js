import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { checkToken } from '../components/token_checker'; 

function AssignPermissionsToUser() {
  const [permissions, setPermissions] = useState([]);
  const [userPermissions, setUserPermissions] = useState({});
  const [originalPermissions, setOriginalPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState(null);
  const [updating, setUpdating] = useState(false);

  const [userFullName, setUserFullName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");

  const { userId } = useParams();
  const navigate = useNavigate();

  const getToken = () => sessionStorage.getItem("token");

    useEffect(() => {
              checkToken();
             }, []);
       
             
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setMessage("Authorization token missing.");
      setMessageType("danger");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage(null);

    const fetchPermissions = fetch("http://localhost:3001/esf10/roles/roles-and-permissions/all", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }).then((res) => res.json());

    const fetchUserInfo = fetch(`http://localhost:3001/esf10/user/${userId}/info`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }).then((res) => res.json());

    Promise.all([fetchPermissions, fetchUserInfo])
      .then(([permData, userData]) => {
        if (permData.success && Array.isArray(permData.data.permissions)) {
          const filteredPerms = permData.data.permissions.filter(
            (perm) => !perm.permission_name.toLowerCase().includes("all")
          );
          setPermissions(filteredPerms);
        } else {
          setMessage("Failed to load permissions.");
          setMessageType("danger");
        }

        if (userData.user) {
          setUserPermissions(userData.user.permissions || {});
          setOriginalPermissions(userData.user.permissions || {});
          setUserEmail(userData.user.email || "");

          const fullName = [userData.user.first_name, userData.user.middle_name, userData.user.last_name]
            .filter(Boolean)
            .join(" ");
          setUserFullName(fullName || "User");

          if (userData.user.role) {
            setUserRole(userData.user.role);
          } else if (Array.isArray(userData.user.roles) && userData.user.roles.length > 0) {
            setUserRole(userData.user.roles.join(", "));
          } else {
            setUserRole("");
          }
        } else {
          setMessage("Failed to load user info.");
          setMessageType("danger");
        }
      })
      .catch((error) => {
        setMessage(`Error fetching data: ${error.message}`);
        setMessageType("danger");
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const togglePermission = (permissionKey) => {
    setUserPermissions((prev) => ({
      ...prev,
      [permissionKey]: !prev[permissionKey],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);
    setMessageType(null);

    const token = getToken();
    if (!token) {
      setMessage("Authorization token missing.");
      setMessageType("danger");
      return;
    }

    const changedPermissions = Object.entries(userPermissions).filter(
      ([key, value]) => originalPermissions[key] !== value
    );

    if (changedPermissions.length === 0) {
      setMessage("No changes to update.");
      setMessageType("info");
      return;
    }

    setUpdating(true);

    try {
      for (const [permission_name, is_granted] of changedPermissions) {
        const response = await fetch(
          `http://localhost:3001/esf10/user/${userId}/permissions`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ permission_name, is_granted }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.message || `Failed to update permission: ${permission_name}`);
        }
      }

      setMessage("✅ Permissions updated successfully!");
      setMessageType("success");
      setOriginalPermissions({ ...userPermissions });
    } catch (error) {
      setMessage(`❌ Update failed: ${error.message}`);
      setMessageType("danger");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center vh-100"
        aria-busy="true"
        aria-label="Loading"
      >
        <div className="spinner-border text-primary" role="status" aria-hidden="true"></div>
        <span className="visually-hidden">Loading...</span>
      </div>
    );
  }

  return (
    <div className="container my-5" role="main" aria-live="polite">
      <div className="card shadow-sm border-0">
        <header className="card-header d-flex justify-content-between align-items-center bg-white border-0 pb-0">
          <h2
            className="card-title m-0 text-truncate"
            style={{ maxWidth: "80%" }}
            title={userFullName}
          >
            {userFullName}
          </h2>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate(-1)}
            disabled={updating}
            aria-label="Go back"
          >
            ← Back
          </button>
        </header>

        <section className="card-body pt-0">
          {(userEmail || userRole) && (
            <div className="mb-4 text-muted small">
              {userEmail && (
                <div>
                  <strong>Email:</strong> {userEmail}
                </div>
              )}
              {userRole && (
                <div>
                  <strong>Role{userRole.includes(",") ? "s" : ""}:</strong> {userRole}
                </div>
              )}
            </div>
          )}

          {message && (
            <div className={`alert alert-${messageType} shadow-sm`} role="alert">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} aria-label="Permissions form">
            <div
              className="permissions-select border rounded-3 bg-white p-4 mb-4 shadow-sm"
              style={{
                maxHeight: "320px",
                overflowY: "auto",
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                userSelect: "none",
              }}
            >
              {permissions.map(({ permission_id, permission_name }) => {
                const isChecked = !!userPermissions[permission_name];
                return (
                  <button
                    key={permission_id}
                    type="button"
                    onClick={() => togglePermission(permission_name)}
                    className={`btn btn-sm rounded-pill ${
                      isChecked ? "btn-primary text-white" : "btn-outline-primary"
                    }`}
                    title={permission_name}
                    disabled={updating}
                    aria-pressed={isChecked}
                  >
                    {permission_name}
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              className="btn btn-success w-100 fw-semibold"
              disabled={updating}
              aria-live="polite"
            >
              {updating ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Updating...
                </>
              ) : (
                "Update Permissions"
              )}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default AssignPermissionsToUser;
