import React, {
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
  Placeholder,
  Row,
  Table,
} from 'react-bootstrap';
import {
  FaBookOpen,
  FaClock,
  FaSchool,
  FaSitemap,
  FaUsers,
  FaUserTie,
} from 'react-icons/fa';
import { useParams } from 'react-router-dom';

import StatusModal from '../components/status_modal';
import { checkToken } from '../components/token_checker';

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const fmtTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const fmtDate = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' });

const toInitials = (first = '', last = '') =>
  `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();

const toSY = (start, end) =>
  Number.isInteger(start) && Number.isInteger(end) ? `${start}–${end}` : '—';

const timeLabel = (hhmmss = '00:00:00') => {
  const [H = '0', M = '0'] = String(hhmmss).split(':');
  const d = new Date();
  d.setHours(Number(H), Number(M), 0, 0);
  return fmtTime.format(d);
};

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DAY_INDEX = { Monday:0, Tuesday:1, Wednesday:2, Thursday:3, Friday:4, Saturday:5, Sunday:6 };

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────
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

const StatTile = ({ label, value, icon }) => (
  <Card className="shadow-sm border-0 rounded-4 h-100">
    <Card.Body className="p-3 d-flex align-items-center gap-3">
      <div
        className="rounded-3 d-flex justify-content-center align-items-center text-primary bg-primary bg-opacity-10"
        style={{ width: 44, height: 44 }}
      >
        {icon}
      </div>
      <div>
        <div className="text-muted small">{label}</div>
        <div className="fw-bold fs-5">{Number(value || 0).toLocaleString()}</div>
      </div>
    </Card.Body>
  </Card>
);

const HeaderCard = ({ initials, name, email, isActive }) => (
  <Card
    className="border-0 shadow-sm rounded-4 overflow-hidden h-100"
    style={{ background: 'linear-gradient(135deg, rgba(59,130,246,.95), rgba(99,102,241,.95))' }}
  >
    <Card.Body className="p-3 p-md-4 d-flex align-items-center gap-3 gap-md-4">
      <div
        className="rounded-circle d-flex justify-content-center align-items-center flex-shrink-0 text-white"
        style={{ width: 64, height: 64, fontSize: '1.25rem', fontWeight: 700, background: 'rgba(255,255,255,.2)' }}
        aria-label="Teacher initials"
      >
        {initials || <FaUserTie />}
      </div>
      <div className="text-white">
        <div className="fw-bold fs-5">Welcome{ name ? `, ${name}` : '' }! 👋</div>
        <div className="d-flex flex-wrap align-items-center gap-2 mt-1">
          <Badge bg="light" text="dark">Teacher</Badge>
          {isActive ? <Badge bg="success">Active</Badge> : <Badge bg="secondary">Inactive</Badge>}
        </div>
        <div className="mt-2 small">
          <FaSchool className="me-2" />
          {email || '—'}
        </div>
      </div>
    </Card.Body>
  </Card>
);

const ClockCard = ({ now, next }) => (
  <Card className="shadow-sm border-0 rounded-4 h-100">
    <Card.Body className="p-3 p-md-4 text-center d-flex flex-column justify-content-center">
      <FaClock size={22} className="text-primary mb-1" />
      <div className="fw-bold fs-3">{fmtTime.format(now)}</div>
      <div className="text-muted small mb-2">{fmtDate.format(now)}</div>
      {next ? (
        <div className="small">
          <Badge bg="primary" className="me-2">Up next</Badge>
          <span className="text-muted">
            {next.day}, {next.subject} ({next.section}) • {fmtTime.format(next.startDate)}–{fmtTime.format(next.endDate)}
          </span>
        </div>
      ) : (
        <div className="small text-muted">No upcoming class today</div>
      )}
    </Card.Body>
  </Card>
);

// simple pager hook
function usePager(initialSize = 10) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(initialSize);
  const reset = () => setPage(1);
  return { page, setPage, size, setSize, reset };
}

const PagerBar = ({ page, totalPages, onFirst, onPrev, onNext, onLast }) => (
  <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top bg-white rounded-bottom-4">
    <div className="text-muted small">Page {page} of {totalPages || 1}</div>
    <div className="btn-group">
      <Button size="sm" variant="outline-secondary" onClick={onFirst} disabled={page <= 1}>«</Button>
      <Button size="sm" variant="outline-secondary" onClick={onPrev} disabled={page <= 1}>‹</Button>
      <Button size="sm" variant="outline-secondary" onClick={onNext} disabled={page >= totalPages}>›</Button>
      <Button size="sm" variant="outline-secondary" onClick={onLast} disabled={page >= totalPages}>»</Button>
    </div>
  </div>
);

const PageSizer = ({ value, onChange, options = [10, 20, 50] }) => (
  <Form.Select size="sm" value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: 104 }}>
    {options.map((n) => (
      <option key={n} value={n}>{n}/page</option>
    ))}
  </Form.Select>
);

// Find the next upcoming class from the weekly schedule
function findNextClass(schedule = [], nowMs) {
  if (!Array.isArray(schedule) || !schedule.length) return null;
  const now = new Date(nowMs);
  const todayIdx = (now.getDay() + 6) % 7; // convert Sun(0)→6, Mon(1)→0 ...
  const toDateOn = (dayIdx, hhmmss) => {
    const [H='0', M='0', S='0'] = String(hhmmss).split(':');
    const d = new Date(now);
    const delta = (dayIdx - todayIdx + 7) % 7;
    d.setDate(now.getDate() + delta);
    d.setHours(Number(H), Number(M), Number(S || 0), 0);
    return d;
  };

  // build candidate windows for the next 7 days
  const candidates = [];
  for (let add = 0; add < 7; add++) {
    const dayIdx = (todayIdx + add) % 7;
    const dayName = DAYS[dayIdx];
    const slots = schedule.filter(s => s.day_of_week === dayName);
    for (const s of slots) {
      const start = toDateOn(dayIdx, s.start_time);
      const end = toDateOn(dayIdx, s.end_time);
      if (end.getTime() > nowMs && start.getTime() >= nowMs || (add > 0)) {
        candidates.push({
          day: dayName,
          subject: s.subject_name,
          section: s.section_name,
          startDate: start,
          endDate: end,
        });
      }
    }
  }
  candidates.sort((a, b) => a.startDate - b.startDate);
  return candidates[0] || null;
}

const TeacherDashboard = () => {
  // auth + routing
  const token = useMemo(() => sessionStorage.getItem('token'), []);
  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  const { teacher_id: routeId } = useParams();
  const [teacherId] = useState(() => {
    const qsId = new URLSearchParams(window.location.search).get('teacher_id');
    const stored = sessionStorage.getItem('teacher_id');
    const resolved = routeId || qsId || stored;
    if (resolved) sessionStorage.setItem('teacher_id', resolved);
    return resolved;
  });

  // state
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [modal, setModal] = useState({ show: false, title: '', message: '', variant: 'danger' });

  const [teacher, setTeacher] = useState(null);
  const [stats, setStats] = useState({ total_sections: 0, total_subjects: 0, total_students: 0 });
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [schedule, setSchedule] = useState([]);

  // pagination + filters
  const subjPager = usePager(12);
  const sectPager = usePager(12);
  const studPager = usePager(12);
  const [subjQ, setSubjQ] = useState('');
  const [studQ, setStudQ] = useState('');

  // computed (keep hooks before early returns)
  const scheduleByDay = useMemo(() => (
    DAYS.map((day) => ({
      day,
      slots: schedule
        .filter((s) => s.day_of_week === day)
        .slice()
        .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))),
    })).filter((g) => g.slots.length)
  ), [schedule]);

  const nextClass = useMemo(() => findNextClass(schedule, now), [schedule, now]);

  const filteredSubjects = useMemo(() => {
    const q = subjQ.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) =>
      [s.subject_name, s.section_name, s.grade_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [subjects, subjQ]);

  const filteredStudents = useMemo(() => {
    const q = studQ.trim().toLowerCase();
    if (!q) return students;
    return students.filter((st) =>
      [st.first_name, st.last_name, st.gender, st.section_name, st.grade_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [students, studQ]);

  // effects
  useEffect(() => { checkToken(); }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!teacherId) {
        setModal({
          show: true,
          title: 'Missing teacher_id',
          message: 'Add /:teacher_id to the route or ?teacher_id= in the URL.',
          variant: 'danger',
        });
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data } = await axios.get(`${BASE_URL}/dashboard/teacher/${teacherId}`, { headers: authHeaders() });
        if (!mounted) return;
        setTeacher(data?.teacher || null);
        setStats(data?.stats || {});
        setSubjects(Array.isArray(data?.subjects) ? data.subjects : []);
        setSections(Array.isArray(data?.sections) ? data.sections : []);
        setStudents(Array.isArray(data?.students) ? data.students : []);
        setSchedule(Array.isArray(data?.schedule) ? data.schedule : []);
        subjPager.reset(); sectPager.reset(); studPager.reset();
      } catch {
        setModal({ show: true, title: 'Error', message: 'Failed to fetch teacher dashboard.', variant: 'danger' });
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, token]);

  // early returns
  if (loading) {
    return (
      <Container fluid className="p-3 p-md-4 bg-light min-vh-100">
        <Row className="g-3 g-md-4">
          <Col xs={12}><SkeletonCard /></Col>
          <Col xs={12}><SkeletonCard /></Col>
          <Col xs={12}><SkeletonCard /></Col>
          <Col xs={12}><SkeletonCard /></Col>
        </Row>
      </Container>
    );
  }

  if (!teacher) {
    return (
      <Container fluid className="p-3 p-md-4 bg-light min-vh-100">
        <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />
        <Card className="shadow-sm border-0 rounded-4">
          <Card.Body className="p-4 text-center text-muted">No teacher data available.</Card.Body>
        </Card>
      </Container>
    );
  }

  // derived (non-hook)
  const initials = toInitials(teacher.first_name, teacher.last_name);
  const isActive = String(teacher.is_active) === '1' || teacher.is_active === true;

  const subjTotalPages = Math.max(1, Math.ceil(filteredSubjects.length / subjPager.size));
  const subjSlice = filteredSubjects.slice((subjPager.page - 1) * subjPager.size, subjPager.page * subjPager.size);

  const sectTotalPages = Math.max(1, Math.ceil(sections.length / sectPager.size));
  const sectSlice = sections.slice((sectPager.page - 1) * sectPager.size, sectPager.page * sectPager.size);

  const studTotalPages = Math.max(1, Math.ceil(filteredStudents.length / studPager.size));
  const studSlice = filteredStudents.slice((studPager.page - 1) * studPager.size, studPager.page * studPager.size);

  return (
    <Container fluid className="p-3 p-md-4" style={{ backgroundColor: '#f8f9fb', minHeight: '100vh' }}>
      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />

      {/* Top row: 2×2 look — Header and Time as two equal cards */}
      <Row className="g-3 mb-3">
        <Col md={6}>
          <HeaderCard
            initials={initials}
            name={teacher.first_name}
            email={teacher.email}
            isActive={isActive}
          />
        </Col>
        <Col md={6}>
          <ClockCard now={now} next={nextClass} />
        </Col>
      </Row>

      {/* Stats (compact) */}
      <Row className="g-3 mb-3">
        <Col md={4}><StatTile label="Subjects" value={stats.total_subjects} icon={<FaBookOpen />} /></Col>
        <Col md={4}><StatTile label="Sections" value={stats.total_sections} icon={<FaSitemap />} /></Col>
        <Col md={4}><StatTile label="Students" value={stats.total_students} icon={<FaUsers />} /></Col>
      </Row>

      {/* Schedule (full width) */}
      <Row className="g-3 mb-3">
        <Col xs={12}>
          <Card className="shadow-sm border-0 rounded-4">
            <Card.Header className="bg-white border-0 fw-bold text-primary d-flex align-items-center p-3">
              <FaClock className="me-2" /> Weekly Schedule
            </Card.Header>
            <Card.Body className="p-0">
              {scheduleByDay.length ? (
                <Table hover responsive className="mb-0 align-middle table-sm">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '18%' }}>Day</th>
                      <th>Subject</th>
                      <th>Section</th>
                      <th style={{ width: '22%' }}>Time</th>
                      <th style={{ width: '12%' }}>SY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleByDay.map(({ day, slots }) => (
                      <React.Fragment key={day}>
                        {slots.map((s, idx) => (
                          <tr key={s.schedule_id}>
                            {idx === 0 ? (
                              <td rowSpan={slots.length} className="fw-semibold align-middle">{day}</td>
                            ) : null}
                            <td>{s.subject_name}</td>
                            <td>{s.section_name}</td>
                            <td>{timeLabel(s.start_time)} – {timeLabel(s.end_time)}</td>
                            <td>{toSY(s.start_year, s.end_year)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="p-4 text-muted text-center">No schedule yet.</div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Subjects */}
      <Row className="g-3 mb-3">
        <Col xs={12}>
          <Card className="shadow-sm border-0 rounded-4">
            <Card.Header className="bg-white border-0 fw-bold text-primary d-flex align-items-center justify-content-between p-3">
              <span className="d-flex align-items-center">
                <FaBookOpen className="me-2" /> My Subjects
              </span>
              <div className="d-flex align-items-center gap-2">
                <Form.Control
                  size="sm"
                  placeholder="Search subject, section, grade…"
                  value={subjQ}
                  onChange={(e) => { setSubjQ(e.target.value); subjPager.reset(); }}
                  style={{ maxWidth: 260 }}
                />
                <PageSizer value={subjPager.size} onChange={(n) => { subjPager.setSize(n); subjPager.reset(); }} />
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {subjSlice.length ? (
                <>
                  <Table hover responsive className="mb-0 align-middle table-sm">
                    <thead className="table-light">
                      <tr>
                        <th>Subject</th>
                        <th>Section</th>
                        <th>Grade</th>
                        <th>SY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjSlice.map(({ subject_id, subject_name, section_id, section_name, grade_name, start_year, end_year }) => (
                        <tr key={`${subject_id}-${section_id}`}>
                          <td className="fw-semibold">{subject_name}</td>
                          <td>{section_name}</td>
                          <td>{grade_name}</td>
                          <td>{toSY(start_year, end_year)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  <PagerBar
                    page={subjPager.page}
                    totalPages={subjTotalPages}
                    onFirst={() => subjPager.setPage(1)}
                    onPrev={() => subjPager.setPage((p) => Math.max(1, p - 1))}
                    onNext={() => subjPager.setPage((p) => Math.min(subjTotalPages, p + 1))}
                    onLast={() => subjPager.setPage(subjTotalPages)}
                  />
                </>
              ) : (
                <div className="p-4 text-muted text-center">No subjects found.</div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Sections */}
      <Row className="g-3 mb-3">
        <Col xs={12}>
          <Card className="shadow-sm border-0 rounded-4">
            <Card.Header className="bg-white border-0 fw-bold text-primary d-flex align-items-center justify-content-between p-3">
              <span className="d-flex align-items-center">
                <FaSitemap className="me-2" /> My Sections
              </span>
              <PageSizer
                value={sectPager.size}
                onChange={(n) => { sectPager.setSize(n); sectPager.reset(); }}
                options={[10, 12, 20, 50]}
              />
            </Card.Header>
            <Card.Body className="p-0">
              {sectSlice.length ? (
                <>
                  <Table hover responsive className="mb-0 align-middle table-sm">
                    <thead className="table-light">
                      <tr>
                        <th>Section</th>
                        <th>Grade</th>
                        <th>SY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectSlice.map(({ section_id, section_name, grade_name, start_year, end_year }) => (
                        <tr key={section_id}>
                          <td className="fw-semibold">{section_name}</td>
                          <td>{grade_name}</td>
                          <td>{toSY(start_year, end_year)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  <PagerBar
                    page={sectPager.page}
                    totalPages={sectTotalPages}
                    onFirst={() => sectPager.setPage(1)}
                    onPrev={() => sectPager.setPage((p) => Math.max(1, p - 1))}
                    onNext={() => sectPager.setPage((p) => Math.min(sectTotalPages, p + 1))}
                    onLast={() => sectPager.setPage(sectTotalPages)}
                  />
                </>
              ) : (
                <div className="p-4 text-muted text-center">No sections assigned.</div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Students */}
      <Row className="g-3 mb-3">
        <Col xs={12}>
          <Card className="shadow-sm border-0 rounded-4">
            <Card.Header className="bg-white border-0 fw-bold text-primary d-flex align-items-center justify-content-between p-3">
              <span className="d-flex align-items-center">
                <FaUsers className="me-2" /> My Students
              </span>
              <div className="d-flex align-items-center gap-2">
                <Form.Control
                  size="sm"
                  placeholder="Search name, section, grade…"
                  value={studQ}
                  onChange={(e) => { setStudQ(e.target.value); studPager.reset(); }}
                  style={{ maxWidth: 260 }}
                />
                <PageSizer
                  value={studPager.size}
                  onChange={(n) => { studPager.setSize(n); studPager.reset(); }}
                  options={[10, 12, 20, 50]}
                />
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {studSlice.length ? (
                <>
                  <Table hover responsive className="mb-0 align-middle table-sm">
                    <thead className="table-light">
                      <tr>
                        <th>Name</th>
                        <th>Gender</th>
                        <th>Section</th>
                        <th>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studSlice.map((st) => (
                        <tr key={st.student_id}>
                          <td className="fw-semibold">
                            {[st.first_name, st.last_name].filter(Boolean).join(' ')}
                          </td>
                          <td>{st.gender}</td>
                          <td>{st.section_name}</td>
                          <td>{st.grade_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  <PagerBar
                    page={studPager.page}
                    totalPages={studTotalPages}
                    onFirst={() => studPager.setPage(1)}
                    onPrev={() => studPager.setPage((p) => Math.max(1, p - 1))}
                    onNext={() => studPager.setPage((p) => Math.min(studTotalPages, p + 1))}
                    onLast={() => studPager.setPage(studTotalPages)}
                  />
                </>
              ) : (
                <div className="p-4 text-muted text-center">No students found.</div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default TeacherDashboard;
