# Deploy Backend (AWS) - DevOps Runbook

## 1. Scope
This document explains how to deploy the CCSM backend service to AWS for alpha usage.

It is written for DevOps and assumes:
- backend is already prepared by developers,
- deployment is done by infrastructure owner,
- service is internet-accessible.

## 2. Service Summary
Runtime:
- Node.js Express API (`backend/server.js`)
- MySQL database
- Optional WebSocket endpoint (`/ws/desktop`)

Default port:
- `4000` (override with `PORT`)

Health/readiness:
- `GET /health`
- `GET /ready`

## 3. Prerequisites
1. AWS account and target environment (alpha).
2. Compute target:
- EC2 with systemd, or
- ECS/Fargate (if containerized by DevOps).
3. MySQL connectivity from compute to DB.
4. TLS termination (ALB/Nginx/CloudFront).
5. Secrets storage ready:
- AWS Secrets Manager or SSM Parameter Store.

## 4. Required Environment Contract
Set these variables in deployment environment (not in repo files):

Core:
- `NODE_ENV=remote` (or another explicit target mode)
- `PORT=4000`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

Auth/security:
- `AUTH_REQUIRED=true`
- `JWT_SECRET=<strong random secret>`
- `JWT_EXPIRES_IN=8h`
- `BCRYPT_ROUNDS=12`
- `USE_HELMET=true` (recommended for internet-facing deployment)

Shutdown:
- `SHUTDOWN_GRACE_MS=15000`
- `SHUTDOWN_FORCE_MS=30000`

Jira integration (if used):
- `JIRA_BASE_URL`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

## 5. Build and Start Commands
From `backend/`:

Install dependencies:
```bash
npm ci
```

Start:
```bash
npm run start:remote
```

Expected startup logs include:
- `API HTTP server running on port ...`
- `Connected DB: ...`
- `WebSocket started on endpoint: ws://<host>:.../ws/desktop`

If `USE_HELMET=true`, also expect:
- `[security] Helmet enabled (USE_HELMET=true).`

## 6. Network and Load Balancer Notes
1. Expose backend through ALB (recommended).
2. Forward HTTP traffic to target group on backend port.
3. Configure listener rules and certificate for HTTPS.
4. Ensure WebSocket upgrade support for `/ws/desktop`.
5. Security Group:
- allow inbound from ALB to app port,
- allow outbound from app to MySQL and external Jira if required.

## 7. Health Checks
Use:
- `/health` for liveness
- `/ready` for readiness (DB check)

ALB target group recommendation:
- Health check path: `/health`
- Success code: `200`
- Short timeout/retry suitable for alpha

App validation after deployment:
```bash
curl -i https://<backend-domain>/health
curl -i https://<backend-domain>/ready
```

## 8. Zero-Downtime and Shutdown Behavior
The app handles `SIGTERM` and `SIGINT` for graceful shutdown:
- stops accepting new requests,
- drains connections,
- closes DB pool.

Deploy strategy recommendation:
1. Start new task/instance.
2. Wait until `/ready` is green.
3. Shift traffic.
4. Terminate old task/instance and allow grace period.

## 9. Post-Deploy Smoke Tests
1. `GET /health` -> `200`.
2. `GET /ready` -> `200`.
3. `POST /api/login` with valid credentials -> token returned.
4. Call protected endpoint without token -> `401`.
5. Call protected endpoint with token -> `200`.
6. Desktop authcode login (if desktop is in scope) -> token returned.
7. WebSocket connection to `/ws/desktop` with auth token (if auth enabled).

## 10. Logging and Monitoring
Minimum:
- collect stdout/stderr logs,
- alert on repeated `500` and startup failures,
- alert when `/ready` is failing.

Recommended:
- CloudWatch log groups per environment,
- dashboard with 4xx/5xx rate and latency,
- alarm on frequent restarts.

## 11. Rollback Plan
Rollback triggers:
- readiness failures,
- auth failures after deploy,
- sustained elevated 5xx errors.

Rollback actions:
1. Route traffic back to previous version.
2. Stop new version tasks/instances.
3. Verify `/health` and `/ready` on previous version.
4. Capture logs for root cause.

## 12. Security Checklist (Alpha Internet Access)
Must-have before opening wider access:
1. Secrets are sourced only from AWS secret storage.
2. `JWT_SECRET` rotated and strong.
3. `AUTH_REQUIRED=true`.
4. `USE_HELMET=true`.
5. TLS enforced at edge.

Planned next hardening:
1. Add auth rate limiting for login endpoints.
2. Add stricter CORS allow-list when frontend domain is stable.
3. Add automated smoke tests in CI/CD.

## 13. Handoff Notes
Developer provides to DevOps:
- exact commit/tag,
- env var keys and expected values format,
- DB connectivity requirements,
- feature flags in use (`USE_HELMET`, `AUTH_REQUIRED`).

DevOps provides back:
- deployed URL(s),
- health check status,
- final env configuration audit (without secret values),
- rollback procedure confirmation.
