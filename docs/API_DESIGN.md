# REST API Design Specification
## Standardized JSON Schemas, Error Handling, and Endpoint Directory

---

### 1. Global API Conventions & Protocol Standards

- **Base URI:** `/api/v1`
- **Protocol:** HTTPS (TLS 1.3)
- **Data Interchange Format:** JSON (`application/json; charset=utf-8`)
- **Authentication Header:** `Authorization: Bearer <access_token>`
- **Idempotency Support:** `idempotencyKey` supported on all attempt submission and quiz creation endpoints.

#### 1.1 Standard Success Envelope
```json
{
  "success": true,
  "data": { ... }
}
```

#### 1.2 Standard Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "ERR_VALIDATION",
    "message": "Descriptive human-readable explanation of error."
  }
}
```

---

### 2. Comprehensive Endpoint Directory

#### 2.1 Authentication & Profile (`/api/v1/auth`)
| Method | Path | Auth | Roles | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/register` | Public | None | Register account with email, name, password, and optional role (`STUDENT` / `TEACHER`). |
| `POST` | `/login` | Public | None | Authenticate credentials, issue access token and refresh token. |
| `POST` | `/verify-email` | Public | None | Verify account email using secure token. |
| `POST` | `/forgot-password` | Public | None | Dispatch password reset link with token. |
| `POST` | `/reset-password` | Public | None | Reset password with token. |
| `POST` | `/refresh` | Public | None | Rotate refresh token and issue new 15-minute access token. |
| `POST` | `/logout` | Authenticated | All | Invalidate session tokens. |

#### 2.2 Users & Super Admin Management (`/api/v1/users`)
| Method | Path | Auth | Roles | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/profile` | Authenticated | All | Retrieve current user profile and verification status. |
| `PUT` | `/profile` | Authenticated | All | Update user profile display name. |
| `PUT` | `/change-password` | Authenticated | All | Change account password. |
| `POST` | `/upgrade-to-teacher`| Authenticated | All | Upgrade student account to Teacher role. |
| `GET` | `/` | Authenticated | Admin/Super Admin | Paginated user directory with search and role filters. |
| `PATCH`| `/:id/role` | Authenticated | Super Admin | Promote or modify user role (`STUDENT`, `TEACHER`, `ORG_ADMIN`, `SUPER_ADMIN`). |
| `DELETE`| `/:id` | Authenticated | Super Admin | Safely delete a user account. |

#### 2.3 Quiz Studio & Discovery (`/api/v1/quizzes`)
| Method | Path | Auth | Roles | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/discover` | Authenticated | All | Discover published quizzes for taking. Strips answers and explanations to prevent cheating. |
| `GET` | `/subjects` | Authenticated | All | Retrieve list of distinct active subject categories. |
| `GET` | `/` | Authenticated | Teacher/Admin | List authored quizzes with search, subject, status, difficulty filters and sorting. |
| `POST` | `/` | Authenticated | Teacher/Admin | Create new quiz with settings and optional questions array. |
| `GET` | `/:id` | Authenticated | All | Retrieve full quiz details with questions, options, and answers. |
| `PUT` | `/:id` | Authenticated | Teacher/Admin | Autosave endpoint: update metadata, settings, and questions array. |
| `POST` | `/:id/publish` | Authenticated | Teacher/Admin | Validates quiz, creates immutable version snapshot in `quiz_versions`, sets status `PUBLISHED`. |
| `POST` | `/:id/unpublish` | Authenticated | Teacher/Admin | Reverts published quiz back to `DRAFT`. |
| `POST` | `/:id/duplicate` | Authenticated | Teacher/Admin | Deep-clones quiz and all questions as a new draft. |
| `DELETE` | `/:id` | Authenticated | Teacher/Admin | Safely delete quiz. |
| `GET` | `/:id/preview` | Authenticated | All | Student preview simulation mode. |
| `GET` | `/metrics/summary` | Authenticated | Teacher/Admin | Aggregated counts of quizzes, questions, drafts, and bank questions. |

#### 2.4 Question Bank (`/api/v1/question-bank`)
| Method | Path | Auth | Roles | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/` | Authenticated | Teacher/Admin | List reusable question bank items with filters. |
| `POST` | `/` | Authenticated | Teacher/Admin | Create reusable question in bank. |
| `POST` | `/from-quiz-question` | Authenticated | Teacher/Admin | Save authored quiz question into bank. |
| `POST` | `/save-entire-quiz` | Authenticated | Teacher/Admin | Bulk-save all questions from a quiz into the bank. |
| `POST` | `/:id/import-to-quiz` | Authenticated | Teacher/Admin | Import bank question into target quiz. |
| `PUT` | `/:id` | Authenticated | Teacher/Admin | Update bank question prompt or options. |
| `DELETE` | `/:id` | Authenticated | Teacher/Admin | Remove question from bank. |

#### 2.5 Quiz Attempts & Authoritative Scoring (`/api/v1/attempts`)
| Method | Path | Auth | Roles | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/start` | Authenticated | All | Begin or resume self-paced attempt. Loads published snapshot, masks answers, sets authoritative `expires_at`. |
| `GET` | `/:id` | Authenticated | All | Retrieve attempt state, remaining seconds, saved answers, and sanitized questions. |
| `PUT` | `/:id/answers` | Authenticated | All | Autosave learner's intermediate answers. Rejects if expired or completed. |
| `POST` | `/:id/submit` | Authenticated | All | Server-side authoritative scoring for all 6 types, penalty calculations, pass/fail evaluation, and Mistake Notebook logging. |
| `GET` | `/:id/summary` | Authenticated | All | Comprehensive score report and question review obeying `show_explanations` policy. |
| `GET` | `/history/my` | Authenticated | All | Learner's historical quiz attempts with scores and timestamps. |
| `GET` | `/quiz/:quizId` | Authenticated | Teacher/Admin | Teacher overview of all student attempts on their authored quiz. |

#### 2.6 Mistake Notebook (`/api/v1/mistakes`)
| Method | Path | Auth | Roles | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/` | Authenticated | All | List learner's logged mistakes with filters by subject, type, and resolution status. |
| `GET` | `/stats` | Authenticated | All | Total mistakes, unresolved count, resolved count, and subject breakdown. |
| `PATCH`| `/:id/resolve` | Authenticated | All | Toggle mistake resolution status (`is_resolved`). |
| `DELETE`| `/:id` | Authenticated | All | Remove question item from notebook. |

#### 2.7 Analytics (`/api/v1/analytics`)
| Method | Path | Auth | Roles | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/student` | Authenticated | All | Learner stats: completed quizzes, pass rate, average score %, mistake counts, recent attempts. |
| `GET` | `/teacher` | Authenticated | Teacher/Admin | Teacher stats: total student attempts, pass rate %, average score, hardest questions. |
| `GET` | `/admin` | Authenticated | Super Admin | Platform-wide counts of users, quizzes, and completed attempts. |