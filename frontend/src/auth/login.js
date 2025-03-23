import React, { useState } from "react";
import "./login.css";
import { FaUser, FaLock } from "react-icons/fa";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Hardcoded nga authentication data paras test lang hehehhe
    const validUsername = "admin";
    const validPassword = "password123";

    setTimeout(() => {
      setLoading(false);
      if (username === validUsername && password === validPassword) {
        alert("Login Successful!");
      } else {
        alert("Invalid Username or Password");
      }
    }, 2000);
  };

  return (
    <div className="login-container">
      {loading && (
        <div className="loading-modal">
          <div className="loading-box">
            <div className="loading-spinner"></div>
            <p>Logging in...</p>
          </div>
        </div>
      )}
      <div className="login-box">
        <h2 className="login-title">Trinidad Municipal College</h2>
        <p className="login-subtitle">e-SF10 System</p>
        <form className="login-form" onSubmit={handleLogin}>
          <div className="input-group">
            <FaUser className="input-icon" />
            <input 
              type="text" 
              placeholder="Username" 
              className="login-input" 
              required 
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="input-group">
            <FaLock className="input-icon" />
            <input 
              type="password" 
              placeholder="Password" 
              className="login-input" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="login-button" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;