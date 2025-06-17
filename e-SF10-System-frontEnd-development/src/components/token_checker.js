

export const isTokenExpired = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (e) {
    return true; // Treat invalid token as expired
  }
};

export const checkToken = () => {
  const token = sessionStorage.getItem('token');
  
  if (!token || isTokenExpired(token)) {
    sessionStorage.clear();
    window.location.reload(); // Or redirect if preferred
  }
};
