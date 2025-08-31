// Login.jsx
import React, { useMemo, useState, useCallback } from "react";
import { FaUser, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import { Modal, Button } from "react-bootstrap";
import StatusModal from "../components/status_modal";
import "./login.css";

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const InputField = ({
  icon: Icon,
  type,
  placeholder,
  value,
  onChange,
  autoFocus = false,
  ariaLabel,
  autoComplete,
  rightSlot,
}) => (
  <div className="input-group auth-input-group rounded-3 shadow-sm">
    <span className="input-group-text auth-addon rounded-start-3">
      <Icon />
    </span>
    <input
      type={type}
      className="form-control auth-control rounded-end-3"
      placeholder={placeholder}
      required
      value={value}
      onChange={onChange}
      autoFocus={autoFocus}
      aria-label={ariaLabel || placeholder}
      autoComplete={autoComplete}
    />
    {rightSlot ? <span className="input-group-text auth-addon-right">{rightSlot}</span> : null}
  </div>
);

const Login = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const emailValid = useMemo(() => /\S+@\S+\.\S+/.test(email), [email]);
  const canSubmit = emailValid && password.length >= 1 && !loading;

  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "danger",
  });

  // Developer modal state
  const [showDevModal, setShowDevModal] = useState(false);
  const handleDevOpen = () => setShowDevModal(true);
  const handleDevClose = () => setShowDevModal(false);

  const handleLogin = useCallback(
    async (e) => {
      e.preventDefault();
      if (!canSubmit) return;
      setLoading(true);

      try {
        const res = await fetch(`${BASE_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        let data = null;
        try {
          data = await res.json();
        } catch {
          /* no-op */
        }

        if (res.ok && data?.token) {
          const storage = remember ? localStorage : sessionStorage;
          storage.setItem("loginResponse", JSON.stringify(data));
          storage.setItem("token", data.token);
          storage.setItem("user_id", data.user?.user_id || "");
          storage.setItem("user_email", data.user?.email || "");
          storage.setItem("user_role", data.user?.role || "");

          setModal({
            show: true,
            title: "Success",
            message: "Login successful! Redirecting…",
            variant: "success",
          });
          setTimeout(() => onLogin?.(), 900);
        } else {
          const message = data?.message || `Login failed (${res.status})`;
          setPassword("");
          setModal({ show: true, title: "Login Failed", message, variant: "danger" });
        }
      } catch {
        setModal({
          show: true,
          title: "Error",
          message: "Unable to reach the server. Please try again.",
          variant: "danger",
        });
      } finally {
        setLoading(false);
      }
    },
    [email, password, remember, canSubmit, onLogin]
  );

  return (
    <div className="login-page-wrapper">
      <div className="bg-image" />

      {/* Loading overlay */}
      {loading && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-dark bg-opacity-50" style={{ zIndex: 1050 }}>
          <div className="text-center bg-white p-4 rounded-4 shadow-lg" style={{ minWidth: 280 }}>
            <div className="spinner-border text-primary mb-3" role="status" />
            <p className="mb-0 fw-semibold">Signing you in…</p>
          </div>
        </div>
      )}

      <div className="container vh-100 d-flex justify-content-center align-items-center px-3">
        <div className="login-card glass-card shadow-lg rounded-4 p-4 p-md-5">
          <div className="text-center mb-4">
            <div className="brand-badge mx-auto mb-3">eSF10</div>
            <h1 className="h4 fw-bold mb-1 text-dark">Welcome back</h1>
            <p className="text-muted mb-0 small">Sign in to continue to e-SF10 System</p>
          </div>

          <form onSubmit={handleLogin} className="d-flex flex-column gap-3" noValidate>
            <InputField
              icon={FaUser}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="username"
            />
            {!emailValid && email.length > 0 && (
              <small className="text-danger ms-1">Enter a valid email address.</small>
            )}

            <InputField
              icon={FaLock}
              type={showPw ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              rightSlot={
                <button
                  type="button"
                  className="btn btn-link p-0 border-0 text-decoration-none toggle-eye"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPw ? <FaEyeSlash /> : <FaEye />}
                </button>
              }
            />

            <div className="d-flex justify-content-between align-items-center">
              <label className="form-check small m-0 d-flex align-items-center gap-2">
                <input
                  type="checkbox"
                  className="form-check-input m-0"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span className="text-muted">Remember me</span>
              </label>
              <button
                type="button"
                className="btn btn-link p-0 small text-decoration-none"
                onClick={() =>
                  setModal({
                    show: true,
                    title: "Info",
                    message: "Please contact your admin to reset your password.",
                    variant: "info",
                  })
                }
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="btn btn-primary auth-submit w-100 py-2 fw-semibold rounded-3"
              disabled={!canSubmit}
              aria-disabled={!canSubmit}
              title={!canSubmit ? "Enter valid credentials" : "Sign in"}
            >
              {loading ? "Logging in…" : "Sign in"}
            </button>
          </form>

          {/* Developer Info link */}
          <div className="mt-4 d-flex align-items-center gap-2 text-muted small">
            <div className="flex-grow-1 divider-line" />
            <span
              style={{ cursor: "pointer" }}
              onClick={handleDevOpen}
              className="fst-italic text-primary"
            >
              About the developer
            </span>
            <div className="flex-grow-1 divider-line" />
          </div>
        </div>
      </div>

    {/* Developer Info Modal */}
<Modal show={showDevModal} onHide={handleDevClose} centered>
  <Modal.Header closeButton>
    <Modal.Title>About the Developer</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    <p>
      This project is an <strong>extension project by the TMC Students Club IT Coding Club</strong>.
      It was created to provide an academic records system and to showcase software
      engineering best practices.
    </p>
    <hr />
    <p className="mb-1"><strong>Developers:</strong></p>
    <ul>
      <li>John Paul Curib (Front-end Software Engineer)</li>
      <li>Quiver Cutanda (Back-end Software Engineer)</li>
    </ul>
    <p className="mb-1"><strong>Project Adviser / Manager:</strong></p>
    <ul>
      <li>Clark Kevin Villamor</li>
    </ul>
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={handleDevClose}>
      Close
    </Button>
  </Modal.Footer>
</Modal>


      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />
    </div>
  );
};

export default Login;
