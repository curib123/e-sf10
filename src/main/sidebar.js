import React, { useEffect, useMemo, useState, memo } from "react";
import axios from "axios";
import { Route, Routes, NavLink } from "react-router-dom";
import { Modal, Button } from "react-bootstrap";
import { FaHome, FaUserGraduate, FaUsersCog, FaChevronDown, FaSchool, FaBuilding, FaBars, FaPlus, FaSignOutAlt, FaDatabase, FaListAlt, FaUpload, FaExchangeAlt, FaHistory, FaBook, FaClipboardCheck, FaCog, FaCalendarAlt, FaUserPlus, FaAddressBook, FaBookOpen, FaTasks, FaChalkboardTeacher, FaLayerGroup, FaListOl, FaSitemap } from "react-icons/fa";
// Screens
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
import ClassSchedulesList from "../screens/class_schedule_list";
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
import { useLocation } from "react-router-dom";

// Styles
import "./sidebar.css";

// ---- API Config ----
const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const LOGO_URL = process.env.REACT_APP_API_LOGO_URL;
const api = axios.create({ baseURL: BASE_URL, headers: { "Content-Type": "application/json" } });

// ---- UI Primitives ----
const SidebarLink = memo(function SidebarLink({ to, icon: Icon, label, collapsed }) {
  return (
    <NavLink to={to} className={({ isActive }) => `link ${isActive ? "active" : ""}`}>
      <Icon /> {!collapsed && <span className="ms-2">{label}</span>}
    </NavLink>
  );
});

const SidebarDropdown = memo(function SidebarDropdown({ label, icon: Icon, collapsed, open, onToggle, children }) {
  return (
    <li className="dropdown-link my-2">
      <button type="button" className="link d-flex justify-content-between align-items-center w-100 bg-transparent border-0 p-0" onClick={onToggle} aria-expanded={open}>
        <div className="d-flex align-items-center">
          <Icon /> {!collapsed && <span className="ms-2">{label}</span>}
        </div>
        {!collapsed && <FaChevronDown className={`dropdown-icon ${open ? "rotate" : ""}`} />}
      </button>
      <ul className={`submenu ${open ? "show" : ""}`} style={{ display: collapsed ? "none" : undefined }}>{children}</ul>
    </li>
  );
});

// ---- MENU (source of truth for order) ----
const MENU_CONFIG = [
  { type: "link", roles: ["admin", "registrar"], permission: "view_reports", to: "/dashboard", icon: FaHome, label: "Dashboard" },
  {
    type: "dropdown", label: "Student Records", icon: FaUserGraduate, key: "student",
    children: [
      { to: "/add_student", icon: FaUserPlus, label: "Add New Student", permission: "register_student" },
      { to: "/student_information", icon: FaAddressBook, label: "Student Directory", permission: "view_student_info" },
      { to: "/upload_ecards_all", icon: FaUpload, label: "Upload SF10 Records", permission: "upload_documents" },
      { to: "/view_request", icon: FaExchangeAlt, label: "Transfer Requests", permission: "approve_transfers" },
    ],
  },
  {
    type: "dropdown", label: "Academic Management", icon: FaBook, key: "academic_management", roles: ["admin", "registrar"],
    children: [
      { to: "/subjects", icon: FaBookOpen, label: "Subject Management" },
      { to: "/curriculum", icon: FaTasks, label: "Curriculum Management" },
      { to: "/teacher", icon: FaChalkboardTeacher, label: "Teacher Management" },
    ],
  },
  {
    type: "dropdown", label: "Assignments & Scheduling", icon: FaClipboardCheck, key: "academic_assignments", roles: ["admin", "registrar"],
    children: [
      { to: "/assign-subject-per-year-level", icon: FaLayerGroup, label: "Assign Subjects" },
      { to: "/teacher-assignments", icon: FaChalkboardTeacher, label: "Assign Teacher" },
      { to: "/class-schedules", icon: FaSchool, label: "Class Schedules" },
      { to: "/enrollments", icon: FaListAlt, label: "Student Enrollment" },
    ],
  },
  {
    type: "dropdown", label: "School Setup", icon: FaCalendarAlt, key: "academic_setup", roles: ["admin", "registrar"],
    children: [
      { to: "/school_year", icon: FaCalendarAlt, label: "Academic Year" },
      { to: "/grade_level", icon: FaListOl, label: "Grade Levels" },
      { to: "/sections", icon: FaSitemap, label: "Section Creation" },
      { to: "/school_settings", icon: FaBuilding, label: "School Information", permission: "manage_school_settings" },
    ],
  },
  {
    type: "dropdown", label: "System Settings", icon: FaCog, key: "sysadmin", roles: ["admin"],
    children: [
      { to: "/users_account", icon: FaUsersCog, label: "User Management" },
      { to: "/all_logs", icon: FaHistory, label: "Activity Logs", permission: "view_logs" },
      { to: "/backup", icon: FaDatabase, label: "Backup & Restore", permission: "export_data" },
    ],
  },
];

