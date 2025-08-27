import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { checkToken } from '../components/token_checker';
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Badge,
  ProgressBar,
  Spinner
} from 'react-bootstrap';
import {
  FaUsers,
  FaUserPlus,
  FaExchangeAlt,
  FaSchool,
  FaUserTie,
  FaClock
} from 'react-icons/fa';

const Home = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const token = sessionStorage.getItem('token');

  useEffect(() => { checkToken(); }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await axios.get('http://localhost:3001/esf10/dashboard', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDashboardData(data);
      } catch {
        setFetchError('⚠️ Failed to fetch dashboard data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [token]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="d-flex vh-100 justify-content-center align-items-center bg-light">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <Container className="mt-5">
        <Card className="shadow-sm border-0 rounded-4">
          <Card.Body className="text-center text-danger fw-semibold">{fetchError}</Card.Body>
        </Card>
      </Container>
    );
  }

  const { user, studentStats, schoolInfo, recentLogs } = dashboardData;
  const calculatePercent = (count) => studentStats.total_students > 0 ? (count / studentStats.total_students) * 100 : 0;

  return (
    <Container fluid className="p-4" style={{ backgroundColor: '#f0f2f7', minHeight: '100vh' }}>
      
      {/* Welcome + Time */}
      <Row className="mb-4 g-3">
        <Col lg={8} md={12}>
          <Card className="border-0 shadow rounded-4 text-white" style={{ background: 'linear-gradient(135deg, #4f46e5, #3b82f6)' }}>
            <Card.Body className="d-flex align-items-center gap-4 p-4">
              <div
                className="rounded-circle d-flex justify-content-center align-items-center flex-shrink-0"
                style={{ width: 80, height: 80, fontSize: '1.7rem', fontWeight: 600, background: 'rgba(255,255,255,0.2)' }}
              >
                {user.first_name[0]}{user.last_name[0]}
              </div>
              <div>
                <h4 className="mb-1 fw-bold">Welcome back, {user.first_name}! 👋</h4>
                <Badge bg="light" text="dark">{user.roles}</Badge>
              </div>
            </Card.Body>
          </Card>
        </Col>
       <Col lg={4} md={12}>
  <Card className="shadow border-0 rounded-4">
    <Card.Body className="d-flex flex-column justify-content-center align-items-center py-4">
      <FaClock size={28} className="text-primary mb-2" />
      <h5 className="fw-bold mb-1">{currentTime.toLocaleTimeString()}</h5>
      <small className="text-muted">{currentTime.toLocaleDateString()}</small>
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
            <Col md={4}><strong>Name:</strong> {schoolInfo.school_name}</Col>
            <Col md={4}><strong>Region:</strong> {schoolInfo.region}</Col>
            <Col md={4}><strong>District:</strong> {schoolInfo.district}</Col>
          </Row>
          <Row>
            <Col md={4}><strong>Address:</strong> {schoolInfo.school_address}</Col>
            <Col md={4}><strong>Division:</strong> {schoolInfo.division}</Col>
            <Col md={4}>
              <strong>School Head:</strong> {schoolInfo.school_head} <FaUserTie className="text-muted ms-1" />
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Stats */}
      <Row className="mb-4 g-4">
        {[
          { icon: <FaUsers size={28} className="text-white" />, label: 'Total Students', value: studentStats.total_students, percent: 100, color: '#3b82f6' },
          { icon: <FaUserPlus size={28} className="text-white" />, label: 'Recent Students', value: studentStats.recent_students, percent: calculatePercent(studentStats.recent_students), color: '#10b981' },
          { icon: <FaExchangeAlt size={28} className="text-white" />, label: 'Pending Transfers', value: studentStats.pending_transfers, percent: calculatePercent(studentStats.pending_transfers), color: '#ef4444' }
        ].map((stat, idx) => (
          <Col md={4} key={idx}>
            <Card className="shadow-sm border-0 h-100 rounded-4">
              <Card.Body className="text-center p-4">
                <div 
                  className="d-inline-flex justify-content-center align-items-center rounded-circle mb-3"
                  style={{ width: 60, height: 60, backgroundColor: stat.color }}
                >
                  {stat.icon}
                </div>
                <Card.Title className="fw-semibold text-muted">{stat.label}</Card.Title>
                <h2 className="fw-bold mb-3" style={{ color: stat.color }}>{stat.value}</h2>
                <ProgressBar now={stat.percent} style={{ height: 8, borderRadius: 4 }} animated />
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Recent Logs */}
      <Card className="shadow-sm border-0 rounded-4">
        <Card.Header className="bg-white border-0 fw-bold text-primary">Recent Activity</Card.Header>
        <Card.Body className="p-0">
          {recentLogs && recentLogs.length > 0 ? (
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
                    <td>{action}</td>
                    <td className="text-muted">{new Date(log_timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="text-center py-4 text-muted">No recent logs available.</div>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Home;
