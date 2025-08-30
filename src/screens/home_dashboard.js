import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { checkToken } from "../components/token_checker";
import StatusModal from "../components/status_modal";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Badge,
  ProgressBar,
  Spinner,
  Placeholder,
} from "react-bootstrap";
import {
  FaUsers,
  FaUserPlus,
  FaExchangeAlt,
  FaSchool,
  FaUserTie,
  FaClock,
} from "react-icons/fa";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const fmtTime = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const fmtDate = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const StatCard = ({ icon, label, value = 0, percent = 0, color }) => (
  <Card className="shadow-sm border-0 h-100 rounded-4">
    <Card.Body className="text-center p-4">
      <div
        className="d-inline-flex justify-content-center align-items-center rounded-circle mb-3"
        style={{ width: 56, height: 56, backgroundColor: color }}
      >
        {icon}
      </div>
      <div className="text-muted small">{label}</div>
      <div className="fw-bold fs-3 mb-3" style={{ color }}>
        {value?.toLocaleString?.() ?? value}
      </div>
      <ProgressBar
        now={Math.min(100, Math.max(0, percent))}
        style={{ height: 8, borderRadius: 6 }}
        className="bg-body-tertiary"
      />
    </Card.Body>
  </Card>
);

const InfoItem = ({ title, children }) => (
  <Col md={4} className="mb-2">
    <div className="text-muted small">{title}</div>
    <div className="fw-semibold">{children || "—"}</div>
  </Col>
);

const SkeletonCard = () => (
  <Card className="shadow-sm border-0 rounded-4">
    <Card.Body className="p-4">
      <Placeholder as="div" animation="wave">
        <Placeholder xs={3} className="mb-3" />
        <Placeholder xs={8} className="mb-2" />
        <Placeholder xs={6} />
      </Placeholder>
    </Card.Body>
  </Card>
);

const HomeDashboard = () => {
  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "danger",
  });
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    checkToken();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${BASE_URL}/dashboard`, {
          headers: authHeaders(),
        });
        if (mounted) setDashboardData(data);
      } catch {
        setModal({
          show: true,
          title: "Error",
          message: "Failed to fetch dashboard data.",
          variant: "danger",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <Container fluid className="p-4 bg-light min-vh-100">
        <Row className="g-4">
          <Col lg={8}>
            <SkeletonCard />
          </Col>
          <Col lg={4}>
            <SkeletonCard />
          </Col>
          <Col xs={12}>
            <SkeletonCard />
          </Col>
          <Col md={4}>
            <SkeletonCard />
          </Col>
          <Col md={4}>
            <SkeletonCard />
          </Col>
          <Col md={4}>
            <SkeletonCard />
          </Col>
          <Col xs={12}>
            <SkeletonCard />
          </Col>
        </Row>
      </Container>
    );
  }

  if (!dashboardData) return null;

  const { user = {}, studentStats = {}, schoolInfo = {}, recentLogs = [] } =
    dashboardData;

  const total = Number(studentStats.total_students || 0);
  const pct = (n) => (total ? (Number(n || 0) / total) * 100 : 0);

  const stats = [
    {
      icon: <FaUsers size={24} className="text-white" />,
      label: "Total Students",
      value: total,
      percent: 100,
      color: "#3b82f6",
    },
    {
      icon: <FaUserPlus size={24} className="text-white" />,
      label: "Recent Students",
      value: studentStats.recent_students || 0,
      percent: pct(studentStats.recent_students),
      color: "#10b981",
    },
    {
      icon: <FaExchangeAlt size={24} className="text-white" />,
      label: "Pending Transfers",
      value: studentStats.pending_transfers || 0,
      percent: pct(studentStats.pending_transfers),
      color: "#ef4444",
    },
  ];

  const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase();

  return (
    <Container
      fluid
      className="p-4"
      style={{ backgroundColor: "#f8f9fb", minHeight: "100vh" }}
    >
      <StatusModal
        {...modal}
        onHide={() => setModal((m) => ({ ...m, show: false }))}
      />

      {/* Welcome + Clock */}
      <Row className="g-3 mb-4">
        <Col lg={8} md={12}>
          <Card
            className="border-0 shadow-sm rounded-4 overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(99,102,241,.95), rgba(59,130,246,.95))",
            }}
          >
            <Card.Body className="p-4 d-flex align-items-center gap-3 gap-md-4">
              <div
                className="rounded-circle d-flex justify-content-center align-items-center flex-shrink-0 text-white"
                style={{
                  width: 76,
                  height: 76,
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  background: "rgba(255,255,255,.2)",
                }}
                aria-label="User initials"
              >
                {initials || <FaUsers />}
              </div>
              <div className="text-white">
                <div className="fw-bold fs-5 mb-1">
                  Welcome back{user.first_name ? `, ${user.first_name}` : ""}! 👋
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {(Array.isArray(user.roles) ? user.roles : [user.roles])
                    .filter(Boolean)
                    .map((r, i) => (
                      <Badge key={i} bg="light" text="dark">
                        {r}
                      </Badge>
                    ))}
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4} md={12}>
          <Card className="shadow-sm border-0 rounded-4 h-100">
            <Card.Body className="py-4 d-flex flex-column align-items-center justify-content-center text-center">
              <FaClock size={22} className="text-primary mb-2" />
              <div className="fw-bold fs-4">{fmtTime.format(now)}</div>
              <div className="text-muted small">{fmtDate.format(now)}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* School Info */}
      <Card className="mb-4 shadow-sm border-0 rounded-4">
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
        </Card.Body>
      </Card>

      {/* Stats */}
      <Row className="g-4 mb-4">
        {stats.map((s, i) => (
          <Col key={i} md={4}>
            <StatCard {...s} />
          </Col>
        ))}
      </Row>

      {/* Recent Activity */}
      <Card className="shadow-sm border-0 rounded-4">
        <Card.Header className="bg-white border-0 fw-bold text-primary">
          Recent Activity
        </Card.Header>
        <Card.Body className="p-0">
          {recentLogs?.length ? (
            <Table hover responsive className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Action</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map(({ log_id, action, log_timestamp }) => (
                  <tr key={log_id}>
                    <td className="text-truncate" style={{ maxWidth: 560 }}>
                      {action}
                    </td>
                    <td className="text-muted">
                      {new Date(log_timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="text-center py-4 text-muted">
              No recent logs available.
            </div>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default HomeDashboard;