// ---- Components + permissions by base path (for exact mapping) ----
const ROUTE_COMPONENTS = {
  "/dashboard": { el: <Home />, perm: "view_reports" },

  "/add_student": { el: <AddStudent />, perm: "register_student" },
  "/student_information": { el: <StudentInformation />, perm: "view_student_info" },
  "/upload_ecards_all": { el: <UploadEcardAll />, perm: "upload_documents" },
  "/view_request": { el: <ViewRequest />, perm: "approve_transfers" },

  "/subjects": { el: <SubjectList /> },
  "/curriculum": { el: <Curriculum /> },
  "/teacher": { el: <TeacherList /> },

  "/assign-subject-per-year-level": { el: <AssignSubjectPerYearLevel /> },
  "/teacher-assignments": { el: <TeacherAssign /> },
  "/class-schedules": { el: <ClassSchedulesList /> },
  "/enrollments": { el: <EnrollmentList /> },

  "/school_year": { el: <DisplaySchoolYear /> },
  "/grade_level": { el: <GradeLevelList /> },
  "/sections": { el: <SectionList /> },
  "/school_settings": { el: <SchoolSettings />, perm: "manage_school_settings" },

  "/users_account": { el: <User />, perm: "manage_users" },
  "/all_logs": { el: <AllLogs />, perm: "view_logs" },
  "/backup": { el: <Backup />, perm: "export_data" },
};

// ---- Extra routes clustered after their base path (edit/create pages, details) ----
const EXTRA_ROUTES = {
  "/student_information": [
    { path: "/record_student/:lrn", el: <StudentRecord />, perm: "view_student_info" },
    { path: "/edit_student/:lrn", el: <EditStudent />, perm: "edit_student_info" },
    { path: "/request_transfer/:studentId", el: <RequestTransfer />, perm: "request_transfers" },
    { path: "/upload_ecards/:lrn", el: <UploadEcard />, perm: "upload_documents" },
  ],
  "/subjects": [
    { path: "/subjects/create", el: <SubjectUpsert /> },
    { path: "/subjects/edit/:id", el: <SubjectUpsert /> },
  ],
  "/curriculum": [
    { path: "/curriculum/create", el: <CurriculumUpsert /> },
    { path: "/curriculum/edit/:id", el: <CurriculumUpsert /> },
    { path: "/curriculum/assign-subject/:id", el: <CurriculumAssign /> },
  ],
  "/teacher": [
    { path: "/teacher/create", el: <TeacherUpsert /> },
    { path: "/teacher/edit/:id", el: <TeacherUpsert /> },
  ],
  "/teacher-assignments": [
    { path: "/teacher-assignments/create", el: <TeacherAssignUpsert /> },
    { path: "/teacher-assignments/update/:id", el: <TeacherAssignUpsert /> },
  ],
  "/class-schedules": [
    { path: "/class-schedules/create", el: <ClassScheduleUpsert /> },
    { path: "/class-schedules/edit/:id", el: <ClassScheduleUpsert /> },
  ],
  "/enrollments": [
    { path: "/enrollments/create", el: <EnrollmentUpsert /> },
    { path: "/enrollments/edit/:id", el: <EnrollmentUpsert /> },
  ],
  "/assign-subject-per-year-level": [
    { path: "/assign-subject-per-year-level/assign", el: <AssignSubjectPerYearLevelForm /> },
  ],
  "/grade_level": [
    { path: "/grade_level/create", el: <GradeLevelUpsert /> },
    { path: "/grade_level/edit/:id", el: <GradeLevelUpsert /> },
  ],
  "/sections": [
    { path: "/sections/create", el: <SectionUpsert /> },
    { path: "/sections/edit/:id", el: <SectionUpsert /> },
  ],
  "/school_year": [
    { path: "/school_year/create", el: <UpsertSchoolYear /> },
    { path: "/school_year/edit/:id", el: <UpsertSchoolYear /> },
  ],
  "/users_account": [
    { path: "/add_user", el: <AddUser />, perm: "manage_users" },
    { path: "/edit-user/:userId", el: <AddUser />, perm: "manage_users" },
    { path: "/edit_permission/:userId", el: <EditPermission />, perm: "manage_users" },
    { path: "/create_roles", el: <CreateRoles />, perm: "manage_users" },
  ],
};

