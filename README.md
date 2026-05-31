# Team Task Tracker API

A REST API for managing tasks within a team. Users belong to an organization, have roles, and can create/manage tasks based on their permissions.

**Stack:** Node.js · Express 5 · MongoDB (Mongoose) · Redis (ioredis) · JWT · Docker

---

## Setup

Clone the repo and run one command — no other configuration is needed:

```bash
docker compose up
```

The compose file includes default development secrets so reviewers can start immediately. MongoDB and Redis are health-checked before the API boots.

API available at: `http://localhost:3000/health`

```bash
# Stop containers (data volumes are preserved)
docker compose down

# Stop and wipe all data
docker compose down -v
```

> **Production:** Override the JWT secrets before deploying:
> ```bash
> JWT_ACCESS_SECRET=<strong-random> JWT_REFRESH_SECRET=<strong-random> docker compose up
> ```

**Local development (without Docker):**

```bash
cp .env.example .env   # edit MONGODB_URI, REDIS_URL, and JWT secrets
npm install
npm start
```

---

## Caching Strategy

Redis caches responses for `GET /api/tasks` only. All other endpoints go directly to MongoDB. **TTL: 60 seconds** (configurable via `CACHE_TTL_SECONDS`).

### Cache key format

```
tasks:assignee:<assigneeId>:<status>:<priority>:p<page>:l<limit>
```

| Role | assigneeId used in key |
|---|---|
| MEMBER | always `req.user._id` — they only see their own tasks |
| ADMIN/MANAGER with `?assignee=` filter | the filter value |
| ADMIN/MANAGER with no assignee filter | sentinel `org:<orgName>` |

Every written key is also registered in a Redis Set `tasks:org:<org>:__keys__`. Invalidation reads this set with `SMEMBERS` then bulk-deletes in a pipeline — no `KEYS *` scan is ever used.

### Invalidation triggers

| Event | What is invalidated |
|---|---|
| Task created | Assignee's cached pages + entire org key set |
| Task fields updated | Old assignee's keys + new assignee's keys + org key set |
| Task status updated | Assignee's keys + org key set |
| Task deleted | Assignee's keys + org key set |

Cache failures are **silent** — a Redis outage degrades to uncached MongoDB reads, never a 500 error. Every list response includes an `X-Cache: HIT` or `X-Cache: MISS` header for observability.

---

## Database Design

### Collections

**`users`**

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK (auto) |
| `name` | String | Required |
| `email` | String | Unique · lowercase |
| `password` | String | bcrypt-hashed · never returned |
| `role` | Enum | `ADMIN` \| `MANAGER` \| `MEMBER` |
| `organization` | String | Tenant identifier |
| `refreshTokens` | [String] | Active tokens for rotation |
| `createdAt / updatedAt` | Date | Auto |

Indexes: `{ email }` unique · `{ organization }`

---

**`tasks`**

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK (auto) |
| `title` | String | Required |
| `description` | String | Defaults to `""` |
| `priority` | Enum | `LOW` \| `MEDIUM` \| `HIGH` · default `MEDIUM` |
| `status` | Enum | `TODO` \| `IN_PROGRESS` \| `IN_REVIEW` \| `DONE` \| `BLOCKED` |
| `assignee` | ObjectId | FK → `users._id` · nullable |
| `due_date` | Date | Must be a future date if provided |
| `organization` | String | Denormalized tenant identifier |
| `createdBy` | ObjectId | FK → `users._id` |
| `createdAt / updatedAt` | Date | Auto |

Indexes: `{ status, organization }` · `{ assignee, organization }` · `{ project, organization }` sparse · `{ due_date }` sparse

---

**`projects`**

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK (auto) |
| `name` | String | Required |
| `description` | String | Defaults to `""` |
| `members` | [ObjectId] | FK → `users._id` |
| `organization` | String | Tenant identifier |
| `createdBy` | ObjectId | FK → `users._id` |
| `createdAt / updatedAt` | Date | Auto |

Indexes: `{ organization }`

---

### Schema diagram

```
┌──────────────────────────────────┐
│              users               │
├──────────────────────────────────┤
│ _id          ObjectId   PK       │
│ email        String     UNIQUE   │
│ role         Enum                │
│ organization String     IDX      │
│ refreshTokens [String]           │
└──────────┬───────────────────────┘
           │ 1
           │ tasks.createdBy  (FK)
           │ tasks.assignee   (FK, nullable)
           │ N
┌──────────▼───────────────────────┐
│              tasks               │
├──────────────────────────────────┤
│ _id          ObjectId   PK       │
│ status       Enum       IDX      │
│ assignee     ObjectId   IDX      │
│ due_date     Date       IDX(sparse) │
│ organization String     IDX      │
│ createdBy    ObjectId   FK       │
└──────────────────────────────────┘
```

---

## DB Design Decision

**Denormalized `organization` field on tasks instead of a foreign key**

Tasks store `organization` as a plain string copied from the creating user, rather than a reference to a separate `Organization` collection.

