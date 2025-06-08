import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Route, Routes, NavLink, useLocation } from 'react-router-dom';
import {
  FaHome,
  FaUserGraduate,
  FaUsersCog,
  FaChevronDown,
  FaBuilding,
  FaBars,
  FaPlus,
  FaSignOutAlt,
  FaDatabase,
  FaListAlt,
  FaUpload,
} from 'react-icons/fa';



import Home from '../screens/home';
import StudentInformation from '../screens/student_information';
import AddStudent from '../screens/add_students';
import AddUser from '../screens/add_users';
import EditStudent from '../screens/edit_student';
import StudentRecord from '../screens/record_students';
import UploadEcard from '../screens/upload_ecards';
import UploadEcardAll from '../screens/upload_ecards_all';
import User from '../screens/users';
import SchoolSettings from '../screens/school_settings';
import Backup from '../screens/backup';
import CreateRoles from '../screens/create_roles';
import EditPermission from '../screens/edit_permission';


import './dashboard.css';

const Dashboard = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isStudentMenuOpen, setIsStudentMenuOpen] = useState(false);  // <-- add this
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [schoolData, setSchoolData] = useState({});
  const [logoUrl, setLogoUrl] = useState(null);
  const [isSysAdminOpen, setIsSysAdminOpen] = useState(false);


  const schoolId = '1234567890';
  const token = localStorage.getItem('token');

  const navLinks = [
    { to: '/dashboard', icon: <FaHome />, label: 'Dashboard' },
    { to: '/student_information', icon: <FaUserGraduate />, label: 'Student Information' },
    { to: '/add_student', icon: <FaPlus />, label: 'Add Students' },

    // System Administation
    { to: '/users_account', icon: <FaUsersCog />, label: 'User Roles & Permission' },
    { to: '/system', icon: <FaBuilding />, label: 'System Default' },
    { to: '/backup', icon: <FaDatabase />, label: 'System Backup' }
  ];

  useEffect(() => {
    const fetchUser = async () => {
      const userId = localStorage.getItem('user_id');
      if (!userId || !token) return;

      try {
        const res = await axios.get(`http://localhost:3001/esf10/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(res.data);
      } catch (err) {
        console.error('Failed to load user', err);
      }
    };

    const fetchSchoolData = async () => {
      try {
        const res = await axios.get(`http://localhost:3001/esf10/school-defaults/${schoolId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = res.data || {};
        const { user, school_id, created_at, updated_at, ...filtered } = data;
        setSchoolData(filtered);

        if (data?.school_logo) {
          const logo = data.school_logo.startsWith('http')
            ? data.school_logo
            : `http://localhost:3001${data.school_logo}`;
          setLogoUrl(logo);
        } else {
          setLogoUrl(null);
        }
      } catch (err) {
        console.error('Failed to fetch school defaults', err);
      }
    };

    fetchUser();
    fetchSchoolData();
  }, []);

  const fullName = user
    ? [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ')
    : 'Loading...';

  const avatarInitial = user?.first_name?.charAt(0).toUpperCase() || '?';
  const role = Array.isArray(user?.roles) ? user.roles[0] : user?.roles || 'User';

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className={`sidebar glass ${collapsed ? 'collapsed' : ''}`}>
     <div className="sidebar-header p-3 border-bottom border-secondary">
  {!collapsed && (
    <>
      <h2 className="fw-bold text-white mb-1" style={{ letterSpacing: '2px', fontSize: '1.8rem' }}>
        E-SF10 SYSTEM
      </h2>
      <p
        className="text-white-50 mt-3"
        style={{ maxWidth: '260px', lineHeight: '1.2', fontSize: '0.5rem' }}
      >
       Manage student forms easily and securely.
      </p>
    </>
  )}
</div>
  <ul className="nav-links" style={{ fontSize: '0.9rem' }}>
      <li>
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `link ${isActive ? 'active' : ''}`}
        >
          <FaHome />
          {!collapsed && <span className="ms-2">Dashboard Overview</span>}
        </NavLink>
      </li>

      {/* Manage Student Records Dropdown */}
      <li className="dropdown-link">
        <div
          className="link d-flex justify-content-between align-items-center"
          onClick={() => setIsStudentMenuOpen(prev => !prev)}
          style={{ cursor: 'pointer' }}
        >
          <div className="d-flex align-items-center">
            <FaUserGraduate />
            {!collapsed && <span className="ms-2">Manage Student Records</span>}
          </div>
          {!collapsed && (
            <FaChevronDown
              className={`dropdown-icon ${isStudentMenuOpen ? 'rotate' : ''}`}
            />
          )}
        </div>

        <ul
          className={`submenu ${isStudentMenuOpen ? 'show' : ''}`}
          style={{ display: collapsed ? 'none' : undefined }}
        >
          <li>
            <NavLink
              to="/add_student"
              className={({ isActive }) => `link ${isActive ? 'active' : ''}`}
            >
              <FaPlus />
              {!collapsed && <span className="ms-4">Add New Student</span>}
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/student_information"
              className={({ isActive }) => `link ${isActive ? 'active' : ''}`}
            >
              <FaListAlt />
              {!collapsed && <span className="ms-4">View All Students</span>}
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/upload_ecards_all"
              className={({ isActive }) => `link ${isActive ? 'active' : ''}`}
            >
              <FaUpload />
              {!collapsed && <span className="ms-4">Upload SF10</span>}
            </NavLink>
          </li>
        </ul>
      </li>

      {/* System Administrator Dropdown */}
      <li className="dropdown-link">
        <div
          className="link d-flex justify-content-between align-items-center"
          onClick={() => setIsSysAdminOpen(prev => !prev)}
          style={{ cursor: 'pointer' }}
        >
          <div className="d-flex align-items-center">
            <FaUsersCog />
            {!collapsed && <span className="ms-2">System Administrator Panel</span>}
          </div>
          {!collapsed && (
            <FaChevronDown
              className={`dropdown-icon ${isSysAdminOpen ? 'rotate' : ''}`}
            />
          )}
        </div>

      <ul
  className={`submenu ${isSysAdminOpen ? 'show' : ''}`}
  style={{ display: collapsed ? 'none' : undefined }}
>
  <li>
    <NavLink
      to="/users_account"
      className={({ isActive }) => `link ${isActive ? 'active' : ''}`}
    >
      <FaUsersCog />
      {!collapsed && <span className="ms-4">User Roles & Permissions</span>}
    </NavLink>
  </li>

  <li>
    <NavLink
      to="/school_settings"
      className={({ isActive }) => `link ${isActive ? 'active' : ''}`}
    >
      <FaBuilding />
      {!collapsed && <span className="ms-4">School Default Settings</span>}
    </NavLink>
  </li>

  <li>
    <NavLink
      to="/backup"
      className={({ isActive }) => `link ${isActive ? 'active' : ''}`}
    >
      <FaDatabase />
      {!collapsed && <span className="ms-4">Backup System Database</span>}
    </NavLink>
  </li>
</ul>

      </li>
    </ul>


       {/* School Info */}
{!collapsed && (
  <div className="school-info p-3 text-white small" style={{ fontSize: '0.75rem' }}>
    <hr className="bg-light" />
    <p className="text-center mb-0" style={{ fontSize: '0.7rem', opacity: 0.7 }}>
      &copy; {new Date().getFullYear()} All rights reserved.
    </p>
    <p className="text-center mb-0" style={{ fontSize: '0.7rem', opacity: 0.7, fontStyle: 'italic' }}>
      Extension Project by TMC Coding Club
    </p>
  </div>
)}

      </div>

      {/* Main */}
      <div className="main">
        <div className="topbar">
          <div className="d-flex align-items-center justify-content-between">
            <button
              className="toggle-btn"
              onClick={() => setCollapsed(!collapsed)}
              aria-label="Toggle sidebar"
            >
              <FaBars />
            </button>
             {logoUrl ? (
            <img
              src={logoUrl}
              alt="School Logo"
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid #fff',
                backgroundColor: '#e9ecef',
              }}
            />
          ) : (
            <div
              className="rounded-circle bg-secondary d-flex justify-content-center align-items-center text-white"
              style={{
                width: '60px',
                height: '60px',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              N/A
            </div>
          )}
            <div className='mx-3'>
              <h5 className="mb-0 fw-bold">{schoolData.school_name || 'Loading...'}</h5>
              <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                 {schoolData.school_address || 'N/A'}
              </small>
            </div>
          </div>

          <div className="dropdown">
            <button
              className="btn bg-white border rounded-pill d-flex align-items-center gap-2 px-3 py-1"
              type="button"
              id="profileDropdown"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <div
                className="rounded-circle bg-primary text-white d-flex justify-content-center align-items-center"
                style={{
                  width: '36px',
                  height: '36px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  userSelect: 'none',
                }}
              >
                {avatarInitial}
              </div>

              <div className="d-none d-md-flex flex-column text-start ms-2">
                <span className="text-dark fw-medium">{fullName}</span>
                <small className="text-muted" style={{ fontSize: '0.75rem' }}>{role}</small>
              </div>

              <FaChevronDown className="text-muted small d-none d-md-inline ms-2" />
            </button>

            <ul
              className="dropdown-menu dropdown-menu-end mt-2 shadow-sm"
              aria-labelledby="profileDropdown"
            >
              <li>
                <button
                  className="dropdown-item d-flex align-items-center gap-2"
                  onClick={onLogout}
                >
                  <FaSignOutAlt className="text-danger" />
                  <span className="text-danger fw-semibold">Logout</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="main-content">
          <Routes>
            <Route path="/dashboard" element={<Home />} />
            <Route path="/student_information" element={<StudentInformation />} />
            <Route path="/add_student" element={<AddStudent />} />
            <Route path="/add_user" element={<AddUser />} />
            <Route path="/users_account" element={<User />} />
            <Route path="/edit_student/:lrn" element={<EditStudent />} />
            <Route path="/record_student/:lrn" element={<StudentRecord />} />
            <Route path="/upload_ecards/:lrn" element={<UploadEcard />} />
            <Route path="/upload_ecards_all" element={<UploadEcardAll />} />
            <Route path="/edit-user/:userId" element={<AddUser />} />
            <Route path="/school_settings" element={<SchoolSettings />} />
            <Route path="/backup" element={<Backup />} />
            <Route path="/create_roles" element={<CreateRoles />} />
           <Route path="/edit_permission/:userId" element={<EditPermission />} />
              
            {/* <Route path="*" element={<NotFound />} /> */}
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
