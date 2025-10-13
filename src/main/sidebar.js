// SidebarMui.jsx — Glassmorph AppBar+Drawer, NavLink active styles,
// NO vertical bar for dropdown headers & dropdown child links,
// icon-only dropdown when collapsed, centered sidebar credits,
// slim footer (no credits), main content locked to light mode.
// Added: Desktop drag-to-resize sidebar (persisted), coexists with collapsed mini mode.
// Patched: Drawer/AppBar z-index lowered under Bootstrap modal (modal=1055, backdrop=1050)

import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import axios from 'axios';
import {
  NavLink,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

// UNIQUE ICONS (no repeats)
import {
  AccountCircle as AccountIcon,
  AppRegistration as AppRegistrationIcon,
  AssignmentInd as AssignmentIndIcon,
  AutoStories as AutoStoriesIcon,
  Backup as BackupIcon,
  Brightness4 as DarkIcon,
  Brightness7 as LightIcon,
  CalendarMonth as CalendarIcon,
  CloudUpload as CloudUploadIcon,
  CompareArrows as CompareArrowsIcon,
  Contacts as ContactsIcon,
  DashboardCustomize as DashboardCustomizeIcon,
  DateRange as DateRangeIcon,
  Domain as DomainIcon,
  EventNote as EventNoteIcon,
  ExpandLess,
  ExpandMore,
  FolderShared as FolderSharedIcon,
  Grading as GradingIcon,
  History as HistoryIcon,
  Home as HomeIcon,
  HomeWork as HomeWorkIcon,
  HowToReg as HowToRegIcon,
  InfoOutlined as InfoIcon,
  Layers as LayersIcon,
  Logout as LogoutIcon,
  ManageAccounts as ManageAccountsIcon,
  Menu as MenuIcon,
  MenuBook as MenuBookIcon,
  PersonAdd as PersonAddIcon,
  SettingsSuggest as SettingsSuggestIcon,
  Stairs as StairsIcon,
  SupervisorAccount as SupervisorAccountIcon,
  ViewWeek as ViewWeekIcon,
} from '@mui/icons-material';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Collapse,
  createTheme,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Popover,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';

// helpers (existing)
import { getUserPermissions } from '../components/get_permission';
import { checkToken } from '../components/token_checker';
// screens (existing)
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

// API config
const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const LOGO_URL = process.env.REACT_APP_API_LOGO_URL;
const api = axios.create({ baseURL: BASE_URL, headers: { 'Content-Type': 'application/json' } });

// ======= PERMISSIONS (unchanged) =======
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
    PERMS.LOCK_RECORDS, PERMS.UNLOCK_RECORDS, PERMS.APPROVE_TRANSFERS, PERMS.REQUEST_TRANSFERS,
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
    PERMS.VIEW_GRADES, PERMS.MANAGE_GRADE_INPUT, PERMS.VIEW_REPORTS,
  ]),
};

function buildPermFlags(keys) { const o = {}; keys.forEach((k) => (o[k] = true)); return o; }
function grantAllPerms() { return buildPermFlags(ALL_PERM_KEYS); }
function mergeServerAndRolePerms(userRole, serverFlags) {
  if (userRole === 'admin') return grantAllPerms();
  const roleSet = ROLE_POLICIES[userRole] || new Set();
  const roleFlags = buildPermFlags([...roleSet]);
  const merged = { ...roleFlags };
  if (serverFlags && typeof serverFlags === 'object') for (const k of ALL_PERM_KEYS) if (k in serverFlags) merged[k] = !!serverFlags[k];
  return merged;
}

