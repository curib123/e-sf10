import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { FaEdit, FaTrash } from "react-icons/fa";
import { checkToken } from "../components/token_checker";
import StatusModal from "../components/status_modal";

const RequestList = () => {
  const BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const token = useMemo(() => sessionStorage.getItem("token"), []);
  const itemsPerPage = 10;

  const [allRequests, setAllRequests] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [statusChanges, setStatusChanges] = useState({});
  const [modal, setModal] = useState({
    show: false,
    title: "",
    message: "",
    variant: "danger",
  });

  useEffect(() => {
    checkToken();
    fetchAllRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  // Fetch all transfer requests (all pages)
  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      let page = 1;
      let allData = [];
      let totalPages = 1;

      while (page <= totalPages) {
        const res = await axios.get(
          `${BASE_URL}/transfer-request/view-all-requests?page=${page}&limit=${itemsPerPage}`,
          auth
        );
        if (res.data?.success) {
          allData = allData.concat(res.data.data || []);
          totalPages = res.data?.pagination?.totalPages || 1;
          page += 1;
        } else {
          break;
        }
      }
      setAllRequests(allData);
    } catch (error) {
      setModal({
        show: true,
        title: "Error",
        message: "Failed to load requests.",
        variant: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (id) => {
    const newStatus = statusChanges[id];
    if (!newStatus) return;
    setUpdating(true);
    try {
      const res = await axios.put(
        `${BASE_URL}/transfer-request/update-request/${id}`,
        { request_status: newStatus },
        auth
      );
      if (res.data?.success) {
        setModal({
          show: true,
          title: "Success",
          message: res.data.message,
          variant: "success",
        });
        setStatusChanges((m) => ({ ...m, [id]: undefined }));
        await fetchAllRequests();
      } else {
        setModal({
          show: true,
          title: "Error",
          message: res.data?.message || "Failed to update request.",
          variant: "danger",
        });
      }
    } catch (error) {
      setModal({
        show: true,
        title: "Error",
        message: "Failed to update request.",
        variant: "danger",
      });
    } finally {
      setUpdating(false);
    }
  };

  const deleteRequest = async (id) => {
    setDeleting(true);
    try {
      const res = await axios.delete(
        `${BASE_URL}/transfer-request/delete/${id}`,
        auth
      );
      if (res.data?.success) {
        setModal({
          show: true,
          title: "Success",
          message: res.data.message,
          variant: "success",
        });
        setAllRequests((prev) => prev.filter((r) => r.transfer_id !== id));
        setStatusChanges((m) => {
          const { [id]: _, ...rest } = m;
          return rest;
        });
      } else {
        setModal({
          show: true,
          title: "Error",
          message: res.data?.message || "Failed to delete request.",
          variant: "danger",
        });
      }
    } catch (error) {
      setModal({
        show: true,
        title: "Error",
        message: "Failed to delete request.",
        variant: "danger",
      });
    } finally {
      setDeleting(false);
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = allRequests.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(allRequests.length / itemsPerPage) || 1;

  const badgeClass = (status) =>
    status === "Approved"
      ? "text-bg-success"
      : status === "Rejected"
      ? "text-bg-danger"
      : "text-bg-warning";

  return (
    <div className="container-xxl my-3">
      <StatusModal
        {...modal}
        onHide={() => setModal((m) => ({ ...m, show: false }))}
      />

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4 p-lg-5">
          {/* Header */}
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3">
            <h4 className="fw-bold mb-0">Student Transfer Requests</h4>
            <span className="badge text-bg-light text-muted fs-6">
              Total: {allRequests.length}
            </span>
          </div>

          {/* Table / Loading / Empty */}
          <div className="border rounded-3 overflow-hidden">
            {loading ? (
              <div className="text-center text-muted py-5">Loading requests…</div>
            ) : currentItems.length === 0 ? (
              <div className="text-center bg-body-tertiary p-5">
                <div className="mb-2">No requests found</div>
                <p className="text-muted small mb-0">
                  Try again later or refresh the page.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead
                    className="table-light"
                    style={{ position: "sticky", top: 0, zIndex: 1 }}
                  >
                    <tr className="text-secondary text-uppercase small">
                      <th style={{ width: 80 }}>ID</th>
                      <th>LRN</th>
                      <th>Name</th>
                      <th>School</th>
                      <th>Status</th>
                      <th>Requested At</th>
                      <th className="text-end" style={{ width: 240 }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((req) => {
                      const current = req.request_status || "Pending";
                      const chosen = statusChanges[req.transfer_id] ?? current;
                      const changed = chosen !== current;

                      return (
                        <tr key={req.transfer_id}>
                          <td className="text-muted">{req.transfer_id}</td>
                          <td className="fw-medium">{req.lrn}</td>
                          <td>{`${req.first_name} ${req.last_name}`}</td>
                          <td className="text-truncate" style={{ maxWidth: 220 }}>
                            {req.requesting_school}
                          </td>
                          <td>
                            <span className={`badge ${badgeClass(current)}`}>
                              {current}
                            </span>
                          </td>
                          <td className="text-nowrap">
                            {new Date(req.requested_at).toLocaleString()}
                          </td>
                          <td className="text-end">
                            <div className="d-flex justify-content-end align-items-center gap-2">
                              <select
                                value={chosen}
                                onChange={(e) =>
                                  setStatusChanges((m) => ({
                                    ...m,
                                    [req.transfer_id]: e.target.value,
                                  }))
                                }
                                className="form-select form-select-sm"
                                disabled={updating || deleting}
                                style={{ minWidth: 120 }}
                                aria-label="Change request status"
                              >
                                <option value="Pending">Pending</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                              </select>

                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1 text-nowrap px-3"
                                onClick={() => updateRequestStatus(req.transfer_id)}
                                disabled={updating || deleting || !changed}
                                title="Update Status"
                              >
                                <FaEdit size={14} />
                                Update
                              </button>

                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1 text-nowrap px-3"
                                onClick={() => deleteRequest(req.transfer_id)}
                                disabled={updating || deleting}
                                title="Delete Request"
                              >
                                <FaTrash size={14} />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <small className="text-muted">
                Page {currentPage} of {totalPages}
              </small>
              <div className="btn-group">
                <button
                  className="btn btn-outline-secondary btn-sm text-nowrap"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                >
                  ◀ Prev
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm text-nowrap"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(p + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestList;
