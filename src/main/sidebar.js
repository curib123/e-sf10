// Styles
import './sidebar.css';

import React, {
  memo,
  useEffect,
  useMemo,
  useState,
} from 'react';

import axios from 'axios';
import {
  Button,
  Modal,
} from 'react-bootstrap';
import {
  FaAddressBook,
  FaBars,
  FaBook,
  FaBookOpen,
  FaBuilding,
  FaCalendarAlt,
  FaChalkboardTeacher,
  FaChevronDown,
  FaClipboardCheck,
  FaCog,
  FaDatabase,
  FaExchangeAlt,
  FaHistory,
  FaHome,
  FaLayerGroup,
  FaListAlt,
  FaListOl,
  FaSchool,
  FaSignOutAlt,
  FaSitemap,
  FaTasks,
  FaUpload,
  FaUserGraduate,
  FaUserPlus,
  FaUsersCog,
} from 'react-icons/fa';
import {
  NavLink,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import { getUserPermissions } from '../components/get_permission';
import { checkToken } from '../components/token_checker';
// Screens ---------------------------------------------------------------
import AllLogs from '../screens/all_logs';
import AssignSubjectPerYearLevelForm
  from '../screens/assign_subject_per_level_form';
import AssignSubjectPerYearLevel
  from '../screens/assign_subject_per_level_list';
import Backup from '../screens/backup';
import ClassSchedulesList from '../screens/class_schedule_list';
import ClassScheduleUpsert from '../screens/class_schedule_upsert';
import Curriculum from '../screens/curriculum_list';
import CurriculumSubjects from '../screens/curriculum_subjects';
import CurriculumUpsert from '../screens/curriculum_upsert';
import GradeInputsList from '../screens/grade_inputs_list';
import GradeInputUpsert from '../screens/grade_inputs_upsert';
import GradeLevelList from '../screens/grade_level_list';
import GradeLevelUpsert from '../screens/grade_level_upsert';
import Home from '../screens/home_dashboard';
import NotFound from '../screens/not_found';
import EditPermission from '../screens/permission_assign_to_user';
import ViewRequest from '../screens/request_list';
import RequestTransfer from '../screens/request_transfer';
import CreateRoles from '../screens/roles_upsert';
import SchoolSettings from '../screens/school_settings';
import DisplaySchoolYear from '../screens/school_year_list';
import UpsertSchoolYear from '../screens/school_year_upsert';
import SectionList from '../screens/section_list';
import SectionUpsert from '../screens/section_upsert';
import EditStudent from '../screens/student_edit';
import EnrollmentList from '../screens/student_enrollment_list';
import EnrollmentUpsert from '../screens/student_enrollment_upsert';
import AddStudent from '../screens/student_form';
import StudentInformation from '../screens/student_information';
import StudentRecord from '../screens/student_records';
import SubjectList from '../screens/subject_list';
import SubjectUpsert from '../screens/subject_upsert';
import TeacherAssign from '../screens/teacher_assign';
import TeacherAssignUpsert from '../screens/teacher_assign_upsert';
import HomeTeacher from '../screens/teacher_dashboard';
import TeacherList from '../screens/teacher_list';
import TeacherUpsert from '../screens/teacher_upsert';
import UploadEcard from '../screens/upload_ecards';
import UploadEcardAll from '../screens/upload_ecards_all';
import User from '../screens/user_list';
import AddUser from '../screens/user_upsert';

// API Config
const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const LOGO_URL = process.env.REACT_APP_API_LOGO_URL;
const api = axios.create({ baseURL: BASE_URL, headers: { 'Content-Type': 'application/json' } });

// PERMISSIONS
const PERMS = Object.freeze({
  REGISTER_STUDENT: 'register_student',
  SEARCH_STUDENT: 'search_student',
  VIEW_STUDENT_INFO: 'view_student_info',
  EDIT_STUDENT_INFO: 'edit_student_info',
  DELETE_STUDENT: 'delete_student',
  VIEW_ECARDS: 'view_ecards',

  UPLOAD_DOCUMENTS: 'upload_documents',
  DOWNLOAD_DOCUMENTS: 'download_documents',
  DELETE_DOCUMENTS: 'delete_documents',

  LOCK_RECORDS: 'lock_records',
  UNLOCK_RECORDS: 'unlock_records',

  APPROVE_TRANSFERS: 'approve_transfers',
  REQUEST_TRANSFERS: 'request_transfers',

  MANAGE_USERS: 'manage_users',
  MANAGE_ROLES: 'manage_roles',
  MANAGE_PERMISSIONS: 'manage_permissions',
  MANAGE_BACKUPS: 'manage_backups',
  MANAGE_SCHOOL_SETTINGS: 'manage_school_settings',
  VIEW_LOGS: 'view_logs',
  EXPORT_DATA: 'export_data',
  IMPORT_DATA: 'import_data',
  VIEW_REPORTS: 'view_reports',

  VIEW_TEACHERS: 'view_teachers',
  MANAGE_TEACHERS: 'manage_teachers',

  VIEW_TEACHER_ASSIGNMENTS: 'view_teacher_assignments',
  MANAGE_TEACHER_ASSIGNMENTS: 'manage_teacher_assignments',

  VIEW_SUBJECTS: 'view_subjects',
  MANAGE_SUBJECTS: 'manage_subjects',

  VIEW_SECTIONS: 'view_sections',
  MANAGE_SECTIONS: 'manage_sections',

  VIEW_SCHOOL_YEARS: 'view_school_years',
  MANAGE_SCHOOL_YEARS: 'manage_school_years',

  VIEW_GRADES: 'view_grades',
  MANAGE_GRADES: 'manage_grades',
  MANAGE_GRADE_INPUT: 'manage_grade_input',

  VIEW_GRADE_LEVELS: 'view_grade_levels',
  MANAGE_GRADE_LEVELS: 'manage_grade_levels',

  VIEW_ENROLLMENTS: 'view_enrollments',
  MANAGE_ENROLLMENTS: 'manage_enrollments',

  VIEW_CLASS_SCHEDULES: 'view_class_schedules',
  MANAGE_CLASS_SCHEDULES: 'manage_class_schedules',

  VIEW_CURRICULUM: 'view_curriculum',
  MANAGE_CURRICULUM: 'manage_curriculum',
});

const ALL_PERM_KEYS = Object.values(PERMS);

const ROLE_POLICIES = {
  admin: new Set(ALL_PERM_KEYS),
  registrar: new Set([
    PERMS.REGISTER_STUDENT, PERMS.SEARCH_STUDENT, PERMS.VIEW_STUDENT_INFO,
    PERMS.EDIT_STUDENT_INFO, PERMS.DELETE_STUDENT, PERMS.VIEW_ECARDS,
    PERMS.UPLOAD_DOCUMENTS, PERMS.DOWNLOAD_DOCUMENTS, PERMS.DELETE_DOCUMENTS,
    PERMS.LOCK_RECORDS, PERMS.UNLOCK_RECORDS,
    PERMS.APPROVE_TRANSFERS, PERMS.REQUEST_TRANSFERS,
    PERMS.VIEW_REPORTS, PERMS.EXPORT_DATA, PERMS.IMPORT_DATA,
    PERMS.VIEW_TEACHERS, PERMS.MANAGE_TEACHERS,
    PERMS.VIEW_TEACHER_ASSIGNMENTS, PERMS.MANAGE_TEACHER_ASSIGNMENTS,
    PERMS.VIEW_SUBJECTS, PERMS.MANAGE_SUBJECTS,
    PERMS.VIEW_SECTIONS, PERMS.MANAGE_SECTIONS,
    PERMS.VIEW_SCHOOL_YEARS, PERMS.MANAGE_SCHOOL_YEARS,
    PERMS.VIEW_GRADES, PERMS.MANAGE_GRADES, PERMS.MANAGE_GRADE_INPUT,
    PERMS.VIEW_GRADE_LEVELS, PERMS.MANAGE_GRADE_LEVELS,
    PERMS.VIEW_ENROLLMENTS, PERMS.MANAGE_ENROLLMENTS,
    PERMS.VIEW_CLASS_SCHEDULES, PERMS.MANAGE_CLASS_SCHEDULES,
    PERMS.VIEW_CURRICULUM, PERMS.MANAGE_CURRICULUM,
    PERMS.MANAGE_SCHOOL_SETTINGS,
  ]),
  teacher: new Set([
    PERMS.SEARCH_STUDENT, PERMS.VIEW_STUDENT_INFO, PERMS.VIEW_ECARDS,
    PERMS.UPLOAD_DOCUMENTS, PERMS.DOWNLOAD_DOCUMENTS,
    PERMS.VIEW_TEACHER_ASSIGNMENTS, PERMS.VIEW_CLASS_SCHEDULES,
    PERMS.VIEW_GRADES, PERMS.MANAGE_GRADE_INPUT,
    PERMS.VIEW_REPORTS,
  ]),
};

function buildPermFlags(keys) {
  const o = {};
  keys.forEach((k) => (o[k] = true));
  return o;
}
function grantAllPerms() { return buildPermFlags(ALL_PERM_KEYS); }
function mergeServerAndRolePerms(userRole, serverFlags) {
  if (userRole === 'admin') return grantAllPerms();
  const roleSet = ROLE_POLICIES[userRole] || new Set();
  const roleFlags = buildPermFlags([...roleSet]);
  const merged = { ...roleFlags };
  if (serverFlags && typeof serverFlags === 'object') {
    for (const k of ALL_PERM_KEYS) if (k in serverFlags) merged[k] = Boolean(serverFlags[k]);
  }
  return merged;
}

// UI Primitives
const SidebarLink = memo(function SidebarLink({ to, icon: Icon, label, collapsed }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `link ${isActive ? 'active' : ''}`}
      title={collapsed ? label : undefined}
    >
      <span className="link-icon"><Icon /></span>
      {!collapsed && <span className="ms-2 link-label">{label}</span>}
    </NavLink>
  );
});

