import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FaBars, FaTachometerAlt, FaUser } from "react-icons/fa";
import "./Sidebar.css";

const Sidebar = ({ pageTitle, children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Sidebar Container */}
      <div className={`sidebar-container ${isCollapsed ? "collapsed" : ""}`}>
        {/* Sidebar */}
        <div className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
          <div className="sidebar-top">
            <div
              className="toggle-btn"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              <FaBars />
            </div>

            <h1 className="system-name">E-SF10 SYSTEM</h1>
          </div>

          {/* Sidebar Sections */}
          <div className="sidebar-section">
            <p className={`sidebar-section-title ${isCollapsed ? "collapsed" : ""}`}>
              {!isCollapsed && "ANALYTICS"}
            </p>
            <Link to="/" className="sidebar-link">
              <FaTachometerAlt className="sidebar-icon" />
              {!isCollapsed && <span>Dashboard</span>}
            </Link>
          </div>

          <div className="sidebar-section">
            <p className={`sidebar-section-title ${isCollapsed ? "collapsed" : ""}`}>
              {!isCollapsed && "CONTENT"}
            </p>
            <Link to="/student_info" className="sidebar-link">
              <FaUser className="sidebar-icon" />
              {!isCollapsed && <span>Student Information</span>}
            </Link>
          </div>
        </div>

        {/* Main Content */}
        <main className={`main-content ${isCollapsed ? "collapsed" : ""}`}>
          {children}
        </main>
      </div>
    </>
  );
};

export default Sidebar;
