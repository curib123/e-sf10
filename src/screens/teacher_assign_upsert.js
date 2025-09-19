import 'bootstrap/dist/css/bootstrap.min.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FaChevronLeft,
  FaChevronRight,
  FaSave,
  FaSyncAlt,
  FaUndo,
} from 'react-icons/fa';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import StatusModal from '../components/status_modal';

/**
 * Teacher Assignment — Simplified UI (with filtering of already-assigned pairs)
 */

// ───────────────────────────────────────────────────────────────────────────────
// Config (BASE_URL must already include /esf10)
const BASE_URL = process.env.REACT_APP_API_BASE_URL;
const CREATE_ENDPOINT = `/teacher-assignments/create`;
const UPDATE_ENDPOINT = (id) => `/teacher-assignments/update/${id}`;
const SHOW_ENDPOINT = (id) => `/teacher-assignments/${id}`;
const TEACHER_ACTIVE_YEAR = (teacherId) => `/teacher-assignments/teacher/${teacherId}/active-year`;

const PAGE_SIZES = [5, 10, 20, 50];

// ───────────────────────────────────────────────────────────────────────────────
// Helpers — school year
const isTruthyActive = (v) => {
  if (v === true || v === 1 || v === '1') return true;
  if (typeof v === 'string' && v.toLowerCase() === 'true') return true;
  return false;
};
const toYear = (v) => {
  if (v == null) return NaN;
  const m = String(v).match(/\d{4}/);
  return m ? Number(m[0]) : Number.isFinite(Number(v)) ? Number(v) : NaN;
};
const pickActiveSchoolYear = (list = []) => {
  if (!Array.isArray(list) || list.length === 0) return null;
  const flagged = list.find((sy) => isTruthyActive(sy?.is_active ?? sy?.active ?? sy?.isActive ?? sy?.status));
  if (flagged) return flagged;
  const sorted = [...list].sort((a, b) => {
    const ae = toYear(a?.end_year ?? a?.school_year?.split?.('-')?.[1]);
    const be = toYear(b?.end_year ?? b?.school_year?.split?.('-')?.[1]);
    if (Number.isFinite(ae) && Number.isFinite(be) && be !== ae) return be - ae;
    const as = toYear(a?.start_year ?? a?.school_year?.split?.('-')?.[0]);
    const bs = toYear(b?.start_year ?? b?.school_year?.split?.('-')?.[0]);
    if (Number.isFinite(as) && Number.isFinite(bs) && bs !== as) return bs - as;
    return 0;
  });
  return sorted[0] || null;
};

// Small helper for pair keys
const pairKey = (sectionId, subjectId) => `${String(sectionId)}|${String(subjectId)}`;

// Small helper to build a compact page list with ellipses
function buildPageList(page, totalPages) {
  const pages = [];
  const maxToShow = 7;
  if (totalPages <= maxToShow) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }
  const showAround = 1;
  const start = Math.max(2, page - showAround);
  const end = Math.min(totalPages - 1, page + showAround);
  pages.push(1);
  if (start > 2) pages.push('…');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push('…');
  pages.push(totalPages);
  return pages;
}

