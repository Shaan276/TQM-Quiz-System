# Qubix — React Native Android Mobile Application

The official Android mobile application for **Qubix Assessment OS**.

---

## Architecture & Capabilities

- **Native Authentication & Token Rotation:** Connects directly to the backend with Bearer JWT persistence via `@react-native-async-storage/async-storage`.
- **Live Classroom PIN Access:** Enter 6/8-character live session PINs to participate in real-time multiplayer examinations.
- **Mobile Assessment Runner:** Timed quiz execution with single/multi-choice selection, automatic response persistence, and instant grading.
- **Cross-Platform Readiness:** Optimized for Android with support for both the standard Android Emulator (`10.0.2.2:5000`) and physical devices on local Wi-Fi.

---

## Directory Structure

```
mobile/
├── App.js                     # Root navigation & AuthProvider wrapper
├── app.json                   # Expo / Android package manifest (com.qubix.assessment)
├── package.json               # Mobile dependencies
└── src/
    ├── context/
    │   └── AuthContext.js     # User session & token state
    ├── screens/
    │   ├── LoginScreen.js     # Native dark-theme Sign In
    │   ├── StudentHomeScreen.js # Student arena, PIN input & test list
    │   ├── QuizRunnerScreen.js  # Timed quiz runner
    │   └── LiveSessionScreen.js # Multiplayer live room & podium
    └── services/
        └── api.js             # Qubix backend API client
```

---

## Quick Start (Run on Android)

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Start Android Emulator or Physical Device
- To run on Android Emulator:
  ```bash
  npm run android
  ```
- To run via Expo Go on your physical Android phone:
  ```bash
  npx expo start
  ```
  Scan the terminal QR code using the **Expo Go** app from the Google Play Store.

### 3. Backend Connection Note
- When running in an **Android Emulator**, `http://10.0.2.2:5000` automatically routes to your machine's `localhost:5000`.
- When testing on a **physical phone** via Wi-Fi, update `DEV_API_URL` in `src/services/api.js` to your computer's local LAN IP (e.g. `http://192.168.1.50:5000/api/v1`).