// ======== THEME (Glassmorph AppBar & Drawer share the same surface) ========
const getDesignTokens = (mode) => {
  const isLight = mode === 'light';

  const glassBg = isLight
    ? 'linear-gradient(180deg, rgba(255,255,255,.72) 0%, rgba(255,255,255,.52) 100%)'
    : 'linear-gradient(180deg, rgba(13,20,38,.62) 0%, rgba(13,20,38,.46) 100%)';

  const glassBorder = isLight
    ? '1px solid rgba(15,23,42,.08)'
    : '1px solid rgba(255,255,255,.10)';

  const glassShadow = isLight
    ? '0 10px 30px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.05), inset 0 1px 0 rgba(255,255,255,.40)'
    : '0 12px 32px rgba(0,0,0,.40), inset 0 1px 0 rgba(255,255,255,.06)';

  return {
    palette: {
      mode,
      primary: { main: isLight ? '#2563eb' : '#60a5fa' },
      divider: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.10)',
      background: {
        default: isLight ? '#eef2f9' : '#0a0f1f',
        paper: isLight ? '#ffffff' : '#0d1426',
      },
      text: {
        primary: isLight ? '#0f172a' : '#f1f5f9',
        secondary: isLight ? '#475569' : '#cbd5e1',
      },
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: `Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`,
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backdropFilter: 'saturate(145%) blur(12px)',
            background: glassBg,
            borderBottom: glassBorder,
            boxShadow: glassShadow,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backdropFilter: 'saturate(145%) blur(12px)',
            background: glassBg,
            borderRight: glassBorder,
            boxShadow: glassShadow,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            paddingLeft: 12,
            paddingRight: 12,
            transition: 'background-color .18s ease, transform .12s ease',
            '&:hover': {
              backgroundColor: isLight ? 'rgba(2,6,23,.05)' : 'rgba(255,255,255,.08)',
              transform: 'translateY(-1px)',
            },
            '&.Mui-selected': {
              background: isLight
                ? 'linear-gradient(90deg, rgba(37,99,235,.06), rgba(37,99,235,.03))'
                : 'linear-gradient(90deg, rgba(96,165,250,.18), rgba(96,165,250,.08))',
              boxShadow: 'none',
            },
            '&:focus, &:focus-visible': { outline: 'none' },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontSize: 12, fontWeight: 600, borderRadius: 10, padding: '6px 8px' },
        },
      },
      MuiDivider: {
        styleOverrides: { root: { opacity: isLight ? 0.9 : 0.7 } },
      },
    },
  };
};

// ======== ICON MAP (unique) ========
const I = {
  AdminDashboard: HomeIcon,
  TeacherDashboard: DashboardCustomizeIcon,

  StudentRecordsDD: FolderSharedIcon,
  AcademicMgmtDD: AppRegistrationIcon,
  AssignSchedDD: EventNoteIcon,
  SchoolSetupDD: DomainIcon,
  SystemSettingsDD: SettingsSuggestIcon,

  AddStudent: PersonAddIcon,
  Directory: ContactsIcon,
  Enrollment: HowToRegIcon,
  UploadSF10: CloudUploadIcon,
  InputGrades: GradingIcon,
  TransferReq: CompareArrowsIcon,

  Subjects: MenuBookIcon,
  Curriculum: AutoStoriesIcon,
  Teachers: SupervisorAccountIcon,

  AssignSubjects: LayersIcon,
  AssignTeacher: AssignmentIndIcon,
  ClassSchedules: CalendarIcon,

  AcademicYear: DateRangeIcon,
  GradeLevels: StairsIcon,
  Sections: ViewWeekIcon,
  SchoolInfo: HomeWorkIcon,

  UserMgmt: ManageAccountsIcon,
  ActivityLogs: HistoryIcon,
  BackupRestore: BackupIcon,
};

