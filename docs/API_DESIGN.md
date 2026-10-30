# REST API Design Specification
## Standardized JSON Schemas, Error Handling, and Endpoint Directory

---

### 1. Global API Conventions & Protocol Standards

- **Base URI:** `/api/v1`
- **Protocol:** HTTPS (TLS 1.3)
- **Data Interchange Format:** JSON (`application/json; charset=utf-8`)
- **Authentication Header:** `Authorization: Bearer <access_token>` or via HTTP-only session cookie.
- **Idempotency Header:** `Idempotency-Key: <UUIDv4>` supported on all attempt submission and quiz creation POST endpoints.

#### 1.1 Standard Success Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "latency_ms": 12.4,
    "timestamp": "2026-10-30T05:45:00.123Z"
  }
}
```

#### 1.2 Standard Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "ERR_POKA_YOKE_INVALID_KEY",
    "message": "Question options must contain at least one designated correct answer.",
    "details": [
      { "field": "options", "issue": "Missing correct_option flag" }
    ]
  },
  "meta": {
    "timestamp": "2026-10-30T05:45:00.123Z"
  }
}
```

---

### 2. Comprehensive Endpoint Directory

#### 2.1 Authentication & Profile (`/api/v1/auth`)
| Method | Path | Auth | Roles | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/register` | Public | None | Register teacher or student profile with email/password. |
| `POST` | `/login` | Public | None | Authenticate user, issue JWT access token and refresh cookie. |
| `POST` | `/refresh` | Public | None | Rotate refresh token and issue new 15-minute access token. |
| `POST` | `/logout` | Authenticated | All | Invalidate session in Redis and clear client cookies. |
| `GET` | `/me` | Authenticated | All | Return currently logged-in user profile and permissions. |

#### 2.2 Quiz Studio & Management (`/api/v1/quizzes`)
| Method | Path | Auth | Roles | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/` | Authenticated | All | List published quizzes with debounced search (`?query=`), category filtering, and sorting (`?sort=id_asc`). |
| `POST` | `/` | Authenticated | Teacher/Admin | Create new quiz header with title, category, duration, and passing score (Poka-Yoke enforced). |
| `GET` | `/:id` | Authenticated | All | Fetch full quiz details. If requester is a student, correct answer keys are scrubbed. |
| `PUT` | `/:id` | Authenticated | Teacher/Admin | Update quiz settings and increment version counter. |
| `DELETE` | `/:id` | Authenticated | Teacher/Admin | Soft-delete quiz (`is_archived = TRUE`), preserving historical attempts. |
| `GET` | `/categories` | Public | None | Retrieve distinct categories for fast dropdown filtering. |

#### 2.3 Question Authoring (`/api/v1/quizzes/:quiz_id/questions`)
| Method | Path | Auth | Roles | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/` | Authenticated | Teacher/Admin | List all questions and options for authoring view. |
| `POST` | `/` | Authenticated | Teacher/Admin | Add new question with options, correct answer keys, marks, and explanation. |
| `PUT` | `/:question_id` | Authenticated | Teacher/Admin | Edit question text or option set. |
| `DELETE` | `/:question_id` | Authenticated | Teacher/Admin | Remove question from quiz. |

#### 2.4 Sessions & Multiplayer Engine (`/api/v1/sessions`)
| Method | Path | Auth | Roles | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/` | Authenticated | Teacher/Admin | Create a new session (Live Game with 6-digit PIN or Assignment with deadline). |
| `GET` | `/:id` | Authenticated | All | Fetch session state, host info, and current question index. |
| `GET` | `/join/:code` | Public | None | Validate 6-digit game PIN and return basic lobby metadata. |
| `POST` | `/:id/status` | Authenticated | Teacher/Admin | Transition session state (`LOBBY` $\rightarrow$ `ACTIVE` $\rightarrow$ `COMPLETED`). |

#### 2.5 Quiz Attempts & Auto-Grading (`/api/v1/attempts`)
| Method | Path | Auth | Roles | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/start` | Public/Auth | All | Begin attempt for a session (creates attempt record with timestamp). |
| `POST` | `/:id/submit` | Public/Auth | All | Submit complete or final attempt; triggers atomic grading and score calculation ($< 100\text{ ms}$ SLA). |
| `GET` | `/:id/summary` | Authenticated | All | Fetch individual results, score percentage, and detailed pedagogical explanations. (Student privacy guarded). |

#### 2.6 Historical Reports & Cohort Analytics (`/api/v1/reports`)
| Method | Path | Auth | Roles | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/attempts` | Authenticated | All | Server-side paginated attempt history (`?page=1&page_size=10`). Students restricted to personal records; Teachers view all. |
| `GET` | `/metrics/dashboard` | Authenticated | Teacher/Admin | In-memory cached aggregate stats (pass rates, active quizzes, attempts). |
| `POST` | `/metrics/cache/flush`| Authenticated | Teacher/Admin | Force-invalidate RAM cache to verify real-time data sync. |

#### 2.7 Mistake Notebook (`/api/v1/notebook`)
| Method | Path | Auth | Roles | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/` | Authenticated | Student | List learner's historically failed questions with distractor analysis. |
| `POST` | `/practice` | Authenticated | Student | Synthesize a personalized practice quiz generated strictly from unresolved mistakes. |
| `PATCH`| `/:id/resolve` | Authenticated | Student | Mark a mistake entry as mastered following successful re-attempt. |

#### 2.8 Audit & System Governance (`/api/v1/admin`)
| Method | Path | Auth | Roles | Purpose & Description |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/audit-logs` | Authenticated | Superadmin | Retrieve system transaction audit logs with IP and user IDs. |
| `GET` | `/tqm/benchmarks` | Authenticated | Superadmin | Inspect active database B-Tree indexes and EXPLAIN query plans. |
