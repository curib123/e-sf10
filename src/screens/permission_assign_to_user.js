import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaArrowLeft,
  FaSearch,
  FaTimes,
} from "react-icons/fa";
import StatusModal from "../components/status_modal";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const AssignPermissionsToUser = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const [permissions, setPermissions] = useState([]);
  const [userPermissions, setUserPermissions] = useState({});
  const [originalPermissions, setOriginalPermissions] = useState({});
  const [userInfo, setUserInfo] = useState({
    fullName: "",
    email: "",
    role: "",
  });

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [statusModal, setStatusModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "info",
  });

  // UI helpers
  const [permSearch, setPermSearch] = useState("");

  const handleUnauthorized = () => {
    setStatusModal({
      show: true,
      title: "Unauthorized",
      message: "Please log in.",
      variant: "danger",
    });
    sessionStorage.removeItem("token");
    setTimeout(() => navigate("/login"), 1200);
  };

  useEffect(() => {
    if (!token) return handleUnauthorized();

    const fetchData = async () => {
      try {
        setLoading(true);
        const [permRes, userRes] = await Promise.all([
          fetch(`${BASE_URL}/roles/roles-and-permissions/all`, {
            headers: { ...authHeaders },
          }),
          fetch(`${BASE_URL}/user/${userId}/info`, {
            headers: { ...authHeaders },
          }),
        ]);

        const permData = await permRes.json();
        const userData = await userRes.json();

        if (!permData?.success) throw new Error("Failed to load permissions.");
        if (!userData?.user) throw new Error("Failed to load user info.");

        // Filter and sort permissions (remove any “all”)
        const filteredPerms = (permData.data?.permissions || [])
          .filter((p) => !String(p.permission_name).toLowerCase().includes("all"))
          .sort((a, b) => a.permission_name.localeCompare(b.permission_name));

        setPermissions(filteredPerms);

        const fullName = [userData.user.first_name, userData.user.middle_name, userData.user.last_name]
          .filter(Boolean)
          .join(" ");
        const role =
          userData.user.role ||
          (Array.isArray(userData.user.roles) ? userData.user.roles.join(", ") : "");

        setUserInfo({
          fullName: fullName || "User",
          email: userData.user.email || "",
          role,
        });

        const permsObj = userData.user.permissions || {};
        setUserPermissions(permsObj);
        setOriginalPermissions(permsObj);
      } catch (err) {
        setStatusModal({
          show: true,
          title: "Error",
          message: err.message,
          variant: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, token, authHeaders, navigate]);

  const filteredPermissions = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter((p) =>
      p.permission_name.toLowerCase().includes(q)
    );
  }, [permissions, permSearch]);

  const togglePermission = (permissionKey) => {
    setUserPermissions((prev) => ({
      ...prev,
      [permissionKey]: !prev[permissionKey],
    }));
  };

  const selectVisible = () => {
    setUserPermissions((prev) => {
      const next = { ...prev };
      filteredPermissions.forEach((p) => {
        next[p.permission_name] = true;
      });
      return next;
    });
  };

  const clearAll = () => {
    setUserPermissions({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return handleUnauthorized();

    const changedPermissions = Object.entries(userPermissions).filter(
      ([key, value]) => originalPermissions[key] !== value
    );

    // Include permissions that were originally true but now removed (undefined/false)
    const originalTrueKeys = Object.keys(originalPermissions).filter(
      (k) => originalPermissions[k] === true
    );
    originalTrueKeys.forEach((k) => {
      if (userPermissions[k] !== true) {
        if (!changedPermissions.find(([name]) => name === k)) {
          changedPermissions.push([k, false]);
        }
      }
    });

    if (!changedPermissions.length) {
      setStatusModal({
        show: true,
        title: "Info",
        message: "No changes to update.",
        variant: "info",
      });
      return;
    }

    setUpdating(true);
    try {
      // Update each changed permission
      for (const [permission_name, is_granted] of changedPermissions) {
        const res = await fetch(`${BASE_URL}/user/${userId}/permissions`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({ permission_name, is_granted }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(
            errData?.message || `Failed to update: ${permission_name}`
          );
        }
      }

      setStatusModal({
        show: true,
        title: "Success",
        message: "Permissions updated successfully!",
        variant: "success",
      });
      setOriginalPermissions({ ...userPermissions });
    } catch (err) {
      setStatusModal({
        show: true,
        title: "Error",
        message: `Update failed: ${err.message}`,
        variant: "danger",
      });
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
    <div className="container my-4">
      <div className="card shadow-sm border-0 rounded-4">
        {/* Header */}
        <div className="card-body p-4 p-md-5">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-2">
            <div>
              <h4 className="fw-bold mb-1 text-truncate">{userInfo.fullName}</h4>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                {userInfo.role && (
                  <span className="badge bg-info text-dark text-nowrap">{userInfo.role}</span>
                )}
                {userInfo.email && (
                  <small className="text-muted text-truncate">
                    <strong>Email:</strong> {userInfo.email}
                  </small>
                )}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-outline-secondary d-inline-flex align-items-center gap-2 text-nowrap"
              onClick={() => navigate(-1)}
              disabled={updating}
            >
              <FaArrowLeft />
              Back
            </button>
          </div>

          <hr className="mt-3" />

          {/* Controls */}
          <form onSubmit={handleSubmit} className="mt-3">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
              <div className="input-group input-group-sm" style={{ minWidth: 280, maxWidth: 420 }}>
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

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm text-nowrap"
                  onClick={selectVisible}
                  disabled={updating || filteredPermissions.length === 0}
                >
                  Select Visible
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm text-nowrap"
                  onClick={clearAll}
                  disabled={updating}
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Permissions chips */}
            <div
              className="border rounded-3 bg-white p-3 shadow-sm"
              style={{ maxHeight: 340, overflowY: "auto" }}
            >
              {filteredPermissions.length === 0 ? (
                <div className="text-muted fst-italic">No permissions found.</div>
              ) : (
                <div className="d-flex flex-wrap gap-2">
                  {filteredPermissions.map(({ permission_id, permission_name }) => {
                    const isChecked = !!userPermissions[permission_name];
                    return (
                      <button
                        key={permission_id}
                        type="button"
                        onClick={() => togglePermission(permission_name)}
                        className={`btn btn-sm rounded-pill text-nowrap d-inline-flex align-items-center gap-2 ${
                          isChecked ? "btn-primary" : "btn-outline-primary"
                        }`}
                        style={{ transition: "all 0.2s" }}
                        title={permission_name}
                        disabled={updating}
                      >
                        {permission_name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer line */}
            <div className="d-flex justify-content-between align-items-center mt-3">
              <small className="text-muted">
                Selected:{" "}
                <strong>
                  {Object.values(userPermissions).filter(Boolean).length}
                </strong>
              </small>
              <button
                type="submit"
                className="btn btn-success text-nowrap d-inline-flex align-items-center gap-2 px-3"
                disabled={updating}
              >
                {updating ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Updating…
                  </>
                ) : (
                  <>
                    <FaCheckCircle />
                    Update Permissions
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Status Modal */}
      <StatusModal
        {...statusModal}
        icon={
          statusModal.variant === "success" ? (
            <FaCheckCircle className="text-success me-2" />
          ) : statusModal.variant === "danger" ? (
            <FaTimesCircle className="text-danger me-2" />
          ) : (
            <FaInfoCircle className="text-info me-2" />
          )
        }
        onHide={() => setStatusModal((m) => ({ ...m, show: false }))}
      />

      {/* Subtle custom scrollbars for the permission list */}
      <style>{`
        .border.rounded-3.bg-white.p-3::-webkit-scrollbar { width: 8px; height: 8px; }
        .border.rounded-3.bg-white.p-3::-webkit-scrollbar-thumb {
          background-color: rgba(0,0,0,0.15);
          border-radius: 6px;
        }
        .border.rounded-3.bg-white.p-3::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
};

export default AssignPermissionsToUser;
