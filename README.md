# TQM Quiz System — Next-Generation Assessment SaaS Platform

> **Author**: Piyush Pilkhwal (2410301049)  
> **Course / Subject**: BBAT104 Total Quality Management (TQM)  
> **Architecture**: Microservices-Ready Monorepo (Node.js Express + React 19 + Tailwind CSS + WebSocket)

---

## 🌟 Key Highlights & System Capabilities

### 1. Phase P1 — Identity, Multi-Role RBAC & Security
- **Role-Based Access Control (RBAC)**: Differentiated roles for **Student / Learner**, **Teacher / Creator**, **Organization Admin**, and **Platform Super Admin**.
- **Cryptographic Security**: Dual-token architecture with 15-minute JWT Access Tokens, 7-day Refresh Token rotation stored securely, and bcrypt password hashing.
- **Account Lifecycles**: Secure self-registration, tokenized email verification, self-service password reset, and one-click role switching for evaluation.

### 2. Phase P2 — Google Forms-Style Quiz Studio & Question Bank
- **Quiz Studio**:
  - Live debounced autosave (`DIRTY` $\rightarrow$ `SAVING` $\rightarrow$ `SAVED`) with dirty-state unload guards.
  - Interactive **"+ Add Question Below"** floating toolbar that smoothly auto-scrolls and focuses on newly added questions.
  - Subject Name selector with an instant **"+ Add New Subject"** creation modal.
  - Structured Question Identifiers (`QID`, e.g., `TQM-MCQ-MED-001`) automatically formatted based on subject, question type, difficulty, and order.
  - Automatic calculation of Total Quiz Duration from the sum of individual question timers.
- **6 Supported Question Types**:
  1. `MCQ_SINGLE` — Single correct answer.
  2. `MCQ_MULTI` — Multiple selection with proportional scoring and $-0.25$ negative marking penalty on incorrect picks.
  3. `TRUE_FALSE` — Dual-choice toggle.
  4. `FILL_BLANK` — Fill-in-the-blank with case-insensitive matching, whitespace trimming, and punctuation normalization.
  5. `SHORT_ANSWER` — Open-ended response matched against accepted answer variants (`|`).
  6. `NUMERICAL` — Mathematical/numerical inputs with configurable tolerance margin ($\pm \text{tolerance}$).
- **Centralized Question Bank**:
  - Filterable by subject, question type, and difficulty.
  - Automatic synchronization from Quiz Studio to Question Bank, plus whole-quiz bank import.

### 3. Phase P3 — Self-Paced Quiz Attempts, Scoring Engine & Mistake Notebook
- **Learner Experience**:
  - Discover accessible quizzes filtered by subject and difficulty.
  - Zero-knowledge question masking (answers and grading keys stripped on server before delivery to prevent inspection attacks).
  - Authoritative backend countdown timer with auto-submit upon expiration.
  - Interactive Question Palette with answered/unanswered tracking, flagged question markers, and live progress bar.
- **Authoritative Scoring Engine**: Authoritative server-side evaluation across all 6 question types with idempotency protection.
- **Mistake Notebook**:
  - Automatically captures incorrectly answered questions into the learner's personal Mistake Notebook.
  - Displays human-readable student answers vs. correct solutions with detailed explanations.
  - Repeat mistake counter (`Missed 2x`), subject filters, and an interactive **"Mark Resolved"** revision flow.
- **Analytics & Dashboards**:
  - **Student Dashboard**: Performance stats, recent attempts, quick resume, and mistake counters.
  - **Teacher Dashboard**: Attempt counts, class score averages, pass rates, and question-level review.
  - **Super Admin Dashboard**: Full platform user management, role assignments, audit logs, and quiz oversight.

### 4. Phase P4 — Live Multiplayer Quiz Engine (In Progress)
- **Host Controller**: Real-time lobby, big 6-digit session PIN, participant roster, synchronized question runner, and leaderboard reveal.
- **Participant Runner**: Real-time WebSocket synchronization (`ws`), instant answer submission feedback, and live rankings.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ (tested on Node v20+)
- npm or yarn

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/Shaan276/TQM-Quiz-System.git
cd TQM-Quiz-System

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Running in Development Mode
```bash
# In Terminal 1 (Start Express API Server on port 5000)
cd server
node src/server.js

# In Terminal 2 (Start Vite Dev Server on port 3000)
cd client
npm run dev
```

### 3. Running Automated Tests
```bash
# Run complete test suite (P1, P2, and P3 test suites)
npm test
```

---

## 📁 Repository Structure

```
TQM-Quiz-System/
├── client/                     # React 19 + Tailwind CSS Frontend
│   ├── src/
│   │   ├── components/         # Sidebar, ErrorBoundary, Shared UI
│   │   ├── context/            # AuthContext (JWT & User state)
│   │   ├── views/              # Studio, Attempts, Mistake Notebook, Dashboards
│   │   └── App.jsx             # Main Router & View Guards
│   └── package.json
├── server/                     # Express.js REST & Real-Time Backend
│   ├── src/
│   │   ├── database/           # SQLite migrations & seeds
│   │   ├── middleware/         # RBAC Auth & Rate limiting
│   │   ├── routes/             # Auth, Quizzes, Questions, Attempts, Mistakes
│   │   └── server.js           # Server bootstrap
│   ├── tests/                  # Automated test suites (P1, P2, P3)
│   └── package.json
├── docs/                       # Architecture, PRD, Database Schema & Design System
├── reference/                  # Course Guidelines, Allotment & Report Templates
└── package.json
```
