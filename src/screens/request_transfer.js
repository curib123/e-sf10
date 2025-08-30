import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import StatusModal from "../components/status_modal";
import { checkToken } from "../components/token_checker";

// Base API URL
const BASE_URL = process.env.REACT_APP_API_BASE_URL;

const RequestTransferForm = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const token = useMemo(() => sessionStorage.getItem("token"), []);

  const [schoolName, setSchoolName] = useState("");
  const [schoolSuggestions, setSchoolSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "success",
  });

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    checkToken();
    inputRef.current?.focus();
  }, []);

  // Authorized request helper
  const request = async (method, url, data = null) => {
    if (!token) throw new Error("Missing authorization token. Please log in again.");
    const res = await axios({
      method,
      url: `${BASE_URL}${url}`,
      headers: { Authorization: `Bearer ${token}` },
      data,
    });
    return res.data;
  };

  // Debounced school search
  const searchSchools = (query) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 2) {
      setSchoolSuggestions([]);
      setShowSuggestions(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await request("get", `/transfer-request/search-schools?query=${encodeURIComponent(query)}`);
        const list = data?.success ? data.data ?? [] : [];
        setSchoolSuggestions(list);
        setShowSuggestions(list.length > 0);
        setHighlightIdx(-1);
      } catch {
        setSchoolSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSearching(false);
      }
    }, 250);
  };

  const handleSchoolInputChange = (e) => {
    const q = e.target.value;
    setSchoolName(q);
    searchSchools(q);
  };

  const chooseSuggestion = (value) => {
    setSchoolName(value);
    setShowSuggestions(false);
    setHighlightIdx(-1);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || !schoolSuggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, schoolSuggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      chooseSuggestion(schoolSuggestions[highlightIdx]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setHighlightIdx(-1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!schoolName.trim()) {
      setModal({ show: true, title: "Missing info", message: "Please enter a requesting school.", variant: "warning" });
      return;
    }
    setLoading(true);
    try {
      const data = await request("post", "/transfer-request/create-request", {
        student_id: parseInt(studentId, 10),
        requesting_school: schoolName.trim(),
      });

      if (data?.success) {
        setModal({
          show: true,
          title: "Success",
          message: "Transfer request created successfully.",
          variant: "success",
        });
        setTimeout(() => navigate("/student_information"), 1200);
      } else {
        setModal({
          show: true,
          title: "Error",
          message: data?.message || "Failed to create transfer request.",
          variant: "danger",
        });
      }
    } catch (err) {
      setModal({
        show: true,
        title: "Error",
        message: err.message || "An error occurred while sending the request.",
        variant: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="mx-auto" style={{ maxWidth: 640 }}>
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4 p-lg-5">
            <h4 className="fw-bold mb-1">Student Transfer Request</h4>
            <p className="text-muted mb-4">Send a request to transfer this student to another school.</p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3 position-relative">
                <label htmlFor="schoolInput" className="form-label fw-semibold">
                  Requesting School <span className="text-danger">*</span>
                </label>

                <div className="input-group">
                  <input
                    id="schoolInput"
                    ref={inputRef}
                    type="text"
                    className="form-control"
                    placeholder="e.g. Tagum Sur High School"
                    value={schoolName}
                    onChange={handleSchoolInputChange}
                    onFocus={() => schoolSuggestions.length > 0 && setShowSuggestions(true)}
                    onKeyDown={handleKeyDown}
                    aria-autocomplete="list"
                    aria-expanded={showSuggestions}
                    aria-controls="school-suggestions"
                    autoComplete="off"
                    required
                  />
                  <span className="input-group-text bg-white">
                    {searching ? (
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                    ) : (
                      <span className="text-muted">⌕</span>
                    )}
                  </span>
                </div>

                {showSuggestions && (
                  <ul
                    id="school-suggestions"
                    ref={listRef}
                    className="list-group position-absolute w-100 shadow-sm"
                    style={{
                      top: "100%",
                      zIndex: 1020,
                      maxHeight: 240,
                      overflowY: "auto",
                      borderRadius: "0.5rem",
                    }}
                    role="listbox"
                  >
                    {schoolSuggestions.map((school, idx) => (
                      <li
                        key={`${school}-${idx}`}
                        role="option"
                        aria-selected={highlightIdx === idx}
                        className={
                          "list-group-item list-group-item-action d-flex align-items-center " +
                          (highlightIdx === idx ? "active" : "")
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => chooseSuggestion(school)}
                        onMouseEnter={() => setHighlightIdx(idx)}
                        style={{ cursor: "pointer" }}
                        title={school}
                      >
                        <span className="text-truncate">{school}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="form-text">Start typing at least 2 characters to search schools.</div>
              </div>

              <div className="d-flex justify-content-between mt-4">
                <button
                  type="button"
                  className="btn btn-light border px-4 text-nowrap"
                  onClick={() => navigate(-1)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success px-4 d-inline-flex align-items-center gap-2 text-nowrap"
                  disabled={loading || !schoolName.trim()}
                >
                  {loading && (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  )}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <StatusModal {...modal} onHide={() => setModal((m) => ({ ...m, show: false }))} />
    </div>
  );
};

export default RequestTransferForm;
