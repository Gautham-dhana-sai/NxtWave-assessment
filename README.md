# Team Task Tracker API

A REST API for managing tasks within a team. Users belong to an organization, have roles, and can create/manage tasks based on their permissions.

---

## Setup

```bash
# Clone and install
npm install

# Copy env file and fill in secrets
cp .env.example .env

# Start (requires MongoDB running locally)
npm start
```

> Docker support coming — `docker compose up` will be enough once containerized.

---

## Database Schema

### Collection: `users`

| Field           | Type       | Required | Notes                              |
|----------------|------------|----------|------------------------------------|
| `_id`           | ObjectId   | auto     | Primary key                        |
| `name`          | String     | yes      |                                    |
| `email`         | String     | yes      | Unique, lowercase                  |
| `password`      | String     | yes      | bcrypt hashed, never returned      |
| `role`          | String     | yes      | `ADMIN` \| `MANAGER` \| `MEMBER`   |
| `organization`  | String     | yes      | Tenant identifier                  |
| `refreshTokens` | [String]   | no       | Active refresh tokens (rotation)   |
| `createdAt`     | Date       | auto     |                                    |
| `updatedAt`     | Date       | auto     |                                    |

**Indexes:**
- `email` — unique (auto from schema)
- `{ organization: 1 }` — org-scoped user lookups

---

### Collection: `tasks`

| Field          | Type      | Required | Notes                                     |
|---------------|-----------|----------|-------------------------------------------|
| `_id`          | ObjectId  | auto     | Primary key                               |
| `title`        | String    | yes      |                                           |
| `description`  | String    | no       | Defaults to `""`                          |
| `priority`     | String    | yes      | `LOW` \| `MEDIUM` \| `HIGH`, default `MEDIUM` |
| `status`       | String    | yes      | See status transitions below              |
| `assignee`     | ObjectId  | no       | Ref → `users._id`, nullable               |
| `due_date`     | Date      | no       | Must be a future date if provided         |
| `organization` | String    | yes      | Tenant identifier (denormalized)          |
| `createdBy`    | ObjectId  | yes      | Ref → `users._id`                         |
| `createdAt`    | Date      | auto     |                                           |
| `updatedAt`    | Date      | auto     |                                           |

**Indexes:**
- `{ status: 1, organization: 1 }` — list/filter tasks by status per org
- `{ assignee: 1, organization: 1 }` — MEMBER self-scoped list + assignee filter
- `{ due_date: 1 }` sparse — overdue/analytics queries; sparse skips null-dated documents

---

### Schema Relationships (ERD)

```
┌─────────────────────────────────┐
│             users               │
├─────────────────────────────────┤
│ _id          ObjectId  PK       │
│ name         String             │
│ email        String   UNIQUE    │
│ password     String             │
│ role         Enum               │
│ organization String   IDX       │
│ refreshTokens [String]          │
│ createdAt / updatedAt           │
└──────────────┬──────────────────┘
               │ 1
               │
        ┌──────┴──────────────────────────┐
        │ tasks.assignee (nullable FK)    │
        │ tasks.createdBy (FK)            │
        └──────┬──────────────────────────┘
               │ N
┌──────────────▼──────────────────┐
│              tasks              │
├─────────────────────────────────┤
│ _id          ObjectId  PK       │
│ title        String             │
│ description  String             │
│ priority     Enum               │
│ status       Enum               │
│ assignee     ObjectId  FK→users │
│ due_date     Date      IDX(sparse)│
│ organization String   IDX       │
│ createdBy    ObjectId  FK→users │
│ createdAt / updatedAt           │
└─────────────────────────────────┘
```

---

## Status Transition Rules

Status is **not free-form** — only the following transitions are accepted server-side:

```
TODO ──→ IN_PROGRESS ──→ IN_REVIEW ──→ DONE
  ↘            ↘              ↘
           BLOCKED  (reachable from any active state)

BLOCKED ──→ TODO | IN_PROGRESS
```

- Only the **assignee** or a **MANAGER / ADMIN** may advance a task's status.
- Attempting an invalid transition returns `400 INVALID_TRANSITION` with the allowed next states listed.

---

## Role Permissions (RBAC)

RBAC is enforced at the **middleware level** (`authorize(...roles)`), never inside controller logic.

| Action                        | ADMIN | MANAGER | MEMBER |
|------------------------------|:-----:|:-------:|:------:|
| Register / Login             | ✓     | ✓       | ✓      |
| View own profile             | ✓     | ✓       | ✓      |
| List users in org            | ✓     | ✗       | ✗      |
| Update user role             | ✓     | ✗       | ✗      |
| Delete user                  | ✓     | ✗       | ✗      |
| Create task                  | ✓     | ✓       | ✗      |
| List tasks                   | ✓ all | ✓ all   | ✓ own  |
| View task detail             | ✓ all | ✓ all   | ✓ own  |
| Update task fields           | ✓     | ✓       | ✗      |
| Update task status           | ✓     | ✓       | ✓ own* |
| Delete task                  | ✓     | ✗       | ✗      |

