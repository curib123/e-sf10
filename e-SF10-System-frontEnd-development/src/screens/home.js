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
  FaUserTie
} from 'react-icons/fa';

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const token = sessionStorage.getItem('token');

  useEffect(() => {
    checkToken();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await axios.get('http://localhost:3001/esf10/dashboard', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDashboardData(data);
      } catch {
        setFetchError('Failed to fetch dashboard data. Please try again later.');
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
      <div className="d-flex vh-100 justify-content-center align-items-center">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <Container className="mt-5">
        <div className="alert alert-danger text-center">{fetchError}</div>
      </Container>
    );
  }

  const { user, studentStats, schoolInfo, recentLogs } = dashboardData;

  const calculatePercent = (count) =>
    studentStats.total_students > 0 ? (count / studentStats.total_students) * 100 : 0;

  return (
    <Container fluid className="p-4">
      {/* Welcome Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <Card className="shadow-sm bg-primary text-white flex-grow-1 me-3 border-0">
          <Card.Body className="d-flex align-items-center gap-3">
            <div className="rounded-circle bg-white bg-opacity-25 d-flex justify-content-center align-items-center" style={{ width: 80, height: 80, fontSize: '1.5rem', fontWeight: 600 }}>
              {user.first_name[0].toUpperCase()}
              {user.last_name[0].toUpperCase()}
            </div>
            <div>
              <h4 className="mb-1">Welcome back, {user.first_name}!</h4>
              <small>Your role: <Badge bg="light" text="dark">{user.roles}</Badge></small>
            </div>
          </Card.Body>
        </Card>

        <Card className="shadow-sm text-center bg-light border-0" style={{ minWidth: 180 }}>
          <Card.Body>
            <h5 className="mb-0" style={{ fontFamily: 'monospace' }}>{currentTime.toLocaleTimeString()}</h5>
            <small>{currentTime.toLocaleDateString()}</small>
          </Card.Body>
        </Card>
      </div>

      {/* School Info */}
      <Card className="mb-4 shadow-sm border-0">
        <Card.Header className="bg-secondary text-white d-flex align-items-center">
          <FaSchool className="me-2" />
          School Information
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}><strong>Name:</strong> {schoolInfo.school_name}</Col>
            <Col md={4}><strong>Region:</strong> {schoolInfo.region}</Col>
            <Col md={4}><strong>District:</strong> {schoolInfo.district}</Col>
          </Row>
          <Row className="mt-2">
            <Col md={4}><strong>Address:</strong> {schoolInfo.school_address}</Col>
            <Col md={4}><strong>Division:</strong> {schoolInfo.division}</Col>
            <Col md={4}>
              <strong>School Head:</strong> {schoolInfo.school_head} <FaUserTie className="text-muted ms-1" />
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Student Stats */}
      <Row className="mb-4 g-4">
        {[
          {
            icon: <FaUsers size={40} className="text-primary mb-2" />,
            label: 'Total Students',
            value: studentStats.total_students,
            percent: 100,
            variant: 'primary'
          },
          {
            icon: <FaUserPlus size={40} className="text-warning mb-2" />,
            label: 'Recent Students',
            value: studentStats.recent_students,
            percent: calculatePercent(studentStats.recent_students),
            variant: 'warning'
          },
          {
            icon: <FaExchangeAlt size={40} className="text-danger mb-2" />,
            label: 'Pending Transfers',
            value: studentStats.pending_transfers,
            percent: calculatePercent(studentStats.pending_transfers),
            variant: 'danger'
          }
        ].map((stat, idx) => (
          <Col md={4} key={idx}>
            <Card className={`shadow-sm border-${stat.variant} h-100`}>
              <Card.Body className="text-center">
                {stat.icon}
                <Card.Title>{stat.label}</Card.Title>
                <h2>{stat.value}</h2>
                <ProgressBar
                  now={stat.percent}
                  variant={stat.variant}
                  style={{ height: 8, borderRadius: 4 }}
                  animated
                />
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Recent Logs */}
      <Card className="shadow-sm border-0">
        <Card.Header className="bg-dark text-white">
          Activity Logs
        </Card.Header>
        <Card.Body className="p-0">
          {recentLogs && recentLogs.length > 0 ? (
            <Table striped hover responsive className="mb-0">
              <thead className="table-dark">
                <tr>
                  <th>ID</th>
                  <th>Action</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map(({ log_id, action, log_timestamp }) => (
                  <tr key={log_id}>
                    <td>{log_id}</td>
                    <td>{action}</td>
                    <td>{new Date(log_timestamp).toLocaleString()}</td>
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

export default Dashboard;