// ======== MENU CONFIG ========
const MENU_CONFIG = [
  { type: 'link', roles: ['admin', 'registrar'], permission: PERMS.VIEW_REPORTS, to: '/dashboard', icon: I.AdminDashboard, label: 'Dashboard' },
  { type: 'link', roles: ['teacher'], to: '/teacher-dashboard', icon: I.TeacherDashboard, label: 'Dashboard (Teacher)' },

  {
    type: 'dropdown', label: 'Student Records', icon: I.StudentRecordsDD, key: 'student', roles: ['admin', 'registrar', 'teacher'],
    children: [
      { to: '/add_student', icon: I.AddStudent, label: 'Add New Student', permission: PERMS.REGISTER_STUDENT },
      { to: '/student_information', icon: I.Directory, label: 'Student Directory', permission: PERMS.VIEW_STUDENT_INFO },
      { to: '/enrollments', icon: I.Enrollment, label: 'Student Enrollment', permission: PERMS.VIEW_ENROLLMENTS },
      { to: '/upload_ecards_all', icon: I.UploadSF10, label: 'Upload SF10 Records', permission: PERMS.UPLOAD_DOCUMENTS },
      { to: '/input-grades', icon: I.InputGrades, label: 'Input Students Grades', permission: PERMS.MANAGE_GRADE_INPUT },
      { to: '/view_request', icon: I.TransferReq, label: 'Transfer Requests', permission: PERMS.APPROVE_TRANSFERS },
    ],
  },

  {
    type: 'dropdown', label: 'Academic Management', icon: I.AcademicMgmtDD, key: 'academic_management', roles: ['admin', 'registrar'],
    children: [
      { to: '/subjects', icon: I.Subjects, label: 'Subject Management', permission: PERMS.VIEW_SUBJECTS },
      { to: '/curriculum', icon: I.Curriculum, label: 'Curriculum Management', permission: PERMS.VIEW_CURRICULUM },
      { to: '/teacher', icon: I.Teachers, label: 'Teacher Management', permission: PERMS.VIEW_TEACHERS },
    ],
  },

  {
    type: 'dropdown', label: 'Assignments & Scheduling', icon: I.AssignSchedDD, key: 'academic_assignments', roles: ['admin', 'registrar'],
    children: [
      { to: '/assign-subject-per-year-level', icon: I.AssignSubjects, label: 'Assign Subjects Grade Level', permission: PERMS.MANAGE_SUBJECTS },
      { to: '/teacher-assignments', icon: I.AssignTeacher, label: 'Assign Teacher', permission: PERMS.VIEW_TEACHER_ASSIGNMENTS },
      { to: '/class-schedules', icon: I.ClassSchedules, label: 'Class Schedules', permission: PERMS.VIEW_CLASS_SCHEDULES },
    ],
  },

  {
    type: 'dropdown', label: 'School Setup', icon: I.SchoolSetupDD, key: 'academic_setup', roles: ['admin', 'registrar'],
    children: [
      { to: '/school_year', icon: I.AcademicYear, label: 'Academic Year', permission: PERMS.VIEW_SCHOOL_YEARS },
      { to: '/grade_level', icon: I.GradeLevels, label: 'Grade Levels', permission: PERMS.VIEW_GRADE_LEVELS },
      { to: '/sections', icon: I.Sections, label: 'Section Creation', permission: PERMS.VIEW_SECTIONS },
      { to: '/school_settings', icon: I.SchoolInfo, label: 'School Information', permission: PERMS.MANAGE_SCHOOL_SETTINGS },
    ],
  },

  {
    type: 'dropdown', label: 'System Settings', icon: I.SystemSettingsDD, key: 'sysadmin', roles: ['admin'],
    children: [
      { to: '/users_account', icon: I.UserMgmt, label: 'User Management', permission: PERMS.MANAGE_USERS },
      { to: '/all_logs', icon: I.ActivityLogs, label: 'Activity Logs', permission: PERMS.VIEW_LOGS },
      { to: '/backup', icon: I.BackupRestore, label: 'Backup & Restore', permission: PERMS.MANAGE_BACKUPS },
    ],
  },
];

// ======== ROUTES ========
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

// ======== Sidebar helpers ========
const NAV_FONT_SIZE = '0.94rem';
const NAV_ICON_SIZE = 22;

// -------- Bootstrap modal-safe z-indexes --------
// Bootstrap modal = 1055, backdrop = 1050.
// Keep sidebar under these.
const Z_SIDEBAR_UNDER_BOOTSTRAP = 1038;

// Icon chip wrapper
const IconChip = ({ children }) => (
  <Box
    sx={{
      display: 'grid',
      placeItems: 'center',
      width: 36,
      height: 36,
      borderRadius: '12px',
      bgcolor: (t) => t.palette.mode === 'light' ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.07)',
      border: '1px solid',
      borderColor: 'divider',
    }}
  >
    {children}
  </Box>
);

/**
 * SidebarLink
 * - Uses NavLink .active class for active styles
 * - Optional `noActiveBar` removes the slim left bar (used for dropdown children)
 * - Optional `matchStart` enables startsWith matching (active for subroutes)
 */
