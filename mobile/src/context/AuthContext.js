import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStoredAuth() {
      try {
        const storedToken = await AsyncStorage.getItem('qubix_access_token');
        if (storedToken) {
          setToken(storedToken);
          const profileRes = await authApi.getProfile();
          if (profileRes.success && profileRes.data?.profile) {
            setUser(profileRes.data.profile);
          }
        }
      } catch (e) {
        console.error('[AuthContext] Load auth error', e);
      } finally {
        setLoading(false);
      }
    }
    loadStoredAuth();
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    if (res.success && res.data?.accessToken) {
      await AsyncStorage.setItem('qubix_access_token', res.data.accessToken);
      if (res.data.refreshToken) {
        await AsyncStorage.setItem('qubix_refresh_token', res.data.refreshToken);
      }
      setToken(res.data.accessToken);
      setUser(res.data.user);
      return { success: true };
    }
    return { success: false, message: res.error?.message || 'Login failed' };
  };

  const logout = async () => {
    await AsyncStorage.removeItem('qubix_access_token');
    await AsyncStorage.removeItem('qubix_refresh_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
