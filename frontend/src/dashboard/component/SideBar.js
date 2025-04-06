import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FaBars, FaTachometerAlt, FaUserPlus } from "react-icons/fa";
import "./Sidebar.css";

const Sidebar = ({ pageTitle, children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Sidebar */}
      <div className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-top">
          <div className="toggle-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
            <FaBars />
            {!isCollapsed && <span className="system-name">e-SF10 System</span>}
          </div>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-section-title">{!isCollapsed && "ANALYTICS"}</p>
          <Link to="/" className="sidebar-link">
            <FaTachometerAlt className="sidebar-icon" />
            {!isCollapsed && <span>Dashboard</span>}
          </Link>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-section-title">{!isCollapsed && "CONTENT"}</p>
          <Link to="/add_Student" className="sidebar-link">
            <FaUserPlus className="sidebar-icon" />
            {!isCollapsed && <span>Add Student</span>}
          </Link>
        </div>
      </div>

      {/* Topbar */}
      <div className={`topbar ${isCollapsed ? "collapsed" : ""}`}>
        <h2 className="topbar-title">{pageTitle}</h2>
        <div className="topbar-profile">
          <img src="https://i.pravatar.cc/40" alt="Avatar" className="avatar" />
        </div>
      </div>

      {/* Page Content */}
      <main className={`main-content ${isCollapsed ? "collapsed" : ""}`}>
        {children}
      </main>
    </>
  );
};

export default Sidebar;
