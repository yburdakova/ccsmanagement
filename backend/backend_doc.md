# Backend COC (Codebase Operations & Collaboration)

## 1. Purpose
This document is the operational and collaboration reference for the `backend` service in the CCSM project.

It describes:
- what the backend does,
- how it is configured and run,
- security and auth behavior,
- operational endpoints and shutdown behavior,
- engineering rules for safe changes.

This project is currently in **alpha** and intended for **internal company use**.

## 2. Service Overview
The backend is an Express API with:
- MySQL data storage (`mysql2/promise`),
- JWT-based authentication,
- role-based authorization,
- desktop WebSocket channel (`/ws/desktop`) for change notifications,
- route groups for login, projects, users, lookups, time tracking, items, customers, and desktop API facade.

Main entrypoint:
- `backend/server.js`

Core modules:
- `backend/db.config.js` (DB pool + mutation/event hooks)
- `backend/middleware/auth.middleware.js` (auth + role checks)
- `backend/auth/*` (JWT and password hashing logic)
- `backend/routes/*` (HTTP APIs)
- `backend/ws/desktop-ws.js` (desktop websocket server)

## 3. Runtime Modes and Env Files
Runtime mode is selected via `NODE_ENV` in npm scripts:
- `start:local` -> `.env.local`
- `start:remote` -> `.env.remote`
- `start:remotetest` -> `.env.remotetest`

Important:
- `db.config.js` loads env file based on `NODE_ENV`.
- Keep secrets out of git-tracked files.

## 4. Required Environment Variables
Minimum required variables:
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `PORT`

Auth/security variables:
- `AUTH_REQUIRED` (`true/false`)
- `JWT_SECRET` (required when `AUTH_REQUIRED=true`)
- `JWT_EXPIRES_IN` (default `8h`)
- `BCRYPT_ROUNDS` (optional, bounded in code to 8..15)
- `USE_HELMET` (`true/false`, default behavior is disabled unless true)

Shutdown tuning:
- `SHUTDOWN_GRACE_MS` (default `15000`)
- `SHUTDOWN_FORCE_MS` (default `30000`)

Jira integration:
- `JIRA_BASE_URL`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

## 5. Auth and Authorization Model
### 5.1 Login
Web login endpoint:
- `POST /api/login`

Desktop authcode login endpoint:
- `POST /api/desktop/login-authcode`

On successful auth:
- backend returns JWT access token (`accessToken`, `tokenType`, `expiresIn`),
- clients must send `Authorization: Bearer <token>`.

### 5.2 Roles
Role IDs currently used:
- `1` = admin
- `2` = employee
- `3` = customer

Role constants are defined in:
- `backend/auth/auth-config.js`

### 5.3 Password Storage
Passwords are stored as bcrypt hashes.
Compatibility behavior:
- legacy plaintext rows can still authenticate,
- on successful login, plaintext password is upgraded to bcrypt hash.

## 6. API Protection and Route Wiring
Global route wiring is in `backend/server.js`.

Examples:
- `/api/users` -> `requireAuth + requireRole([ADMIN])`
- `/api/projects` -> `requireAuth + requireRole([ADMIN, EMPLOYEE])`
- `/api/lookups` -> `requireAuth`

Desktop routes:
- public desktop login route exists first,
- then `router.use(requireAuth)` protects the rest.

## 7. WebSocket Behavior
Endpoint:
- `ws://<host>:<port>/ws/desktop`

Current behavior:
- validates JWT on upgrade when auth is enabled,
- supports identify and heartbeat,
- broadcasts `db-changed` events to connected desktop clients.

## 8. Operational Endpoints
Health endpoint:
- `GET /health`
- returns service status, uptime, and shutdown flag.

Readiness endpoint:
- `GET /ready`
- verifies DB connectivity (`SELECT 1`),
- returns `503` when shutting down or DB is unavailable.

## 9. Graceful Shutdown
Signal handlers:
- `SIGTERM`
- `SIGINT`

Shutdown flow:
1. mark server as shutting down,
2. close idle connections,
3. stop accepting new requests,
4. drain/end sockets in grace period,
5. close DB pool,
6. exit with `0` on success, `1` on failure/force timeout.

## 10. Security Notes for Alpha
Current alpha posture (internal use):
- JWT auth enabled by env,
- bcrypt hashing in place,
- optional Helmet support via `USE_HELMET`.

Known security gaps that should be planned:
- auth rate limiting / brute-force protection,
- structured audit logging for security events,
- secret management via AWS Secrets Manager/SSM only,
- tighter CORS policy (when frontend origin is finalized).

## 11. Engineering Collaboration Rules
When editing backend code:
- keep changes minimal and scoped,
- do not refactor unrelated modules in the same commit,
- prefer explicit behavior over hidden magic,
- keep comments in English and only where they add value,
- preserve API compatibility unless change is explicitly approved.

For auth-sensitive changes:
- test web login, desktop login-authcode, protected endpoint access, and websocket auth.

For shutdown/ops changes:
- verify `/health`, `/ready`, and signal handling logs.

## 12. Manual Smoke Test Checklist
1. Start backend:
`npm run start:remotetest`

2. Health:
`curl.exe -i http://localhost:4000/health`

3. Ready:
`curl.exe -i http://localhost:4000/ready`

4. Auth-required check:
- call protected endpoint without token -> expect `401`
- call with valid token -> expect `200`

5. Shutdown:
- stop with `Ctrl+C`
- confirm shutdown logs and clean exit.

## 13. Ownership and Change Control
Backend changes must include:
- clear commit message,
- concise reason for change,
- manual verification notes (what was tested).

For deployment-affecting changes (auth, env, shutdown, ws, db):
- notify DevOps with updated env var list and expected runtime behavior.
