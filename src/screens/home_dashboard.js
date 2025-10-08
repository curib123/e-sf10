// HomeDashboard.bootstrap.bigHeaderBigKPIs.jsx
// Bootstrap 5.3+ | Only header & KPI cards are larger; all other sections use normal/compact sizing.

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
  FaExchangeAlt,
  FaSchool,
  FaSearch,
  FaUserPlus,
  FaUsers,
  FaUserTie,
} from 'react-icons/fa';

import StatusModal from '../components/status_modal';
import { checkToken } from '../components/token_checker';

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const fmtTime = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtDate = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" });

// helpers
const clamp = (n, min, max) => Math.min(max, Math.max(min, Number(n) || 0));
function formatRelative(ts, now = Date.now()) {
  if (!ts) return "—";
  const d = typeof ts === "number" ? ts : new Date(ts).getTime();
  if (Number.isNaN(d)) return "—";
  const diff = Math.max(0, now - d);
  if (diff < 1000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleString();
}
const classifyAction = (action = "") => {
  const a = (action || "").toLowerCase();
  if (/(create|added|new)/.test(a)) return "created";
  if (/(update|edit|change)/.test(a)) return "updated";
  if (/(delete|remove)/.test(a)) return "deleted";
  if (/(transfer|move)/.test(a)) return "transfer";
  return "info";
};
const actionBadge = (action = "") => {
  const kind = classifyAction(action);
  const map = {
    created: { text: "Created", bg: "success" },
    updated: { text: "Updated", bg: "primary" },
    deleted: { text: "Deleted", bg: "danger" },
    transfer: { text: "Transfer", bg: "warning" },
    info: { text: "Info", bg: "secondary" },
  };
  return map[kind] || map.info;
};

const RingIcon = ({ children, tint = "var(--bs-primary)" }) => (
  <div className="d-inline-flex justify-content-center align-items-center position-relative" style={{ width: 44, height: 44 }}>
    <span className="position-absolute w-100 h-100 rounded-circle opacity-25" style={{ boxShadow: `inset 0 0 0 6px ${tint}33` }} />
    <span className="rounded-circle d-inline-flex justify-content-center align-items-center text-white" style={{ width: 36, height: 36, background: tint }}>
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

/**
 * StatCard — supports size "md" (default normal) and "lg" (bigger).
 * We'll render the KPI cards with size="lg" while keeping all other cards normal.
 */
const StatCard = ({ icon, label, value = 0, percent = 0, color, size = "md" }) => {
  const isLg = size === "lg";
  return (
    <Card className={`border-0 soft-shadow hover-lift h-100 rounded-${isLg ? 4 : 3} ${isLg ? "kpi-lg" : ""}`}>
      <Card.Body className={isLg ? "p-4" : "p-3 py-2"}>
        <div className="d-flex align-items-start gap-3">
          <RingIcon tint={color}>{icon}</RingIcon>
          <div className="flex-grow-1">
            <div className="text-body-secondary small">{label}</div>
            <div className="d-flex align-items-baseline justify-content-between mt-1">
              <div className={`fw-bold ${isLg ? "display-6 mb-0" : "fs-4"}`} style={{ color, lineHeight: 1 }}>
                <AnimatedNumber value={value} />
              </div>
              <Badge bg="light" text="dark" className={`rounded-pill ${isLg ? "fs-6" : ""}`}>
                {Math.round(clamp(percent, 0, 100))}%
              </Badge>
            </div>
            <ProgressBar
              now={clamp(percent, 0, 100)}
              className={isLg ? "mt-3" : "mt-2"}
              style={{ height: isLg ? 10 : 6, borderRadius: 999 }}
            />
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

const InfoItem = ({ title, children }) => (
  <Col md={4} className="mb-2">
    <div className="text-body-secondary small mb-1">{title}</div>
    <div className="fw-semibold text-truncate">{children || "—"}</div>
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

export default function HomeDashboard() {
  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState({ show: false, title: "", message: "", variant: "danger" });
  const [now, setNow] = useState(Date.now());

  // logs state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLimit, setLogsLimit] = useState(10);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsQuery, setLogsQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [compact, setCompact] = useState(false);

  // NEW: Active teachers + curriculum + enrolled count
  const [teacherCount, setTeacherCount] = useState(0);
  const [activeCurriculum, setActiveCurriculum] = useState(null);
  const [enrolledCountCurr, setEnrolledCountCurr] = useState(0);

  // derived filtered logs
  const visibleLogs = useMemo(() => {
    const q = (logsQuery || "").toLowerCase();
    return (logs || []).filter((l) => {
      const matchesQuery = q
        ? [l?.action, l?.first_name, l?.last_name, l?.email].filter(Boolean).join(" ").toLowerCase().includes(q)
        : true;
      const kind = classifyAction(l?.action || "");
      const matchesType = typeFilter === "all" ? true : kind === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [logs, logsQuery, typeFilter]);

  const handleError = (message) => setModal({ show: true, title: "Error", message, variant: "danger" });

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/dashboard`, { headers: authHeaders() });
      setDashboardData(data);
    } catch {
      handleError("Failed to fetch dashboard data.");
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
      handleError("Failed to fetch activity logs.");
    } finally {
      setLogsLoading(false);
    }
  }, [logsPage, logsLimit, token]);

  const fetchActiveTeachers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${BASE_URL}/teachers/active`, { headers: authHeaders() });
    const count = typeof data?.count === "number" ? data.count : Array.isArray(data?.data) ? data.data.length : 0;
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
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          params: { page: 1, limit: 1, curriculum_id: cid, status: "Enrolled" },
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

  // early returns
  if (loading) {
    return (
      <Container fluid className="p-3" style={{ minHeight: "100vh" }}>
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

  const { user = {}, studentStats = {}, schoolInfo = {} } = dashboardData;

  // KPIs
  const stats = [
    { icon: <FaUsers size={18} />, label: "Total Students", value: Number(studentStats.total_students) || 0, percent: 100, color: "var(--bs-primary)" },
    { icon: <FaExchangeAlt size={16} />, label: "Pending Transfers", value: Number(studentStats.pending_transfers) || 0, percent: 100, color: "var(--bs-info)" },
    { icon: <FaUserPlus size={16} />, label: "Recent Students", value: Number(studentStats.recent_students) || 0, percent: 100, color: "var(--bs-success)" },
  ];

  const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase();

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
    <Container fluid className="p-3" style={{ minHeight: "100vh" }}>
      <style>{styles}</style>

      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />

        {/* Hero (bigger) */}
<Row className="g-2 mb-3">
  <Col xs={12}>
    <Card className="hero-card border-0 rounded-3 soft-shadow overflow-hidden">
      <Card.Body className="p-2 p-lg-3 hero-xl">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-circle d-flex justify-content-center align-items-center flex-shrink-0 text-white hero-avatar-lg"
              aria-label="User initials"
            >
              {initials || <FaUsers size={22} />}
            </div>
            <div className="text-white">
              <div className="fw-semibold display-6 lh-base mb-1">
                Welcome{user.first_name ? `, ${user.first_name}` : ""}!
              </div>
              <div className="d-flex flex-wrap gap-2 mt-1">
                {(Array.isArray(user.roles) ? user.roles : [user.roles])
                  .filter(Boolean)
                  .map((r, i) => (
                    <Badge key={i} bg="light" text="dark" className="rounded-pill badge-hero">
                      {r}
                    </Badge>
                  ))}
              </div>
            </div>
          </div>
          <div className="text-end text-white">
            <div className="display-6 fw-bold">{fmtTime.format(now)}</div>
            <div className="opacity-75 fs-5">{fmtDate.format(now)}</div>
          </div>
        </div>
      </Card.Body>
    </Card>
  </Col>
</Row>

    {/* KPIs — ONLY these 3 are larger */}
      <Row className="g-2 mb-2">
        {stats.map((s, i) => (
          <Col key={i} xs={12} sm={6} md={4}>
            <StatCard icon={s.icon} label={s.label} value={s.value} percent={s.percent} color={s.color} size="lg" />
          </Col>
        ))}
      </Row>
      {/* School & Curriculum Info (normal size) */}
      <Card className="mb-2 soft-shadow border-0 rounded-3">
        <Card.Header className="bg-body border-0 fw-semibold text-primary d-flex align-items-center py-2">
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
              {schoolInfo.school_head} <FaUserTie className="text-body-tertiary ms-1" />
            </InfoItem>
          </Row>
          <Row className="mt-1">
            <InfoItem title="Active Curriculum">{activeCurriculum?.curriculum_name}</InfoItem>
            <InfoItem title="Effective Year">{activeCurriculum?.school_year_period}</InfoItem>
            <InfoItem title="Subjects in Curriculum">{(activeCurriculum?.subjects || []).length}</InfoItem>
          </Row>
        </Card.Body>
      </Card>

     

      {/* Quick Actions + Status (normal) */}
      <Row className="g-2 mb-2">
        <Col md={4} lg={3}>
          <Card className="soft-shadow rounded-3 border-0 h-100">
            <Card.Body className="p-3 d-flex flex-column gap-2">
              <div className="fw-semibold">Quick Actions</div>
              <div className="d-grid gap-2">
                <Button variant="primary" size="sm" onClick={() => window.location.assign("/student_information")}>
                  View Students
                </Button>
                <Button variant="outline-primary" size="sm" onClick={() => window.location.assign("/add_student")}>
                  Add Student
                </Button>
                <Button variant="outline-secondary" size="sm" onClick={() => window.location.assign("/enrollments")}>
                  Enrollments
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={8} lg={9}>
          <Card className="soft-shadow rounded-3 border-0 h-100">
            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
              <div>
                <div className="fw-semibold">System Status</div>
                <div className="text-body-secondary small">All services operational</div>
              </div>
              <span className="status-dot online" title="Operational" />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Activity (normal) */}
      <Card className="soft-shadow border-0 rounded-3">
        <Card.Header className="bg-body border-0 fw-semibold text-primary d-flex align-items-center justify-content-between flex-wrap gap-2 py-2">
          <span>Recent Activity</span>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="d-flex gap-1 filters-scroll">
              {[
                { id: "all", label: "All" },
                { id: "created", label: "Created" },
                { id: "updated", label: "Updated" },
                { id: "deleted", label: "Deleted" },
                { id: "transfer", label: "Transfer" },
                { id: "info", label: "Info" },
              ].map((f) => (
                <button
                  key={f.id}
                  className={`chip ${typeFilter === f.id ? "active" : ""}`}
                  onClick={() => setTypeFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <InputGroup size="sm" style={{ width: 240 }}>
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

            <div className="form-check form-switch ms-1">
              <input className="form-check-input" type="checkbox" role="switch" id="densitySwitch"
                checked={compact} onChange={(e) => setCompact(e.target.checked)} />
              <label className="form-check-label small text-body-secondary" htmlFor="densitySwitch">
                {compact ? "Compact" : "Cozy"}
              </label>
            </div>
          </div>
        </Card.Header>

        <Card.Body className="p-0">
          {logsLoading ? (
            <div className="p-3"><SkeletonCard /></div>
          ) : visibleLogs?.length ? (
            <>
              <div className="table-responsive">
                <Table hover size={compact ? "sm" : undefined} className="mb-0 align-middle table-modern">
                  <thead className="table-light sticky-top">
                    <tr>
                      <th style={{ width: "55%" }}>Action</th>
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
                                {(first_name?.[0] || "").toUpperCase()}
                                {(last_name?.[0] || "").toUpperCase()}
                              </div>
                              <span>{[first_name, last_name].filter(Boolean).join(" ") || email || "—"}</span>
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

  function exportLogsCsv() {
    try {
      const headers = ["log_id", "action", "user", "email", "timestamp"];
      const rows = visibleLogs.map((l) => [
        l.log_id,
        (l.action || "").replace(/\n|\r/g, " "),
        [l.first_name, l.last_name].filter(Boolean).join(" "),
        l.email || "",
        new Date(l.log_timestamp).toISOString(),
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `activity_logs_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      handleError("Failed to export CSV.");
    }
  }
}

// ----- styles (scoped) -----
const styles = `
  :root {
    --shadow: 0 6px 16px rgba(16,24,40,.06);
    --shadow-lg: 0 12px 24px rgba(16,24,40,.10);
  }
  .soft-shadow { box-shadow: var(--shadow); background: var(--bs-body-bg); }
  .hover-lift { transition: transform .16s ease, box-shadow .16s ease; }
  .hover-lift:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }

  /* Header chip (bigger only when .brand-chip-lg is added) */
  .brand-chip {
    display:inline-flex; align-items:center;
    padding:.35rem .6rem; border-radius:999px;
    background: var(--bs-body-bg);
    border: 1px solid var(--bs-border-color);
    box-shadow: 0 4px 12px rgba(0,0,0,.04);
    font-weight: 700; font-size: .95rem;
  }
  .brand-chip-lg {
    padding: .6rem .9rem;
    font-weight: 800;
    font-size: 1.05rem;
  }

  /* Hero */
/* Animated gradient for the hero */
.hero-card {
  /* same colors, we just animate their positions */
  background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #34d399 100%);
  background-size: 150% 150%;
  animation: heroGradientShift 14s ease-in-out infinite;
  color: #fff;
}

/* Smoothly move the gradient stops around */
@keyframes heroGradientShift {
  0%   { background-position: 0% 50%; }
  25%  { background-position: 50% 100%; }
  50%  { background-position: 100% 50%; }
  75%  { background-position: 50% 0%; }
  100% { background-position: 0% 50%; }
}

/* Respect users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  .hero-card { animation: none; }
}
  .hero-tall { min-height: 150px; } /* only hero is taller; rest of the page stays normal */
  .hero-avatar-sm { width: 48px; height: 48px; font-size: .95rem; font-weight: 700; background: rgba(255,255,255,.22); }

  /* KPI big aura applies only to big KPI cards */
  .kpi-lg::before {
    content: ""; position: absolute; right: -28px; top: -28px;
    width: 130px; height: 130px; border-radius: 50%;
    background: radial-gradient(closest-side, rgba(13,110,253,.12), transparent);
  }

  /* Table */
  .table-modern tbody tr:hover { background-color: var(--bs-tertiary-bg); }
  .table-modern thead.sticky-top { top: 0; z-index: 1; }
  .row-created { box-shadow: inset 3px 0 0 0 #22c55e; }
  .row-updated { box-shadow: inset 3px 0 0 0 #2563eb; }
  .row-deleted { box-shadow: inset 3px 0 0 0 #ef4444; }
  .row-transfer { box-shadow: inset 3px 0 0 0 #f59e0b; }
  .row-info { box-shadow: inset 3px 0 0 0 #9ca3af; }

  .avatar-mini {
    width: 26px; height: 26px; border-radius: 9999px;
    background: #e0f2fe; color: #2563eb;
    display:flex; align-items:center; justify-content:center;
    font-size: .7rem; font-weight: 700;
  }
    /* Bigger hero */
.hero-xl { min-height: 200px; }                  /* height up from 150px */
@media (min-width: 992px) {
  .hero-xl { min-height: 240px; }               /* roomier on lg+ */
}

/* Larger avatar for hero */
.hero-avatar-lg {
  width: 72px;
  height: 72px;
  font-size: 1.15rem;
  font-weight: 800;
  background: rgba(255,255,255,.22);
  border: 1px solid rgba(255,255,255,.18);
  backdrop-filter: saturate(1.1);
}

/* Slightly larger role badges in the hero */
.badge-hero {
  padding: .45rem .75rem;
  font-weight: 600;
  font-size: .95rem;
}


  .status-dot { width: 14px; height: 14px; border-radius: 9999px; box-shadow: 0 0 0 6px rgba(16,185,129,.12); }
  .status-dot.online { background: radial-gradient(circle at 35% 35%, #6ee7b7, #10b981); }

  /* Filter chips */
  .chip { border: 1px solid var(--bs-border-color); background: var(--bs-body-bg); color: var(--bs-body-color); padding: .2rem .6rem; border-radius: 9999px; font-size: .8rem; }
  .chip.active { background: var(--bs-primary); color: #fff; border-color: var(--bs-primary); }
  .filters-scroll { overflow-x: auto; padding-bottom: 2px; }
  .filters-scroll::-webkit-scrollbar { height: 6px; }
  .filters-scroll::-webkit-scrollbar-thumb { background: var(--bs-tertiary-bg); border-radius: 999px; }
`;


