import React, { useState, useCallback } from "react";
import { FaUser, FaLock } from "react-icons/fa";
import StatusModal from "../components/status_modal";
import "./login.css";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const InputField = ({ icon: Icon, type, placeholder, value, onChange, autoFocus = false }) => (
  <div className="input-group rounded shadow-sm">
    <span className="input-group-text bg-secondary text-white fs-5 border-0 rounded-start">
      <Icon />
    </span>
    <input
      type={type}
      className="form-control border-0 rounded-end"
      placeholder={placeholder}
      required
      value={value}
      onChange={onChange}
      style={{ fontSize: "1.1rem" }}
      autoFocus={autoFocus}
      aria-label={placeholder}
    />
  </div>
);

const Login = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });

  const handleLogin = useCallback(
    async (e) => {
      e.preventDefault();
      setLoading(true);

      try {
        const response = await fetch(`${BASE_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        let data;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        setLoading(false);

        if (response.ok && data?.token) {
          // Store the entire response data object as JSON
          sessionStorage.setItem("loginResponse", JSON.stringify(data));
          sessionStorage.setItem("token", data.token);
          sessionStorage.setItem("user_id", data.user.user_id);
          sessionStorage.setItem("user_email", data.user.email);
          sessionStorage.setItem("user_role", data.user.role);

          setModal({ show: true, title: "Success", message: "Login successful! Redirecting...", variant: "success" });
          setTimeout(() => onLogin(), 2000);
        } else {
          setPassword(""); // Clear password on failure
          const message = data?.message || `Login failed (${response.status})`;
          setModal({ show: true, title: "Login Failed", message, variant: "danger" });
        }
      } catch (error) {
        console.error("Login error:", error);
        setLoading(false);
        setModal({ show: true, title: "Error", message: "Unable to connect to the server. Please try again later.", variant: "danger" });
      }
    },
    [email, password, onLogin]
  );

  return (
    <div className="login-page-wrapper">
      <div className="bg-image"></div>

      <div className="container vh-100 d-flex justify-content-center align-items-center px-3">
        {loading && (
          <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-dark bg-opacity-50"
            style={{ zIndex: 1050 }}
            aria-live="assertive"
            aria-busy="true"
          >
            <div className="text-center bg-white p-5 rounded shadow" style={{ zIndex: 1060, minWidth: "280px" }}>
              <div className="spinner-border text-primary mb-4" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mb-0 fs-5 fw-semibold">Logging in...</p>
            </div>
          </div>
        )}

        <div
          className="login-card shadow bg-white bg-opacity-75 rounded p-5"
          style={{ maxWidth: "420px", width: "100%", backdropFilter: "blur(8px)" }}
        >
          <h2 className="text-center fs-5 mb-4 fw-bold text-dark text-uppercase letter-spacing-2 text-shadow">
            Welcome to e-SF10 System
          </h2>

          <form onSubmit={handleLogin} className="d-flex flex-column gap-4" noValidate>
            <InputField
              icon={FaUser}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <InputField
              icon={FaLock}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn-secondary py-1 fs-5 fw-semibold rounded"
              disabled={loading}
              style={{ transition: "background-color 0.3s ease" }}
              aria-disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>

      <StatusModal {...modal} onHide={() => setModal({ ...modal, show: false })} />
    </div>
  );
};

export default Login;
