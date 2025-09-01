import React, { useState, useEffect } from "react";
import axios from "axios";
import { Route, Routes, NavLink } from "react-router-dom";
import { Modal, Button } from "react-bootstrap"; 
import {
  FaHome,
  FaUserGraduate,
  FaUsersCog,
  FaChevronDown,
  FaSchool,
  FaBuilding,
  FaBars,
  FaPlus,
  FaSignOutAlt,
  FaDatabase,
  FaListAlt,
  FaUpload,
  FaExchangeAlt,
  FaHistory,
  FaBook,
  FaClipboardCheck,
  FaCog,
  FaCalendarAlt,
  FaUserPlus,
  FaAddressBook,
  FaBookOpen,
  FaTasks,
  FaChalkboardTeacher,
  FaLayerGroup,
  FaListOl,
  FaSitemap,
} from "react-icons/fa";



import Home from "../screens/home_dashboard";
import StudentInformation from "../screens/student_information";
import AddStudent from "../screens/studen_form";
import AddUser from "../screens/user_upsert";
import EditStudent from "../screens/student_edit";
import StudentRecord from "../screens/student_records";
import UploadEcard from "../screens/upload_ecards";
import UploadEcardAll from "../screens/upload_ecards_all";
import User from "../screens/user_list";
import GradeLevelList from "../screens/grade_level_list";
import GradeLevelUpsert from "../screens/grade_level_upsert";
import SectionList from "../screens/section_list";
import SectionUpsert from "../screens/section_upsert";
import SubjectUpsert from "../screens/subject_upsert";
import SubjectList from "../screens/subject_list";
import Curriculum from "../screens/curriculum_list";
import CurriculumUpsert from "../screens/curriculum_upsert";
import CurriculumAssign from "../screens/curriculum_assign";
import EnrollmentList from "../screens/enrollment_list";
import EnrollmentUpsert from "../screens/enrollment_upsert";
import TeacherList from "../screens/teacher_list";
import TeacherUpsert from "../screens/teacher_upsert";
import TeacherAssign from "../screens/teacher_assign";
import TeacherAssignUpsert from "../screens/teacher_assign_upsert";
import ClassScheduleUpsert from "../screens/class_schedule_upsert";
import ClassScheduleList from "../screens/class_schedule_list";
import AssignSubjectPerYearLevel from "../screens/assign_subject_per_level_list";
import AssignSubjectPerYearLevelForm from "../screens/assign_subject_per_level_form";
import SchoolSettings from "../screens/school_settings";
import Backup from "../screens/backup";
import CreateRoles from "../screens/roles_upsert";
import EditPermission from "../screens/permission_assign_to_user";
import RequestTransfer from "../screens/request_transfer";
import ViewRequest from "../screens/request_list";
import AllLogs from "../screens/all_logs";
import DisplaySchoolYear from "../screens/school_year_list";
import UpsertSchoolYear from "../screens/school_year_upsert";
import NotFound from "../screens/not_found";


// Helpers
import { checkToken } from "../components/token_checker";
import { getUserPermissions } from "../components/get_permission";

// Styles
import "./sidebar.css";
import ClassSchedulesList from "../screens/class_schedule_list";

// ---- API Config ----
const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const LOGO_URL = process.env.REACT_APP_API_LOGO_URL;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ---- Sidebar Link & Dropdown ----
const SidebarLink = ({ to, icon: Icon, label, collapsed }) => (
  <NavLink to={to} className={({ isActive }) => `link ${isActive ? "active" : ""}`}>
    <Icon /> {!collapsed && <span className="ms-2">{label}</span>}
  </NavLink>
);

const SidebarDropdown = ({ label, icon: Icon, collapsed, open, setOpen, children }) => (
  <li className="dropdown-link">
    <div
      className="link d-flex justify-content-between align-items-center"
      onClick={() => setOpen(!open)}
      style={{ cursor: "pointer" }}
    >
      <div className="d-flex align-items-center">
        <Icon /> {!collapsed && <span className="ms-2">{label}</span>}
      </div>
      {!collapsed && <FaChevronDown className={`dropdown-icon ${open ? "rotate" : ""}`} />}
    </div>
    <ul className={`submenu ${open ? "show" : ""}`} style={{ display: collapsed ? "none" : undefined }}>
      {children}
    </ul>
  </li>
);