const SidebarDropdown = memo(function SidebarDropdown({ label, icon: Icon, collapsed, open, onToggle, children }) {
  return (
    <li className="dropdown-link my-1">
      <button
        type="button"
        className="link dropdown-toggle-btn d-flex justify-content-between align-items-center w-100 bg-transparent border-0 p-0"
        onClick={onToggle}
        aria-expanded={open}
        title={collapsed ? label : undefined}
      >
        <div className="d-flex align-items-center">
          <span className="link-icon"><Icon /></span>
          {!collapsed && <span className="ms-2 link-label">{label}</span>}
        </div>
        {!collapsed && <FaChevronDown className={`dropdown-icon ${open ? 'rotate' : ''}`} />}
      </button>
      <ul className={`submenu ${open ? 'show' : ''}`} style={{ display: collapsed ? 'none' : undefined }}>{children}</ul>
    </li>
  );
});

// MENU
const MENU_CONFIG = [
  { type: 'link', roles: ['admin', 'registrar'], permission: PERMS.VIEW_REPORTS, to: '/dashboard', icon: FaHome, label: 'Dashboard' },
  { type: 'link', roles: ['teacher'], to: '/teacher-dashboard', icon: FaHome, label: 'Dashboard' },
  {
    type: 'dropdown', label: 'Student Records', icon: FaUserGraduate, key: 'student', roles: ['admin', 'registrar', 'teacher'],
    children: [
      { to: '/add_student', icon: FaUserPlus, label: 'Add New Student', permission: PERMS.REGISTER_STUDENT },
      { to: '/student_information', icon: FaAddressBook, label: 'Student Directory', permission: PERMS.VIEW_STUDENT_INFO },
      { to: '/enrollments', icon: FaListAlt, label: 'Student Enrollment', permission: PERMS.VIEW_ENROLLMENTS },
      { to: '/upload_ecards_all', icon: FaUpload, label: 'Upload SF10 Records', permission: PERMS.UPLOAD_DOCUMENTS },
      { to: '/input-grades', icon: FaBookOpen, label: 'Input Students Grades', permission: PERMS.MANAGE_GRADE_INPUT },
      { to: '/view_request', icon: FaExchangeAlt, label: 'Transfer Requests', permission: PERMS.APPROVE_TRANSFERS },
    ],
  },
  {
    type: 'dropdown', label: 'Academic Management', icon: FaBook, key: 'academic_management', roles: ['admin', 'registrar'],
    children: [
      { to: '/subjects', icon: FaBookOpen, label: 'Subject Management', permission: PERMS.VIEW_SUBJECTS },
      { to: '/curriculum', icon: FaTasks, label: 'Curriculum Management', permission: PERMS.VIEW_CURRICULUM },
      { to: '/teacher', icon: FaChalkboardTeacher, label: 'Teacher Management', permission: PERMS.VIEW_TEACHERS },
    ],
  },
  {
    type: 'dropdown', label: 'Assignments & Scheduling', icon: FaClipboardCheck, key: 'academic_assignments', roles: ['admin', 'registrar'],
    children: [
      { to: '/assign-subject-per-year-level', icon: FaLayerGroup, label: 'Assign Subjects Grade Level', permission: PERMS.MANAGE_SUBJECTS },
      { to: '/teacher-assignments', icon: FaChalkboardTeacher, label: 'Assign Teacher', permission: PERMS.VIEW_TEACHER_ASSIGNMENTS },
      { to: '/class-schedules', icon: FaSchool, label: 'Class Schedules', permission: PERMS.VIEW_CLASS_SCHEDULES },
    ],
  },
  {
    type: 'dropdown', label: 'School Setup', icon: FaCalendarAlt, key: 'academic_setup', roles: ['admin', 'registrar'],
    children: [
      { to: '/school_year', icon: FaCalendarAlt, label: 'Academic Year', permission: PERMS.VIEW_SCHOOL_YEARS },
      { to: '/grade_level', icon: FaListOl, label: 'Grade Levels', permission: PERMS.VIEW_GRADE_LEVELS },
      { to: '/sections', icon: FaSitemap, label: 'Section Creation', permission: PERMS.VIEW_SECTIONS },
      { to: '/school_settings', icon: FaBuilding, label: 'School Information', permission: PERMS.MANAGE_SCHOOL_SETTINGS },
    ],
  },
  {
    type: 'dropdown', label: 'System Settings', icon: FaCog, key: 'sysadmin', roles: ['admin'],
    children: [
      { to: '/users_account', icon: FaUsersCog, label: 'User Management', permission: PERMS.MANAGE_USERS },
      { to: '/all_logs', icon: FaHistory, label: 'Activity Logs', permission: PERMS.VIEW_LOGS },
      { to: '/backup', icon: FaDatabase, label: 'Backup & Restore', permission: PERMS.MANAGE_BACKUPS },
    ],
  },
];