const SidebarLink = memo(function SidebarLink({
  to,
  icon: Icon,
  label,
  collapsed,
  onClick,
  matchStart = false,
  noActiveBar = false,
}) {
  const content = (
    <ListItemButton
      component={NavLink}
      to={to}
      end={!matchStart}
      onClick={onClick}
      sx={{
        position: 'relative',
        px: collapsed ? 0.9 : 1.35,
        py: 0.9,
        borderRadius: 2,
        mx: 0,
        my: 0.5,
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? 0 : 1.05,
        textDecoration: 'none',
        '&, &:focus, &:focus-visible': { outline: 'none' },

        '& .MuiListItemIcon-root': {
          minWidth: 0,
          mr: collapsed ? 0 : 1.0,
          '& svg': { fontSize: NAV_ICON_SIZE, transition: 'transform .12s ease, opacity .12s ease' },
        },
        '& .MuiListItemText-primary': {
          fontSize: NAV_FONT_SIZE, fontWeight: 650, letterSpacing: 0.2, lineHeight: 1.15
        },

        '&:hover': {
          backgroundColor: (t) => (t.palette.mode === 'light' ? 'rgba(2,6,23,.05)' : 'rgba(255,255,255,.08)'),
          transform: 'translateY(-1px)',
        },

        '&.active': {
          background: (t) =>
            t.palette.mode === 'light'
              ? 'linear-gradient(90deg, rgba(37,99,235,.06), rgba(37,99,235,.03))'
              : 'linear-gradient(90deg, rgba(96,165,250,.18), rgba(96,165,250,.08))',
        },

        ...(noActiveBar ? {} : {
          '&.active::before': {
            content: '""',
            position: 'absolute',
            left: 6,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 2,
            backgroundColor: 'primary.main',
          },
        }),

        '&.active .MuiListItemIcon-root svg': { color: 'primary.main' },
        '&.active .MuiListItemText-primary': { color: 'primary.main', fontWeight: 800 },
      }}
      aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
    >
      <ListItemIcon>
        <IconChip><Icon /></IconChip>
      </ListItemIcon>
      {!collapsed && <ListItemText primary={label} />}
    </ListItemButton>
  );

  return collapsed ? <Tooltip title={label} placement="right">{content}</Tooltip> : content;
});

/**
 * SidebarDropdown
 * - Expanded: inline Collapse.
 * - Collapsed: icon-only trigger opens Popover menu.
 * - NO vertical bar for active header; uses subtle wash only.
 * - Child links inside dropdown pass `noActiveBar` so no vertical bar there either.
 */
const SidebarDropdown = memo(function SidebarDropdown({ label, icon: Icon, open, onToggle, items, collapsed, active }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const popOpen = Boolean(anchorEl);

  const handleClick = (e) => { if (collapsed) setAnchorEl(e.currentTarget); else onToggle?.(); };
  const handleClose = () => setAnchorEl(null);

  const header = (
    <ListItemButton
      onClick={handleClick}
      aria-haspopup="menu"
      aria-expanded={collapsed ? popOpen : open}
      aria-label={label}
      selected={active}
      sx={{
        position: 'relative',
        px: collapsed ? 0.9 : 1.35,
        py: 0.9,
        borderRadius: 2,
        mx: 0,
        my: 0.5,
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? 0 : 1.05,
        textDecoration: 'none',
        '&, &:focus, &:focus-visible': { outline: 'none' },

        '& .MuiListItemIcon-root': {
          minWidth: 0,
          mr: collapsed ? 0 : 1.0,
          '& svg': { fontSize: NAV_ICON_SIZE, transition: 'transform .12s ease, opacity .12s ease' },
        },
        '&:hover': { backgroundColor: (t) => t.palette.action.hover, transform: 'translateY(-1px)' },

        '&.Mui-selected .MuiListItemIcon-root svg': { color: 'primary.main' },
        '&.Mui-selected .MuiListItemText-primary': { color: 'primary.main', fontWeight: 800 },
      }}
    >
      <ListItemIcon>
        <IconChip><Icon /></IconChip>
      </ListItemIcon>
      {!collapsed && (
        <>
          <ListItemText
            primary={label}
            primaryTypographyProps={{ fontSize: NAV_FONT_SIZE, fontWeight: 750, letterSpacing: 0.2, lineHeight: 1.15 }}
          />
          {open ? <ExpandLess /> : <ExpandMore />}
        </>
      )}
    </ListItemButton>
  );

  return (
    <Box>
      {collapsed ? <Tooltip title={label} placement="right">{header}</Tooltip> : header}

      {!collapsed && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List component="div" disablePadding sx={{ pl: 2 }}>
            {items.map((c) => (
              <SidebarLink
                key={c.to}
                to={c.to}
                icon={c.icon}
                label={c.label}
                collapsed={false}
                noActiveBar
              />
            ))}
          </List>
        </Collapse>
      )}

      {collapsed && (
        <Popover
          open={popOpen}
          onClose={handleClose}
          anchorEl={anchorEl}
          anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
          transformOrigin={{ vertical: 'center', horizontal: 'left' }}
          PaperProps={{
            sx: {
              ml: 1,
              borderRadius: 2,
              boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
              backdropFilter: 'saturate(140%) blur(6px)',
            }
          }}
        >
          <Box sx={{ minWidth: 280, p: 0.75 }}>
            <List dense disablePadding>
              {items.map((c) => (
                <SidebarLink
                  key={c.to}
                  to={c.to}
                  icon={c.icon}
                  label={c.label}
                  collapsed={false}
                  noActiveBar
                  onClick={() => setAnchorEl(null)}
                />
              ))}
            </List>
          </Box>
        </Popover>
      )}
    </Box>
  );
});

