import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// On Android Emulator, 10.0.2.2 maps to the host machine localhost:5000
// On physical Android device via Wi-Fi, change this to your computer's LAN IP (e.g. http://192.168.1.50:5000)
const DEV_API_URL = Platform.OS === 'android' 
  ? 'http://10.0.2.2:5000/api/v1' 
  : 'http://localhost:5000/api/v1';

export const API_BASE_URL = DEV_API_URL;

/**
 * Universal Authenticated Request Helper
 */
export async function apiRequest(endpoint, options = {}) {
  const token = await AsyncStorage.getItem('qubix_access_token');
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(`[Qubix Mobile API Error] ${endpoint}:`, err);
    return { success: false, error: { message: 'Network connection failed. Ensure server is running.' } };
  }
}

// Auth API Calls
export const authApi = {
  login: (email, password) => 
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  register: (name, email, password, role = 'STUDENT') =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, passwordConfirmation: password, role })
    }),

  getProfile: () => 
    apiRequest('/users/profile')
};

// Quizzes & Assessments API Calls
export const quizApi = {
  getAvailableQuizzes: () => 
    apiRequest('/quizzes/available'),

  getAssignedTests: () => 
    apiRequest('/assignments/student/my'),

  startAttempt: (quizId) => 
    apiRequest('/attempts/start', {
      method: 'POST',
      body: JSON.stringify({ quiz_id: quizId })
    }),

  getAttemptSummary: (attemptId) => 
    apiRequest(`/attempts/${attemptId}/summary`),

  submitAnswer: (attemptId, questionId, selectedKeys, timeSpentSec = 0) =>
    apiRequest(`/attempts/${attemptId}/response`, {
      method: 'PUT',
      body: JSON.stringify({
        question_id: questionId,
        selected_keys: selectedKeys,
        time_spent_sec: timeSpentSec
      })
    }),

  finishAttempt: (attemptId) =>
    apiRequest(`/attempts/${attemptId}/submit`, {
      method: 'POST'
    })
};

// Live Multiplayer API Calls
export const liveApi = {
  lookupSessionByPin: (pin) => 
    apiRequest(`/live-sessions/lookup/${pin}`),

  getLeaderboard: (sessionId) => 
    apiRequest(`/live-sessions/${sessionId}/leaderboard`)
};
