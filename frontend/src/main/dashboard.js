import React, { useState, useEffect } from 'react';
import { Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom';
import { FaHome, FaUserGraduate, FaUsersCog, FaBuilding, FaBars,FaPlus, FaSignOutAlt } from 'react-icons/fa';
import Home from '../screens/home';
import StudentInformation from '../screens/student_information';
import AddStudent from '../screens/add_students';
import './dashboard.css';

const Dashboard = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [pageTitle, setPageTitle] = useState('');

  useEffect(() => {
    const pathToTitle = {
      '/home': 'Dashboard',
      '/student_information': 'Student Information',
      '/settings': 'Access Roles',
      '/reports': 'Administration',
    };
    setPageTitle(pathToTitle[location.pathname] || 'Dashboard');
  }, [location]);

  const handleLogout = () => {
    console.log("Logging out...");
    navigate('/login');
  };

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <div className={`sidebar bg-dark text-white ${collapsed ? 'collapsed' : ''}`}>
        <div className="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
          <span className="fs-5 sidebar-title">E-SF10 System</span>
          <button className="btn btn-sm btn-outline-light" onClick={() => setCollapsed(!collapsed)}>
            <FaBars />
          </button>
        </div>
        <ul className="nav nav-pills flex-column mt-3">
          <li className="nav-item">
            <Link to="/home" className="nav-link text-white">
              <FaHome className="me-5" />
              <span className="link-text">Dashboard</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/student_information" className="nav-link text-white">
              <FaUserGraduate className="me-5" />
              <span className="link-text">Student Info</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/add_student" className="nav-link text-white">
              <FaPlus className="me-5" />
              <span className="link-text">Add Student</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/settings" className="nav-link text-white">
              <FaUsersCog className="me-5" />
              <span className="link-text">Access Roles</span>
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/reports" className="nav-link text-white">
              <FaBuilding className="me-5" />
              <span className="link-text">Administration</span>
            </Link>
          </li>
        </ul>
      </div>

      {/* Main content area */}
      <div className="flex-grow-1">
        <nav className="navbar navbar-expand-lg navbar-light bg-light shadow-sm px-4">
          <div className="container-fluid d-flex justify-content-between align-items-center">
            <h5 className="my-2">{pageTitle}</h5>
            <button className="btn btn-outline-danger btn-sm d-flex align-items-center" onClick={handleLogout}>
              <FaSignOutAlt className="me-2" />
              Logout
            </button>
          </div>
        </nav>

        <div className="p-4">
          <Routes>
            <Route path="/home" element={<Home />} />
            <Route path="/student_information" element={<StudentInformation />} />
            <Route path="/add_student" element={<AddStudent />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