**Why:** Every task query must be tenant-scoped to prevent cross-org data leaks. Storing `organization` directly on each task document lets the compound indexes `{ status, organization }` and `{ assignee, organization }` satisfy those queries in a single index scan. MongoDB has no native join — resolving an org reference via `$lookup` on every task read would add a full extra round-trip with no benefit.

**Tradeoff:** If an organization name changes, all task documents need a bulk write. For this use-case org names are treated as immutable identifiers after creation, so the query simplicity outweighs that risk.

---

## What I Would Improve Given More Time

**Dedicated `Organization` collection** — currently org membership is implicit (matching string values). A proper document with explicit membership records would support invite flows, unique org name enforcement, and more formal data isolation.

**Integration and unit tests** — the status transition logic and RBAC middleware are the two highest-value targets. Tests covering all transition paths and role combinations would catch regressions during refactors.

**Cursor-based pagination** — the current `page + limit` offset pagination can return duplicate or skipped results under concurrent writes. Keying on `_id` or `createdAt` gives stable, consistent pages.

**Rate limiting** — `express-rate-limit` on `/register` and `/login` to prevent brute-force and credential stuffing attacks.

**Real-time notifications** — emit a Server-Sent Events (SSE) stream when a task's status changes, so assignees see updates without polling.

---

## Role Permissions (RBAC)

Enforced at middleware level via `authorize(...roles)` — never inside controller logic.

| Action | ADMIN | MANAGER | MEMBER |
|---|:---:|:---:|:---:|
| Register / Login | ✓ | ✓ | ✓ |
| View own profile | ✓ | ✓ | ✓ |
| List / get / delete users | ✓ | ✗ | ✗ |
| Update user role | ✓ | ✗ | ✗ |
| Create / update project | ✓ | ✓ | ✗ |
| List / view projects | ✓ | ✓ | member of only |
| Delete project | ✓ | ✗ | ✗ |
| Create task | ✓ | ✓ | ✗ |
| List / view all tasks | ✓ | ✓ | own only |
| Update task fields | ✓ | ✓ | ✗ |
| Update task status | ✓ | ✓ | own only |
| Delete task | ✓ | ✗ | ✗ |

---

## Status Transitions

Server-side only — not free-form:

```
TODO ──→ IN_PROGRESS ──→ IN_REVIEW ──→ DONE
  ↘           ↘              ↘
          BLOCKED   (reachable from any active state)

BLOCKED ──→ TODO | IN_PROGRESS
```

Only the **assignee** or **MANAGER / ADMIN** may advance a task's status. An invalid transition returns `400 INVALID_TRANSITION` with the list of allowed next states.

---

## API Reference

### Auth

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register — returns access + refresh tokens |
| POST | `/api/auth/login` | Public | Login — returns access + refresh tokens |
| POST | `/api/auth/refresh-token` | Public | Rotate refresh token |
| POST | `/api/auth/logout` | Required | Revoke refresh token |
| GET | `/api/auth/me` | Required | Current user profile |

### Users — ADMIN only

| Method | Route | Description |
|---|---|---|
| GET | `/api/users` | List all users in org |
| GET | `/api/users/:userId` | Get a single user |
| PATCH | `/api/users/:userId/role` | Update user role |
| DELETE | `/api/users/:userId` | Remove user from org |

### Projects

| Method | Route | Roles | Description |
|---|---|---|---|
| GET | `/api/projects` | ALL | List projects (MEMBER sees only projects they're a member of) |
| POST | `/api/projects` | ADMIN, MANAGER | Create project |
| GET | `/api/projects/:projectId` | ALL | Get project detail |
| PATCH | `/api/projects/:projectId` | ADMIN, MANAGER | Update project |
| DELETE | `/api/projects/:projectId` | ADMIN | Delete project |

### Tasks

| Method | Route | Roles | Description |
|---|---|---|---|
| GET | `/api/tasks` | ALL | List tasks (paginated + filtered) |
| POST | `/api/tasks` | ADMIN, MANAGER | Create task |
| GET | `/api/tasks/:taskId` | ALL | Get task detail |
| PATCH | `/api/tasks/:taskId` | ADMIN, MANAGER | Update task fields |
| PATCH | `/api/tasks/:taskId/status` | ALL (scoped) | Advance task status |
| DELETE | `/api/tasks/:taskId` | ADMIN | Delete task |

**List query params:** `page` · `limit` · `status` · `priority` · `assignee`

### Error response shape

Every error across every endpoint returns:

```json
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "due_date must be a future date"
}
```

Codes: `VALIDATION_ERROR` · `UNAUTHORIZED` · `TOKEN_EXPIRED` · `INVALID_TOKEN` · `FORBIDDEN` · `NOT_FOUND` · `CONFLICT` · `INVALID_TRANSITION` · `PAYLOAD_TOO_LARGE` · `INTERNAL_ERROR`

---

## Postman Collection

Import `postman_collection.json` from the repo root into Postman.

- Set the `baseUrl` variable if running on a different port (default: `http://localhost:3000`)
- Run **Register** or **Login** first — the `accessToken`, `refreshToken`, and `userId` collection variables are auto-populated by test scripts
- Create a task with **Create Task** — `taskId` is auto-captured for subsequent requests
