import { FaExclamationTriangle } from "react-icons/fa";

const NotFound = ({ isTokenExpired = false }) => {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100 bg-light">
      <div className="text-center p-4 rounded shadow bg-white">
        <FaExclamationTriangle
          size={80}
          className="text-warning mb-3"
        />
        <h1 className="display-4 fw-bold">404</h1>
        <p className="fs-5 text-muted mb-4">
          {isTokenExpired
            ? "Your session has expired. Please refresh to continue."
            : "Oops! The page you're looking for doesn't exist."}
        </p>

        {isTokenExpired && (
          <button
            className="btn btn-primary px-4 py-2"
            onClick={handleRefresh}
          >
            🔄 Refresh
          </button>
        )}
      </div>
    </div>
  );
};

export default NotFound;
