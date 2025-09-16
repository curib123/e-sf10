import 'bootstrap/dist/css/bootstrap.min.css';

// src/pages/UpsertCurriculum.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FaArrowLeft,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaPlusSquare,
  FaSave,
  FaTimes,
  FaTrashAlt,
} from 'react-icons/fa';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import StatusModal from '../components/status_modal';

const BASE_URL = process.env.REACT_APP_API_BASE_URL;

/** Safe URL joiner */
const joinUrl = (base, path) =>
  `${(base || '').replace(/\/$/, '')}/${(path || '').replace(/^\//, '')}`;

/** Small stat pill */
const StatPill = ({ children, variant = 'light', title }) => (
  <span className={`badge rounded-pill text-bg-${variant}`} title={title || undefined}>
    {children}
  </span>
);

/** Busy overlay */
const BusyOverlay = ({ show, label }) => {
  if (!show) return null;
  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: 'rgba(0,0,0,.15)', zIndex: 2000 }}
      aria-live="assertive"
      aria-busy="true"
    >
      <div className="bg-white rounded-4 shadow p-3 d-flex align-items-center gap-3">
        <div className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        <div className="fw-semibold small">{label || 'Working…'}</div>
      </div>
    </div>
  );
};

const UpsertCurriculum = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const token = useMemo(() => sessionStorage.getItem('token'), []);
  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  // ——— State ——————————————————————————————————————————————————————————
  const [formData, setFormData] = useState({ curriculum_name: '', school_year_id: '' });
  const [schoolYears, setSchoolYears] = useState([]);
  const [usedSchoolYears, setUsedSchoolYears] = useState([]);
  const [savedCurriculumId, setSavedCurriculumId] = useState(isEdit ? Number(id) : null);

  const [activeCurriculum, setActiveCurriculum] = useState(null); // { curriculum_id, curriculum_name, school_year_id }
  const [activeByGrade, setActiveByGrade] = useState({}); // { [grade_level_id]: { grade_code, grade_name, subjects:[...] } }

  const [loading, setLoading] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [statusModal, setStatusModal] = useState({ show: false, title: '', message: '', variant: 'info' });

  // Assign UI (create mode)
  const [gradeLevels, setGradeLevels] = useState([]);
  const [gradeSubjects, setGradeSubjects] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [assignForm, setAssignForm] = useState({ grade_level_id: 0, assignments: [] });
  const [pendingByGrade, setPendingByGrade] = useState({});
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // ——— Auth helpers ———————————————————————————————————————————————————
  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: 'Unauthorized', message: 'Please log in.', variant: 'danger' });
    sessionStorage.removeItem('token');
    setTimeout(() => navigate('/login'), 900);
  };
  const checkToken = () => {
    if (!token) { handleUnauthorized(); return false; }
    return true;
  };

  // ——— Data fetches ————————————————————————————————————————————————————
  useEffect(() => {
    if (!checkToken()) return;
    (async () => {
      try {
        const res = await fetch(joinUrl(BASE_URL, 'school-year/all-school-years'), { headers });
        if (res.status === 401) return handleUnauthorized();
        const data = await res.json();
        if (data?.success) setSchoolYears(data.schoolYears || []);
      } catch {
        setStatusModal({ show: true, title: 'Error', message: 'Failed to load school years.', variant: 'danger' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!checkToken()) return;
    (async () => {
      try {
        const res = await fetch(joinUrl(BASE_URL, 'curriculum/view-all-curriculums'), { headers });
        if (res.status === 401) return handleUnauthorized();
        const data = await res.json();
        if (data?.success && Array.isArray(data.data)) {
          const used = data.data
            .filter((c) => !isEdit || c.curriculum_id !== Number(id))
            .map((c) => c.school_year_id);
          setUsedSchoolYears(used);
        }
      } catch { /* no-op */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  useEffect(() => {
    if (!isEdit || !checkToken()) return;
    (async () => {
      try {
        const res = await fetch(joinUrl(BASE_URL, `curriculum/view-curriculum/${id}`), { headers });
        if (res.status === 401) return handleUnauthorized();
        const data = await res.json();
        if (!data?.success || !data?.data) throw new Error('Failed to fetch curriculum.');
        setFormData({
          curriculum_name: data.data.curriculum_name || '',
          school_year_id: data.data.school_year_id || '',
        });
        setSavedCurriculumId(Number(id));
      } catch {
        setStatusModal({ show: true, title: 'Error', message: 'Failed to load curriculum.', variant: 'danger' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  useEffect(() => {
    if (!checkToken() || isEdit) return;
    (async () => {
      try {
        const res = await fetch(joinUrl(BASE_URL, 'grade-levels'), { headers });
        if (res.status === 401) return handleUnauthorized();
        const data = await res.json();
        if (data?.success) setGradeLevels(data.data || []);
      } catch {
        setStatusModal({ show: true, title: 'Error', message: 'Failed to load grade levels.', variant: 'danger' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  // ——— Active curriculum & mapping —————————————————————————————————————
  const loadActiveAssignments = useCallback(async () => {
    try {
      const res = await fetch(joinUrl(BASE_URL, 'subjects/view-all-sub-grade-levels'), { headers });
      if (res.status === 401) return handleUnauthorized();
      const j = await res.json();
      if (!j?.success) {
        setActiveCurriculum(null);
        setActiveByGrade({});
        return;
      }
      setActiveCurriculum(j.curriculum || null);
      const map = {};
      (j.data || []).forEach((g) => {
        map[Number(g.grade_level_id)] = {
          grade_code: g.grade_code,
          grade_name: g.grade_name,
          subjects: (g.subjects || []).map((s) => ({
            subject_id: s.subject_id,
            subject_code: s.subject_code,
            subject_name: s.subject_name,
            units: null,
            is_required: null,
          })),
        };
      });
      setActiveByGrade(map);
    } catch {
      setActiveCurriculum(null);
      setActiveByGrade({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  useEffect(() => {
    loadActiveAssignments();
  }, [loadActiveAssignments, formData.curriculum_name, formData.school_year_id]);

  const matchActiveByNameOrYear = useCallback(() => {
    const nameInput = (formData.curriculum_name || '').trim().toLowerCase();
    const nameActive = (activeCurriculum?.curriculum_name || '').trim().toLowerCase();
    if (nameInput && nameActive && nameInput === nameActive) return { matches: true, reason: 'name' };

    const yearInput = formData.school_year_id ? Number(formData.school_year_id) : null;
    const yearActive = activeCurriculum ? Number(activeCurriculum.school_year_id) : null;
    const yearMatch = !!yearInput && !!yearActive && yearInput === yearActive;

    return yearMatch ? { matches: true, reason: 'year' } : { matches: false, reason: null };
  }, [formData.curriculum_name, formData.school_year_id, activeCurriculum]);

  // ——— Subject candidates refresh (create only) ——————————————————————
  useEffect(() => {
    if (isEdit) return;
    (async () => {
      const gid = assignForm.grade_level_id;

      setAllSubjects([]); setGradeSubjects([]); setPage(1);
      setAssignForm((p) => ({ ...p, assignments: [] }));
      if (!gid) return;

      try {
        let assignedCodes = new Set();
        const { matches } = matchActiveByNameOrYear();
        if (matches) {
          const gradeEntry = activeByGrade[gid];
          const serverSubs = gradeEntry?.subjects || [];
          setGradeSubjects(serverSubs);
          assignedCodes = new Set(serverSubs.map((s) => s.subject_code));
        }

        const r2 = await fetch(joinUrl(BASE_URL, 'subjects/view-all-subjects'), { headers });
        if (r2.status === 401) return handleUnauthorized();
        const d2 = await r2.json();
        const subjects = d2?.success
          ? (d2.data || []).map((s) => ({
              subject_id: s.subject_id,
              subject_code: s.subject_code,
              subject_name: s.subject_name,
              is_required: false,
              units: 0,
            }))
          : [];
        const filtered = subjects.filter((s) => !assignedCodes.has(s.subject_code));
        setAllSubjects(filtered);
      } catch {
        setStatusModal({ show: true, title: 'Error', message: 'Failed to load subjects.', variant: 'danger' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, assignForm.grade_level_id, headers, activeByGrade, formData.curriculum_name, formData.school_year_id, matchActiveByNameOrYear]);

  // ——— Selection & pagination ————————————————————————————————————————
  const pendingForCurrent = pendingByGrade[assignForm.grade_level_id] || [];
  const selectedMap = new Map(assignForm.assignments.map((a) => [a.subject_id, a]));

  const filtered = useMemo(() => {
    const t = (query || '').trim().toLowerCase();
    const excludedIds = new Set(pendingForCurrent.map((a) => a.subject_id));
    const base = t
      ? allSubjects.filter(
          (s) =>
            (s.subject_code || '').toLowerCase().includes(t) ||
            (s.subject_name || '').toLowerCase().includes(t)
        )
      : allSubjects;
    return base
      .filter((s) => !excludedIds.has(s.subject_id))
      .map((s) => ({ ...s, ...(selectedMap.get(s.subject_id) || {}) }));
  }, [allSubjects, query, pendingForCurrent, selectedMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * ITEMS_PER_PAGE;
  const pageSlice = filtered.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const isSelected = (id2) => assignForm.assignments.some((a) => a.subject_id === id2);
  const selectedCount = assignForm.assignments.length;
  const pendingCountThisGrade = pendingForCurrent.length;

  const toggleRow = (row, checked) => {
    setAssignForm((prev) => {
      const cur = prev.assignments;
      if (checked) {
        if (cur.some((a) => a.subject_id === row.subject_id)) return prev;
        return { ...prev, assignments: [...cur, { ...row, units: Number(row.units) || 0, is_required: !!row.is_required }] };
      }
      return { ...prev, assignments: cur.filter((a) => a.subject_id !== row.subject_id) };
    });
  };

  const toggleSelectAllOnPage = (checked) => {
    setAssignForm((prev) => {
      if (!checked) {
        const idsOnPage = new Set(pageSlice.map((s) => s.subject_id));
        return { ...prev, assignments: prev.assignments.filter((a) => !idsOnPage.has(a.subject_id)) };
      }
      const curIds = new Set(prev.assignments.map((a) => a.subject_id));
      const toAdd = pageSlice
        .filter((s) => !curIds.has(s.subject_id))
        .map((s) => ({ ...s, units: Number(s.units) || 0, is_required: !!s.is_required }));
      return { ...prev, assignments: [...prev.assignments, ...toAdd] };
    });
  };

  const selectAllFiltered = () => {
    setAssignForm((prev) => {
      const curIds = new Set(prev.assignments.map((a) => a.subject_id));
      const toAdd = filtered
        .filter((s) => !curIds.has(s.subject_id))
        .map((s) => ({ ...s, units: Number(s.units) || 0, is_required: !!s.is_required }));
      return { ...prev, assignments: [...prev.assignments, ...toAdd] };
    });
  };

  const onUnitsChange = (subject_id, value) => {
    const v = value === '' ? '' : Number(value);
    setAssignForm((prev) => ({
      ...prev,
      assignments: prev.assignments
        .map((a) => (a.subject_id === subject_id ? { ...a, units: v } : a))
        .concat(prev.assignments.some((a) => a.subject_id === subject_id) ? [] : [{ subject_id, units: v, is_required: false }]),
    }));
  };

  const onRequiredChange = (subject_id, value) => {
    setAssignForm((prev) => ({
      ...prev,
      assignments: prev.assignments.map((a) => (a.subject_id === subject_id ? { ...a, is_required: !!value } : a)),
    }));
  };

  // ——— Local queue ops ————————————————————————————————————————————————
  const mergeAssignments = (base = [], extra = []) => {
    const map = new Map(base.map((a) => [a.subject_id, { ...a }]));
    for (const a of extra) map.set(a.subject_id, { ...(map.get(a.subject_id) || {}), ...a });
    return Array.from(map.values());
  };

  const saveLocalForGrade = () => {
    const gid = assignForm.grade_level_id;
    if (!gid || selectedCount === 0) {
      setStatusModal({ show: true, title: 'Check selection', message: 'Pick a grade and select at least one subject.', variant: 'warning' });
      return;
    }
    const invalid = assignForm.assignments.find((a) => {
      const n = Number(a.units);
      return !Number.isFinite(n) || n < 0;
    });
    if (invalid) {
      setStatusModal({ show: true, title: 'Units required', message: 'Enter a non-negative number for all selected subjects’ units.', variant: 'warning' });
      return;
    }
    setPendingByGrade((prev) => ({
      ...prev,
      [gid]: mergeAssignments(prev[gid], assignForm.assignments),
    }));
    setAssignForm((p) => ({ ...p, assignments: [] }));
    setStatusModal({ show: true, title: 'Saved locally', message: 'Assignments were added to this grade’s local queue.', variant: 'info' });
  };

  const updatePendingField = (subject_id, key, value) => {
    const gid = assignForm.grade_level_id;
    setPendingByGrade((prev) => ({
      ...prev,
      [gid]: (prev[gid] || []).map((a) => (a.subject_id === subject_id ? { ...a, [key]: key === 'units' ? Number(value) : !!value } : a)),
    }));
  };

  const removePending = (subject_id) => {
    const gid = assignForm.grade_level_id;
    setPendingByGrade((prev) => ({
      ...prev,
      [gid]: (prev[gid] || []).filter((a) => a.subject_id !== subject_id),
    }));
  };

  const clearPendingForGrade = () => {
    const gid = assignForm.grade_level_id;
    if (!gid) return;
    setPendingByGrade((prev) => ({ ...prev, [gid]: [] }));
  };

  // ——— Save + bulk assign ——————————————————————————————————————————————
  const findCurriculumIdFallback = async (payload) => {
    try {
      const res = await fetch(joinUrl(BASE_URL, 'curriculum/view-all-curriculums'), { headers });
      if (res.status === 401) return handleUnauthorized();
      const j = await res.json();
      if (!j?.success || !Array.isArray(j.data)) return null;
      const matches = j.data.filter(
        (c) =>
          Number(c.school_year_id) === Number(payload.school_year_id) &&
          String(c.curriculum_name).trim().toLowerCase() === String(payload.curriculum_name).trim().toLowerCase()
      );
      if (matches.length === 0) return null;
      const best = matches.reduce((a, b) => ((a?.curriculum_id || 0) > (b?.curriculum_id || 0) ? a : b));
      return Number(best.curriculum_id) || null;
    } catch {
      return null;
    }
  };

  const resolveCurriculumIdFromResult = async (result, payload) => {
    const direct = result?.curriculumId ?? result?.data?.curriculum_id ?? result?.data?.id ?? null;
    let cid = direct != null ? Number(direct) : null;
    if (!cid || Number.isNaN(cid)) cid = await findCurriculumIdFallback(payload);
    return cid && !Number.isNaN(cid) ? cid : null;
  };

  const saveCurriculum = useCallback(async () => {
    if (!checkToken()) throw new Error('Unauthorized.');
    if (!formData.curriculum_name.trim() || !formData.school_year_id) {
      throw new Error('Curriculum name and school year are required.');
    }
    const endpoint = isEdit
      ? joinUrl(BASE_URL, `curriculum/update-curriculum/${id}`)
      : joinUrl(BASE_URL, 'curriculum/create-curriculum');

    const payload = {
      curriculum_name: formData.curriculum_name.trim(),
      school_year_id: Number(formData.school_year_id),
    };

    setLoading(true);
    setBusyLabel(isEdit ? 'Updating curriculum…' : 'Creating curriculum…');
    try {
      const res = await fetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (res.status === 401) return handleUnauthorized();
      const result = await res.json();
      if (!result?.success) throw new Error(result?.message || 'Failed to save curriculum.');

      let cid = isEdit ? Number(id) : null;
      if (!cid || Number.isNaN(cid)) cid = await resolveCurriculumIdFromResult(result, payload);
      if (!cid || Number.isNaN(cid)) throw new Error('Missing curriculumId after save.');

      setSavedCurriculumId(cid);
      return cid;
    } finally {
      setLoading(false);
      setBusyLabel('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, isEdit, id, headers]);

  const labelForGrade = (gid) => {
    const g = gradeLevels.find((x) => x.grade_level_id === Number(gid));
    return g ? `${g.grade_name} (${g.grade_code})` : `Grade #${gid}`;
  };

  const URL_BULK_ASSIGN = joinUrl(BASE_URL, 'subject-grade-levels/bulk-create');

  const bulkAssignForGrade = useCallback(
    async (gid) => {
      const gradeId = Number(gid);
      if (!gradeId || Number.isNaN(gradeId)) return { skipped: true };

      const staged = pendingByGrade[gradeId] || [];
      const inline = gradeId === assignForm.grade_level_id ? assignForm.assignments : [];
      const toAssignMerged = mergeAssignments(staged, inline);

      const toAssign = toAssignMerged
        .map((a) => ({
          subject_id: Number(a.subject_id),
          grade_level_id: gradeId,
          is_required: !!a.is_required,
          units: a.units === '' || a.units == null ? 0 : Number(a.units),
        }))
        .filter(
          (a) =>
            Number.isFinite(a.subject_id) &&
            Number.isFinite(a.grade_level_id) &&
            Number.isFinite(a.units) &&
            a.units >= 0
        );

      if (toAssign.length === 0) return { skipped: true };

      const payload = { assignments: toAssign };

      setLoading(true);
      setBusyLabel(`Assigning subjects to ${labelForGrade(gradeId)}…`);
      try {
        const res = await fetch(URL_BULK_ASSIGN, { method: 'POST', headers, body: JSON.stringify(payload) });
        if (res.status === 401) return handleUnauthorized();
        const data = await res.json();
        if (!data?.success) throw new Error(data?.message || `Failed to assign for ${labelForGrade(gradeId)}.`);

        setPendingByGrade((prev) => ({ ...prev, [gradeId]: [] }));

        const { matches } = matchActiveByNameOrYear();
        if (gradeId === assignForm.grade_level_id && matches) {
          await loadActiveAssignments();
          setAssignForm((p) => ({ ...p, assignments: [] }));
        }
        return { skipped: false, count: toAssign.length };
      } finally {
        setLoading(false);
        setBusyLabel('');
      }
    },
    [assignForm, pendingByGrade, headers, matchActiveByNameOrYear, loadActiveAssignments]
  );

  const saveAndAssignAllGrades = async () => {
    try {
      await saveCurriculum();

      const gradesWithPending = Object.keys(pendingByGrade)
        .map(Number)
        .filter((gid) => (pendingByGrade[gid] || []).length > 0);

      if (
        assignForm.grade_level_id > 0 &&
        assignForm.assignments.length > 0 &&
        !gradesWithPending.includes(assignForm.grade_level_id)
      ) {
        gradesWithPending.push(assignForm.grade_level_id);
      }

      if (gradesWithPending.length === 0) {
        setStatusModal({ show: true, title: 'Saved', message: 'Curriculum saved. No pending assignments across grades.', variant: 'success' });
        return;
      }

      const results = [];
      for (const gid of gradesWithPending) {
        try {
          const r = await bulkAssignForGrade(gid);
          results.push({ gid, ok: true, count: r?.count || 0 });
        } catch (err) {
          results.push({ gid, ok: false, error: err.message || 'Failed' });
        }
      }

      await loadActiveAssignments();

      const okLines = results.filter((x) => x.ok).map((x) => `• ${labelForGrade(x.gid)} — ${x.count} subject(s)`);
      const badLines = results.filter((x) => !x.ok).map((x) => `• ${labelForGrade(x.gid)} — ${x.error}`);

      setStatusModal({
        show: true,
        title: badLines.length ? 'Partial Success' : 'Success',
        message:
          (okLines.length ? `Assigned:\n${okLines.join('\n')}` : 'No assignments saved.') +
          (badLines.length ? `\n\nFailed:\n${badLines.join('\n')}` : ''),
        variant: badLines.length ? 'warning' : 'success',
      });
    } catch (err) {
      setStatusModal({ show: true, title: 'Error', message: err.message || 'Failed to save & assign all.', variant: 'danger' });
    }
  };

  // ——— Derived UI —————————————————————————————————————————————————————
  const selectedSY = useMemo(
    () => schoolYears.find((s) => s.school_year_id === Number(formData.school_year_id)),
    [schoolYears, formData.school_year_id]
  );
  const selectedSYLabel = selectedSY
    ? (selectedSY.start_year && selectedSY.end_year ? `${selectedSY.start_year} - ${selectedSY.end_year}` : `SY #${selectedSY.school_year_id}`)
    : '';
  const totalPendingAcross = Object.values(pendingByGrade).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  const hasInlineForCurrentGrade = assignForm.grade_level_id > 0 && assignForm.assignments.length > 0;
  const matchInfo = matchActiveByNameOrYear();
  const selectedMatchesActive = matchInfo.matches;

  // ——— Render (single compact container) ——————————————————————————————
  return (
    <div className="container-xxl my-3">
      <BusyOverlay show={loading && !!busyLabel} label={busyLabel} />
      <StatusModal {...statusModal} onHide={() => setStatusModal((s) => ({ ...s, show: false }))} />

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        {/* Header strip */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-3 border-bottom bg-light">
          <div className="d-flex flex-column">
            <h5 className="fw-bold mb-0">
              {isEdit ? 'Update Curriculum' : 'Create Curriculum & Assign Subjects'}
            </h5>
            <small className="text-muted">
              One compact screen: name + school year, then assign subjects per grade.
            </small>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {!isEdit && <StatPill title="Total staged items across all grades">Queued: {totalPendingAcross}</StatPill>}
            {activeCurriculum ? (
              <StatPill variant="success" title="Active curriculum from the server">
                Active: {activeCurriculum.curriculum_name} (SY #{activeCurriculum.school_year_id})
              </StatPill>
            ) : (
              <StatPill variant="secondary">No active curriculum</StatPill>
            )}
            {selectedMatchesActive ? (
              <StatPill variant="primary">Matches active by {matchInfo.reason === 'name' ? 'name' : 'year'}</StatPill>
            ) : (
              <StatPill variant="warning">Inputs don’t match active</StatPill>
            )}
            <button
              type="button"
              className="btn btn-light btn-sm border d-flex align-items-center gap-2 px-3"
              onClick={() => navigate(-1)}
            >
              <FaArrowLeft /> Back
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-3 p-lg-4">
          {/* STEP 1: Curriculum (compact) */}
          <div className="row g-2 mb-3">
            <div className="col-12 col-md-6">
              <label htmlFor="curriculum_name" className="form-label fw-semibold small mb-1">Curriculum Name</label>
              <input
                id="curriculum_name"
                name="curriculum_name"
                className="form-control form-control-sm"
                placeholder="e.g., K–12 Core 2026"
                value={formData.curriculum_name}
                onChange={(e) => setFormData((p) => ({ ...p, curriculum_name: e.target.value }))}
                autoComplete="off"
                required
                maxLength={128}
              />
            </div>
            <div className="col-12 col-md-4">
              <label htmlFor="school_year_id" className="form-label fw-semibold small mb-1">School Year</label>
              <select
                id="school_year_id"
                name="school_year_id"
                className="form-select form-select-sm"
                value={formData.school_year_id}
                onChange={(e) => setFormData((p) => ({ ...p, school_year_id: e.target.value }))}
                required
              >
                <option value="" disabled>Select…</option>
                {schoolYears.map((sy) => {
                  const used = usedSchoolYears.includes(sy.school_year_id) && (!isEdit || sy.school_year_id !== Number(formData.school_year_id));
                  const label = sy.start_year && sy.end_year ? `${sy.start_year} - ${sy.end_year}${used ? ' (Used)' : ''}` : 'Unknown Year';
                  return (
                    <option key={sy.school_year_id} value={sy.school_year_id} disabled={used}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <div className="form-text small">One curriculum per school year.</div>
            </div>
            <div className="col-12 col-md-2 d-flex align-items-end">
              {isEdit && (
                <button
                  type="button"
                  className="btn btn-dark btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
                  onClick={async () => {
                    try {
                      await saveCurriculum();
                      navigate(-1);
                    } catch (err) {
                      setStatusModal({ show: true, title: 'Error', message: err.message || 'Failed to update curriculum.', variant: 'danger' });
                    }
                  }}
                  disabled={loading}
                >
                  <FaCheck /> Update
                </button>
              )}
            </div>
            <div className="col-12">
              <div className="alert alert-info py-2 small mb-0">
                <strong>Preview:</strong> {formData.curriculum_name || '—'} • {selectedSYLabel || '—'}
              </div>
            </div>
          </div>

          {/* STEP 2: Assign (create only) */}
          {!isEdit && (
            <>
              {/* Sticky mini-toolbar inside card */}
              <div
                className="border rounded-3 mb-3 position-sticky top-0 bg-white p-2"
                style={{ zIndex: 1 }}
              >
                <div className="row g-2 align-items-center">
                  <div className="col-12 col-lg-4">
                    <select
                      className="form-select form-select-sm"
                      value={assignForm.grade_level_id}
                      onChange={(e) => { setAssignForm((p) => ({ ...p, grade_level_id: Number(e.target.value) })); setPage(1); }}
                    >
                      <option value={0}>Select grade level…</option>
                      {gradeLevels.map((g) => (
                        <option key={g.grade_level_id} value={g.grade_level_id}>
                          {g.grade_name} ({g.grade_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-lg-5">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">Search</span>
                      <input
                        className="form-control"
                        placeholder="Find by code or name"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                        aria-label="Search subjects"
                      />
                      {query && (
                        <button className="btn btn-outline-secondary" onClick={() => { setQuery(''); setPage(1); }}>
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="col-12 col-lg-3 d-flex gap-2 justify-content-lg-end">
                    <StatPill variant="secondary">Selected: {selectedCount}</StatPill>
                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm d-flex align-items-center gap-2"
                      disabled={!assignForm.grade_level_id || filtered.length === 0}
                      onClick={selectAllFiltered}
                      title="Select all filtered subjects"
                    >
                      <FaPlusSquare /> Select All
                    </button>
                  </div>
                </div>

                <div className="mt-2 small text-muted">
                  {savedCurriculumId ? <span>Curriculum ID: {savedCurriculumId}</span> : <span>Not saved yet</span>}
                  {' '}&middot;{' '}
                  {selectedMatchesActive
                    ? <span className="text-primary">Showing server assignments (matched by {matchInfo.reason === 'name' ? 'name' : 'year'})</span>
                    : <span>No server assignments shown</span>}
                </div>
              </div>

              {/* Inline subject table */}
              {!assignForm.grade_level_id ? (
                <div className="text-center text-muted py-5">Pick a grade level to start assigning subjects.</div>
              ) : (
                <>
                  <div className="table-responsive border rounded-3">
                    {pageSlice.length === 0 ? (
                      <div className="text-center text-muted py-5">No subjects available to assign.</div>
                    ) : (
                      <table className="table table-sm table-hover align-middle mb-0">
                        <thead className="table-light position-sticky top-0" style={{ zIndex: 1 }}>
                          <tr>
                            <th style={{ width: 44 }}>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={pageSlice.length > 0 && pageSlice.every((r) => isSelected(r.subject_id))}
                                onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                                aria-label="Select all on page"
                              />
                            </th>
                            <th style={{ width: 140 }}>Code</th>
                            <th>Name</th>
                            <th style={{ width: 140 }}>Units</th>
                            <th style={{ width: 110 }}>Required</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageSlice.map((s) => {
                            const selected = isSelected(s.subject_id);
                            return (
                              <tr
                                key={s.subject_id}
                                className={selected ? 'table-primary' : ''}
                                style={selected ? { borderLeft: '4px solid var(--bs-primary)' } : undefined}
                              >
                                <td>
                                  <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={selected}
                                    onChange={(e) => toggleRow(s, e.target.checked)}
                                    aria-label={`Select ${s.subject_code}`}
                                  />
                                </td>
                                <td className="fw-medium">{s.subject_code}</td>
                                <td>{s.subject_name}</td>
                                <td>
                                  <div className="input-group input-group-sm">
                                    <input
                                      type="number"
                                      min="0"
                                      className="form-control"
                                      placeholder="0"
                                      value={selected ? (s.units ?? 0) : ''}
                                      onChange={(e) => onUnitsChange(s.subject_id, e.target.value)}
                                      disabled={!selected}
                                      aria-label={`Units for ${s.subject_code}`}
                                    />
                                    <span className="input-group-text">units</span>
                                  </div>
                                </td>
                                <td className="text-center">
                                  <div className="form-check form-switch d-inline-flex">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      role="switch"
                                      checked={selected ? !!s.is_required : false}
                                      onChange={(e) => onRequiredChange(s.subject_id, e.target.checked)}
                                      disabled={!selected}
                                      aria-label={`Required toggle for ${s.subject_code}`}
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Pagination */}
                  <div className="d-flex align-items-center justify-content-between mt-2">
                    <div className="small text-muted">Page {safePage} of {totalPages}</div>
                    <div className="btn-group btn-group-sm">
                      <button
                        className="btn btn-outline-secondary"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                      >
                        <FaChevronLeft /> Prev
                      </button>
                      <button
                        className="btn btn-outline-secondary"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                      >
                        Next <FaChevronRight />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Local queue (this grade) */}
              {assignForm.grade_level_id !== 0 && pendingCountThisGrade > 0 && (
                <div className="mt-3">
                  <div className="border rounded-3 p-2">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="fw-semibold small mb-0">Saved Locally — not yet committed</div>
                      <div className="d-flex align-items-center gap-2">
                        <StatPill variant="secondary">Items: {pendingCountThisGrade}</StatPill>
                        <button
                          className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2"
                          onClick={clearPendingForGrade}
                        >
                          <FaTrashAlt /> Clear All
                        </button>
                      </div>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: 140 }}>Code</th>
                            <th>Name</th>
                            <th style={{ width: 160 }}>Units</th>
                            <th style={{ width: 120 }}>Required</th>
                            <th style={{ width: 90 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingForCurrent.map((a) => (
                            <tr key={a.subject_id}>
                              <td className="fw-medium">{a.subject_code}</td>
                              <td>{a.subject_name}</td>
                              <td>
                                <div className="input-group input-group-sm">
                                  <input
                                    type="number"
                                    min="0"
                                    className="form-control"
                                    value={a.units ?? 0}
                                    onChange={(e) => updatePendingField(a.subject_id, 'units', e.target.value)}
                                  />
                                  <span className="input-group-text">units</span>
                                </div>
                              </td>
                              <td className="text-center">
                                <div className="form-check form-switch d-inline-flex">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    checked={!!a.is_required}
                                    onChange={(e) => updatePendingField(a.subject_id, 'is_required', e.target.checked)}
                                  />
                                </div>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-2"
                                  onClick={() => removePending(a.subject_id)}
                                  title="Remove from local queue"
                                >
                                  <FaTimes /> Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Server assignments (read-only) */}
              {assignForm.grade_level_id !== 0 && selectedMatchesActive && gradeSubjects.length > 0 && (
                <div className="mt-3">
                  <div className="border rounded-3 p-2">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="fw-semibold small mb-0">
                        Current Server Assignments — {labelForGrade(assignForm.grade_level_id)}
                      </div>
                      <StatPill variant="success">From active</StatPill>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: 140 }}>Code</th>
                            <th>Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gradeSubjects.map((s) => (
                            <tr key={s.subject_id}>
                              <td className="fw-medium">{s.subject_code}</td>
                              <td>{s.subject_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Primary actions (create) */}
              <div className="d-flex flex-wrap justify-content-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
                  onClick={saveLocalForGrade}
                  disabled={!assignForm.grade_level_id || selectedCount === 0}
                  title="Store the current selection in this grade's local queue (no API call)"
                >
                  <FaSave /> Assign (Save Locally)
                </button>
                <button
                  type="button"
                  className="btn btn-dark btn-sm d-flex align-items-center gap-2"
                  onClick={saveAndAssignAllGrades}
                  disabled={loading || (totalPendingAcross === 0 && !hasInlineForCurrentGrade)}
                  title="Save the curriculum then commit all queued assignments across grades"
                >
                  <FaCheck /> Save & Assign All Grades
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpsertCurriculum;
