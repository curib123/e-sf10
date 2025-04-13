import React, { useState } from "react";
import { FaUser, FaLock } from "react-icons/fa";
import "./login.css";

const Login = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);

    const validUsername = "admin";
    const validPassword = "password123";

    setTimeout(() => {
      setLoading(false);
      if (username === validUsername && password === validPassword) {
        onLogin();
      } else {
        alert("Invalid Username or Password");
      }
    }, 2000);
  };

  return (
    <div className="login-page-wrapper">
     
      <div className="bg-image"></div>

      
      <div className="container vh-100 d-flex justify-content-center align-items-center position-relative">
        {loading && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-dark bg-opacity-50" style={{ zIndex: 1050 }}>
            <div className="text-center bg-white p-4 rounded shadow" style={{ zIndex: 1060 }}>
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mb-0">Logging in...</p>
            </div>
          </div>
        )}
        <div className="card p-4 shadow bg-white bg-opacity-75" style={{ width: "100%", maxWidth: "400px", backdropFilter: "blur(8px)" }}>
          <h3 className="text-center mb-2">Trinidad Municipal College</h3>
          <p className="text-center text-muted mb-4">e-SF10 System</p>
          <form onSubmit={handleLogin}>
            <div className="mb-3 input-group">
              <span className="input-group-text">
                <FaUser />
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="mb-4 input-group">
              <span className="input-group-text">
                <FaLock />
              </span>
              <input
                type="password"
                className="form-control"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn-secondary w-100"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