// ======== Build routes from menu ========
function buildRoutesFromMenu(menu, perms) {
  const hasPerm = (p) => (p ? Boolean(perms[p]) : true);
  const ordered = [];
  const visit = (item) => {
    if (item.type === 'link') {
      if (!hasPerm(item.permission)) return;
      const base = ROUTE_COMPONENTS[item.to];
      if (base && hasPerm(base.perm)) ordered.push({ path: item.to, el: base.el });
      (EXTRA_ROUTES[item.to] || []).forEach((r) => hasPerm(r.perm) && ordered.push({ path: r.path, el: r.el }));
    } else if (item.type === 'dropdown') (item.children || []).forEach((c) => visit({ ...c, type: 'link' }));
  };
  menu.forEach(visit);
  return ordered;
}

// ======== Main Component ========
const STORAGE_KEY = 'esf10.sidebar.width.v1';
const DEFAULT_WIDTH = 360;
const MIN_WIDTH = 240;
const MAX_WIDTH = 560;
const collapsedWidth = 108;
const FOOTER_HEIGHT = 34;

export default function SidebarMui({ onLogout }) {
  // Themes
  const [mode, setMode] = useState(getInitialTheme);
  const appTheme = useMemo(() => createTheme(getDesignTokens(mode)), [mode]);
  const mainLightTheme = useMemo(() => createTheme(getDesignTokens('light')), []);

  const toggleTheme = () => {
    setMode((m) => { const next = m === 'dark' ? 'light' : 'dark'; localStorage.setItem('mui-theme', next); return next; });
  };

  // Layout / UI state
  const mdUp = useMediaQuery(appTheme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // === Resizable width state (desktop only) ===
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(STORAGE_KEY) || '', 10);
    if (Number.isFinite(saved)) return clamp(saved, MIN_WIDTH, MAX_WIDTH);
    return DEFAULT_WIDTH;
  });
  const prevExpandedWidthRef = useRef(sidebarWidth);
  const draggingRef = useRef(false);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      if (!c) {
        prevExpandedWidthRef.current = sidebarWidth;
      } else {
        const restored = clamp(prevExpandedWidthRef.current || sidebarWidth || DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH);
        setSidebarWidth(restored);
        localStorage.setItem(STORAGE_KEY, String(restored));
      }
      return !c;
    });
  };

  // Drag handlers (desktop permanent drawer)
  const onDragStart = (e) => {
    if (!mdUp || collapsed) return;
    draggingRef.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  };

  const onDragMove = (e) => {
    if (!draggingRef.current) return;
    const next = clamp(e.clientX, MIN_WIDTH, MAX_WIDTH);
    setSidebarWidth(next);
  };

  const onDragEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    localStorage.setItem(STORAGE_KEY, String(sidebarWidth));
    prevExpandedWidthRef.current = sidebarWidth;
  };

  useEffect(() => {
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('mouseleave', onDragEnd);
    return () => {
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
      window.removeEventListener('mouseleave', onDragEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarWidth, mdUp, collapsed]);

  // Data/permissions
  const [openMenus, setOpenMenus] = useState({});
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [schoolData, setSchoolData] = useState({});
  const [logoUrl, setLogoUrl] = useState(null);

  const [anchorEl, setAnchorEl] = useState(null);
  const profileMenuOpen = Boolean(anchorEl);
  const handleProfileClick = (e) => setAnchorEl(e.currentTarget);
  const handleProfileClose = () => setAnchorEl(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const schoolId = '1234567890';
  const token = sessionStorage.getItem('token');
  const userRole = (sessionStorage.getItem('user_role') || 'teacher').toLowerCase();

  const fullName = useMemo(() => (!user ? 'Loading...' : [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ')), [user]);
  const avatarInitial = useMemo(() => (user?.first_name?.[0] || '?').toUpperCase(), [user?.first_name]);
  const roleLabel = useMemo(() => (Array.isArray(user?.role) ? user.role[0] : user?.role) || userRole || 'User', [user?.role, userRole]);

  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === '/login' || pathname.startsWith('/login')) { setUser(null); setPermissions({}); return; }
    checkToken();
    const serverFlags = getUserPermissions?.() || {};
    const merged = mergeServerAndRolePerms(userRole, serverFlags);
    setPermissions(merged);

    const loginRaw = sessionStorage.getItem('loginResponse');
    if (loginRaw) { try { const loginData = JSON.parse(loginRaw); if (loginData?.user) setUser(loginData.user); } catch {} }

    api.get(`/school-defaults/${schoolId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        const { user, school_id, created_at, updated_at, ...filtered } = data || {};
        setSchoolData(filtered);
        setLogoUrl(data?.school_logo ? (data.school_logo.startsWith('http') ? data.school_logo : `${LOGO_URL}${data.school_logo}`) : null);
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
      if (!seen.has(path) && (!cfg.perm || permissions[cfg.perm])) { seen.add(path); inMenuRoutes.push({ path, el: cfg.el }); }
    });
    Object.entries(EXTRA_ROUTES).forEach(([base, extras]) => {
      if (!seen.has(base)) extras.forEach((r) => (!r.perm || permissions[r.perm]) && inMenuRoutes.push({ path: r.path, el: r.el }));
    });
    inMenuRoutes.push({ path: '*', el: <NotFound /> });
    return inMenuRoutes;
  }, [filteredMenus, permissions]);

  const toggleMenu = (key) => setOpenMenus((p) => ({ ...p, [key]: !p[key] }));

  // ---- DYNAMIC DOCUMENT TITLE PER ROUTE ----
  const PATH_LABELS = useMemo(() => {
    const map = {};
    MENU_CONFIG.forEach((m) => {
      if (m.type === 'link') map[m.to] = m.label;
      if (m.type === 'dropdown') (m.children || []).forEach((c) => { map[c.to] = c.label; });
    });
    MENU_CONFIG.filter(m => m.type === 'dropdown').forEach((m) => { map[`/${m.key}`] = m.label; });
    return map;
  }, []);

  useEffect(() => {
    let action = PATH_LABELS[pathname];
    if (!action) {
      const entry = Object.keys(PATH_LABELS).find((k) => pathname.startsWith(k + '/'));
      if (entry) action = PATH_LABELS[entry];
    }
    if (!action) {
      const seg = pathname.split('/').filter(Boolean).join(' / ');
      action = seg ? seg.replace(/-/g, ' ').replace(/\b\w/g, s => s.toUpperCase()) : 'Dashboard';
    }
    document.title = `E-SF10 SYSTEM - ${action}`;
  }, [pathname, PATH_LABELS]);
  // ------------------------------------------

  // Drawer credits popover (collapsed)
  const [creditsAnchor, setCreditsAnchor] = useState(null);
  const creditsOpen = Boolean(creditsAnchor);
  const openCredits = (e) => setCreditsAnchor(e.currentTarget);
  const closeCredits = () => setCreditsAnchor(null);

  // Drawer content
  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Header */}
      <Box
        sx={{
          px: 2.5, pt: 1.75, pb: 1.25,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', gap: 1, minHeight: 64,
        }}
      >
        {!collapsed && (
          <Box sx={{ overflow: 'hidden' }}>
            <Typography noWrap sx={{ fontWeight: 900, fontSize: '1.22rem', letterSpacing: 0.2, lineHeight: 1.15 }}>
              E-SF10 SYSTEM
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: .25 }}>
              Manage student forms easily & securely
            </Typography>
          </Box>
        )}
      </Box>

      <Divider />

      {/* Scroll area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          py: 1,
          px: 2.25,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        <List disablePadding>
          {filteredMenus.map((menu) => {
            if (menu.type === 'link') {
              const Icon = menu.icon;
              if (!hasRole(menu.roles) || !can(menu.permission)) return null;
              return (
                <SidebarLink
                  key={menu.to}
                  to={menu.to}
                  icon={Icon}
                  label={menu.label}
                  collapsed={collapsed}
                />
              );
            }
            if (!hasRole(menu.roles)) return null;
            const visibleChildren = (menu.children || []).filter((c) => can(c.permission));
            if (!visibleChildren.length) return null;
            const isOpen = !!openMenus[menu.key];
            const Icon = menu.icon;

            const anyChildActive = visibleChildren.some((c) => pathname === c.to || pathname.startsWith(c.to + '/'));
            return (
              <Box key={menu.key}>
                <SidebarDropdown
                  label={menu.label}
                  icon={Icon}
                  open={isOpen}
                  onToggle={() => toggleMenu(menu.key)}
                  collapsed={collapsed}
                  items={visibleChildren}
                  active={anyChildActive}
                />
              </Box>
            );
          })}
        </List>
      </Box>

      <Divider />

      {/* Sidebar bottom credits — CENTERED */}
      {!collapsed ? (
        <Box sx={{ p: 2, pt: 1.5, display: 'grid', justifyItems: 'center' }}>
          <Paper variant="outlined" sx={{ p: 1.35, borderRadius: 2, textAlign: 'center', width: '100%' }}>
            <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', mb: 0.5, letterSpacing: 0.2 }}>
              Developers
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              • John Paul Curib (Front-end)
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
              • Quivir Cutanda (Back-end)
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', mb: 0.5, letterSpacing: 0.2 }}>
              Project Adviser / Manager
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              • Clark Kevin Villamor
            </Typography>
          </Paper>

          <Box sx={{ mt: 1, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              © {new Date().getFullYear()} • TMC Coding Club
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ p: 1.25, display: 'grid', justifyItems: 'center', rowGap: 0.5 }}>
          <Tooltip title="Credits">
            <IconButton size="small" onClick={(e) => setCreditsAnchor(e.currentTarget)}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography variant="caption" color="text.secondary" noWrap>
            © {new Date().getFullYear()}
          </Typography>

          {/* Credits popover in collapsed mode */}
          <Popover
            open={creditsOpen}
            onClose={closeCredits}
            anchorEl={creditsAnchor}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            PaperProps={{
              sx: {
                p: 1,
                borderRadius: 2,
                minWidth: 260,
                textAlign: 'center',
                backdropFilter: 'saturate(140%) blur(6px)',
              }
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', mb: 0.5 }}>
              Developers
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              • John Paul Curib (Front-end)
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
              • Quivir Cutanda (Back-end)
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', mb: 0.5 }}>
              Project Adviser / Manager
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              • Clark Kevin Villamor
            </Typography>
          </Popover>
        </Box>
      )}

      {/* === DRAG HANDLE (desktop only, hidden when collapsed) === */}
      <Box
        onMouseDown={onDragStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        sx={{
          display: { xs: 'none', md: collapsed ? 'none' : 'block' },
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
          width: 6,
          cursor: 'col-resize',
          '&:hover': {
            background:
              'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(99,102,241,0.2) 40%, rgba(99,102,241,0.35) 60%, rgba(0,0,0,0) 100%)',
          },
        }}
      />
    </Box>
  );

  const sideWidth = collapsed ? collapsedWidth : sidebarWidth;

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {/* AppBar */}
        <AppBar
          position="fixed"
          color="default"
          elevation={0}
          sx={{
            // Use our constant instead of theme.zIndex.drawer to stay under Bootstrap modal
            zIndex: Z_SIDEBAR_UNDER_BOOTSTRAP + 1,
            width: { md: `calc(100% - ${sideWidth}px)` },
            ml: { md: `${sideWidth}px` },
          }}
        >
          <Toolbar sx={{ gap: 1.25, minHeight: 72, px: { xs: 1.75, sm: 2.5, md: 3 } }}>
            <Tooltip title={useMediaQuery(appTheme.breakpoints.up('md')) ? (collapsed ? 'Expand sidebar' : 'Collapse sidebar') : 'Open menu'}>
              <IconButton
                color="inherit"
                edge="start"
                onClick={useMediaQuery(appTheme.breakpoints.up('md')) ? toggleCollapse : handleDrawerToggle}
                aria-label="toggle sidebar"
                size="large"
                sx={{ '&, &:focus, &:focus-visible': { outline: 'none' } }}
              >
                <MenuIcon />
              </IconButton>
            </Tooltip>

            {/* logo + school meta */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {logoUrl ? (
                <Box
                  component="img"
                  src={logoUrl}
                  alt="School Logo"
                  sx={{ width: 40, height: 40, borderRadius: 2, border: '1px solid', borderColor: 'divider', objectFit: 'cover' }}
                />
              ) : (
                <Box sx={{
                  width: 40, height: 40, borderRadius: 2, bgcolor: 'action.hover',
                  display: 'grid', placeItems: 'center', color: 'text.disabled', fontSize: 11
                }}>N/A</Box>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <Typography variant="subtitle1" noWrap fontWeight={800}>{schoolData.school_name || 'Loading…'}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>{schoolData.school_address || '—'}</Typography>
              </Box>
            </Box>

            <Box sx={{ flex: 1 }} />

            {/* Profile */}
            <Tooltip title={fullName}>
              <IconButton onClick={handleProfileClick} size="small" sx={{ ml: 0.5, '&, &:focus, &:focus-visible': { outline: 'none' } }}>
                <Avatar sx={{ width: 32, height: 32 }}>{avatarInitial}</Avatar>
              </IconButton>
            </Tooltip>
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', alignItems: 'flex-start', mx: 1 }}>
              <Typography variant="body2" noWrap fontWeight={700}>{fullName}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>{roleLabel}</Typography>
            </Box>

            {/* Theme toggle (affects sidebar/appbar only) */}
            <Tooltip title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}>
              <IconButton onClick={toggleTheme} aria-label="toggle color mode" color="inherit" sx={{ '&, &:focus, &:focus-visible': { outline: 'none' } }}>
                {mode === 'dark' ? <LightIcon /> : <DarkIcon />}
              </IconButton>
            </Tooltip>

            {/* Profile menu */}
            <Menu
              anchorEl={anchorEl}
              open={profileMenuOpen}
              onClose={handleProfileClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem disabled>
                <ListItemIcon><AccountIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{fullName}</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => { handleProfileClose(); setConfirmOpen(true); }}>
                <ListItemIcon><LogoutIcon color="error" fontSize="small" /></ListItemIcon>
                <Typography color="error">Logout</Typography>
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Drawer (sidebar) */}
        <Box component="nav" sx={{ width: { md: sideWidth }, flexShrink: { md: 0 } }} aria-label="sidebar">
          {/* Mobile */}
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true, sx: { zIndex: Z_SIDEBAR_UNDER_BOOTSTRAP } }}
            sx={{
              display: { xs: 'block', md: 'none' },
              zIndex: Z_SIDEBAR_UNDER_BOOTSTRAP, // ensure Drawer root under Bootstrap modal
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: DEFAULT_WIDTH,
                borderRadius: 0,
                zIndex: Z_SIDEBAR_UNDER_BOOTSTRAP, // paper under Bootstrap modal
              },
            }}
          >
            <Box sx={{ width: DEFAULT_WIDTH }}>{drawer}</Box>
          </Drawer>

          {/* Desktop mini-variant */}
          <Drawer
            variant="permanent"
            open
            sx={{
              display: { xs: 'none', md: 'block' },
              zIndex: Z_SIDEBAR_UNDER_BOOTSTRAP, // root under Bootstrap modal
              '& .MuiDrawer-paper': {
                zIndex: Z_SIDEBAR_UNDER_BOOTSTRAP, // paper under Bootstrap modal
                boxSizing: 'border-box',
                width: sideWidth,
                borderRight: '1px solid',
                borderColor: 'divider',
                overflowX: 'hidden',
                transition: (t) => t.transitions.create('width', { duration: t.transitions.duration.shortest }),
              },
            }}
          >
            <Box sx={{ width: sideWidth }}>{drawer}</Box>
          </Drawer>
        </Box>

        {/* MAIN CONTENT (locked to light) */}
        <ThemeProvider theme={mainLightTheme}>
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              padding:'10px',
              p: 5,
              bgcolor: '#ffffff',
              color: '#0f172a',
              minHeight: '100vh',
              pb: `${FOOTER_HEIGHT + 12}px`,
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            <Toolbar sx={{ minHeight: 72 }} />
            <Routes>
              {useMemo(() => orderedRoutes.map((r) => <Route key={r.path} path={r.path} element={r.el} />), [orderedRoutes])}
            </Routes>
          </Box>

          {/* SLIM FOOTER — no developer/adviser info here */}
          <Box
            component="footer"
            sx={{
              position: 'fixed',
              bottom: 0,
              left: { xs: 0, md: `${sideWidth}px` },
              width: { xs: '100%', md: `calc(100% - ${sideWidth}px)` },
              height: `${FOOTER_HEIGHT}px`,
              bgcolor: '#ffffff',
              borderTop: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: { xs: 1.5, md: 2 },
              // Keep footer above the drawer/appbar but still below Bootstrap modal
              zIndex: Z_SIDEBAR_UNDER_BOOTSTRAP + 2,
              color: '#334155',
            }}
          >
            <Typography variant="caption" noWrap>
              © {new Date().getFullYear()} TMC Coding Club
            </Typography>
          </Box>
        </ThemeProvider>
      </Box>

      {/* Logout dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 28, height: 28 }}>{avatarInitial}</Avatar>
          <Box>
            <Typography variant="subtitle1">Sign out</Typography>
            <Typography variant="caption" color="text.secondary">{fullName}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">Are you sure you want to logout?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} variant="outlined">Cancel</Button>
          <Button onClick={() => { setConfirmOpen(false); onLogout?.(); }} variant="contained" color="error" startIcon={<LogoutIcon />}>
            Logout
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

function getInitialTheme() {
  const saved = localStorage.getItem('mui-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light';
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
