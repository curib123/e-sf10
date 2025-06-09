

import { FaExclamationTriangle } from 'react-icons/fa';

const NotFound = () => {
  return (
    <div className="container d-flex flex-column justify-content-center align-items-center v-50">
      <div className="text-center">
        <FaExclamationTriangle size={80} className="text-warning mb-4" />
        <h1 className="display-1 fw-bold">404</h1>
        <p className="fs-4 text-muted">Oops! The page you're looking for doesn't exist.</p>
      </div>
    </div>
  );
};

export default NotFound;
