import React from "react";
import Sidebar from "./component/SideBar";
import { Routes, Route, useLocation } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Add_Student from "./pages/Add_Student";

const DashboardLayout = () => {
  const location = useLocation();

  // Function to get the page name based on the current route
  const getPageName = (path) => {
    switch (path) {
      case "/":
        return "Dashboard";
      case "/add_Student":
        return "Add Student";
      default:
        return "Page Not Found"; // Default fallback if route is not mapped
    }
  };

  const pageName = getPageName(location.pathname);

  return (
    <div className="dashboard-container" style={{ display: "flex" }}>
      {/* Sidebar is always shown on the left */}
      <Sidebar pageTitle={pageName} />

      <div style={{ flex: 1, padding: "20px" }}>
        {/* Routes for different pages */}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add_Student" element={<Add_Student />} />
        </Routes>
      </div>
    </div>
  );
};

export default DashboardLayout;
