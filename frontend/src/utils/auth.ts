// src/utils/auth.ts
export const verifyToken = async (): Promise<boolean> => {
  const token = localStorage.getItem('token');
  if (!token) return false;

  try {
    const response = await fetch('http://localhost:5000/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.ok;
  } catch (error) {
    console.error('Token verification failed:', error);
    return false;
  }
};

export const logout = async (): Promise<void> => {
  try {
    // Optional: Call backend logout endpoint if you have one
    await fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Logout failed:', error);
  } finally {
    localStorage.removeItem('token');
  }
};