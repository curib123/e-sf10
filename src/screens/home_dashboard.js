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
  FaSyncAlt,
  FaUserPlus,
  FaUsers,
  FaUserTie,
} from 'react-icons/fa';

import StatusModal from '../components/status_modal';
import { checkToken } from '../components/token_checker';

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const fmtTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtDate = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' });

// helpers
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

const RingIcon = ({ children, tint = '#2563eb' }) => (
  <div className="d-inline-flex justify-content-center align-items-center position-relative" style={{ width: 48, height: 48 }}>
    <span className="position-absolute w-100 h-100 rounded-circle opacity-25" style={{ boxShadow: `inset 0 0 0 8px ${tint}33` }} />
    <span className="rounded-circle d-inline-flex justify-content-center align-items-center text-white" style={{ width: 40, height: 40, background: tint }}>
      {children}
    </span>
  </div>
);

function AnimatedNumber({ value = 0, duration = 700 }) {
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

const StatCard = ({ icon, label, value = 0, percent = 0, color }) => (
  <Card className="border-0 soft-shadow hover-lift h-100 rounded-4 kpi-card">
    <Card.Body className="p-3">
      <div className="d-flex align-items-start gap-3">
        <RingIcon tint={color}>{icon}</RingIcon>
        <div className="flex-grow-1">
          <div className="text-muted small">{label}</div>
          <div className="d-flex align-items-baseline justify-content-between mt-1">
            <div className="fw-bold fs-3 kpi-number" style={{ color }}>
              <AnimatedNumber value={value} />
            </div>
            <Badge bg="light" text="dark" className="rounded-pill">
              {Math.round(clamp(percent, 0, 100))}%
            </Badge>
          </div>
          <ProgressBar now={clamp(percent, 0, 100)} className="mt-2" style={{ height: 6, borderRadius: 6, background: 'rgba(0,0,0,.06)' }} />
        </div>
      </div>
    </Card.Body>
  </Card>
);

const InfoItem = ({ title, children }) => (
  <Col md={4} className="mb-3">
    <div className="text-muted small mb-1">{title}</div>
    <div className="fw-semibold text-truncate" title={children || '—'}>
      {children || '—'}
    </div>
  </Col>
);

const SkeletonCard = () => (
  <Card className="soft-shadow border-0 rounded-4">
    <Card.Body className="p-4">
      <Placeholder as="div" animation="wave">
        <Placeholder xs={3} className="mb-3" />
        <Placeholder xs={8} className="mb-2" />
        <Placeholder xs={6} />
      </Placeholder>
    </Card.Body>
  </Card>
);

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
      const matchesQuery = q
        ? [l?.action, l?.first_name, l?.last_name, l?.email].filter(Boolean).join(' ').toLowerCase().includes(q)
        : true;
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
    } catch (e) {
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
    } catch (e) {
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

  const fetchEnrolledCountForActiveCurriculum = useCallback(async (curr) => {
    const cid = curr?.curriculum_id ?? curr?.curriculumId ?? curr?.id;
    if (!cid) return;
    try {
      const { data } = await axios.get(`${BASE_URL}/enrollments`, {
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        params: { page: 1, limit: 1, curriculum_id: cid, status: 'Enrolled' },
      });
      const total =
        Number(data?.pagination?.total) ||
        (Array.isArray(data?.data) ? data.data.length : 0);
      setEnrolledCountCurr(Number(total || 0));
    } catch {}
  }, [token]);

  useEffect(() => { checkToken(); }, []);
  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchActiveTeachers(); fetchActiveCurriculum(); }, [fetchActiveTeachers, fetchActiveCurriculum]);
  useEffect(() => { if (activeCurriculum) fetchEnrolledCountForActiveCurriculum(activeCurriculum); }, [activeCurriculum, fetchEnrolledCountForActiveCurriculum]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // early returns
  if (loading) {
    return (
      <Container fluid className="p-4" style={{ minHeight: '100vh', background: 'var(--app-bg)' }}>
        <style>{styles}</style>
        <Row className="g-4">
          <Col lg={8}><SkeletonCard /></Col>
          <Col lg={4}><SkeletonCard /></Col>
          <Col xs={12}><SkeletonCard /></Col>
          <Col md={4}><SkeletonCard /></Col>
          <Col md={4}><SkeletonCard /></Col>
          <Col md={4}><SkeletonCard /></Col>
          <Col xs={12}><SkeletonCard /></Col>
        </Row>
      </Container>
    );
  }
  if (!dashboardData) return null;

  const { user = {}, studentStats = {}, schoolInfo = {} } = dashboardData;

  // KPIs
  const stats = [
    { icon: <FaUsers size={20} />, label: 'Total Students', value: Number(studentStats.total_students) || 0, percent: 100, color: '#2563eb' },
    { icon: <FaExchangeAlt size={18} />, label: 'Pending Transfers', value: Number(studentStats.pending_transfers) || 0, percent: 100, color: '#0ea5e9' },
    { icon: <FaUserPlus size={18} />, label: 'Recent Students', value: Number(studentStats.recent_students) || 0, percent: 100, color: '#22c55e' },
  ];

  const colPropsFor = (count) => (count === 1
    ? { xs: 12, sm: 12, md: 12, lg: 12 }
    : count === 2
    ? { xs: 12, sm: 6, md: 6, lg: 6 }
    : { xs: 12, sm: 6, md: 4, lg: 4 });
  const kpiCol = colPropsFor(stats.length);

  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase();

  const renderPagination = () => (
    <Pagination className="mb-0">
      <Pagination.First disabled={logsPage <= 1} onClick={() => setLogsPage(1)} />
      <Pagination.Prev disabled={logsPage <= 1} onClick={() => setLogsPage((p) => Math.max(1, p - 1))} />
      <Pagination.Item active>{logsPage}</Pagination.Item>
      <Pagination.Next disabled={logsPage >= logsTotalPages} onClick={() => setLogsPage((p) => Math.min(logsTotalPages, p + 1))} />
      <Pagination.Last disabled={logsPage >= logsTotalPages} onClick={() => setLogsPage(logsTotalPages)} />
    </Pagination>
  );

  return (
    <Container fluid className="p-3 p-md-4" style={{ minHeight: '100vh' }}>
      <style>{styles}</style>

      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />

      {/* Topbar */}
      <Row className="align-items-center mb-3 g-2">
        <Col sm={6} className="d-flex align-items-center gap-3">
          <div
            className="brand-pill text-truncate"
            title={activeCurriculum?.curriculum_name || schoolInfo?.school_name || 'Dashboard'}
          >
            {activeCurriculum?.curriculum_name || schoolInfo?.school_name || 'Dashboard'}
          </div>
        </Col>
        <Col sm={6} className="d-flex justify-content-sm-end justify-content-start gap-2 flex-wrap">
          <Button
            variant="light"
            className="btn-soft d-flex align-items-center gap-2"
            onClick={() => {
              fetchDashboard();
              fetchLogs();
              fetchActiveTeachers();
              fetchActiveCurriculum();
              if (activeCurriculum) fetchEnrolledCountForActiveCurriculum(activeCurriculum);
            }}
          >
            <FaSyncAlt /> Refresh
          </Button>
          <Button variant="light" className="btn-soft d-flex align-items-center gap-2" onClick={exportLogsCsv}>
            <FaDownload /> Export CSV
          </Button>
          {/* Theme switcher removed */}
        </Col>
      </Row>

      {/* Slim full-width hero (no blur) */}
      <Row className="g-3 mb-3">
        <Col xs={12}>
          <Card className="hero-card border-0 rounded-4 overflow-hidden soft-shadow">
            <Card.Body className="p-3 p-md-4 hero-body hero-slim">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                <div className="d-flex align-items-center gap-3">
                  <div className="rounded-circle d-flex justify-content-center align-items-center flex-shrink-0 text-white hero-avatar hero-avatar-slim" aria-label="User initials">
                    {initials || <FaUsers size={18} />}
                  </div>
                  <div className="text-white">
                    <div className="fw-semibold fs-5 mb-0 lh-base">
                      Welcome{user.first_name ? `, ${user.first_name}` : ''}!
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-1">
                      {(Array.isArray(user.roles) ? user.roles : [user.roles])
                        .filter(Boolean)
                        .map((r, i) => (
                          <Badge key={i} bg="light" text="dark">
                            {r}
                          </Badge>
                        ))}
                    </div>
                  </div>
                </div>
                <div className="text-end text-white hero-clock hero-clock-slim">
                  <div className="fw-bold fs-5">{fmtTime.format(now)}</div>
                  <div className="opacity-75 small">{fmtDate.format(now)}</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* School & Curriculum Info */}
      <Card className="mb-3 soft-shadow border-0 rounded-4">
        <Card.Header className="bg-white border-0 fw-bold text-primary d-flex align-items-center">
          <FaSchool className="me-2" /> School Information
        </Card.Header>
        <Card.Body className="pt-2">
          <Row className="mb-2">
            <InfoItem title="Name">{schoolInfo.school_name}</InfoItem>
            <InfoItem title="Region">{schoolInfo.region}</InfoItem>
            <InfoItem title="District">{schoolInfo.district}</InfoItem>
          </Row>
          <Row>
            <InfoItem title="Address">{schoolInfo.school_address}</InfoItem>
            <InfoItem title="Division">{schoolInfo.division}</InfoItem>
            <InfoItem title="School Head">
              {schoolInfo.school_head} <FaUserTie className="text-muted ms-1" />
            </InfoItem>
          </Row>
          <Row className="mt-1">
            <InfoItem title="Active Curriculum">{activeCurriculum?.curriculum_name}</InfoItem>
            <InfoItem title="Effective Year">{activeCurriculum?.school_year_period}</InfoItem>
            <InfoItem title="Subjects in Curriculum">{(activeCurriculum?.subjects || []).length}</InfoItem>
          </Row>
        </Card.Body>
      </Card>

      {/* KPIs */}
      <Row className="g-3 mb-3">
        {stats.map((s, i) => (
          <Col key={i} {...kpiCol}>
            <StatCard icon={s.icon} label={s.label} value={s.value} percent={s.percent} color={s.color} />
          </Col>
        ))}
      </Row>

      {/* Quick Actions + Status */}
      <Row className="g-3 mb-3">
        <Col md={6} lg={3}>
          <Card className="soft-shadow rounded-4 border-0 h-100">
            <Card.Body className="p-3 d-flex flex-column gap-2">
              <div className="fw-semibold">Quick Actions</div>
              <div className="d-grid gap-2">
                <Button variant="primary" size="sm" className="btn-elevate" onClick={() => window.location.assign('/student_information')}>
                  View Students
                </Button>
                <Button variant="outline-primary" size="sm" className="btn-elevate" onClick={() => window.location.assign('/add_student')}>
                  Add Student
                </Button>
                <Button variant="outline-secondary" size="sm" className="btn-elevate" onClick={() => window.location.assign('/enrollments')}>
                  Enrollments
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={9}>
          <Card className="soft-shadow rounded-4 border-0 h-100">
            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
              <div>
                <div className="fw-semibold">System Status</div>
                <div className="text-muted small">All services operational</div>
              </div>
              <div className="status-dot online" title="Operational" />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Activity (logs) */}
      <Card className="soft-shadow border-0 rounded-4">
        <Card.Header className="bg-white border-0 fw-bold text-primary d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span>Recent Activity</span>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="filter-chips d-flex gap-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'created', label: 'Created' },
                { id: 'updated', label: 'Updated' },
                { id: 'deleted', label: 'Deleted' },
                { id: 'transfer', label: 'Transfer' },
                { id: 'info', label: 'Info' },
              ].map((f) => (
                <button
                  key={f.id}
                  className={`chip ${typeFilter === f.id ? 'active' : ''}`}
                  onClick={() => setTypeFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <InputGroup size="sm" style={{ width: 260 }}>
              <InputGroup.Text><FaSearch /></InputGroup.Text>
              <Form.Control placeholder="Search logs..." value={logsQuery} onChange={(e) => setLogsQuery(e.target.value)} />
            </InputGroup>
            <Form.Select
              size="sm"
              value={logsLimit}
              onChange={(e) => { setLogsLimit(Number(e.target.value)); setLogsPage(1); }}
              style={{ width: 110 }}
            >
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}/page</option>)}
            </Form.Select>
            <Form.Check
              type="switch"
              id="density-switch"
              checked={compact}
              onChange={(e) => setCompact(e.target.checked)}
              label={<span className="small text-muted">{compact ? 'Compact' : 'Cozy'}</span>}
            />
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {logsLoading ? (
            <div className="p-4"><SkeletonCard /></div>
          ) : visibleLogs?.length ? (
            <>
              <div className="table-responsive">
                <Table hover className={`mb-0 align-middle table-modern ${compact ? 'table-compact' : ''}`}>
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
                          <td className="text-truncate" style={{ maxWidth: 560 }}>
                            <Badge bg={badge.bg} className="me-2 align-middle">{badge.text}</Badge>
                            <span className="align-middle">{action}</span>
                          </td>
                          <td className="text-muted">
                            <div className="d-flex align-items-center gap-2">
                              <div className="avatar-mini">
                                {(first_name?.[0] || '').toUpperCase()}
                                {(last_name?.[0] || '').toUpperCase()}
                              </div>
                              <span>{[first_name, last_name].filter(Boolean).join(' ') || email || '—'}</span>
                            </div>
                          </td>
                          <td className="text-muted" title={new Date(log_timestamp).toLocaleString()}>
                            {formatRelative(log_timestamp, now)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top bg-white rounded-bottom-4 flex-wrap gap-2">
                <div className="text-muted small">Page {logsPage} of {logsTotalPages}</div>
                {renderPagination()}
              </div>
            </>
          ) : (
            <div className="text-center py-5 text-muted">
              <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
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

  function exportLogsCsv() {
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
  }
}

// ----- styles (scoped)
const styles = `
  :root {
    /* Clean blue theme (no indigo) */
    --app-bg: radial-gradient(1200px 600px at 20% -10%, #eaf2ff 0%, transparent 40%), linear-gradient(180deg, #f7faff, #eef5ff 60%, #f7faff 100%);
    --card-bg: #ffffff;
    --text: #1f2937;
    --muted: #6b7280;
    --border: rgba(0,0,0,.08);
    --hover: #f8fafc;
    --shadow: 0 6px 24px rgba(17,24,39,.06);
    --shadow-lg: 0 12px 28px rgba(17,24,39,.10);
    --accent: #2563eb; /* blue-600 */
    --accent-2: #3b82f6; /* blue-500 */

    /* HERO palette (blue family) */
    --hero-1: #1d4ed8; /* blue-700 */
    --hero-2: #2563eb; /* blue-600 */
    --hero-3: #60a5fa; /* blue-400 */
  }

  .soft-shadow { box-shadow: var(--shadow); background: var(--card-bg); color: var(--text); }
  .hover-lift { transition: transform .18s ease, box-shadow .18s ease; }
  .hover-lift:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }

  /* === SLIM HERO (no blur, full width) === */
  .hero-card {
    position: relative;
    border: 0;
    background:
      radial-gradient(600px 360px at 110% -20%, rgba(255,255,255,.30), transparent 60%),
      radial-gradient(480px 320px at -20% 120%, rgba(255,255,255,.18), transparent 60%),
      linear-gradient(135deg, var(--hero-1), var(--hero-2), var(--hero-3));
    background-repeat: no-repeat, no-repeat, no-repeat;
    background-size: cover, cover, 200% 200%;
    background-position: center, center, 0% 50%;
    animation: heroMove 18s ease-in-out infinite;
    overflow: hidden;
  }
  .hero-body { min-height: clamp(120px, 18vh, 220px); }
  .hero-card::after {
    content: "";
    position: absolute; inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
    background-size: 24px 24px;
    mix-blend-mode: overlay;
  }
  @keyframes heroMove {
    0%   { background-position: center, center, 0% 50%; }
    50%  { background-position: center, center, 100% 50%; }
    100% { background-position: center, center, 0% 50%; }
  }
  .hero-avatar { width: 72px; height: 72px; font-size: 1.25rem; font-weight: 700; background: rgba(255,255,255,.20); }
  .hero-avatar-slim { width: 56px; height: 56px; font-size: 1rem; }
  .hero-clock { text-shadow: 0 1px 0 rgba(0,0,0,.25); }
  .hero-clock-slim .fs-5 { font-weight: 700; }

  .brand-pill {
    font-weight: 700; font-size: 1.05rem; padding: .45rem .75rem; border-radius: 9999px;
    background: var(--card-bg); color: var(--text);
    box-shadow: 0 4px 16px rgba(33,37,41,.06); border: 1px solid var(--border);
  }

  .btn-soft { border: 1px solid var(--border) !important; background: var(--card-bg) !important; color: var(--text) !important; }
  .btn-soft:hover { filter: brightness(0.98); }
  .btn-elevate { box-shadow: var(--shadow); }

  .kpi-card { position: relative; overflow: hidden; }
  .kpi-card::before { content: ""; position: absolute; right: -28px; top: -28px; width: 110px; height: 110px; border-radius: 50%; background: radial-gradient(closest-side, rgba(37,99,235,.12), transparent); }
  .kpi-number { letter-spacing: .2px; }

  .table-modern { color: var(--text); }
  .table-modern tbody tr { transition: background-color .15s ease, box-shadow .15s ease; }
  .table-modern tbody tr:hover { background-color: var(--hover); }
  .table-modern thead.sticky-top { top: 0; z-index: 1; background: var(--card-bg); }
  .table-compact td, .table-compact th { padding-top: .35rem !important; padding-bottom: .35rem !important; }

  .row-created { box-shadow: inset 3px 0 0 0 #22c55e; }
  .row-updated { box-shadow: inset 3px 0 0 0 #2563eb; }
  .row-deleted { box-shadow: inset 3px 0 0 0 #ef4444; }
  .row-transfer { box-shadow: inset 3px 0 0 0 #f59e0b; }
  .row-info { box-shadow: inset 3px 0 0 0 #9ca3af; }

  .avatar-mini {
    width: 28px; height: 28px; border-radius: 9999px;
    background: #e0f2fe; /* sky-100 */
    color: #2563eb; /* blue-600 */
    display:flex; align-items:center; justify-content:center;
    font-size: .7rem; font-weight: 700;
  }

  .status-dot { width: 14px; height: 14px; border-radius: 9999px; box-shadow: 0 0 0 6px rgba(16,185,129,.12); }
  .status-dot.online { background: radial-gradient(circle at 35% 35%, #6ee7b7, #10b981); }

  .chip { border: 1px solid var(--border); background: var(--card-bg); color: var(--text); padding: .25rem .5rem; border-radius: 9999px; font-size: .8rem; }
  .chip.active { background: var(--accent); color: #fff; border-color: transparent; }
`;