// Routes
const ROUTE_COMPONENTS = {
  '/dashboard': { el: <Home />, perm: PERMS.VIEW_REPORTS },
  '/teacher-dashboard': { el: <HomeTeacher /> },

  '/add_student': { el: <AddStudent />, perm: PERMS.REGISTER_STUDENT },
  '/student_information': { el: <StudentInformation />, perm: PERMS.VIEW_STUDENT_INFO },
  '/upload_ecards_all': { el: <UploadEcardAll />, perm: PERMS.UPLOAD_DOCUMENTS },
  '/view_request': { el: <ViewRequest />, perm: PERMS.APPROVE_TRANSFERS },
  '/enrollments': { el: <EnrollmentList />, perm: PERMS.VIEW_ENROLLMENTS },
  '/input-grades': { el: <GradeInputsList />, perm: PERMS.MANAGE_GRADE_INPUT },

  '/subjects': { el: <SubjectList />, perm: PERMS.VIEW_SUBJECTS },
  '/curriculum': { el: <Curriculum />, perm: PERMS.VIEW_CURRICULUM },
  '/teacher': { el: <TeacherList />, perm: PERMS.VIEW_TEACHERS },

  '/assign-subject-per-year-level': { el: <AssignSubjectPerYearLevel />, perm: PERMS.MANAGE_SUBJECTS },
  '/teacher-assignments': { el: <TeacherAssign />, perm: PERMS.VIEW_TEACHER_ASSIGNMENTS },
  '/class-schedules': { el: <ClassSchedulesList />, perm: PERMS.VIEW_CLASS_SCHEDULES },

  '/school_year': { el: <DisplaySchoolYear />, perm: PERMS.VIEW_SCHOOL_YEARS },
  '/grade_level': { el: <GradeLevelList />, perm: PERMS.VIEW_GRADE_LEVELS },
  '/sections': { el: <SectionList />, perm: PERMS.VIEW_SECTIONS },
  '/school_settings': { el: <SchoolSettings />, perm: PERMS.MANAGE_SCHOOL_SETTINGS },

  '/users_account': { el: <User />, perm: PERMS.MANAGE_USERS },
  '/all_logs': { el: <AllLogs />, perm: PERMS.VIEW_LOGS },
  '/backup': { el: <Backup />, perm: PERMS.MANAGE_BACKUPS },
};

