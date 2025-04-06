import React, { useState } from "react";
import "./login.css";
import { FaUser, FaLock } from "react-icons/fa";

const Login = ({ onLogin }) => {
  // Nag set ta'g mga state para sa loading, username ug password
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Function para i-handle ang login button click
  const handleLogin = (e) => {
    e.preventDefault(); // I-prevent lang nato ang reload sa page
    setLoading(true); // Pa-show ta sa loading spinner while nag-login

    // Hardcoded username ug password for testing lang ni ha 😅
    const validUsername = "admin";
    const validPassword = "password123";

    // Simulate nato nga nag-communicate ta sa server (2 seconds)
    setTimeout(() => {
      setLoading(false); // Wala na loading
      if (username === validUsername && password === validPassword) {
        alert("Login Successful!");
        onLogin(); // Tawagon nato ang function nga mo-pass sa App.js para mo-load na ang dashboard layout
      } else {
        alert("Invalid Username or Password");
      }
    }, 2000);
  };

  // UI sa login form
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
              onChange={(e) => setUsername(e.target.value)} // Gikuha ang input value from user
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
              onChange={(e) => setPassword(e.target.value)} // Gikuha pud ang password input
            />
          </div>
          <button className="login-button" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"} {/* Mo change text kung nag loading */}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
