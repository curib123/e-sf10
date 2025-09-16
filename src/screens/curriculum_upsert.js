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

/** Safe URL joiner (avoids double/missing slashes) */
const joinUrl = (base, path) =>
  `${(base || '').replace(/\/$/, '')}/${(path || '').replace(/^\//, '')}`;

/** Busy overlay (centered) */
const BusyOverlay = ({ show, label }) => {
  if (!show) return null;
  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: 'rgba(0,0,0,.15)', zIndex: 2000 }}
    >
      <div className="bg-white rounded-4 shadow p-4 d-flex align-items-center gap-3">
        <div className="spinner-border" role="status" aria-hidden="true" />
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

  // ------------------ Curriculum (LOCAL until save) ------------------
  const [formData, setFormData] = useState({
    curriculum_name: '',
    school_year_id: '',
  });

  const [schoolYears, setSchoolYears] = useState([]);
  const [usedSchoolYears, setUsedSchoolYears] = useState([]);
  const [savedCurriculumId, setSavedCurriculumId] = useState(isEdit ? Number(id) : null);

  // Active curriculum + its grade map (via /subjects/view-all-sub-grade-levels)
  const [activeCurriculum, setActiveCurriculum] = useState(null); // { curriculum_id, curriculum_name, school_year_id }
  const [activeByGrade, setActiveByGrade] = useState({}); // { [grade_level_id]: { grade_code, grade_name, subjects:[...] } }

  // Async UX
  const [loading, setLoading] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [statusModal, setStatusModal] = useState({ show: false, title: '', message: '', variant: 'info' });

  const handleUnauthorized = () => {
    setStatusModal({ show: true, title: 'Unauthorized', message: 'Please log in.', variant: 'danger' });
    sessionStorage.removeItem('token');
    setTimeout(() => navigate('/login'), 900);
  };
  const checkToken = () => {
    if (!token) { handleUnauthorized(); return false; }
    return true;
  };

  // Load school years
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

  // Mark used SYs (one curriculum per SY)
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

  // Load existing curriculum for edit (local)
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ------------------ Assign Subjects (local queue per grade) — CREATE MODE ONLY ------------------
  const [gradeLevels, setGradeLevels] = useState([]);
  const [gradeSubjects, setGradeSubjects] = useState([]); // server state for current grade (from active curriculum if matched)
  const [allSubjects, setAllSubjects] = useState([]);     // candidate subjects for picker (with inline fields)

  const [assignForm, setAssignForm] = useState({ grade_level_id: 0, assignments: [] }); // current inline selection
  const [pendingByGrade, setPendingByGrade] = useState({}); // { [gradeId]: Assignment[] } — LOCAL QUEUE

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // grade levels (create mode only)
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

  // UTIL: merge assignments by subject_id (later wins)
  const mergeAssignments = (base = [], extra = []) => {
    const map = new Map(base.map((a) => [a.subject_id, { ...a }]));
    for (const a of extra) map.set(a.subject_id, { ...(map.get(a.subject_id) || {}), ...a });
    return Array.from(map.values());
  };

  // -------- Load active curriculum assignments (all grades) --------
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
      const cur = j.curriculum || null;
      setActiveCurriculum(cur);
      const mapping = {};
      (j.data || []).forEach((g) => {
        mapping[Number(g.grade_level_id)] = {
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
      setActiveByGrade(mapping);
    } catch {
      setActiveCurriculum(null);
      setActiveByGrade({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  // Load once and also when inputs change (name/year banners)
  useEffect(() => {
    loadActiveAssignments();
  }, [loadActiveAssignments, formData.curriculum_name, formData.school_year_id]);

  // ---------- Match logic: prefer NAME, fallback YEAR ----------
  const matchActiveByNameOrYear = useCallback(() => {
    const nameInput = (formData.curriculum_name || '').trim().toLowerCase();
    const nameActive = (activeCurriculum?.curriculum_name || '').trim().toLowerCase();
    const nameMatch = nameInput && nameActive && nameInput === nameActive;

    if (nameMatch) return { matches: true, reason: 'name' };

    const yearInput = formData.school_year_id ? Number(formData.school_year_id) : null;
    const yearActive = activeCurriculum ? Number(activeCurriculum.school_year_id) : null;
    const yearMatch = !!yearInput && !!yearActive && yearInput === yearActive;

    return yearMatch ? { matches: true, reason: 'year' } : { matches: false, reason: null };
  }, [formData.curriculum_name, formData.school_year_id, activeCurriculum]);

  // Refresh picker whenever GRADE or inputs change (CREATE MODE ONLY)
  useEffect(() => {
    if (isEdit) return;
    (async () => {
      const gid = assignForm.grade_level_id;

      // reset UI state
      setAllSubjects([]);
      setGradeSubjects([]);
      setPage(1);
      setAssignForm((p) => ({ ...p, assignments: [] }));

      if (!gid) return;
      try {
        let assignedCodesSet = new Set();

        const { matches } = matchActiveByNameOrYear();
        if (matches) {
          // Show current server assignments for this grade from the active curriculum
          const gradeEntry = activeByGrade[gid];
          const serverSubs = gradeEntry?.subjects || [];
          setGradeSubjects(serverSubs);
          assignedCodesSet = new Set(serverSubs.map((s) => s.subject_code));
        } else {
          // No match (by name or year) → no server table, no hiding
          setGradeSubjects([]);
        }

        // Load all subjects and hide those already assigned in server (only when matched)
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
        const filtered = subjects.filter((s) => !assignedCodesSet.has(s.subject_code));
        setAllSubjects(filtered);
      } catch {
        setStatusModal({ show: true, title: 'Error', message: 'Failed to load subjects.', variant: 'danger' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, assignForm.grade_level_id, headers, activeByGrade, formData.curriculum_name, formData.school_year_id, matchActiveByNameOrYear]);

  // ------------ Filters & pagination (CREATE MODE ONLY) ------------
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * itemsPerPage;
  const pageSlice = filtered.slice(pageStart, pageStart + itemsPerPage);

  const isSelected = (id2) => assignForm.assignments.some((a) => a.subject_id === id2);
  const selectedCount = assignForm.assignments.length;
  const pendingCountThisGrade = pendingForCurrent.length;

  const toggleRow = (row, checked) => {
    setAssignForm((prev) => {
      const cur = prev.assignments;
      if (checked) {
        if (cur.some((a) => a.subject_id === row.subject_id)) return prev;
        return { ...prev, assignments: [...cur, { ...row, units: Number(row.units) || 0, is_required: !!row.is_required }] };
      } else {
        return { ...prev, assignments: cur.filter((a) => a.subject_id !== row.subject_id) };
      }
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

  // ---- Local queue ops for current grade ----
  const saveLocalForGrade = () => {
    const gid = assignForm.grade_level_id;
    if (!gid || selectedCount === 0) {
      setStatusModal({ show: true, title: 'Check selection', message: "Pick a grade and select at least one subject.", variant: 'warning' });
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

  const resetAssign = () => {
    setAssignForm({ grade_level_id: 0, assignments: [] });
    setAllSubjects([]); setGradeSubjects([]);
    setQuery(''); setPage(1);
  };

  // ------------------ Save curriculum + (CREATE) assign all ------------------
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

  /** BULK ASSIGN — EXACT BODY SHAPE (NO curriculum_id FIELD) */
  const URL_BULK_ASSIGN = joinUrl(BASE_URL, 'subject-grade-levels/bulk-create');

  const bulkAssignForGrade = useCallback(
    async (gid) => {
      const gradeId = Number(gid);
      if (!gradeId || Number.isNaN(gradeId)) return { skipped: true };

      // merge staged + inline for this grade
      const staged = pendingByGrade[gradeId] || [];
      const inline = gradeId === assignForm.grade_level_id ? assignForm.assignments : [];
      const toAssignMerged = mergeAssignments(staged, inline);

      // normalize + validate
      const toAssign = toAssignMerged
        .map((a) => ({
          subject_id: Number(a.subject_id),
          grade_level_id: gradeId,
          is_required: !!a.is_required,
          units: a.units === '' || a.units == null ? 0 : Number(a.units),
        }))
        // remove any partial/invalid rows
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
        console.log('[bulk-create][REQ]', URL_BULK_ASSIGN, payload);
        const res = await fetch(URL_BULK_ASSIGN, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (res.status === 401) return handleUnauthorized();
        const data = await res.json();
        console.log('[bulk-create][RES]', data);

        if (!data?.success) {
          throw new Error(data?.message || `Failed to assign for ${labelForGrade(gradeId)}.`);
        }

        // Clear local queue for this grade on success
        setPendingByGrade((prev) => ({ ...prev, [gradeId]: [] }));

        // If we’re previewing the active curriculum, refresh that read-only view
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
      // Optional: keep saving the curriculum first so the "Create" flow persists meta
      await saveCurriculum();

      // Build list of grades to commit
      const gradesWithPending = Object.keys(pendingByGrade)
        .map(Number)
        .filter((gid) => (pendingByGrade[gid] || []).length > 0);

      // Include current inline if any
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

      // Refresh active curriculum cache after all assigns (read-only)
      await loadActiveAssignments();

      // Summary
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

  // ---------- UI helpers ----------
  const selectedSY = useMemo(
    () => schoolYears.find((s) => s.school_year_id === Number(formData.school_year_id)),
    [schoolYears, formData.school_year_id]
  );
  const selectedSYLabel = selectedSY
    ? (selectedSY.start_year && selectedSY.end_year ? `${selectedSY.start_year} - ${selectedSY.end_year}` : `SY #${selectedSY.school_year_id}`)
    : '';

  const totalPendingAcross = Object.values(pendingByGrade).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  const hasInlineForCurrentGrade = assignForm.grade_level_id > 0 && assignForm.assignments.length > 0;

  const matchInfo = matchActiveByNameOrYear(); // {matches, reason}
  const selectedMatchesActive = matchInfo.matches;

  // ---------- UI ----------
  return (
    <div className="container-xxl my-4">
      <BusyOverlay show={loading && !!busyLabel} label={busyLabel} />
      <StatusModal {...statusModal} onHide={() => setStatusModal((s) => ({ ...s, show: false }))} />

      {/* HEADER */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <h4 className="fw-bold mb-0">
          {isEdit ? 'Update Curriculum' : 'Create Curriculum & Assign Subjects'}
        </h4>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {!isEdit && <span className="badge text-bg-light">Queued across grades: {totalPendingAcross}</span>}
          {activeCurriculum ? (
            <span className="badge text-bg-success">
              Active: {activeCurriculum.curriculum_name} (SY #{activeCurriculum.school_year_id})
            </span>
          ) : (
            <span className="badge text-bg-secondary">No active curriculum</span>
          )}
          {selectedMatchesActive ? (
            <span className="badge text-bg-primary">
              Inputs match active by {matchInfo.reason === 'name' ? 'Curriculum Name' : 'School Year'}
            </span>
          ) : (
            <span className="badge text-bg-warning">Inputs don’t match active by name/year</span>
          )}
          <button type="button" className="btn btn-light border d-flex align-items-center gap-2 px-3" onClick={() => navigate(-1)}>
            <FaArrowLeft /> Back
          </button>
        </div>
      </div>

      {/* -------- CURRICULUM FORM -------- */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body p-4 p-lg-5">
          <div className="row g-3 g-lg-4">
            <div className="col-12">
              <label htmlFor="curriculum_name" className="form-label fw-semibold">Curriculum Name</label>
              <input
                id="curriculum_name"
                name="curriculum_name"
                className="form-control"
                placeholder="e.g., K–12 Core 2026"
                value={formData.curriculum_name}
                onChange={handleChange}
                autoComplete="off"
                required
                maxLength={128}
              />
            </div>

            <div className="col-md-6">
              <label htmlFor="school_year_id" className="form-label fw-semibold">School Year</label>
              <select
                id="school_year_id"
                name="school_year_id"
                className="form-select"
                value={formData.school_year_id}
                onChange={handleChange}
                required
              >
                <option value="" disabled>Select school year…</option>
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
              <div className="form-text">Each school year can have only one curriculum.</div>
            </div>

            {/* quick preview */}
            <div className="col-12">
              <div className="alert alert-info small mb-0">
                <strong>Preview:</strong> {formData.curriculum_name || '—'} • {selectedSYLabel || '—'}
              </div>
            </div>
          </div>

          {/* Footer actions for the form */}
          <div className="d-flex justify-content-end gap-2 mt-4">
            {isEdit ? (
              <button
                type="button"
                className="btn btn-dark d-flex align-items-center gap-2"
                onClick={async () => {
                  try {
                    await saveCurriculum();
                    // Auto-back on success
                    navigate(-1);
                  } catch (err) {
                    setStatusModal({ show: true, title: 'Error', message: err.message || 'Failed to update curriculum.', variant: 'danger' });
                  }
                }}
                disabled={loading}
              >
                <FaCheck /> Update Curriculum
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* -------- CREATE MODE: ASSIGN UI + PREVIEWS -------- */}
      {!isEdit && (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4 p-lg-5">
            <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 gap-2">
              <h5 className="fw-bold mb-0">Assign Subjects to Grade</h5>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="badge text-bg-light">
                  {savedCurriculumId ? `Curriculum ID: ${savedCurriculumId}` : 'Not saved yet'}
                </span>

                {selectedMatchesActive ? (
                  <span className="badge text-bg-primary">
                    Using active assignments (matched by {matchInfo.reason === 'name' ? 'name' : 'year'})
                  </span>
                ) : (
                  <span className="badge text-bg-secondary">No server assignments shown (inputs don’t match active)</span>
                )}
              </div>
            </div>

            {/* Grade + bulk select */}
            <div className="row g-2 align-items-center mb-3">
              <div className="col-12 col-lg-4">
                <select
                  className="form-select"
                  value={assignForm.grade_level_id}
                  onChange={(e) => { setAssignForm((p) => ({ ...p, grade_level_id: Number(e.target.value) })); setPage(1); }}
                >
                  <option value={0}>Select grade level</option>
                  {gradeLevels.map((g) => (
                    <option key={g.grade_level_id} value={g.grade_level_id}>
                      {g.grade_name} ({g.grade_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-lg-8 d-flex gap-2 justify-content-lg-end">
                <span className="badge text-bg-secondary d-inline-flex align-items-center gap-2 px-3">
                  Selected: <span className="fw-semibold">{selectedCount}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-outline-success d-flex align-items-center gap-2"
                  disabled={!assignForm.grade_level_id || filtered.length === 0}
                  onClick={selectAllFiltered}
                  title="Select all filtered subjects"
                >
                  <FaPlusSquare /> Select All (filtered)
                </button>
              </div>
            </div>

            {/* Inline Subject Picker (no new editor component) */}
            {!assignForm.grade_level_id ? (
              <div className="text-center text-muted py-5">Pick a grade level to start.</div>
            ) : (
              <>
                {/* Toolbar */}
                <div className="row g-2 align-items-center mb-3">
                  <div className="col-12 col-lg-8">
                    <div className="input-group">
                      <span className="input-group-text">Search</span>
                      <input
                        className="form-control"
                        placeholder="Code or name"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                      />
                      {query && (
                        <button className="btn btn-outline-secondary" onClick={() => { setQuery(''); setPage(1); }}>
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="col-12 col-lg-4 d-flex gap-2 justify-content-lg-end">
                    <span className="badge text-bg-secondary d-inline-flex align-items-center gap-2 px-3">
                      Filtered: <span className="fw-semibold">{filtered.length}</span>
                    </span>
                  </div>
                </div>

                {/* Table */}
                <div className="table-responsive border rounded-3">
                  {pageSlice.length === 0 ? (
                    <div className="text-center text-muted py-5">No subjects available to assign.</div>
                  ) : (
                    <table className="table table-striped table-hover align-middle mb-0">
                      <thead className="table-light position-sticky top-0" style={{ zIndex: 1 }}>
                        <tr>
                          <th style={{ width: 48 }}>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={pageSlice.length > 0 && pageSlice.every((r) => isSelected(r.subject_id))}
                              onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                            />
                          </th>
                          <th style={{ width: 140 }}>Code</th>
                          <th>Name</th>
                          <th style={{ width: 120 }}>Units</th>
                          <th style={{ width: 120 }}>Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageSlice.map((s) => {
                          const selected = isSelected(s.subject_id);
                          return (
                            <tr key={s.subject_id} className={selected ? 'table-primary' : ''}>
                              <td>
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={selected}
                                  onChange={(e) => toggleRow(s, e.target.checked)}
                                />
                              </td>
                              <td className="fw-medium">{s.subject_code}</td>
                              <td>{s.subject_name}</td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-control form-control-sm"
                                  placeholder="0"
                                  value={selected ? (s.units ?? 0) : ''}
                                  onChange={(e) => onUnitsChange(s.subject_id, e.target.value)}
                                  disabled={!selected}
                                />
                              </td>
                              <td className="text-center">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={selected ? !!s.is_required : false}
                                  onChange={(e) => onRequiredChange(s.subject_id, e.target.checked)}
                                  disabled={!selected}
                                />
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
                  <div className="btn-group">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                    >
                      <FaChevronLeft /> Prev
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                    >
                      Next <FaChevronRight />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Preview: Saved Locally for this Grade */}
            {assignForm.grade_level_id !== 0 && pendingCountThisGrade > 0 && (
              <div className="mt-3">
                <div className="card border-0 shadow-sm rounded-4">
                  <div className="card-body">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <h6 className="fw-bold mb-0">Saved Locally for This Grade (not yet committed)</h6>
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge text-bg-secondary">Items: {pendingCountThisGrade}</span>
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
                            <th style={{ width: 140 }}>Units</th>
                            <th style={{ width: 120 }}>Required</th>
                            <th style={{ width: 80 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingForCurrent.map((a) => (
                            <tr key={a.subject_id}>
                              <td className="fw-medium">{a.subject_code}</td>
                              <td>{a.subject_name}</td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-control form-control-sm"
                                  value={a.units ?? 0}
                                  onChange={(e) => updatePendingField(a.subject_id, 'units', e.target.value)}
                                />
                              </td>
                              <td className="text-center">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={!!a.is_required}
                                  onChange={(e) => updatePendingField(a.subject_id, 'is_required', e.target.checked)}
                                />
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
              </div>
            )}

            {/* Preview: Current server assignments for this grade (READ-ONLY) */}
            {assignForm.grade_level_id !== 0 && selectedMatchesActive && gradeSubjects.length > 0 && (
              <div className="mt-3">
                <div className="card border-0 shadow-sm rounded-4">
                  <div className="card-body">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <h6 className="fw-bold mb-0">
                        Server Assignments for {labelForGrade(assignForm.grade_level_id)} (active curriculum)
                      </h6>
                      <span className="badge text-bg-success">From active</span>
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
              </div>
            )}

            {/* Actions (CREATE) — only the two buttons you want */}
            <div className="d-flex flex-wrap justify-content-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-outline-primary d-flex align-items-center gap-2"
                onClick={saveLocalForGrade}
                disabled={!assignForm.grade_level_id || selectedCount === 0}
                title="Store the current selection in this grade's local queue (no API call)"
              >
                <FaSave /> Assign (Save Locally)
              </button>

              <button
                type="button"
                className="btn btn-dark d-flex align-items-center gap-2"
                onClick={saveAndAssignAllGrades}
                disabled={loading || (totalPendingAcross === 0 && !hasInlineForCurrentGrade)}
                title="Save the curriculum then commit all queued assignments across grades"
              >
                <FaCheck /> Save & Assign All Grades
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpsertCurriculum;