const EXTRA_ROUTES = {
  '/student_information': [
    { path: '/record_student/:lrn', el: <StudentRecord />, perm: PERMS.VIEW_STUDENT_INFO },
    { path: '/edit_student/:lrn', el: <EditStudent />, perm: PERMS.EDIT_STUDENT_INFO },
    { path: '/request_transfer/:studentId', el: <RequestTransfer />, perm: PERMS.REQUEST_TRANSFERS },
    { path: '/upload_ecards/:lrn', el: <UploadEcard />, perm: PERMS.UPLOAD_DOCUMENTS },
  ],
  '/subjects': [
    { path: '/subjects/create', el: <SubjectUpsert />, perm: PERMS.MANAGE_SUBJECTS },
    { path: '/subjects/edit/:id', el: <SubjectUpsert />, perm: PERMS.MANAGE_SUBJECTS },
  ],
  '/curriculum': [
    { path: '/curriculum/create', el: <CurriculumUpsert />, perm: PERMS.MANAGE_CURRICULUM },
    { path: '/curriculum/edit/:id', el: <CurriculumUpsert />, perm: PERMS.MANAGE_CURRICULUM },
    { path: '/curriculum_subject/:id', el: <CurriculumSubjects />, perm: PERMS.MANAGE_CURRICULUM },
  ],
  '/teacher': [
    { path: '/teacher/create', el: <TeacherUpsert />, perm: PERMS.MANAGE_TEACHERS },
    { path: '/teacher/edit/:id', el: <TeacherUpsert />, perm: PERMS.MANAGE_TEACHERS },
  ],
  '/teacher-assignments': [
    { path: '/teacher-assignments/create', el: <TeacherAssignUpsert />, perm: PERMS.MANAGE_TEACHER_ASSIGNMENTS },
    { path: '/teacher-assignments/update/:id', el: <TeacherAssignUpsert />, perm: PERMS.MANAGE_TEACHER_ASSIGNMENTS },
  ],
  '/class-schedules': [
    { path: '/class-schedules/create', el: <ClassScheduleUpsert />, perm: PERMS.MANAGE_CLASS_SCHEDULES },
    { path: '/class-schedules/edit/:id', el: <ClassScheduleUpsert />, perm: PERMS.MANAGE_CLASS_SCHEDULES },
  ],
  '/enrollments': [
    { path: '/enrollments/create', el: <EnrollmentUpsert />, perm: PERMS.MANAGE_ENROLLMENTS },
    { path: '/enrollments/edit/:id', el: <EnrollmentUpsert />, perm: PERMS.MANAGE_ENROLLMENTS },
  ],
  '/grade-inputs': [
    { path: '/grade-inputs/upsert', el: <GradeInputUpsert />, perm: PERMS.MANAGE_GRADE_INPUT },
  ],
  '/assign-subject-per-year-level': [
    { path: '/assign-subject-per-year-level/assign', el: <AssignSubjectPerYearLevelForm />, perm: PERMS.MANAGE_SUBJECTS },
  ],
  '/grade_level': [
    { path: '/grade_level/create', el: <GradeLevelUpsert />, perm: PERMS.MANAGE_GRADE_LEVELS },
    { path: '/grade_level/edit/:id', el: <GradeLevelUpsert />, perm: PERMS.MANAGE_GRADE_LEVELS },
  ],
  '/sections': [
    { path: '/sections/create', el: <SectionUpsert />, perm: PERMS.MANAGE_SECTIONS },
    { path: '/sections/edit/:id', el: <SectionUpsert />, perm: PERMS.MANAGE_SECTIONS },
  ],
  '/school_year': [
    { path: '/school_year/create', el: <UpsertSchoolYear />, perm: PERMS.MANAGE_SCHOOL_YEARS },
    { path: '/school_year/edit/:id', el: <UpsertSchoolYear />, perm: PERMS.MANAGE_SCHOOL_YEARS },
  ],
  '/users_account': [
    { path: '/add_user', el: <AddUser />, perm: PERMS.MANAGE_USERS },
    { path: '/edit-user/:userId', el: <AddUser />, perm: PERMS.MANAGE_USERS },
    { path: '/edit_permission/:userId', el: <EditPermission />, perm: PERMS.MANAGE_PERMISSIONS },
    { path: '/create_roles', el: <CreateRoles />, perm: PERMS.MANAGE_ROLES },
  ],
};

