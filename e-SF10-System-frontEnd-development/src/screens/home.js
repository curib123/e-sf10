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
  FaClipboardList
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
       
  // Fetch dashboard data
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

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading)
    return (
      <div className="d-flex vh-100 justify-content-center align-items-center">
        <Spinner animation="border" variant="primary" role="status" />
      </div>
    );

  if (fetchError)
    return (
      <Container className="mt-5">
        <div className="alert alert-danger text-center">{fetchError}</div>
      </Container>
    );

  const { user, studentStats, schoolInfo, recentLogs } = dashboardData;

  const calculatePercent = (count) =>
    studentStats.total_students > 0
      ? (count / studentStats.total_students) * 100
      : 0;

  return (
    <Container fluid className="p-4" style={{ maxWidth: '100vw' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <Card
          className="shadow-sm border-0 rounded-3 bg-primary text-white flex-grow-1 me-3"
          style={{ minHeight: 100 }}
        >
          <Card.Body className="d-flex align-items-center gap-3">
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '1.8rem',
                fontWeight: '700',
                userSelect: 'none'
              }}
            >
              {user.first_name[0].toUpperCase()}
              {user.last_name[0].toUpperCase()}
            </div>
            <div>
              <h3 className="mb-0">Welcome back, {user.first_name}!</h3>
              <small>
                Your role:{' '}
                <Badge bg="light" text="dark" className="text-uppercase">
                  {user.roles}
                </Badge>
              </small>
            </div>
          </Card.Body>
        </Card>

        <Card
          className="shadow-sm border-0 rounded-3 bg-light text-dark flex-shrink-0"
          style={{ minWidth: 180, minHeight: 80 }}
        >
          <Card.Body className="text-center py-2">
            <h5
              className="mb-0"
              style={{ fontFamily: "'Courier New', Courier, monospace" }}
            >
              {currentTime.toLocaleTimeString()}
            </h5>
            <small>{currentTime.toLocaleDateString()}</small>
          </Card.Body>
        </Card>
      </div>

      {/* School Info */}
      <Card className="mb-4 shadow-sm border-0">
        <Card.Header className="bg-secondary text-white d-flex align-items-center gap-2">
          <FaSchool />
          <span>School Information</span>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}>
              <p>
                <strong>Name:</strong> {schoolInfo.school_name}
              </p>
              <p>
                <strong>Address:</strong> {schoolInfo.school_address}
              </p>
            </Col>
            <Col md={4}>
              <p>
                <strong>Region:</strong> {schoolInfo.region}
              </p>
              <p>
                <strong>Division:</strong> {schoolInfo.division}
              </p>
            </Col>
            <Col md={4}>
              <p>
                <strong>District:</strong> {schoolInfo.district}
              </p>
              <p>
                <strong>School Head:</strong> {schoolInfo.school_head}{' '}
                <FaUserTie className="text-muted" />
              </p>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Stats */}
      <Row className="mb-4 g-4">
        <Col md={4}>
          <Card className="shadow-sm border-primary h-100">
            <Card.Body className="d-flex flex-column align-items-center justify-content-center text-center">
              <FaUsers size={48} className="text-primary mb-3" />
              <Card.Title>Total Students</Card.Title>
              <h2>{studentStats.total_students}</h2>
              <ProgressBar
                now={100}
                variant="primary"
                style={{ height: 8, borderRadius: 4, width: '100%' }}
                animated
              />
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="shadow-sm border-warning h-100">
            <Card.Body className="d-flex flex-column align-items-center justify-content-center text-center">
              <FaUserPlus size={48} className="text-warning mb-3" />
              <Card.Title>Recent Students</Card.Title>
              <h2>{studentStats.recent_students}</h2>
              <ProgressBar
                now={calculatePercent(studentStats.recent_students)}
                variant="warning"
                style={{ height: 8, borderRadius: 4, width: '100%' }}
                animated
              />
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="shadow-sm border-danger h-100">
            <Card.Body className="d-flex flex-column align-items-center justify-content-center text-center">
              <FaExchangeAlt size={48} className="text-danger mb-3" />
              <Card.Title>Pending Transfers</Card.Title>
              <h2>{studentStats.pending_transfers}</h2>
              <ProgressBar
                now={calculatePercent(studentStats.pending_transfers)}
                variant="danger"
                style={{ height: 8, borderRadius: 4, width: '100%' }}
                animated
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>

     {(!recentLogs || recentLogs.length === 0) ? (
  <p className="text-center my-4 text-muted">No recent logs available.</p>
) : (
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
)}

    </Container>
  );
};

export default Dashboard;
