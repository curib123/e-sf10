import React, { useState, useEffect } from 'react';
import { Route, Routes, Link, useLocation } from 'react-router-dom';
import {
  FaHome, FaUserGraduate, FaUsersCog,
  FaBuilding, FaBars, FaPlus, FaSignOutAlt
} from 'react-icons/fa';

import Home from '../screens/home';
import StudentInformation from '../screens/student_information';
import AddStudent from '../screens/add_students';
import Add_User from '../screens/add_users';
import EditStudent from '../screens/edit_student';
import User from '../screens/users';

import './dashboard.css';

const Dashboard = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const [pageTitle, setPageTitle] = useState('');

  // useEffect(() => {
  //   const pathToTitle = {
  //     '/home': 'Dashboard',
  //     '/student_information': 'Student Information',
  //     '/users_account': 'Users Account',
  //     '/add_student': 'Add Student',
  //     '/add_user': 'Create User Account',
  //     '/edit_student/:lrn': 'Update User',
  //     '/reports': 'Administration',
  //   };
  //   setPageTitle(pathToTitle[location.pathname] || 'Dashboard');
  // }, [location]);

  const navLinks = [
    { to: '/home', icon: <FaHome />, label: 'Dashboard' },
    { to: '/student_information', icon: <FaUserGraduate />, label: 'Student Info' },
    { to: '/add_student', icon: <FaPlus />, label: 'Add Student' },
    { to: '/users_account', icon: <FaUsersCog />, label: 'Users' },
    { to: '/reports', icon: <FaBuilding />, label: 'Administration' },
  ];

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className={`sidebar glass ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <span className="logo">E-SF10</span>
        </div>
        <ul className="nav-links">
          {navLinks.map(({ to, icon, label }) => (
            <li key={to}>
              <Link to={to} className={`link ${location.pathname === to ? 'active' : ''}`}>
                {icon}
                {!collapsed && <span>{label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Main */}
      <div className="main">
        <div className="topbar">
         <div className='d-flex align-items-center justify-content-between '> 
           <button className="toggle-btn" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar">
            <FaBars />
          </button>
          <h3>Trinidad Municipal College</h3>
         </div>
          <button className="logout-btn" onClick={onLogout} aria-label="Logout">
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </div>

        <div className="main-content">
          <Routes>
            <Route path="/home" element={<Home />} />
            <Route path="/student_information" element={<StudentInformation />} />
            <Route path="/add_student" element={<AddStudent />} />
            <Route path="/add_user" element={<Add_User />} />
            <Route path="/users_account" element={<User />} />
            <Route path="/edit_student/:lrn" element={<EditStudent />} />
            

          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
