import './App.css';
import { useEffect, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import Login from './auth/login';
import Dashboard from './main/sidebar';
import { isTokenExpired } from './components/token_checker';

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

    if(user_role == "teacher"){
    window.location.href = '/teacher-dashboard';
    }else{s
      window.location.href = '/dashboard';
    }
    
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