// ---- Build ordered routes from menu ----
function buildRoutesFromMenu(menu, perms) {
  const hasPerm = (p) => (p ? Boolean(perms[p]) : true);
  const ordered = [];

  const visit = (item) => {
    if (item.type === "link") {
      if (!hasPerm(item.permission)) return;
      const base = ROUTE_COMPONENTS[item.to];
      if (base && hasPerm(base.perm)) ordered.push({ path: item.to, el: base.el });
      (EXTRA_ROUTES[item.to] || []).forEach((r) => hasPerm(r.perm) && ordered.push({ path: r.path, el: r.el }));
    } else if (item.type === "dropdown") {
      (item.children || []).forEach((c) => visit({ ...c, type: "link" }));
    }
  };

  menu.forEach(visit);
  return ordered;
}

const Sidebar = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState({});
  const [showModal, setShowModal] = useState(false);

  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});

  const [schoolData, setSchoolData] = useState({});
  const [logoUrl, setLogoUrl] = useState(null);

  const schoolId = "1234567890";
  const token = sessionStorage.getItem("token");
  const userRole = sessionStorage.getItem("user_role");

  const fullName = useMemo(() => (!user ? "Loading..." : [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(" ")), [user]);
  const avatarInitial = useMemo(() => (user?.first_name?.[0] || "?").toUpperCase(), [user?.first_name]);
  const roleLabel = useMemo(() => (Array.isArray(user?.role) ? user.role[0] : user?.role) || "User", [user?.role]);

  const { pathname } = useLocation();

  useEffect(() => {
    
  // Skip if we are on the login page
  if (pathname === "/login" || pathname.startsWith("/login")) {
    setUser(null);
    setPermissions({});
    return;
  }

  checkToken();
  setPermissions(getUserPermissions() || {});

  const loginRaw = sessionStorage.getItem("loginResponse");
  if (loginRaw) {
    try {
      const loginData = JSON.parse(loginRaw);
      if (loginData?.user) setUser(loginData.user);
    } catch {
      // ignore parse error
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
    .catch(() => {});
}, [pathname, schoolId, token]);

  const filteredMenus = useMemo(() => {
    const hasPerm = (perm) => (perm ? Boolean(permissions[perm]) : true);
    const hasRole = (roles) => (roles ? roles.includes(userRole) : true);

    return MENU_CONFIG.map((m) => {
      if (!hasRole(m.roles) || !hasPerm(m.permission)) return null;
      if (m.type === "dropdown") {
        const children = (m.children || []).filter((c) => hasPerm(c.permission));
        return children.length ? { ...m, children } : null;
      }
      return m;
    }).filter(Boolean);
  }, [permissions, userRole]);

  const orderedRoutes = useMemo(() => {
    const inMenuRoutes = buildRoutesFromMenu(filteredMenus, permissions);
    const seen = new Set(inMenuRoutes.map((r) => r.path));

    // Add any base routes not visible in menu (rare), then the NotFound at the end
    Object.entries(ROUTE_COMPONENTS).forEach(([path, cfg]) => {
      if (!seen.has(path) && (!cfg.perm || permissions[cfg.perm])) seen.add(path) && inMenuRoutes.push({ path, el: cfg.el });
    });

    // Attach any EXTRA_ROUTES whose bases weren’t in menu (safety)
    Object.entries(EXTRA_ROUTES).forEach(([base, extras]) => {
      if (!seen.has(base)) {
        extras.forEach((r) => (!r.perm || permissions[r.perm]) && inMenuRoutes.push({ path: r.path, el: r.el }));
      }
    });

    // Finally NotFound
    inMenuRoutes.push({ path: "*", el: <NotFound /> });
    return inMenuRoutes;
  }, [filteredMenus, permissions]);

  const toggleMenu = (key) => setOpenMenus((p) => ({ ...p, [key]: !p[key] }));

  const renderMenu = (menu) => {
    if (menu.type === "link") {
      return (
        <li key={menu.to}>
          <SidebarLink to={menu.to} icon={menu.icon} label={menu.label} collapsed={collapsed} />
        </li>
      );
    }
    const isOpen = !!openMenus[menu.key];
    return (
      <SidebarDropdown key={menu.key} label={menu.label} icon={menu.icon} collapsed={collapsed} open={isOpen} onToggle={() => toggleMenu(menu.key)}>
        {menu.children.map((c) => (
          <li key={c.to}>
            <SidebarLink to={c.to} icon={c.icon} label={c.label} collapsed={collapsed} />
          </li>
        ))}
      </SidebarDropdown>
    );
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className={`sidebar glass ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header p-3 border-bottom border-secondary text-center">
          {!collapsed && (
            <>
              <h2 className="fw-bold text-white mb-1" style={{ letterSpacing: "2px", fontSize: "1.8rem" }}>E-SF10 SYSTEM</h2>
              <p className="text-white" style={{ maxWidth: "260px", fontSize: "0.45rem", margin: "10 auto" }}>Manage student forms easily and securely.</p>
            </>
          )}
        </div>

        <ul className="nav-links" style={{ fontSize: "0.9rem" }}>{filteredMenus.map(renderMenu)}</ul>

        {!collapsed && (
          <div className="school-info p-3 text-center text-light small bg-dark rounded-top" style={{ fontSize: "0.75rem", cursor: "pointer" }} onClick={() => setShowModal(true)}>
            <hr className="bg-light my-2" />
            <p className="mb-1 text-light">&copy; {new Date().getFullYear()} All rights reserved.</p>
            <p className="mb-0 text-light fst-italic">Credits – TMC Coding Club</p>
          </div>
        )}

        <Modal show={showModal} onHide={() => setShowModal(false)} centered>
          <Modal.Header closeButton><Modal.Title>Credits</Modal.Title></Modal.Header>
          <Modal.Body>
            <p>This is an extension project created by the TMC Coding Club.</p>
            <p>We aim to provide learning opportunities and showcase coding skills through practical projects.</p>
            <hr />
            <p className="mb-1"><strong>Software Engineers:</strong></p>
            <ul><li>John Paul Curib</li><li>Quiver Cutanda</li></ul>
            <p className="mb-1"><strong>Project Manager & Adviser:</strong></p>
            <ul><li>Clark Kevin Villamor</li></ul>
          </Modal.Body>
          <Modal.Footer><Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button></Modal.Footer>
        </Modal>
      </aside>

      {/* Main */}
      <main className="main">
        {/* Topbar */}
        <div className="topbar d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <button className="toggle-btn" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar"><FaBars /></button>
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
            <button className="btn bg-white border rounded-pill d-flex align-items-center gap-2 px-3 py-2" data-bs-toggle="dropdown">
              <div className="rounded-circle bg-primary text-white d-flex justify-content-center align-items-center" style={{ width: 36, height: 36 }}>{avatarInitial}</div>
              <div className="d-none d-md-flex flex-column text-start ms-2">
                <span className="fw-medium">{fullName}</span>
                <small className="text-muted">{roleLabel}</small>
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

        {/* Routes in the same order as the sidebar */}
        <div className="main-content">
          <Routes>
            {orderedRoutes.map((r) => (
              <Route key={r.path} path={r.path} element={r.el} />
            ))}
          </Routes>
        </div>

        {/* Footer */}
        <div className="text-center text-white bg-dark position-sticky bottom-0 rounded-0" style={{ zIndex: 10, fontSize: "0.75rem" }}>
          &copy; {new Date().getFullYear()} All rights reserved. Credits – TMC Coding Club
        </div>
      </main>
    </div>
  );
};

export default Sidebar;