\* MEMBER can only change status on tasks assigned to them.

---

## API Endpoints

### Auth
| Method | Route                      | Auth     | Description              |
|--------|---------------------------|----------|--------------------------|
| POST   | `/api/auth/register`       | Public   | Register a new user      |
| POST   | `/api/auth/login`          | Public   | Login, receive tokens    |
| POST   | `/api/auth/refresh-token`  | Public   | Rotate refresh token     |
| POST   | `/api/auth/logout`         | Required | Revoke refresh token     |
| GET    | `/api/auth/me`             | Required | Get current user profile |

### Users (ADMIN only)
| Method | Route                        | Description              |
|--------|------------------------------|--------------------------|
| GET    | `/api/users`                 | List all users in org    |
| GET    | `/api/users/:userId`         | Get a single user        |
| PATCH  | `/api/users/:userId/role`    | Update a user's role     |
| DELETE | `/api/users/:userId`         | Remove user from org     |

### Tasks
| Method | Route                          | Roles               | Description                    |
|--------|-------------------------------|---------------------|--------------------------------|
| GET    | `/api/tasks`                   | ALL                 | List tasks (paginated+filtered)|
| POST   | `/api/tasks`                   | ADMIN, MANAGER      | Create a task                  |
| GET    | `/api/tasks/:taskId`           | ALL                 | Get task detail                |
| PATCH  | `/api/tasks/:taskId`           | ADMIN, MANAGER      | Update task fields             |
| PATCH  | `/api/tasks/:taskId/status`    | ALL (scoped)        | Advance task status            |
| DELETE | `/api/tasks/:taskId`           | ADMIN               | Delete a task                  |

**List tasks query params:** `page`, `limit`, `status`, `priority`, `assignee`

---

## Error Response Format

All errors follow a consistent shape:

```json
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "due_date must be a future date"
}
```

Common codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `TOKEN_EXPIRED`, `INVALID_TOKEN`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INVALID_TRANSITION`, `INTERNAL_ERROR`

---

## DB Design Decisions

### 1. Denormalized `organization` field on tasks (instead of a foreign key)

Tasks store `organization` as a plain string (same value as `user.organization`) rather than a reference to an `Organization` collection. This means:

- Every query — list tasks, get task, status update — includes `organization` in the filter without a join.
- The compound indexes `{ status, organization }` and `{ assignee, organization }` keep all tenant-scoped queries index-bound.
- Tradeoff: if an organization is renamed, all task documents need a bulk update. For this use-case (org name is effectively immutable after creation) the query simplicity outweighs that risk.

### 2. Sparse index on `due_date`

Many tasks have no due date (`null`). A standard index would include all those nulls, wasting space and slowing down analytics queries that only care about dated tasks. A sparse index only indexes documents where `due_date` exists, keeping the index small and fast for overdue-task queries.

### 3. Refresh token stored as array in user document (token family rotation)

Rather than a separate `refresh_tokens` collection, each user document holds an array of active refresh tokens. On rotation, the old token is removed and the new one appended. If a reused (already-rotated) token is detected, the entire array is cleared — this is a standard token-family invalidation strategy that detects token theft with no extra collection needed.

---

## Caching Strategy

Redis (ioredis) caches `GET /api/tasks` results. All other endpoints go directly to MongoDB.

### Cache key scheme

```
tasks:assignee:<assigneeId>:<status>:<priority>:p<page>:l<limit>
```

- For **MEMBER** requests, `assigneeId` is always `req.user._id` (their own tasks).
- For **ADMIN/MANAGER** requests with an `assignee` filter, `assigneeId` is the filter value.
- For **ADMIN/MANAGER** requests with no assignee filter, `assigneeId` is the sentinel `org:<orgName>`.

Each key is also tracked in a Redis Set `tasks:org:<org>:__keys__` so the invalidation code knows every live key for an org without a `KEYS *` scan.

**TTL:** 60 seconds (configurable via `CACHE_TTL_SECONDS` env var).

### Invalidation triggers

Any mutation that can change list results calls `cache.invalidate(assigneeId, org)`:

| Event | Invalidates |
|---|---|
| Task created | Assignee's keys + full org set |
| Task fields updated | Old assignee keys + new assignee keys + org set |
| Task status updated | Assignee's keys + org set |
| Task deleted | Assignee's keys + org set |

Invalidation is best-effort — a Redis failure never blocks the request. The `X-Cache: HIT/MISS` response header is set on every list response for observability.

---

## What I Would Improve Given More Time

- Add a dedicated `Organization` collection and enforce org membership at registration time
- Redis caching on task list per assignee with key-pattern invalidation
- Docker + docker-compose so the reviewer can run `docker compose up`
- Swagger / OpenAPI spec auto-generated from Joi schemas
- Unit tests for status transition logic and RBAC middleware
- Real-time status change notifications via SSE or WebSocket
