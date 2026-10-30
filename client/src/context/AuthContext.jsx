import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('quiz_access_token'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('quiz_refresh_token'));
  const [loading, setLoading] = useState(true);

  // Load user profile on initial mount if token present
  useEffect(() => {
    async function initUser() {
      if (accessToken) {
        try {
          const res = await fetch('/api/v1/users/profile', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          const data = await res.json();
          if (data.success) {
            setUser(data.data.profile);
          } else {
            // Attempt token refresh
            await refreshSession();
          }
        } catch (err) {
          console.error('[AuthContext] Init error:', err);
          logout();
        }
      }
      setLoading(false);
    }
    initUser();
  }, [accessToken]);

  const refreshSession = async () => {
    if (!refreshToken) {
      logout();
      return false;
    }
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.data.accessToken, data.data.refreshToken);
        return true;
      }
      logout();
      return false;
    } catch {
      logout();
      return false;
    }
  };

  const setSession = (newAccessToken, newRefreshToken, userData = null) => {
    setAccessToken(newAccessToken);
    setRefreshToken(newRefreshToken);
    localStorage.setItem('quiz_access_token', newAccessToken);
    localStorage.setItem('quiz_refresh_token', newRefreshToken);
    if (userData) {
      setUser(userData);
    }
  };

  const logout = async () => {
    if (accessToken) {
      try {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ refreshToken })
        });
      } catch (e) {}
    }
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem('quiz_access_token');
    localStorage.removeItem('quiz_refresh_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        loading,
        setSession,
        logout,
        setUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
