import './App.css';
import { useState } from 'react';
import Login from './auth/login';
import DashboardLayout from './dashboard/DashboardLayout';
import { BrowserRouter as Router } from "react-router-dom";

function App() {
  // Magbutang ta'g state kung naka-login ba si user o wala pa
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // I-check nato kung login na si user
  // Kung login na, mo-display ta sa dashboard layout
  // Kung wala pa, login page lang usa iyang makita
  return isLoggedIn ? (
    <Router>
          <DashboardLayout />
        </Router>
    
  ) : (
    <Login onLogin={() => setIsLoggedIn(true)} />
  );
}

export default App;
