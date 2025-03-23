import React from "react";
import "./login.css";

const Login = () => {
  return (
    <div className="login-container">

      <div className="overlay"></div>
     
      <div className="login-box">
        <h2 className="login-title">Inventory System Login</h2>
        <form className="login-form">
          <label className="login-label">Username</label>
          <input type="text" className="login-input" />
          
          <label className="login-label">Password</label>
          <input type="password"  className="login-input" />
          
          <button className="login-button">Login</button>
        </form>
      </div>
    </div>
  );
};

export default Login;