// ---- Main Sidebar Component ----
const Sidebar = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState({});
  const [user, setUser] = useState(null);
  const [schoolData, setSchoolData] = useState({});
  const [logoUrl, setLogoUrl] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [showModal, setShowModal] = useState(false);

  const schoolId = "1234567890";
  const token = sessionStorage.getItem("token");
  const userRole = sessionStorage.getItem("user_role");

  const handleOpen = () => setShowModal(true);
  const handleClose = () => setShowModal(false);

// ---- Sidebar Menus ----
const menus = [
  {
    type: "link",
    roles: ["admin", "registrar"],
    permission: "view_reports",
    to: "/dashboard",
    icon: FaHome,
    label: "Dashboard",
  },

  {
    type: "dropdown",
    label: "Student Records",
    icon: FaUserGraduate,
    key: "student",
    children: [
      { to: "/add_student", icon: FaUserPlus, label: "Add New Student", permission: "register_student" },
      { to: "/student_information", icon: FaAddressBook, label: "Student Directory", permission: "view_student_info" },
      { to: "/upload_ecards_all", icon: FaUpload, label: "Upload SF10 Records", permission: "upload_documents" },
      { to: "/view_request", icon: FaExchangeAlt, label: "Transfer Requests", permission: "approve_transfers" },
    ],
  },

  // --- Academics: Management
  {
    type: "dropdown",
    label: "Academic Management",
    icon: FaBook,
    key: "academic_management",
    roles: ["admin"],
    children: [
      { to: "/subjects", icon: FaBookOpen, label: "Subject Management" },
      { to: "/curriculum", icon: FaTasks, label: "Curriculum Management" },
      { to: "/teacher", icon: FaChalkboardTeacher, label: "Teacher Management" },
    ],
  },

  // --- Academics: Assignments
  {
    type: "dropdown",
    label: "Assignments & Scheduling",
    icon: FaClipboardCheck,
    key: "academic_assignments",
    roles: ["admin"],
    children: [
      { to: "/assign-subject-per-year-level", icon: FaLayerGroup, label: "Assign Subjects" },
      { to: "/teacher-assignments", icon: FaChalkboardTeacher, label: "Assign Teacher" },
      { to: "/class-schedules", icon: FaListAlt, label: "Class Schedules" },
      { to: "/enrollments", icon: FaListAlt, label: "Student Enrollment" },
    ],
  },

  // --- School: Setup
  {
    type: "dropdown",
    label: "School Setup",
    icon: FaCalendarAlt,
    key: "academic_setup",
    roles: ["admin"],
    children: [
      { to: "/school_year", icon: FaCalendarAlt, label: "Academic Year" },
      { to: "/grade_level", icon: FaListOl, label: "Grade Levels" },
      { to: "/sections", icon: FaSitemap, label: "Section Creation" },
      { to: "/school_settings", icon: FaBuilding, label: "School Information", permission: "manage_school_settings" },
    ],
  },

  // --- System Settings
  {
    type: "dropdown",
    label: "System Settings",
    icon: FaCog,
    key: "sysadmin",
    roles: ["admin"],
    children: [
      { to: "/users_account", icon: FaUsersCog, label: "User Management" },
      { to: "/all_logs", icon: FaHistory, label: "Activity Logs", permission: "view_logs" },
      { to: "/backup", icon: FaDatabase, label: "Backup & Restore", permission: "export_data" },
    ],
  },
];


  // ---- Effects ----
  useEffect(() => {
    checkToken();
    setPermissions(getUserPermissions() || {});

    const loginRaw = sessionStorage.getItem("loginResponse");
    if (loginRaw) {
      try {
        const loginData = JSON.parse(loginRaw);
        if (loginData?.user) setUser(loginData.user);
      } catch (e) {
        console.error("Invalid loginResponse:", e);
      }
    }

    api
      .get(`/school-defaults/${schoolId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        const { user, school_id, created_at, updated_at, ...filtered } = data || {};
        setSchoolData(filtered);
        setLogoUrl(
          data?.school_logo
            ? data.school_logo.startsWith("http")
              ? data.school_logo
              : `${LOGO_URL}${data.school_logo}`
            : null
        );
      })
      .catch((err) => console.error("Failed to fetch school defaults", err));
  }, []);

  const fullName = user ? [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(" ") : "Loading...";
  const avatarInitial = user?.first_name?.[0]?.toUpperCase() || "?";
  const role = Array.isArray(user?.role) ? user.role[0] : user?.role || "User";

  const renderMenu = (menu) => {
    if (menu.roles && !menu.roles.includes(userRole)) return null;
    if (menu.permission && !permissions[menu.permission]) return null;

    if (menu.type === "link") {
      return <li key={menu.to}><SidebarLink {...menu} collapsed={collapsed} /></li>;
    }

    if (menu.type === "dropdown") {
      const isOpen = openMenus[menu.key];
      return (
        <SidebarDropdown
          key={menu.key}
          {...menu}
          collapsed={collapsed}
          open={isOpen}
          setOpen={() => setOpenMenus(prev => ({ ...prev, [menu.key]: !isOpen }))}
        >
          {menu.children.map(child => 
            !child.permission || permissions[child.permission] ? (
              <li key={child.to}><SidebarLink {...child} collapsed={collapsed} /></li>
            ) : null
          )}
        </SidebarDropdown>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className={`sidebar glass ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header p-3 border-bottom border-secondary text-center">
  {!collapsed && (
    <>
      <h2
        className="fw-bold text-white mb-1"
        style={{ letterSpacing: "2px", fontSize: "1.8rem" }}
      >
        E-SF10 SYSTEM
      </h2>
      <p
        className="text-white"
        style={{ maxWidth: "260px", fontSize: "0.45rem", margin: "10 auto" }}
      >
        Manage student forms easily and securely.
      </p>
    </>
  )}
</div>

        <ul className="nav-links" style={{ fontSize: "0.9rem" }}>
          {menus.map(renderMenu)}
        </ul>

        {/* Footer & Credits Modal */}
        {!collapsed && (
          <div className="school-info p-3 text-center text-light small bg-dark rounded-top" style={{ fontSize: "0.75rem", cursor: "pointer" }} onClick={handleOpen}>
            <hr className="bg-light my-2" />
            <p className="mb-1 text-light">&copy; {new Date().getFullYear()} All rights reserved.</p>
            <p className="mb-0 text-light fst-italic">Credits – TMC Coding Club</p>
          </div>
        )}
        <Modal show={showModal} onHide={handleClose} centered>
          <Modal.Header closeButton>
            <Modal.Title>Credits</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>This is an extension project created by the TMC Coding Club.</p>
            <p>We aim to provide learning opportunities and showcase coding skills through practical projects.</p>
            <hr />
            <p className="mb-1"><strong>Software Engineers:</strong></p>
            <ul>
              <li>John Paul Curib</li>
              <li>Quiver Cutanda</li>
            </ul>
            <p className="mb-1"><strong>Project Manager & Adviser:</strong></p>
            <ul>
              <li>Clark Kevin Villamor</li>
            </ul>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleClose}>Close</Button>
          </Modal.Footer>
        </Modal>
      </div>

      {/* Main */}
      <div className="main">
        {/* Topbar */}
        <div className="topbar d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <button className="toggle-btn" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar">
              <FaBars />
            </button>
            {logoUrl ? (
              <img src={logoUrl} alt="School Logo" className="rounded-circle border" style={{ width: 60, height: 60, objectFit: "cover" }} />
            ) : (
              <div className="rounded-circle bg-secondary text-white d-flex justify-content-center align-items-center" style={{ width: 60, height: 60 }}>N/A</div>
            )}
            <div className="mx-2">
              <h2 className="mb-0 fw-bold">{schoolData.school_name || "Loading..."}</h2>
              <small className="text-muted">{schoolData.school_address || "N/A"}</small>
            </div>
          </div>

          {/* Profile Dropdown */}
          <div className="dropdown">
            <button className="btn bg-white border rounded-pill d-flex align-items-center gap-2 px-3 py-1" data-bs-toggle="dropdown">
              <div className="rounded-circle bg-primary text-white d-flex justify-content-center align-items-center" style={{ width: 36, height: 36 }}>{avatarInitial}</div>
              <div className="d-none d-md-flex flex-column text-start ms-2">
                <span className="fw-medium">{fullName}</span>
                <small className="text-muted">{role}</small>
              </div>
              <FaChevronDown className="text-muted small d-none d-md-inline ms-2" />
            </button>
            <ul className="dropdown-menu dropdown-menu-end mt-2 shadow-sm">
              <li>
                <button className="dropdown-item d-flex align-items-center gap-2" onClick={onLogout}>
                  <FaSignOutAlt className="text-danger" />
                  <span className="text-danger fw-semibold">Logout</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Routes */}
        <div className="main-content">
          <Routes>
            {permissions.view_reports && <Route path="/dashboard" element={<Home />} />}
            {permissions.view_student_info && <Route path="/student_information" element={<StudentInformation />} />}
            {permissions.register_student && <Route path="/add_student" element={<AddStudent />} />}
            {permissions.upload_documents && <>
              <Route path="/upload_ecards/:lrn" element={<UploadEcard />} />
              <Route path="/upload_ecards_all" element={<UploadEcardAll />} />
            </>}
            {permissions.edit_student_info && <Route path="/edit_student/:lrn" element={<EditStudent />} />}
            {permissions.view_student_info && <Route path="/record_student/:lrn" element={<StudentRecord />} />}
            {permissions.request_transfers && <Route path="/request_transfer/:studentId" element={<RequestTransfer />} />}
            {permissions.approve_transfers && <Route path="/view_request" element={<ViewRequest />} />}

            {/* Academics */}
            <Route path="/curriculum" element={<Curriculum />} />
            <Route path="/curriculum/create" element={<CurriculumUpsert />} />
            <Route path="/curriculum/edit/:id" element={<CurriculumUpsert />} /> 
            <Route path="/teacher" element={<TeacherList />} />
            <Route path="/enrollments" element={<EnrollmentList />} />
            <Route path="/enrollments/create" element={<EnrollmentUpsert />} />
            <Route path="/enrollments/edit/:id" element={<EnrollmentUpsert />} />
            <Route path="/teacher/create" element={<TeacherUpsert />} />
            <Route path="/teacher/edit/:id" element={<TeacherUpsert />} /> 
            <Route path="/teacher-assignments" element={<TeacherAssign />} />
            <Route path="/teacher-assignments/create" element={<TeacherAssignUpsert />} />
            <Route path="/teacher-assignments/update/:id" element={<TeacherAssignUpsert />} />
            <Route path="/curriculum/assign-subject/:id" element={<CurriculumAssign />} />
            <Route path="/class-schedules" element={<ClassSchedulesList />} />
            <Route path="/class-schedules/create" element={<ClassScheduleUpsert />} />
            <Route path="/class-schedules/edit/:id" element={<ClassScheduleUpsert />} />
            <Route path="/subjects" element={<SubjectList />} />
            <Route path="/subjects/create" element={<SubjectUpsert />} />
            <Route path="/subjects/edit/:id" element={<SubjectUpsert />} />
            <Route path="/assign-subject-per-year-level" element={<AssignSubjectPerYearLevel />} />
            <Route path="/assign-subject-per-year-level/assign" element={<AssignSubjectPerYearLevelForm />} />
            <Route path="/grade_level" element={<GradeLevelList />} />
            <Route path="/grade_level/create" element={<GradeLevelUpsert />} />
            <Route path="/grade_level/edit/:id" element={<GradeLevelUpsert />} />
            <Route path="/sections" element={<SectionList />} />
            <Route path="/sections/create" element={<SectionUpsert />} />
            <Route path="/sections/edit/:id" element={<SectionUpsert />} />
            <Route path="/school_year" element={<DisplaySchoolYear />} />
            <Route path="/school_year/create" element={<UpsertSchoolYear />} />
            <Route path="/school_year/edit/:id" element={<UpsertSchoolYear />} />

            {/* Admin */}
            {permissions.manage_users && <>
              <Route path="/users_account" element={<User />} />
              <Route path="/add_user" element={<AddUser />} />
              <Route path="/edit-user/:userId" element={<AddUser />} />
              <Route path="/edit_permission/:userId" element={<EditPermission />} />
              <Route path="/create_roles" element={<CreateRoles />} />
            </>}
            {permissions.manage_school_settings && <Route path="/school_settings" element={<SchoolSettings />} />}
            {permissions.export_data && <Route path="/backup" element={<Backup />} />}
            {permissions.view_logs && <Route path="/all_logs" element={<AllLogs />} />}

            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>

{/* Footer */}
<div
  className="text-center text-white bg-dark position-sticky bottom-0 rounded-0"
  style={{ zIndex: 10, fontSize: "0.75rem" }}
>
  &copy; {new Date().getFullYear()} All rights reserved. Credits – TMC Coding Club
</div>


      </div>
    </div>
  );
};

export default Sidebar;
