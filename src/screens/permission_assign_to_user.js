import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaCheckCircle, FaTimesCircle, FaInfoCircle } from "react-icons/fa";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const AssignPermissionsToUser = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const token = sessionStorage.getItem("token");

  const [permissions, setPermissions] = useState([]);
  const [userPermissions, setUserPermissions] = useState({});
  const [originalPermissions, setOriginalPermissions] = useState({});
  const [userInfo, setUserInfo] = useState({ fullName: "", email: "", role: "" });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [statusModal, setStatusModal] = useState({ show: false, title: "", message: "", variant: "info" });

  const authHeaders = () => ({ Authorization: token ? `Bearer ${token}` : "" });

  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: "Unauthorized", message: "Please log in.", variant: "danger" });
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 1500);
  };

  useEffect(() => {
    if (!token) return handleUnauthorized();

    const fetchData = async () => {
      try {
        setLoading(true);
        const [permRes, userRes] = await Promise.all([
          fetch(`${BASE_URL}/roles/roles-and-permissions/all`, { headers: authHeaders() }),
          fetch(`${BASE_URL}/user/${userId}/info`, { headers: authHeaders() }),
        ]);

        const permData = await permRes.json();
        const userData = await userRes.json();

        if (!permData.success) throw new Error("Failed to load permissions.");
        if (!userData.user) throw new Error("Failed to load user info.");

        const filteredPerms = permData.data.permissions.filter(
          (perm) => !perm.permission_name.toLowerCase().includes("all")
        );

        setPermissions(filteredPerms);

        const fullName = [userData.user.first_name, userData.user.middle_name, userData.user.last_name]
          .filter(Boolean)
          .join(" ");
        const role = userData.user.role || (Array.isArray(userData.user.roles) ? userData.user.roles.join(", ") : "");

        setUserInfo({ fullName: fullName || "User", email: userData.user.email || "", role });
        setUserPermissions(userData.user.permissions || {});
        setOriginalPermissions(userData.user.permissions || {});
      } catch (err) {
        setStatusModal({ show: true, title: "Error", message: err.message, variant: "danger" });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, token]);

  const togglePermission = (permissionKey) => {
    setUserPermissions((prev) => ({ ...prev, [permissionKey]: !prev[permissionKey] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return handleUnauthorized();

    const changedPermissions = Object.entries(userPermissions).filter(
      ([key, value]) => originalPermissions[key] !== value
    );

    if (!changedPermissions.length) {
      setStatusModal({ show: true, title: "Info", message: "No changes to update.", variant: "info" });
      return;
    }

    setUpdating(true);
    try {
      for (const [permission_name, is_granted] of changedPermissions) {
        const res = await fetch(`${BASE_URL}/user/${userId}/permissions`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ permission_name, is_granted }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.message || `Failed to update permission: ${permission_name}`);
        }
      }

      setStatusModal({ show: true, title: "Success", message: "Permissions updated successfully!", variant: "success" });
      setOriginalPermissions({ ...userPermissions });
    } catch (err) {
      setStatusModal({ show: true, title: "Error", message: `Update failed: ${err.message}`, variant: "danger" });
    } finally {
      setUpdating(false);
    }
  };

  if (loading)
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );

  return (
    <div className="container my-5">
      <div className="card shadow-sm border-0 rounded-4">
        <header className="card-header d-flex justify-content-between align-items-center bg-light border-bottom py-3">
          <div>
            <h2 className="card-title mb-1">{userInfo.fullName}</h2>
            {userInfo.role && <span className="badge bg-info text-dark">{userInfo.role}</span>}
          </div>
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(-1)} disabled={updating}>
            ← Back
          </button>
        </header>

        <section className="card-body">
          {userInfo.email && <p className="text-muted mb-3"><strong>Email:</strong> {userInfo.email}</p>}

          <form onSubmit={handleSubmit}>
            <div
              className="permissions-select border rounded-3 bg-white p-3 mb-4 shadow-sm"
              style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 10 }}
            >
              {permissions.map(({ permission_id, permission_name }) => {
                const isChecked = !!userPermissions[permission_name];
                return (
                  <button
                    key={permission_id}
                    type="button"
                    onClick={() => togglePermission(permission_name)}
                    className={`btn btn-sm rounded-pill ${
                      isChecked ? "btn-primary text-white shadow-sm" : "btn-outline-primary"
                    }`}
                    style={{ transition: "all 0.2s" }}
                    disabled={updating}
                  >
                    {permission_name}
                  </button>
                );
              })}
            </div>

            <button type="submit" className="btn btn-success w-100 fw-semibold" disabled={updating}>
              {updating ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Updating...
                </>
              ) : "Update Permissions"}
            </button>
          </form>
        </section>
      </div>

      {/* Status Modal */}
      <StatusModal
        {...statusModal}
        icon={
          statusModal.variant === "success" ? <FaCheckCircle className="text-success me-2" /> :
          statusModal.variant === "danger" ? <FaTimesCircle className="text-danger me-2" /> :
          <FaInfoCircle className="text-info me-2" />
        }
        onHide={() => setStatusModal({ ...statusModal, show: false })}
      />
    </div>
  );
};

export default AssignPermissionsToUser;
