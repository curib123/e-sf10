import './App.css';

import {
  useEffect,
  useState,
} from 'react';

import { BrowserRouter as Router } from 'react-router-dom';

import Login from './auth/login';
import { isTokenExpired } from './components/token_checker';
import Dashboard from './main/sidebar';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (token && !isTokenExpired(token)) {
      setIsLoggedIn(true);
    } else {
      sessionStorage.clear();
      setIsLoggedIn(false);
    }
  }, []);

  const handleLogin = () => {
    const user_role = sessionStorage.getItem('user_role');
    setIsLoggedIn(true);
<<<<<<< HEAD
    if(user_role === 'teacher'){
      window.location.href = '/teacher-dashboard';
    } else {
      window.location.href = '/dashboard';
    }
=======

    if(user_role == "teacher"){
    window.location.href = '/teacher-dashboard';
    }else{
      window.location.href = '/dashboard';
    }
    
>>>>>>> 14fe1afe78912ec78d304f7b5a368cae4f172435
  };

  const handleLogout = () => {
    sessionStorage.clear();
    setIsLoggedIn(false);
    window.location.href = '/login';
  };

  return (
    <Router>
      {isLoggedIn ? (
        <Dashboard onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </Router>
  );
}

export default App;
