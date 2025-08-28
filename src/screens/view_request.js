import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { checkToken } from '../components/token_checker'; 

const TransferRequestsTable = () => {
  const [allRequests, setAllRequests] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusChanges, setStatusChanges] = useState({});
  const [message, setMessage] = useState(null);

  const token = sessionStorage.getItem("token");
  const baseUrl = "http://localhost:3001/esf10/transfer-request";
  const itemsPerPage = 10;

  useEffect(() => { checkToken(); }, []);
  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(null), 3000); return () => clearTimeout(t); } }, [message]);

  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      let page = 1, allData = [], totalPages = 1;
      while (page <= totalPages) {
        const res = await axios.get(`${baseUrl}/view-all-requests?page=${page}&limit=${itemsPerPage}`, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        if (res.data.success) {
          allData = [...allData, ...res.data.data];
          totalPages = res.data.pagination.totalPages;
          page++;
        } else break;
      }
      setAllRequests(allData);
    } catch (error) {
      console.error(error);
      setMessage({ text: "❌ Failed to load requests.", type: "error" });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAllRequests(); }, []);

  const updateRequestStatus = async (id) => {
    const newStatus = statusChanges[id];
    if (!newStatus) return;
    setUpdating(true);
    try {
      const res = await axios.put(`${baseUrl}/update-request/${id}`, { request_status: newStatus }, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      if (res.data.success) {
        setMessage({ text: `✅ ${res.data.message}`, type: "success" });
        fetchAllRequests();
      }
    } catch (error) {
      console.error(error);
      setMessage({ text: "❌ Failed to update request.", type: "error" });
    } finally { setUpdating(false); }
  };

  const deleteRequest = async (id) => {
    setDeleting(true);
    try {
      const res = await axios.delete(`${baseUrl}/delete/${id}`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      if (res.data.success) {
        setMessage({ text: `✅ ${res.data.message}`, type: "success" });
        setAllRequests(prev => prev.filter(r => r.transfer_id !== id));
      }
    } catch (error) {
      console.error(error);
      setMessage({ text: "❌ Failed to delete request.", type: "error" });
    } finally { setDeleting(false); }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = allRequests.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(allRequests.length / itemsPerPage);

  return (
    <div className="container my-5">
      <div className="card  border-0 rounded-4">
        <div className="card-header bg-gradient-primary text-white d-flex justify-content-between align-items-center py-3 px-4 rounded-top">
          <h3 className="mb-0 fs-5 text-dark"> Student Transfer Requests</h3>
          <span className="text-dark">Total: {allRequests.length}</span>
        </div>

        <div className="card-body px-3">
          {/* Inline message */}
          {message && (
            <div className={`alert ${message.type === "success" ? "alert-success" : "alert-danger"} py-2 d-flex justify-content-between align-items-center rounded-3`}>
              <span>{message.text}</span>
              <button className="btn-close" onClick={() => setMessage(null)}></button>
            </div>
          )}

          {loading ? (
            <div className="text-center text-muted py-5">Loading requests...</div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-borderless table-hover align-middle mb-0">
                  <thead>
                    <tr className="text-secondary small text-uppercase">
                      <th>ID</th>
                      <th>LRN</th>
                      <th>Name</th>
                      <th>School</th>
                      <th>Status</th>
                      <th>Requested At</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.length ? currentItems.map(req => (
                      <tr key={req.transfer_id}>
                        <td>{req.transfer_id}</td>
                        <td>{req.lrn}</td>
                        <td>{req.first_name} {req.last_name}</td>
                        <td>{req.requesting_school}</td>
                        <td>
                          <span className={`badge rounded-pill px-3 py-1 fw-semibold ${
                            req.request_status === "Approved" ? "bg-success bg-opacity-10 text-success" :
                            req.request_status === "Rejected" ? "bg-danger bg-opacity-10 text-danger" :
                            "bg-warning bg-opacity-10 text-warning"
                          }`}>
                            {req.request_status || "Pending"}
                          </span>
                        </td>
                        <td className="text-nowrap">{new Date(req.requested_at).toLocaleString()}</td>
                        <td className="text-end">
                          <div className="d-flex gap-2 justify-content-end">
                            <select
                              value={statusChanges[req.transfer_id] || req.request_status || 'Pending'}
                              onChange={e => setStatusChanges({ ...statusChanges, [req.transfer_id]: e.target.value })}
                              className="form-select form-select-sm rounded"
                              disabled={updating || deleting}
                              style={{ minWidth: "90px" }}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Approved">Approved</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                            <button
                              className="btn btn-outline-primary btn-sm rounded-circle p-2"
                              onClick={() => updateRequestStatus(req.transfer_id)}
                              disabled={updating || deleting}
                              title="Update Status"
                            >
                              <FaEdit size={14}/>
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm rounded-circle p-2"
                              onClick={() => deleteRequest(req.transfer_id)}
                              disabled={updating || deleting}
                              title="Delete Request"
                            >
                              <FaTrash size={14}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="7" className="text-center text-muted py-4">No transfer requests found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="d-flex justify-content-between align-items-center mt-3 px-2">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setCurrentPage(p => Math.max(p-1,1))} disabled={currentPage === 1}>◀ Prev</button>
                <span className="small fw-medium">Page {currentPage} of {totalPages}</span>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setCurrentPage(p => Math.min(p+1,totalPages))} disabled={currentPage === totalPages}>Next ▶</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransferRequestsTable;
