// HomeDashboard.bootstrap.clean.v3.jsx
// Bootstrap 5.3+ | Modern inline-hero layout; glass overlay matches gradient area exactly

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import axios from 'axios';
import {
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  InputGroup,
  Pagination,
  Placeholder,
  ProgressBar,
  Row,
  Table,
} from 'react-bootstrap';
import {
  FaDownload,
  FaExchangeAlt,
  FaSchool,
  FaSearch,
  FaUserPlus,
  FaUsers,
  FaUserTie,
} from 'react-icons/fa';

import StatusModal from '../components/status_modal';
import { checkToken } from '../components/token_checker';

// ======= ENV =======
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

// ======= Formatters =======
const fmtTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtDate = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' });

const clamp = (n, min, max) => Math.min(max, Math.max(min, Number(n) || 0));
function formatRelative(ts, now = Date.now()) {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? ts : new Date(ts).getTime();
  if (Number.isNaN(d)) return '—';
  const diff = Math.max(0, now - d);
  if (diff < 1000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleString();
}
const classifyAction = (action = '') => {
  const a = (action || '').toLowerCase();
  if (/(create|added|new)/.test(a)) return 'created';
  if (/(update|edit|change)/.test(a)) return 'updated';
  if (/(delete|remove)/.test(a)) return 'deleted';
  if (/(transfer|move)/.test(a)) return 'transfer';
  return 'info';
};
const actionBadge = (action = '') => {
  const kind = classifyAction(action);
  const map = {
    created: { text: 'Created', bg: 'success' },
    updated: { text: 'Updated', bg: 'primary' },
    deleted: { text: 'Deleted', bg: 'danger' },
    transfer: { text: 'Transfer', bg: 'warning' },
    info: { text: 'Info', bg: 'secondary' },
  };
  return map[kind] || map.info;
};

// ======= UI Helpers =======
const RingIcon = ({ children, tint = 'var(--bs-primary)' }) => (
  <div className="d-inline-flex justify-content-center align-items-center position-relative" style={{ width: 48, height: 48 }}>
    <span className="position-absolute w-100 h-100 rounded-circle opacity-25" style={{ boxShadow: `inset 0 0 0 6px ${tint}33` }} />
    <span className="rounded-circle d-inline-flex justify-content-center align-items-center text-white" style={{ width: 38, height: 38, background: tint }}>
      {children}
    </span>
  </div>
);

function AnimatedNumber({ value = 0, duration = 600 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const from = 0;
    const to = Number(value) || 0;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (to - from) * ease);
      setN(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{n.toLocaleString()}</>;
}

// ======= Cards =======
const StatCard = ({ icon, label, value = 0, percent = 0, color, size = 'md' }) => {
  const isLg = size === 'lg';
  return (
    <Card className={`border-0 soft-shadow hover-lift h-100 rounded-3 ${isLg ? 'kpi-lg' : ''}`}>
      <Card.Body className={isLg ? 'p-4' : 'p-3'}>
        <div className="d-flex align-items-start gap-3">
          <RingIcon tint={color}>{icon}</RingIcon>
          <div className="flex-grow-1">
            <div className="text-body-secondary small fw-medium">{label}</div>
            <div className="d-flex align-items-baseline justify-content-between mt-1">
              <div className={`fw-bold ${isLg ? 'display-6 mb-0' : 'fs-3'}`} style={{ color, lineHeight: 1 }}>
                <AnimatedNumber value={value} />
              </div>
              <Badge bg="light" text="dark" className={`rounded-pill ${isLg ? 'fs-6' : 'fs-7'}`}>
                {Math.round(clamp(percent, 0, 100))}%
              </Badge>
            </div>
            <ProgressBar now={clamp(percent, 0, 100)} className={isLg ? 'mt-3' : 'mt-2'} style={{ height: isLg ? 10 : 6, borderRadius: 999 }} />
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

const InfoItem = ({ title, children }) => (
  <Col md={4} className="mb-2">
    <div className="text-body-secondary small mb-1">{title}</div>
    <div className="fw-semibold text-truncate">{children || '—'}</div>
  </Col>
);

const SkeletonCard = () => (
  <Card className="soft-shadow border-0 rounded-3">
    <Card.Body className="p-3">
      <Placeholder as="div" animation="wave">
        <Placeholder xs={3} className="mb-2" />
        <Placeholder xs={8} className="mb-2" />
        <Placeholder xs={6} />
      </Placeholder>
    </Card.Body>
  </Card>
);

// ======= Component =======
export default function HomeDashboard() {
  const token = useMemo(() => sessionStorage.getItem('token'), []);
  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState({ show: false, title: '', message: '', variant: 'danger' });
  const [now, setNow] = useState(Date.now());

  // logs state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLimit, setLogsLimit] = useState(10);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsQuery, setLogsQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [compact, setCompact] = useState(false);

  // NEW: Active teachers + curriculum + enrolled count
  const [teacherCount, setTeacherCount] = useState(0);
  const [activeCurriculum, setActiveCurriculum] = useState(null);
  const [enrolledCountCurr, setEnrolledCountCurr] = useState(0);

  // derived filtered logs
  const visibleLogs = useMemo(() => {
    const q = (logsQuery || '').toLowerCase();
    return (logs || []).filter((l) => {
      const matchesQuery = q ? [l?.action, l?.first_name, l?.last_name, l?.email].filter(Boolean).join(' ').toLowerCase().includes(q) : true;
      const kind = classifyAction(l?.action || '');
      const matchesType = typeFilter === 'all' ? true : kind === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [logs, logsQuery, typeFilter]);

  const handleError = (message) => setModal({ show: true, title: 'Error', message, variant: 'danger' });

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/dashboard`, { headers: authHeaders() });
      setDashboardData(data);
    } catch {
      handleError('Failed to fetch dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/activity-log`, {
        headers: authHeaders(),
        params: { page: logsPage, limit: logsLimit },
      });
      if (data?.success) {
        setLogs(data.logs || []);
        setLogsTotalPages(data.totalPages || 1);
      }
    } catch {
      handleError('Failed to fetch activity logs.');
    } finally {
      setLogsLoading(false);
    }
  }, [logsPage, logsLimit, token]);

  const fetchActiveTeachers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${BASE_URL}/teachers/active`, { headers: authHeaders() });
      const count = typeof data?.count === 'number' ? data.count : Array.isArray(data?.data) ? data.data.length : 0;
      setTeacherCount(Number(count || 0));
    } catch {}
  }, [token]);

  const fetchActiveCurriculum = useCallback(async () => {
    try {
      const { data } = await axios.get(`${BASE_URL}/curriculum/active-curriculums`, { headers: authHeaders() });
      setActiveCurriculum(data?.data || null);
    } catch {}
  }, [token]);

  const fetchEnrolledCountForActiveCurriculum = useCallback(
    async (curr) => {
      const cid = curr?.curriculum_id ?? curr?.curriculumId ?? curr?.id;
      if (!cid) return;
      try {
        const { data } = await axios.get(`${BASE_URL}/enrollments`, {
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          params: { page: 1, limit: 1, curriculum_id: cid, status: 'Enrolled' },
        });
        const total = Number(data?.pagination?.total) || (Array.isArray(data?.data) ? data.data.length : 0);
        setEnrolledCountCurr(Number(total || 0));
      } catch {}
    },
    [token]
  );

  useEffect(() => { checkToken(); }, []);
  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchActiveTeachers(); fetchActiveCurriculum(); }, [fetchActiveTeachers, fetchActiveCurriculum]);
  useEffect(() => { if (activeCurriculum) fetchEnrolledCountForActiveCurriculum(activeCurriculum); }, [activeCurriculum, fetchEnrolledCountForActiveCurriculum]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const exportLogsCsv = () => {
    try {
      const headers = ['log_id', 'action', 'user', 'email', 'timestamp'];
      const rows = visibleLogs.map((l) => [
        l.log_id,
        (l.action || '').replace(/\n|\r/g, ' '),
        [l.first_name, l.last_name].filter(Boolean).join(' '),
        l.email || '',
        new Date(l.log_timestamp).toISOString(),
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity_logs_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      handleError('Failed to export CSV.');
    }
  };

  // ======= Loading State =======
  if (loading) {
    return (
      <Container fluid className="px-3 px-lg-4 py-3" style={{ minHeight: '100vh' }}>
        <style>{styles}</style>
        <Row className="g-3">
          <Col lg={8}><SkeletonCard /></Col>
          <Col lg={4}><SkeletonCard /></Col>
          <Col xs={12}><SkeletonCard /></Col>
          <Col md={4}><SkeletonCard /></Col>
          <Col md={4}><SkeletonCard /></Col>
          <Col md={4}><SkeletonCard /></Col>
        </Row>
      </Container>
    );
  }
  if (!dashboardData) return null;

  // ======= Derived =======
  const { user = {}, studentStats = {}, schoolInfo = {} } = dashboardData;
  const stats = [
    { icon: <FaUsers size={18} />, label: 'Total Students', value: Number(studentStats.total_students) || 0, percent: 100, color: 'var(--bs-primary)' },
    { icon: <FaExchangeAlt size={16} />, label: 'Pending Transfers', value: Number(studentStats.pending_transfers) || 0, percent: 100, color: 'var(--bs-info)' },
    { icon: <FaUserPlus size={16} />, label: 'Recent Students', value: Number(studentStats.recent_students) || 0, percent: 100, color: 'var(--bs-success)' },
  ];
  const miniStats = [
    { label: 'Active Teachers', value: teacherCount, color: 'var(--bs-primary)' },
    { label: 'Enrolled (Active Curriculum)', value: enrolledCountCurr, color: 'var(--bs-success)' },
  ];
  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase();

  // ======= Pagination UI =======
  const renderPagination = () => (
    <Pagination className="mb-0">
      <Pagination.First disabled={logsPage <= 1} onClick={() => setLogsPage(1)} />
      <Pagination.Prev disabled={logsPage <= 1} onClick={() => setLogsPage((p) => Math.max(1, p - 1))} />
      <Pagination.Item active>{logsPage}</Pagination.Item>
      <Pagination.Next disabled={logsPage >= logsTotalPages} onClick={() => setLogsPage((p) => Math.min(logsTotalPages, p + 1))} />
      <Pagination.Last disabled={logsPage >= logsTotalPages} onClick={() => setLogsPage(logsTotalPages)} />
    </Pagination>
  );

  // ======= Render =======
  return (
    <Container fluid className="px-3 px-lg-4 py-3" style={{ minHeight: '100vh' }}>
      <style>{styles}</style>

      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />

      {/* HERO — Inline text; glass overlay fills entire gradient area */}
   {/* HERO — Proper design */}
<Row className="g-3 align-items-stretch mb-3">
  <Col lg={8}>
   <Card className="hero-card border-0 soft-shadow rounded-4 overflow-hidden">
  <Card.Body className="p-0 hero-body position-relative">
    {/* Gradient background */}
    <div className="hero-bg" aria-hidden="true" />

    {/* Glass overlay (1:1 size with bg) */}
    <div className="hero-overlay d-flex align-items-center">
      <div className="container-fluid">
        <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-lg-between gap-3">

          {/* Left block: Avatar + Title */}
          <div className="d-flex align-items-center gap-3 flex-wrap flex-lg-nowrap">
            <div
              className="hero-avatar rounded-circle d-flex justify-content-center align-items-center text-white flex-shrink-0"
              aria-label="User initials"
              title="Profile"
            >
              {initials || <FaUsers size={22} />}
            </div>

            <div className="d-flex flex-column align-items-center align-items-lg-start">
              <h1 className="hero-title m-0 fw-semibold text-center text-lg-start">
                Welcome{user.first_name ? `, ${user.first_name}` : ''}!
              </h1>

              {/* Roles (auto-wrap, pill chips) */}
              <div className="hero-roles d-flex flex-wrap align-items-center justify-content-center justify-content-lg-start gap-2 mt-2">
                {(Array.isArray(user.roles) ? user.roles : [user.roles])
                  .filter(Boolean)
                  .map((r, i) => (
                    <Badge key={i} bg="light" text="dark" className="rounded-pill hero-chip">
                      {r}
                    </Badge>
                  ))}
              </div>
            </div>
          </div>

          {/* Right block: Clock (sticks to the right on lg+) */}
          <div className="d-flex align-items-center justify-content-center justify-content-lg-end w-100 w-lg-auto">
            <div className="hero-clock d-flex align-items-baseline gap-2">
              <span className="hero-time fw-bold">{fmtTime.format(now)}</span>
              <span className="opacity-75">•</span>
              <span className="opacity-75">{fmtDate.format(now)}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  </Card.Body>
</Card>

  </Col>

        {/* Right panel — Actions + Mini stats */}
        <Col lg={4}>
          <Card className="soft-shadow rounded-3 border-0 h-100">
            <Card.Body className="p-3 d-flex flex-column gap-3">
              <div className="d-flex align-items-center justify-content-between">
                <span className="fw-semibold">Quick Actions</span>
                <div className="d-flex gap-2">
                  <Button size="sm" variant="outline-secondary" onClick={exportLogsCsv} title="Export recent logs as CSV">
                    <FaDownload className="me-1" /> Export
                  </Button>
                </div>
              </div>

              <div className="d-grid gap-2">
                <Button variant="primary" size="sm" onClick={() => window.location.assign('/student_information')}>View Students</Button>
                <Button variant="outline-primary" size="sm" onClick={() => window.location.assign('/add_student')}>Add Student</Button>
                <Button variant="outline-secondary" size="sm" onClick={() => window.location.assign('/enrollments')}>Enrollments</Button>
              </div>

              <div className="d-flex gap-3 mt-2">
                {miniStats.map((m, i) => (
                  <div key={i} className="flex-fill">
                    <div className="text-body-secondary small">{m.label}</div>
                    <div className="fw-bold" style={{ color: m.color }}>{(m.value ?? 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* KPIs */}
      <Row className="g-3 mb-2">
        {stats.map((s, i) => (
          <Col key={i} xs={12} sm={6} md={4}>
            <StatCard icon={s.icon} label={s.label} value={s.value} percent={s.percent} color={s.color} size="lg" />
          </Col>
        ))}
      </Row>

      {/* School & Curriculum */}
      <Row className="g-3 mb-3">
        <Col xs={12}>
          <Card className="mb-3 soft-shadow border-0 rounded-3 h-100">
            <Card.Header className="bg-body border-0 fw-semibold text-primary d-flex align-items-center py-2">
              <FaSchool className="me-2" /> School Information
            </Card.Header>
            <Card.Body className="pt-2">
              <Row className="mb-2 g-2 g-lg-3">
                <InfoItem title="Name">{schoolInfo.school_name}</InfoItem>
                <InfoItem title="Region">{schoolInfo.region}</InfoItem>
                <InfoItem title="District">{schoolInfo.district}</InfoItem>
              </Row>
              <Row className="g-2 g-lg-3">
                <InfoItem title="Address">{schoolInfo.school_address}</InfoItem>
                <InfoItem title="Division">{schoolInfo.division}</InfoItem>
                <InfoItem title="School Head">
                  {schoolInfo.school_head} <FaUserTie className="text-body-tertiary ms-1" />
                </InfoItem>
              </Row>
              <Row className="mt-1 g-2 g-lg-3">
                <InfoItem title="Active Curriculum">{activeCurriculum?.curriculum_name}</InfoItem>
                <InfoItem title="Effective Year">{activeCurriculum?.school_year_period}</InfoItem>
                <InfoItem title="Subjects in Curriculum">{(activeCurriculum?.subjects || []).length}</InfoItem>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      <Card className="soft-shadow border-0 rounded-3">
        <Card.Header className="bg-body border-0 fw-semibold text-primary d-flex align-items-center justify-content-between flex-wrap gap-2 py-2">
          <span>Recent Activity</span>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="d-flex gap-1 filters-scroll">
              {[
                { id: 'all', label: 'All' },
                { id: 'created', label: 'Created' },
                { id: 'updated', label: 'Updated' },
                { id: 'deleted', label: 'Deleted' },
                { id: 'transfer', label: 'Transfer' },
                { id: 'info', label: 'Info' },
              ].map((f) => (
                <button key={f.id} className={`chip ${typeFilter === f.id ? 'active' : ''}`} onClick={() => setTypeFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>

            <InputGroup size="sm" style={{ width: 260 }}>
              <InputGroup.Text><FaSearch /></InputGroup.Text>
              <Form.Control placeholder="Search logs..." value={logsQuery} onChange={(e) => setLogsQuery(e.target.value)} />
            </InputGroup>

            <Form.Select size="sm" value={logsLimit} onChange={(e) => { setLogsLimit(Number(e.target.value)); setLogsPage(1); }} style={{ width: 120 }}>
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}/page</option>)}
            </Form.Select>

            <div className="form-check form-switch ms-1">
              <input className="form-check-input" type="checkbox" role="switch" id="densitySwitch" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
              <label className="form-check-label small text-body-secondary" htmlFor="densitySwitch">{compact ? 'Compact' : 'Cozy'}</label>
            </div>
          </div>
        </Card.Header>

        <Card.Body className="p-0">
          {logsLoading ? (
            <div className="p-3"><SkeletonCard /></div>
          ) : visibleLogs?.length ? (
            <>
              <div className="table-responsive">
                <Table hover size={compact ? 'sm' : undefined} className="mb-0 align-middle table-modern">
                  <thead className="table-light sticky-top">
                    <tr>
                      <th style={{ width: '55%' }}>Action</th>
                      <th>User</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLogs.map(({ log_id, action, log_timestamp, first_name, last_name, email }) => {
                      const badge = actionBadge(action);
                      const kind = classifyAction(action);
                      return (
                        <tr key={log_id} className={`row-${kind}`}>
                          <td className="text-truncate" style={{ maxWidth: 720 }}>
                            <Badge bg={badge.bg} className="me-2 align-middle">{badge.text}</Badge>
                            <span className="align-middle">{action}</span>
                          </td>
                          <td className="text-body-secondary">
                            <div className="d-flex align-items-center gap-2">
                              <div className="avatar-mini">
                                {(first_name?.[0] || '').toUpperCase()}
                                {(last_name?.[0] || '').toUpperCase()}
                              </div>
                              <span>{[first_name, last_name].filter(Boolean).join(' ') || email || '—'}</span>
                            </div>
                          </td>
                          <td className="text-body-secondary" title={new Date(log_timestamp).toLocaleString()}>
                            {formatRelative(log_timestamp, now)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top bg-body rounded-bottom-3 flex-wrap gap-2">
                <div className="text-body-secondary small">Page {logsPage} of {logsTotalPages}</div>
                {renderPagination()}
              </div>
            </>
          ) : (
            <div className="text-center py-5 text-body-secondary">
              <svg width="88" height="88" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <div>No recent logs available.</div>
            </div>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}

// ======= Styles (scoped) =======
const styles = `
/* ===== TOKENS ===== */
:root {
  --hero-radius: 16px;
  --hero-min-h: 196px;   /* slim but roomy */
  --hero-avatar: 72px;
  --hero-glass-bg: rgba(255,255,255,.12);
  --hero-glass-br: rgba(255,255,255,.22);
  --hero-blur: blur(10px) saturate(1.15);
}

/* ===== CARD (gradient background) ===== */
.hero-card{
  background: linear-gradient(135deg,#1d4ed8 0%,#3b82f6 50%,#34d399 100%);
  background-size: 180% 180%;
  animation: heroShift 14s ease-in-out infinite;
  color:#fff;
  border-radius: var(--hero-radius);
  position: relative;
}
@keyframes heroShift{
  0%{background-position:0% 50%}
  50%{background-position:100% 50%}
  100%{background-position:0% 50%}
}
@media (prefers-reduced-motion: reduce){
  .hero-card{animation:none}
}

/* Body hosts the overlay and sets height */
.hero-body{
  position:relative;
  min-height:var(--hero-min-h);
}

/* ===== GLASS OVERLAY (exact same size as bg) ===== */
.hero-overlay{
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  backdrop-filter: var(--hero-blur);
  -webkit-backdrop-filter: var(--hero-blur);
  background: var(--hero-glass-bg);
  border:1px solid var(--hero-glass-br);
  border-radius: inherit;
  padding:16px;
}

/* ===== INLINE CONTENT ===== */
.hero-content > *{ white-space:nowrap }
.hero-title{
  font-size: clamp(1.4rem, 2.2vw, 2.25rem);
  line-height:1.1;
  letter-spacing:.2px;
}
.hero-avatar{
  width:var(--hero-avatar);
  height:var(--hero-avatar);
  font-weight:800;
  border:1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.22);
}
.hero-chip{
  padding:.45rem .8rem;
  font-weight:600;
  font-size:.9rem;
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
}
.hero-time{ font-size: clamp(1.25rem, 2vw, 2rem); line-height:1 }

/* ===== RESPONSIVE WRAP ===== */
@media (max-width: 992px){
  .hero-content{
    justify-content:center !important; /* center when wrapping */
    gap: .75rem 1rem;
  }
}
@media (max-width: 576px){
  :root{
    --hero-min-h: 164px;
    --hero-avatar: 60px;
  }
  .hero-content > *{ white-space:normal }
}

  /* ===== KPI aura ===== */
  .kpi-lg { position: relative; }
  .kpi-lg::before {
    content: "";
    position: absolute; right: -28px; top: -28px;
    width: 130px; height: 130px; border-radius: 50%;
    background: radial-gradient(closest-side, rgba(13,110,253,.12), transparent);
  }

  /* ===== Table ===== */
  .table-modern tbody tr:hover { background-color: var(--bs-tertiary-bg); }
  .table-modern thead.sticky-top { top: 0; z-index: 1; }

  .row-created  { box-shadow: inset 3px 0 0 0 #22c55e; }
  .row-updated  { box-shadow: inset 3px 0 0 0 #2563eb; }
  .row-deleted  { box-shadow: inset 3px 0 0 0 #ef4444; }
  .row-transfer { box-shadow: inset 3px 0 0 0 #f59e0b; }
  .row-info     { box-shadow: inset 3px 0 0 0 #9ca3af; }

  .avatar-mini {
    width: 26px; height: 26px; border-radius: 9999px;
    background: #e0f2fe; color: #2563eb;
    display:flex; align-items:center; justify-content:center;
    font-size: .7rem; font-weight: 700;
  }

  /* ===== Filter chips ===== */
  .chip {
    border: 1px solid var(--bs-border-color);
    background: var(--bs-body-bg);
    color: var(--bs-body-color);
    padding: .25rem .7rem; border-radius: 9999px; font-size: .8rem;
    transition: background-color .12s ease, color .12s ease, border-color .12s ease, transform .06s ease;
  }
  .chip:hover { transform: translateY(-1px); }
  .chip.active { background: var(--bs-primary); color: #fff; border-color: var(--bs-primary); }

  .filters-scroll { overflow-x: auto; padding-bottom: 2px; }
  .filters-scroll::-webkit-scrollbar { height: 6px; }
  .filters-scroll::-webkit-scrollbar-thumb { background: var(--bs-tertiary-bg); border-radius: 999px; }
`;
