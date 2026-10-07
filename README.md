# API security demo

Self-contained TypeScript demo. Same HTTP security contract runs through Express and NestJS. External systems behave as async boundaries, not route-local mocks.

## Five implemented systems

1. Identity provider simulator: valid, expired, revoked, malformed, and unavailable tokens.
2. Database and Redis simulators: ownership, unavailable storage, atomic rate limits, and TTL-shaped retry metadata.
3. Payment and audit simulators: concurrent idempotency, payload conflict, append-only events, and secret redaction.
4. Shared secure HTTP behavior: authentication, ownership authorization, validation, payload limit, rate limiting, request IDs, security headers, safe errors, and localhost binding.
5. Express/NestJS adapters: both run the same contract tests.

## Local verification

```text
npm install
npx playwright install chromium
npm run check
npm run build
npm run test:e2e
npm run audit
```

Each E2E test starts an isolated real HTTP server and drives Chromium or Playwright's HTTP client through public routes. Open `/` for the interactive lab or `/guide.html` for the searchable 12-control guide. Guide links can preset the lab with `framework`, `identity`, and `scenario` query parameters. To smoke-test a deployed instance without mutating simulator state:

```powershell
$env:E2E_BASE_URL="https://api-security-12-ideas.onrender.com"
npx playwright test --grep @smoke
```


## Public demo deployment

Render runs `npm ci --include=dev && npm run build`, then `npm start`. The service exposes `/` as an interactive browser demo, `/health` for health checks, `/version` for deployed commit verification, and `/api/express/*` plus `/api/nest/*` for the same security contract through each adapter.

This is an educational public demo, not production security infrastructure. Tokens are public fixtures, external systems are in-process simulators, all state is in memory, and Render free services sleep or restart. Data, rate-limit counters, payments, and audit events reset on restart. Do not submit real credentials, payment data, or secrets.

Render deployment uses `render.yaml`. Set no application secrets. The service reads the platform-provided `PORT` and binds the public server to `0.0.0.0`.


`npm audit` currently reports one low-severity advisory through `tsx`/`esbuild`; no high-severity finding blocks the configured audit gate. Review this before production use.

## Design limits

- Tokens, users, documents, payments, rate limits, and audit events are in memory.
- No real OAuth, secret manager, database, Redis, payment provider, TLS certificate, or queue.
- Simulators inject deterministic failures through their APIs for tests.
- Production/public server binds `0.0.0.0` and reads `PORT`; local adapter tests bind `127.0.0.1`.
- Fixed tokens exist only for local tests: `alice-token`, `bob-token`, `admin-token`.

## Layout

```text
src/ports.ts       typed external boundaries
src/simulators.ts  deterministic external-service simulators
src/http.ts        shared behavior
src/express        Express adapter
src/nest           NestJS adapter
test/contract      identical HTTP tests for both adapters
test/e2e           Chromium UI, guide, and black-box HTTP deployment tests
test/simulators    external-service tests
```
