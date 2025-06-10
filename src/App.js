import './App.css';
import { useEffect, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import Login from './auth/login';
import Dashboard from './main/dashboard'; 
import { isTokenExpired } from './components/token_checker'; 

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
 const userRole = sessionStorage.getItem("user_role");
 
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
    setIsLoggedIn(true);
    console.log(userRole);
    if(userRole == "admin"){
 window.location.href = '/dashboard'; 
    }else{
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
