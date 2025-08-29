import { FaExclamationTriangle } from 'react-icons/fa';
import './css/NotFound.css'; // We'll create a small CSS file for animation and styles

const NotFound = () => {
  return (
    <div className="notfound-container d-flex flex-column justify-content-center align-items-center vh-100">
      <div className="text-center">
        <FaExclamationTriangle size={100} className="text-warning mb-4 shake-animation" />
        <h1 className="display-1 fw-bold bounce-in">404</h1>
        <p className="fs-4 text-muted fade-in">
          Oops! The page you're looking for doesn't exist.
        </p>
      </div>
    </div>
  );
};

export default NotFound;