// ───────────────────────────────────────────────────────────────────────────────
export default function TeacherAssignmentForm() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem('token'), []);
  const inFlight = useRef(false);

  // UI
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState({ show: false, title: '', message: '', variant: 'info' });
  const showStatus = (variant, title, message) => setStatus({ show: true, title, message, variant });

  // Data
  const [teachers, setTeachers] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [byGrade, setByGrade] = useState([]); // [{ grade_level_id, grade_name, sections[], subjects[] }]

  // Form
  const [form, setForm] = useState({ teacher_id: '', school_year_id: '' });
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedSectionIds, setSelectedSectionIds] = useState(new Set());
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set());

  // Edit
  const [current, setCurrent] = useState(null);

  // Table (teacher's active-year subjects)
  const [teacherSubs, setTeacherSubs] = useState([]);
  const [teacherSubsLoading, setTeacherSubsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Derived
  const activeSY = useMemo(() => pickActiveSchoolYear(schoolYears), [schoolYears]);
  const activeSYText = useMemo(() => {
    if (!activeSY) return '';
    const s = activeSY.start_year ?? activeSY.school_year?.split?.('-')?.[0] ?? '';
    const e = activeSY.end_year ?? activeSY.school_year?.split?.('-')?.[1] ?? '';
    return `${s} - ${e}`;
  }, [activeSY]);
  const teacherChosen = Boolean(String(form.teacher_id).trim());
  const syReady = Boolean(String(form.school_year_id).trim());
  const lockForm = !teacherChosen;

  const selectedGrade = useMemo(() => {
    if (!selectedGradeId) return null;
    return byGrade.find((g) => String(g.grade_level_id) === String(selectedGradeId)) || null;
  }, [byGrade, selectedGradeId]);

  const gradeSections = selectedGrade?.sections ?? [];
  const gradeSubjects = selectedGrade?.subjects ?? [];

  // Build a fast lookup of already-assigned (section,subject) pairs for this teacher
  const assignedPairs = useMemo(() => {
    const s = new Set();
    for (const a of teacherSubs || []) {
      const secId = a?.section_id;
      const subId = a?.subject_id;
      if (secId != null && subId != null) s.add(pairKey(secId, subId));
    }
    return s;
  }, [teacherSubs]);

  // Given a section, does it still have at least one subject not assigned to this teacher?
  const sectionHasAnyFreeSubject = (sectionId) => {
    for (const subj of gradeSubjects) {
      if (!assignedPairs.has(pairKey(sectionId, subj.subject_id))) return true;
    }
    return false;
  };

  // Sections: hide those where *all* subjects are already assigned
  const filteredSections = useMemo(() => {
    if (!selectedGrade) return [];
    return gradeSections.filter((sec) => sectionHasAnyFreeSubject(sec.section_id));
  }, [selectedGrade, gradeSections, gradeSubjects, assignedPairs]);

  // Subjects: if user selected sections, show only subjects that are free in at least one selected section.
  // If no section selected yet, show subjects that are free in at least one section of this grade.
  const subjectIsAvailableInAnyOf = (subjectId, sectionIds) => {
    const ids = sectionIds.length ? sectionIds : gradeSections.map((s) => String(s.section_id));
    for (const secId of ids) {
      if (!assignedPairs.has(pairKey(secId, subjectId))) return true;
    }
    return false;
  };
  const filteredSubjects = useMemo(() => {
    if (!selectedGrade) return [];
    const selectedSecs = [...selectedSectionIds];
    return gradeSubjects.filter((subj) =>
      subjectIsAvailableInAnyOf(String(subj.subject_id), selectedSecs)
    );
  }, [selectedGrade, gradeSubjects, gradeSections, selectedSectionIds, assignedPairs]);

  // Optional: show how many subjects remain open in a section (tiny helper)
  const sectionOpenCount = (sectionId) => {
    let open = 0;
    for (const subj of gradeSubjects) {
      if (!assignedPairs.has(pairKey(sectionId, subj.subject_id))) open++;
    }
    return open;
  };

  // If filters make current selections invalid, prune them
  useEffect(() => {
    setSelectedSectionIds((prev) => {
      const allowed = new Set(filteredSections.map((s) => String(s.section_id)));
      const next = new Set([...prev].filter((id) => allowed.has(id)));
      return next;
    });
  }, [filteredSections]);
  useEffect(() => {
    setSelectedSubjectIds((prev) => {
      const allowed = new Set(filteredSubjects.map((s) => String(s.subject_id)));
      const next = new Set([...prev].filter((id) => allowed.has(id)));
      return next;
    });
  }, [filteredSubjects]);

  // API wrapper
  const handleUnauthorized = () => {
    showStatus('danger', 'Unauthorized', 'Please login to continue.');
    sessionStorage.removeItem('token');
    setTimeout(() => navigate('/login'), 800);
  };
  const apiFetch = async (path, options = {}) => {
    const isAbsolute = /^https?:\/\//i.test(path);
    const fullUrl = isAbsolute ? path : `${BASE_URL}${path}`;
    const res = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    return res;
  };

  // Loads
  const loadTeachers = async () => {
    try {
      const res = await apiFetch(`/teachers`, { method: 'GET' });
      const data = await res.json();
      setTeachers(data?.success ? data.data || [] : []);
    } catch {
      showStatus('danger', 'Error', 'Failed to load teachers.');
    }
  };
  const loadSchoolYears = async () => {
    try {
      const res = await apiFetch(`/school-year/all-school-years`, { method: 'GET' });
      const data = await res.json();
      const list = data?.success ? data.schoolYears || [] : [];
      setSchoolYears(list);
      const active = pickActiveSchoolYear(list);
      if (active?.school_year_id) {
        setForm((f) => ({ ...f, school_year_id: String(active.school_year_id) }));
      }
    } catch {
      showStatus('danger', 'Error', 'Failed to load school years.');
    }
  };
  const loadByGrade = async () => {
    try {
      const res = await apiFetch(`/subjects/view-all-sub-grade-levels`, { method: 'GET' });
      const data = await res.json();
      setByGrade(data?.success ? data.data || [] : []);
    } catch {
      showStatus('danger', 'Error', 'Failed to load grade-level sections & subjects.');
    }
  };

  const fetchTeacherSubjects = async (tid) => {
    if (!tid) return setTeacherSubs([]);
    try {
      setTeacherSubsLoading(true);
      const res = await apiFetch(TEACHER_ACTIVE_YEAR(tid), { method: 'GET' });
      const data = await res.json();
      setTeacherSubs(data?.success ? data.data || [] : []);
    } catch {
      setTeacherSubs([]);
      showStatus('danger', 'Error', "Failed to load teacher's current subjects (active year).");
    } finally {
      setTeacherSubsLoading(false);
    }
  };

  const loadAssignment = async () => {
    if (!id) return;
    try {
      const res = await apiFetch(SHOW_ENDPOINT(id), { method: 'GET' });
      const data = await res.json();
      if (!data?.success || !data.data) {
        showStatus('warning', 'Not found', 'Assignment not found.');
        return;
      }
      const a = data.data;
      setCurrent(a);
      setForm((f) => ({ ...f, teacher_id: a.teacher_id ?? f.teacher_id }));
      if (a.section_id) setSelectedSectionIds(new Set([String(a.section_id)]));
      if (a.subject_id) setSelectedSubjectIds(new Set([String(a.subject_id)]));
    } catch {
      showStatus('danger', 'Error', 'Failed to load assignment details.');
    }
  };

  // Boot
  useEffect(() => {
    if (!token) return handleUnauthorized();
    (async () => {
      setBusy(true);
      await loadTeachers();
      await Promise.all([loadSchoolYears(), loadByGrade()]);
      if (id) await loadAssignment();
      setBusy(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  // Whenever the teacher changes, refresh their active-year subjects
  useEffect(() => {
    if (form.teacher_id) fetchTeacherSubjects(form.teacher_id);
    else setTeacherSubs([]);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.teacher_id]);

  // If editing and byGrade has loaded, try to infer grade from section/subject/grade_name
  useEffect(() => {
    if (!isEditMode || !current || byGrade.length === 0 || selectedGradeId) return;
    const secId = current.section_id && String(current.section_id);
    const subId = current.subject_id && String(current.subject_id);
    let found = null;
    for (const g of byGrade) {
      if (secId && Array.isArray(g.sections) && g.sections.some((s) => String(s.section_id) === secId)) found = g;
      if (!found && subId && Array.isArray(g.subjects) && g.subjects.some((s) => String(s.subject_id) === subId)) found = g;
      if (found) break;
    }
    if (found) setSelectedGradeId(String(found.grade_level_id));
  }, [isEditMode, current, byGrade, selectedGradeId]);

  // Handlers
  const setField = (k) => (eOrValue) => {
    const v = eOrValue?.target ? eOrValue.target.value : eOrValue;
    setForm((f) => ({ ...f, [k]: v }));
  };
  const toggleSet = (setter) => (id) => {
    setter((prev) => {
      const next = new Set(prev);
      const key = String(id);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  // Clear section/subject picks when grade changes (keeps things simple)
  useEffect(() => {
    setSelectedSectionIds(new Set());
    setSelectedSubjectIds(new Set());
  }, [selectedGradeId]);

  // Validation
  const validate = () => {
    if (!teacherChosen) return false;
    if (!syReady) return false;
    if (!isEditMode && !selectedGradeId) return false;
    const hasSection = selectedSectionIds.size > 0 || (isEditMode && current?.section_id);
    const hasSubject = selectedSubjectIds.size > 0 || (isEditMode && current?.subject_id);
    return Boolean(hasSection && hasSubject);
  };

  // Submit
  const onSubmit = async (e) => {
    e.preventDefault();
    if (!token || inFlight.current) return;
    setSubmitted(true);
    if (!validate()) {
      const msg = !syReady ? 'Active school year is still loading. Please try again shortly.' : 'Please complete the required fields.';
      showStatus('warning', 'Missing fields', msg);
      return;
    }

    try {
      setBusy(true);
      inFlight.current = true;

      if (id) {
        const pickedSubjectId = selectedSubjectIds.size ? Number([...selectedSubjectIds][0]) : Number(current?.subject_id);
        const pickedSectionId = selectedSectionIds.size ? Number([...selectedSectionIds][0]) : Number(current?.section_id);
        // Skip if already assigned
        if (assignedPairs.has(pairKey(pickedSectionId, pickedSubjectId))) {
          showStatus('info', 'No change', 'This section/subject is already assigned to the teacher.');
        } else {
          const payload = {
            teacher_id: Number(form.teacher_id),
            subject_id: Number(pickedSubjectId),
            section_id: Number(pickedSectionId),
            school_year_id: Number(form.school_year_id),
          };
          const res = await apiFetch(UPDATE_ENDPOINT(id), { method: 'PUT', body: JSON.stringify(payload) });
          const data = await res.json();
          if (!res.ok || data?.success === false) throw new Error(data?.message || 'Request failed');
          showStatus('success', 'Updated', 'Teacher assignment updated successfully.');
          await fetchTeacherSubjects(form.teacher_id);
        }
      } else {
        const combos = [];
        selectedSectionIds.forEach((sec) => {
          selectedSubjectIds.forEach((subj) => {
            const sId = Number(sec);
            const subId = Number(subj);
            if (!assignedPairs.has(pairKey(sId, subId))) {
              combos.push({
                teacher_id: Number(form.teacher_id),
                section_id: sId,
                subject_id: subId,
                school_year_id: Number(form.school_year_id),
              });
            }
          });
        });
        let okCount = 0;
        for (const payload of combos) {
          const res = await apiFetch(CREATE_ENDPOINT, { method: 'POST', body: JSON.stringify(payload) });
          const data = await res.json();
          if (res.ok && data?.success !== false) okCount++;
        }
        const skipped = selectedSectionIds.size * selectedSubjectIds.size - combos.length;
        const summary =
          `Created ${okCount}/${combos.length} new ` +
          `assignment${combos.length !== 1 ? 's' : ''}` +
          (skipped > 0 ? ` (skipped ${skipped} already-assigned).` : '.');
        showStatus('success', 'Created', summary);
        await fetchTeacherSubjects(form.teacher_id);
      }
    } catch (err) {
      showStatus('danger', 'Error', err.message || 'Something went wrong while saving.');
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  const onReset = () => {
    setSubmitted(false);
    if (isEditMode) {
      // Reload edit state
      loadAssignment();
    } else {
      // Keep teacher & active SY; clear the rest
      setSelectedGradeId('');
      setSelectedSectionIds(new Set());
      setSelectedSubjectIds(new Set());
    }
  };

  // Pagination derived
  const totalPages = Math.max(1, Math.ceil(teacherSubs.length / pageSize));
  const paginatedSubs = teacherSubs.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  const rangeStart = teacherSubs.length ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(teacherSubs.length, page * pageSize);
  useEffect(() => setPage(1), [teacherSubs.length, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="container-fluid">
      {/* Page header */}
      <div className="rounded-3 border bg-light p-3 p-md-4 mb-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            <h4 className="mb-1 fw-bold">{isEditMode ? 'Update Assignment' : 'Assign Teacher'}</h4>
            <div className="text-muted small">
              {isEditMode ? 'Modify the assignment for the active school year.' : 'Follow the steps below to assign a teacher.'}
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            {activeSYText && (
              <span className="badge text-success border border-success-subtle p-2">
                Active Year: {activeSYText}
              </span>
            )}
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => {
                try { navigate(-1); } catch { navigate('/teacher-assignments'); }
              }}
            >
              Back
            </button>
          </div>
        </div>
      </div>

      {/* Form card */}
      <div className="card shadow-sm mb-4">
        <div className="card-body p-4">
          <form onSubmit={onSubmit} noValidate>
            {/* Step 1: Teacher */}
            <div className="mb-4">
              <label className="form-label fw-semibold">Teacher <span className="text-danger">*</span></label>
              <select
                className={`form-select ${submitted && !teacherChosen ? 'is-invalid' : ''}`}
                value={form.teacher_id}
                onChange={setField('teacher_id')}
                disabled={busy}
              >
                <option value="">— Select teacher —</option>
                {teachers.map((t) => {
                  const label = t.full_name || t.teacher_name || `${t.first_name ?? ''} ${t.last_name ?? ''}`;
                  return (
                    <option key={t.teacher_id} value={t.teacher_id}>{label}</option>
                  );
                })}
              </select>
              <div className="form-text">Choose the teacher to assign subjects/sections to.</div>
              {submitted && !teacherChosen && (
                <div className="invalid-feedback d-block">Teacher is required.</div>
              )}
            </div>

            {/* Step 2: Grade (hidden until teacher chosen) */}
            <fieldset className="mb-4" disabled={lockForm}>
              <label className="form-label fw-semibold">Grade {!isEditMode && <span className="text-danger">*</span>}</label>
              <select
                className={`form-select ${submitted && !isEditMode && !selectedGradeId ? 'is-invalid' : ''}`}
                value={selectedGradeId}
                onChange={(e) => setSelectedGradeId(e.target.value)}
              >
                <option value="">— Select grade —</option>
                {byGrade.map((g) => (
                  <option key={g.grade_level_id} value={g.grade_level_id}>
                    {g.grade_name || g.grade_code || `Grade ${g.grade_level_id}`}
                  </option>
                ))}
              </select>
              {!lockForm && submitted && !isEditMode && !selectedGradeId && (
                <div className="invalid-feedback d-block">Please choose a grade.</div>
              )}
            </fieldset>

            {/* Step 3: Sections (filtered) */}
            <fieldset className="mb-4" disabled={lockForm || !selectedGrade}>
              <div className="d-flex align-items-center justify-content-between">
                <label className="form-label fw-semibold mb-0">Sections</label>
                {selectedGrade && (
                  <small className="text-muted">
                    {filteredSections.length} available
                  </small>
                )}
              </div>

              {!selectedGrade ? (
                <div className="text-muted small">Select a grade to see its sections.</div>
              ) : filteredSections.length ? (
                <div className="list-group">
                  {filteredSections.map((s) => {
                    const key = String(s.section_id);
                    const checked = selectedSectionIds.has(key);
                    const open = sectionOpenCount(s.section_id);
                    return (
                      <label key={key} className="list-group-item d-flex align-items-center">
                        <input
                          type="checkbox"
                          className="form-check-input me-2"
                          checked={checked}
                          onChange={() => toggleSet(setSelectedSectionIds)(key)}
                        />
                        <span className="me-auto">{s.section_name}</span>
                        <span className="badge text-bg-secondary-subtle border">
                          {open} free
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="text-danger small">All sections in this grade are already fully assigned to this teacher.</div>
              )}

              {!isEditMode && submitted && !lockForm && selectedSectionIds.size === 0 && (
                <div className="text-danger small mt-2">Pick at least one section.</div>
              )}
            </fieldset>

            {/* Step 4: Subjects (filtered) */}
            <fieldset className="mb-4" disabled={lockForm || !selectedGrade}>
              <div className="d-flex align-items-center justify-content-between">
                <label className="form-label fw-semibold mb-0">Subjects</label>
                {selectedGrade && (
                  <small className="text-muted">{filteredSubjects.length} available</small>
                )}
              </div>

              {!selectedGrade ? (
                <div className="text-muted small">Select a grade to see its subjects.</div>
              ) : filteredSubjects.length ? (
                <div className="list-group">
                  {filteredSubjects.map((s) => {
                    const key = String(s.subject_id);
                    const checked = selectedSubjectIds.has(key);
                    return (
                      <label key={key} className="list-group-item d-flex align-items-center">
                        <input
                          type="checkbox"
                          className="form-check-input me-2"
                          checked={checked}
                          onChange={() => toggleSet(setSelectedSubjectIds)(key)}
                        />
                        <span className="me-auto">
                          <span className="fw-semibold">{s.subject_code}</span>
                          <span className="text-muted"> — {s.subject_name}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="text-danger small">
                  No subjects remaining for the selected sections (already assigned to this teacher).
                </div>
              )}

              {!isEditMode && submitted && !lockForm && selectedSubjectIds.size === 0 && (
                <div className="text-danger small mt-2">Pick at least one subject.</div>
              )}
            </fieldset>

            {/* Actions */}
            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={onReset} disabled={busy}>
                <FaUndo className="me-2" /> Reset
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || lockForm || !syReady}
                title={!syReady ? 'Loading active school year…' : (lockForm ? 'Select a teacher first' : 'Save')}
              >
                {busy && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>}
                <FaSave className="me-2" /> {isEditMode ? 'Update Assignment' : 'Save Assignments'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Current subjects table */}
      {form.teacher_id && (
        <div className="card shadow-sm">
          <div className="card-header bg-white px-4 py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <h6 className="mb-0 fw-semibold">Current Subjects (Active Year)</h6>
              <div className="text-muted small">
                {teacherSubsLoading
                  ? 'Loading assignments…'
                  : teacherSubs.length
                  ? `Showing ${rangeStart}–${rangeEnd} of ${teacherSubs.length} assignment${teacherSubs.length > 1 ? 's' : ''}`
                  : 'No current subjects for this teacher.'}
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 ms-auto">
              {teacherSubs.length > 0 && (
                <>
                  <span className="text-muted small">Rows</span>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 90 }}
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </>
              )}

              {teacherSubs.length > pageSize && (
                <nav aria-label="Teacher subjects pagination">
                  <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => setPage(1)} aria-label="First">
                        <span aria-hidden="true">«</span>
                      </button>
                    </li>
                    <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous">
                        <FaChevronLeft />
                      </button>
                    </li>
                    {buildPageList(page, totalPages).map((p, idx) =>
                      typeof p === 'string' ? (
                        <li key={`ellipsis-${idx}`} className="page-item disabled">
                          <span className="page-link">…</span>
                        </li>
                      ) : (
                        <li key={`pg-${p}`} className={`page-item ${p === page ? 'active' : ''}`}>
                          <button className="page-link" onClick={() => setPage(p)}>{p}</button>
                        </li>
                      )
                    )}
                    <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next">
                        <FaChevronRight />
                      </button>
                    </li>
                    <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => setPage(totalPages)} aria-label="Last">
                        <span aria-hidden="true">»</span>
                      </button>
                    </li>
                  </ul>
                </nav>
              )}

              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => fetchTeacherSubjects(form.teacher_id)}
                disabled={teacherSubsLoading}
              >
                <FaSyncAlt className="me-1" /> {teacherSubsLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>

          {teacherSubsLoading ? (
            <div className="p-3">
              <div className="placeholder-glow">
                {[...Array(4)].map((_, i) => (
                  <p key={i} className="placeholder col-12 mb-2" style={{ height: 18 }} />
                ))}
              </div>
            </div>
          ) : teacherSubs.length === 0 ? (
            <div className="p-4 text-center text-muted small">No records to display.</div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: '60vh' }}>
              <table className="table table-sm align-middle mb-0 table-hover table-striped">
                <thead className="table-light">
                  <tr>
                    <th style={{ minWidth: 160 }}>Subject</th>
                    <th style={{ minWidth: 140 }}>Section</th>
                    <th style={{ width: 120 }}>Grade</th>
                    <th style={{ width: 140 }}>School Year</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSubs.map((a) => (
                    <tr key={`teach-sub-${a.assignment_id || `${a.teacher_id}-${a.section_id}-${a.subject_id}`}`}>
                      <td className="text-wrap">
                        <div className="fw-medium">{a.subject_code}</div>
                        <div className="small text-muted">{a.subject_name}</div>
                      </td>
                      <td className="text-wrap">{a.section_name}</td>
                      <td>{a.grade_name}</td>
                      <td>{a.school_year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <StatusModal {...status} onHide={() => setStatus((s) => ({ ...s, show: false }))} />
    </div>
  );
}
