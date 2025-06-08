import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaEdit, FaTrash } from 'react-icons/fa';

const TransferRequestsTable = () => {
  const [allRequests, setAllRequests] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusChanges, setStatusChanges] = useState({});
  const [message, setMessage] = useState(null); // { text: '', type: 'success' | 'error' }

  const token = localStorage.getItem("token");
  const baseUrl = "http://localhost:3001/esf10/transfer-request";
  const itemsPerPage = 10;

  // Clear messages after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchAllRequests = async () => {
    let page = 1;
    let allData = [];
    let totalPages = 1;

    setLoading(true);
    try {
      while (page <= totalPages) {
        const response = await axios.get(`${baseUrl}/view-all-requests?page=${page}&limit=${itemsPerPage}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.data.success) {
          allData = [...allData, ...response.data.data];
          totalPages = response.data.pagination.totalPages;
          page++;
        } else {
          break;
        }
      }
      setAllRequests(allData);
    } catch (error) {
      console.error("Failed to fetch transfer requests:", error);
      setMessage({ text: "❌ Failed to load requests.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllRequests();
  }, []);

  const updateRequestStatus = async (transferId) => {
    const newStatus = statusChanges[transferId];
    if (!newStatus) return;

    setUpdating(true);
    try {
      const response = await axios.put(
        `${baseUrl}/update-request/${transferId}`,
        { request_status: newStatus },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setMessage({ text: `✅ ${response.data.message}`, type: "success" });
        fetchAllRequests();
      }
    } catch (error) {
      console.error("Error updating request:", error);
      setMessage({ text: "❌ Failed to update request.", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const deleteRequest = async (transferId) => {

    setDeleting(true);
    try {
      const response = await axios.delete(`${baseUrl}/delete/${transferId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setMessage({ text: `✅ ${response.data.message}`, type: "success" });
        setAllRequests((prev) => prev.filter((r) => r.transfer_id !== transferId));
      }
    } catch (error) {
      console.error("Error deleting request:", error);
      setMessage({ text: "❌ Failed to delete request.", type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  // Pagination slicing
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = allRequests.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(allRequests.length / itemsPerPage);

  return (
    <div className="container mt-5">
      <div className="card shadow-sm">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h3 className="mb-0">📋 Student Transfer Requests</h3>
          <span className="text-white-50">Total Requests: {allRequests.length}</span>
        </div>

        <div className="card-body p-3">
          {/* Message box */}
          {message && (
            <div
              className={`alert ${
                message.type === "success" ? "alert-success" : "alert-danger"
              } alert-dismissible fade show`}
              role="alert"
            >
              {message.text}
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => setMessage(null)}
              ></button>
            </div>
          )}

          {loading ? (
            <div className="text-center text-muted py-5">Loading requests...</div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>ID</th>
                      <th>LRN</th>
                      <th>Name</th>
                      <th>School</th>
                      <th>Status</th>
                      <th>Requested At</th>
                      <th style={{ minWidth: "160px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.length > 0 ? (
                      currentItems.map((req) => (
                        <tr key={req.transfer_id}>
                          <td>{req.transfer_id}</td>
                          <td>{req.lrn}</td>
                          <td>{req.first_name} {req.last_name}</td>
                          <td>{req.requesting_school}</td>
                          <td>
                            <span
                              className={`badge ${
                                req.request_status === "Approved"
                                  ? "bg-success"
                                  : req.request_status === "Rejected"
                                  ? "bg-danger"
                                  : "bg-warning text-dark"
                              }`}
                            >
                              {req.request_status || 'Pending'}
                            </span>
                          </td>
                          <td>{new Date(req.requested_at).toLocaleString()}</td>
                          <td>
                            <div className="d-flex gap-2 align-items-center">
                              <select
                                value={statusChanges[req.transfer_id] || req.request_status || 'Pending'}
                                onChange={(e) =>
                                  setStatusChanges({ ...statusChanges, [req.transfer_id]: e.target.value })
                                }
                                className="form-select form-select-sm"
                                disabled={updating || deleting}
                                aria-label="Change status"
                              >
                                <option value="Pending">Pending</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                              </select>

                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => updateRequestStatus(req.transfer_id)}
                                disabled={updating || deleting}
                                title="Update Status"
                                aria-label="Update status"
                              >
                                <FaEdit />
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => deleteRequest(req.transfer_id)}
                                disabled={updating || deleting}
                                title="Delete Request"
                                aria-label="Delete request"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center text-muted py-4">
                          No transfer requests found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="d-flex justify-content-between align-items-center p-3 border-top">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                >
                  ◀ Prev
                </button>

                <span className="fw-semibold">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next ▶
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransferRequestsTable;
