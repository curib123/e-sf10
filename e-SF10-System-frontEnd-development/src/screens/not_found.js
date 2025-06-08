
import { Link } from 'react-router-dom';
import { FaExclamationTriangle } from 'react-icons/fa';

const NotFound = () => {
  return (
    <div className="container d-flex flex-column justify-content-center align-items-center vh-100">
      <div className="text-center">
        <FaExclamationTriangle size={80} className="text-warning mb-4" />
        <h1 className="display-1 fw-bold">404</h1>
        <p className="fs-4 text-muted">Oops! The page you're looking for doesn't exist.</p>
        <Link to="/dashboard" className="btn btn-primary mt-3">
          Go Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