function buildRoutesFromMenu(menu, perms) {
  const hasPerm = (p) => (p ? Boolean(perms[p]) : true);
  const ordered = [];
  const visit = (item) => {
    if (item.type === 'link') {
      if (!hasPerm(item.permission)) return;
      const base = ROUTE_COMPONENTS[item.to];
      if (base && hasPerm(base.perm)) ordered.push({ path: item.to, el: base.el });
      (EXTRA_ROUTES[item.to] || []).forEach((r) => hasPerm(r.perm) && ordered.push({ path: r.path, el: r.el }));
    } else if (item.type === 'dropdown') {
      (item.children || []).forEach((c) => visit({ ...c, type: 'link' }));
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

  const schoolId = '1234567890';
  const token = sessionStorage.getItem('token');
  const userRole = (sessionStorage.getItem('user_role') || 'teacher').toLowerCase();

  const fullName = useMemo(
    () => (!user ? 'Loading...' : [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ')),
    [user]
  );
  const avatarInitial = useMemo(() => (user?.first_name?.[0] || '?').toUpperCase(), [user?.first_name]);
  const roleLabel = useMemo(() => (Array.isArray(user?.role) ? user.role[0] : user?.role) || userRole || 'User', [user?.role, userRole]);

  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === '/login' || pathname.startsWith('/login')) {
      setUser(null); setPermissions({});
      return;
    }

    checkToken();

    const serverFlags = getUserPermissions?.() || {};
    const merged = mergeServerAndRolePerms(userRole, serverFlags);
    setPermissions(merged);

    const loginRaw = sessionStorage.getItem('loginResponse');
    if (loginRaw) {
      try {
        const loginData = JSON.parse(loginRaw);
        if (loginData?.user) setUser(loginData.user);
      } catch {}
    }

    api
      .get(`/school-defaults/${schoolId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        const { user, school_id, created_at, updated_at, ...filtered } = data || {};
        setSchoolData(filtered);
        setLogoUrl(
          data?.school_logo
            ? data.school_logo.startsWith('http')
              ? data.school_logo
              : `${LOGO_URL}${data.school_logo}`
            : null
        );
      })
      .catch(() => {});
  }, [pathname, schoolId, token, userRole]);

  const can = React.useCallback((perm) => !perm || Boolean(permissions[perm]), [permissions]);
  const hasRole = React.useCallback((roles) => (roles ? roles.includes(userRole) : true), [userRole]);

  const filteredMenus = useMemo(() => {
    const hasPerm = (perm) => (perm ? Boolean(permissions[perm]) : true);
    const hasR = (roles) => (roles ? roles.includes(userRole) : true);
    return MENU_CONFIG.map((m) => {
      if (!hasR(m.roles) || !hasPerm(m.permission)) return null;
      if (m.type === 'dropdown') {
        const children = (m.children || []).filter((c) => hasPerm(c.permission));
        return children.length ? { ...m, children } : null;
      }
      return m;
    }).filter(Boolean);
  }, [permissions, userRole]);

  const orderedRoutes = useMemo(() => {
    const inMenuRoutes = buildRoutesFromMenu(filteredMenus, permissions);
    const seen = new Set(inMenuRoutes.map((r) => r.path));

    Object.entries(ROUTE_COMPONENTS).forEach(([path, cfg]) => {
      if (!seen.has(path) && (!cfg.perm || permissions[cfg.perm])) {
        seen.add(path);
        inMenuRoutes.push({ path, el: cfg.el });
      }
    });

    Object.entries(EXTRA_ROUTES).forEach(([base, extras]) => {
      if (!seen.has(base)) {
        extras.forEach((r) => (!r.perm || permissions[r.perm]) && inMenuRoutes.push({ path: r.path, el: r.el }));
      }
    });

    inMenuRoutes.push({ path: '*', el: <NotFound /> });
    return inMenuRoutes;
  }, [filteredMenus, permissions]);

  const toggleMenu = (key) => setOpenMenus((p) => ({ ...p, [key]: !p[key] }));

  const renderMenu = (menu) => {
    if (menu.type === 'link') {
      if (!hasRole(menu.roles) || !can(menu.permission)) return null;
      return (
        <li key={menu.to}>
          <SidebarLink to={menu.to} icon={menu.icon} label={menu.label} collapsed={collapsed} />
        </li>
      );
    }
    if (!hasRole(menu.roles)) return null;
    const visibleChildren = (menu.children || []).filter((c) => can(c.permission));
    if (visibleChildren.length === 0) return null;
    const isOpen = !!openMenus[menu.key];
    return (
      <SidebarDropdown
        key={menu.key}
        label={menu.label}
        icon={menu.icon}
        collapsed={collapsed}
        open={isOpen}
        onToggle={() => toggleMenu(menu.key)}
      >
        {visibleChildren.map((c) => (
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
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand">
          <button
            className="brand-toggle"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            <FaBars />
          </button>

          {!collapsed && (
            <div className="brand-meta">
              <div className="brand-titles">
                <h1 className="brand-title">E-SF10 SYSTEM</h1>
                <p className="brand-sub">Manage student forms easily & securely</p>
              </div>
            </div>
          )}
        </div>

        <ul className="nav-links">{filteredMenus.map(renderMenu)}</ul>

        {!collapsed && (
          <div
            className="school-info"
            onClick={() => setShowModal(true)}
          >
            <div className="school-credits">
              <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
              <span className="muted">TMC Coding Club</span>
            </div>
          </div>
        )}

        <Modal show={showModal} onHide={() => setShowModal(false)} centered>
          <Modal.Header closeButton><Modal.Title>Credits</Modal.Title></Modal.Header>
          <Modal.Body>
            <p>This is an extension project created by the TMC Coding Club.</p>
            <hr />
            <p className="mb-1"><strong>Software Engineers:</strong></p>
            <ul className="mb-2">
              <li>John Paul Curib</li>
              <li>Quivir Cutanda</li>
            </ul>
            <p className="mb-1"><strong>Project Manager & Adviser:</strong></p>
            <ul className="mb-0"><li>Clark Kevin Villamor</li></ul>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
          </Modal.Footer>
        </Modal>
      </aside>

      {/* Main */}
      <main className="main">
        {/* Topbar */}
      <header className="topbar">
  <div className="topbar-left">
    {logoUrl ? (
      <img src={logoUrl} alt="School Logo" className="topbar-logo" />
    ) : (
      <div className="topbar-logo placeholder">N/A</div>
    )}
    <div className="topbar-meta">
      <h2 className="topbar-title">{schoolData.school_name || 'Loading…'}</h2>
      <small className="topbar-sub">{schoolData.school_address || '—'}</small>
    </div>
  </div>

  {/* RIGHT: profile only (search removed) */}
  <div className="topbar-right">
    <div className="profile dropdown">
      <button className="profile-btn" data-bs-toggle="dropdown">
        <div className="avatar">{avatarInitial}</div>
        <div className="profile-meta">
          <span className="name">{fullName}</span>
          <small className="role">{roleLabel}</small>
        </div>
        <FaChevronDown className="chev" />
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
</header>


        {/* Routes */}
        <div className="main-content">
          <Routes>
            {orderedRoutes.map((r) => (
              <Route key={r.path} path={r.path} element={r.el} />
            ))}
          </Routes>
        </div>

        <footer className="footer-flat">
          &copy; {new Date().getFullYear()} All rights reserved. Credits – TMC Coding Club
        </footer>
      </main>
    </div>
  );
};

export default Sidebar;
