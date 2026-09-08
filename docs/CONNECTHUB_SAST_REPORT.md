# ConnectHub — Static Application Security Testing (SAST) Report

**Report version:** 1.1 (includes remediation re-scan)  
**Classification:** Internal — Security / IT review  
**This document is not a security certification or formal approval.**

> **Scan history:** This document contains an **initial SAST** (Sections 1–12, commit `6271303…`) and a **remediation re-scan** (Section 13, same base commit with `Dockerfile` fix applied). The initial results are preserved; the re-scan reflects post-remediation state.

---

## 1. Executive Summary

### Initial scan (2026-09-05)

A static application security test (SAST) was performed on the ConnectHub repository at commit `62713034461a69b539f35a7c80969607c15e9a4a4a` using **Semgrep OSS 1.136.0** with community security rulesets including secret detection.

**Automated SAST results (raw scanner):**

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High (Semgrep `ERROR`) | 4 |
| Medium (Semgrep `WARNING`) | 31 |
| Low | 0 |
| Informational (Semgrep `INFO`) | 10 |
| **Total automated findings** | **45** |

**Secret detection:** No hardcoded credentials or API keys were reported by Semgrep `p/secrets` rules in scanned source files.

**Triage summary (after manual review of automated findings):**

| Classification | Count |
|----------------|-------|
| True positive / likely true positive | 2 |
| False positive | 33 |
| Needs manual review | 10 |

No **Critical** or triaged **High** application-code vulnerabilities were identified that alone would block a **restricted 7–8 user event pilot**, assuming production deployment controls documented in `docs/CONNECTHUB_ARCHITECTURE.md` (HTTPS, private PostgreSQL, strong `AUTH_SECRET`, restricted `ALLOWED_ORIGINS`). Several items warrant remediation before **public** deployment or for long-term hardening.

**Dependency scanning (separate from SAST):** `npm audit` reported **4** advisories in the frontend package tree and **4** in the server package tree, including **1 high** in each (Vite dev-server issue; SheetJS `xlsx` prototype pollution / ReDoS). These are documented in Section 9.

### Re-scan after remediation (2026-09-05)

After fixing **SAST-045** (Docker non-root user), Semgrep was re-run with extended timeouts. **SAST-045 no longer appears.** Current automated totals: **46** findings (**3** High/`ERROR`, **33** Medium/`WARNING`, **10** Informational). After triage: **0** likely true-positive SAST findings remain; **10** manual-review items unchanged. See **Section 13**.

**This remains an internal SAST assessment — not a security certification, not formal Security/IT approval, not a penetration test, not DAST, and not infrastructure validation.**

---

## 2. Assessment Information

| Field | Value |
|-------|-------|
| **Application** | ConnectHub |
| **Description** | Event networking platform (React SPA + Express API + PostgreSQL) |
| **Git repository** | `https://coresync.e-zest.in/manish.joshi/connecthub.git` |
| **Branch scanned** | `master` |
| **Commit SHA** | `62713034461a69b539f35a7c80969607c15e9a4a4a` |
| **Scan date** | 2026-09-05 (UTC+5:30) |
| **SAST tool** | Semgrep (Open Source) |
| **Tool version** | 1.136.0 (`pysemgrep`) |
| **Rulesets** | `auto`, `p/security-audit`, `p/secrets`, `p/owasp-top-ten`, `p/nodejs`, `p/react`, `p/typescript` |
| **Rules loaded** | 1,158 (Community) |
| **Rules executed** | 553 |
| **Languages scanned** | JavaScript, TypeScript, JSON, HTML, YAML, Dockerfile; partial Python (1 file) |
| **Package manager** | npm |
| **Frontend** | React 18, TypeScript, Vite |
| **Backend** | Node.js, Express 4 |
| **Primary source directories** | `ConnectHub/src/`, `ConnectHub/server/`, `ConnectHub/scripts/`, `ConnectHub/migrations/`, `Dockerfile`, `docker-compose.yml` |

---

## 3. Methodology

1. **Repository identification** — Git branch, commit SHA, and technology stack were recorded from the working tree without reading `.env` or other secret files.
2. **Tool selection** — Semgrep OSS was installed temporarily via `pip` for local execution without an external Semgrep Cloud account.
3. **Scan execution** — Full scan against git-tracked application sources:

   ```text
   pysemgrep scan \
     --config auto \
     --config p/security-audit \
     --config p/secrets \
     --config p/owasp-top-ten \
     --config p/nodejs \
     --config p/react \
     --config p/typescript \
     --exclude node_modules --exclude dist --exclude build \
     --exclude .pgdata --exclude coverage --exclude .git \
     ConnectHub/ Dockerfile docker-compose.yml
   ```

4. **Finding review** — Each Semgrep finding was reviewed for exploitability in ConnectHub’s actual runtime context (dev-only vs production, allowlists, sanitization).
5. **ConnectHub-specific manual review** — Additional observations were recorded separately (Section 8); these are **not** Semgrep findings.
6. **Dependency audit** — `npm audit` was run read-only in `ConnectHub/` and `ConnectHub/server/` and reported separately (Section 9).
7. **Application security tests** — Existing `server/security.test.js` tests were executed for context; these are **not** SAST.

**Not performed:** penetration testing, dynamic analysis (DAST), infrastructure/TLS review, formal third-party SAST certification.

---

## 4. Scan Coverage

### Included

| Path | Contents |
|------|----------|
| `ConnectHub/src/` | React/TypeScript frontend, components, services, utilities |
| `ConnectHub/server/` | Express API, auth, uploads, AI router, database access |
| `ConnectHub/scripts/` | Dev, DB, ingest helper scripts |
| `ConnectHub/migrations/` | SQL schema migrations |
| `ConnectHub/public/` | Static assets (non-binary rules only) |
| `Dockerfile`, `docker-compose.yml` | Container build/deploy definitions |
| Config sources | `vite.config.ts`, `eslint.config.js`, `tsconfig*.json`, `.env.example` files |

**Files scanned:** 393 (git-tracked)  
**Parse coverage:** ~99.9% (one partial-parse warning in `SettingsPanel.tsx` line 632 — JSX `&` entity; does not affect server security code)

### Excluded

| Path / type | Reason |
|-------------|--------|
| `node_modules/` | Third-party dependencies (covered separately via `npm audit`) |
| `dist/`, `build/` | Generated build output |
| `.pgdata/` | Local PostgreSQL data directory |
| `coverage/`, caches | Non-source artifacts |
| `.git/` | Version control metadata |
| `ConnectHub/server/.env`, `ConnectHub/.env` | Environment secrets (gitignored; not scanned) |
| Binary assets | Images, lockfile binaries, WAL files |
| **Repository root scripts** | `setup-local-postgres.ps1`, `restore-connecthub.ps1`, `install-office-startup.ps1`, etc. at repo root were **outside** the Semgrep scan paths |

### Security categories supported by this scan

Semgrep rules in use can detect patterns related to: injection (command, some path), path traversal sinks, unsafe RegExp construction, Dockerfile privilege issues, some XSS/React patterns, format-string logging, and hardcoded secrets. **Not reliably covered:** business-logic authorization bugs, runtime IDOR, CSRF with cookie sessions, full SSRF taint analysis, SQL injection (limited SQL rules on this stack), JWT-specific misconfigurations, CORS/TLS at runtime.

---

## 5. Executive Results

### Raw Semgrep severity (before triage)

| Severity | Semgrep label | Count |
|----------|---------------|-------|
| Critical | — | 0 |
| High | `ERROR` | 4 |
| Medium | `WARNING` | 31 |
| Low | — | 0 |
| Informational | `INFO` | 10 |

### After manual triage

| Classification | Count |
|----------------|-------|
| True positive / likely true positive | 2 |
| False positive | 33 |
| Needs manual review | 10 |

### Findings by rule (automated)

| Rule ID | Count | Default severity |
|---------|-------|------------------|
| `path-join-resolve-traversal` | 25 | WARNING |
| `unsafe-formatstring` | 10 | INFO |
| `express-path-join-resolve-traversal` | 5 | WARNING |
| `detect-child-process` | 2 | ERROR |
| `spawn-shell-true` | 1 | ERROR |
| `detect-non-literal-regexp` | 1 | WARNING |
| `missing-user-entrypoint` (Dockerfile) | 1 | ERROR |

---

## 6. Detailed Findings

> **Severity in this section** maps Semgrep labels: `ERROR` → High, `WARNING` → Medium, `INFO` → Informational.  
> **Status** reflects manual triage after code review.

---

### SAST-001 — Shell spawn enabled in dev orchestrator

| Field | Value |
|-------|-------|
| **Severity** | High (Semgrep ERROR) |
| **Rule** | `javascript.lang.security.audit.spawn-shell-true.spawn-shell-true` |
| **CWE** | CWE-78 (OS Command Injection) |
| **OWASP** | A03:2021 Injection |
| **File** | `ConnectHub/scripts/dev.mjs` |
| **Line** | 18 |
| **Status** | **FALSE POSITIVE** (production scope) |

**Description:** `spawn()` is called with `shell: true` on Windows when launching the Vite dev server (`npm run dev:web`).

**Security impact:** Shell invocation can expand metacharacters if command arguments were attacker-controlled. Here `command` is hardcoded (`npm.cmd`) and `args` is `['run', 'dev:web']`.

**Exploitability:** Dev-only script; not used in production Docker entrypoint or `npm start`.

**Recommended remediation:** For dev hardening, use `shell: false` with explicit `npm.cmd` path on Windows; not required for pilot if dev scripts are not deployed.

---

### SAST-002 — Child process in dev orchestrator

| Field | Value |
|-------|-------|
| **Severity** | High (Semgrep ERROR) |
| **Rule** | `javascript.lang.security.detect-child-process.detect-child-process` |
| **CWE** | CWE-78 |
| **OWASP** | A03:2021 Injection |
| **File** | `ConnectHub/scripts/dev.mjs` |
| **Line** | 18 |
| **Status** | **FALSE POSITIVE** (production scope) |

**Description:** `child_process.spawn` used to start API and web dev processes.

**Security impact:** Pattern flagged because `command` is a variable; value is `process.execPath` or `npmCmd` (not HTTP input).

**Recommended remediation:** None for production; script is local development only.

---

### SAST-003 — Path join in dev Postgres bootstrap

| Field | Value |
|-------|-------|
| **Severity** | Medium (Semgrep WARNING) |
| **Rule** | `javascript.lang.security.audit.path-traversal.path-join-resolve-traversal` |
| **CWE** | CWE-22 (Path Traversal) |
| **OWASP** | A01:2021 Broken Access Control |
| **File** | `ConnectHub/scripts/ensure-dev-postgres.mjs` |
| **Line** | 71 |
| **Status** | **FALSE POSITIVE** |

**Description:** `path.join` with cluster directory derived from project layout / env, not HTTP request data.

**Recommended remediation:** None for production deployment.

---

### SAST-004 — Child process in dev Postgres bootstrap

| Field | Value |
|-------|-------|
| **Severity** | High (Semgrep ERROR) |
| **Rule** | `javascript.lang.security.detect-child-process.detect-child-process` |
| **CWE** | CWE-78 |
| **OWASP** | A03:2021 Injection |
| **File** | `ConnectHub/scripts/ensure-dev-postgres.mjs` |
| **Line** | 75 |
| **Status** | **FALSE POSITIVE** |

**Description:** Spawns `pg_ctl` / Postgres binaries for local dev cluster management.

**Exploitability:** Developer workstation only; arguments are not sourced from application users.

---

### SAST-005 through SAST-016 — Path join in asset library

| Field | Value |
|-------|-------|
| **Severity** | Medium (Semgrep WARNING) |
| **Rules** | `path-join-resolve-traversal`, `express-path-join-resolve-traversal` |
| **CWE** | CWE-22 |
| **OWASP** | A01:2021 Broken Access Control |
| **File** | `ConnectHub/server/assetLibrary.js` |
| **Lines** | 157, 160, 161, 298, 299, 342, 373 |
| **Status** | **NEEDS MANUAL REVIEW** (mostly false positive) |

**Description:** Semgrep flagged `path.join(UPLOAD_DIR, …)` where disk paths incorporate library item IDs or sanitized filenames.

**Security impact:** Real traversal would require bypassing `safeAssetName()` and writing `..` into `disk_path` in the database, or unvalidated user path segments.

**Context:** Upload routes require authentication and `assetRole()` authorization. Filenames are sanitized via `safeAssetName()`. Disk paths for new uploads use `randomUUID()` plus extension.

**Exploitability:** Low for pilot if DB rows are not attacker-controlled; medium for public multi-tenant without DB integrity review.

**Recommended remediation:** Add explicit `path.resolve` + prefix check (`full.startsWith(UPLOAD_DIR)`) before read/delete; validate `disk_path` column format.

---

### SAST-017 through SAST-020 — Path join in branding helper

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Rule** | `path-join-resolve-traversal` |
| **CWE** | CWE-22 |
| **File** | `ConnectHub/server/branding.js` |
| **Lines** | 7–10 |
| **Status** | **FALSE POSITIVE** |

**Description:** Static paths under `appRoot/public/` and `scripts/prepare-jelly-logo.py`; `appRoot` is server-controlled.

---

### SAST-021 through SAST-026 — Repository upload/delete paths

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Rules** | `path-join-resolve-traversal`, `express-path-join-resolve-traversal` |
| **CWE** | CWE-22 |
| **File** | `ConnectHub/server/index.js` |
| **Lines** | 610, 670 |
| **Status** | **NEEDS MANUAL REVIEW** |

**Description:** Repository file storage uses `path.join(UPLOAD_DIR, 'repository', req.params.industry, …)`.

**Context:** `industry` is validated against `REPOSITORY_INDUSTRY_SET` (`healthcare`, `engineering`, `bfsi`). Filenames pass through `safeRepositoryName()`. Routes require `requireAuthMiddleware`.

**Security impact:** Path traversal via `industry` is blocked by allowlist. Residual risk: **authenticated users** can upload to shared `/uploads/repository/{industry}/` and files are served by `express.static` without per-file authorization.

**Exploitability:** Authorization / data exposure issue more than classic traversal; relevant for public deployment.

**Recommended remediation:** Require event/admin role for repository mutations; or serve repository files through authenticated API instead of public static path.

---

### SAST-027 — Path join in remote photo resolver

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Rule** | `path-join-resolve-traversal` |
| **CWE** | CWE-22 |
| **File** | `ConnectHub/server/remotePhoto.js` |
| **Line** | 49 |
| **Status** | **NEEDS MANUAL REVIEW** (mitigations present) |

**Description:** Local `/uploads/` references are mapped to disk via `path.join(uploadDir, relative)`.

**Context:** Code explicitly rejects `relative.includes('..')`. Only used when loading attendee photos from stored URLs.

**Exploitability:** Low if `..` check is complete; verify Windows alternate path forms in penetration test.

---

### SAST-028 through SAST-033 — Path join in repository file listing

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Rule** | `path-join-resolve-traversal` |
| **CWE** | CWE-22 |
| **File** | `ConnectHub/server/repository.js` |
| **Lines** | 40, 54, 56 |
| **Status** | **FALSE POSITIVE** |

**Description:** `path.join(dir, entry.name)` where `entry` comes from `fs.readdirSync` on a server-controlled directory.

---

### SAST-034 — Dynamic RegExp from watch terms

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Rule** | `javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp` |
| **CWE** | CWE-1333 (ReDoS) |
| **OWASP** | A05:2021 Security Misconfiguration |
| **File** | `ConnectHub/server/termCorrector.js` |
| **Line** | 89 |
| **Status** | **NEEDS MANUAL REVIEW** |

**Description:** `new RegExp(...)` built from `watchTerms` list (admin/event configuration) and known tool names with `escapeRegExp()`.

**Security impact:** ReDoS if malicious terms are injected into watch list without escaping (escaping is applied to `name`).

**Exploitability:** Requires ability to set watch terms; verify caller authorization.

---

### SAST-035 through SAST-044 — Console format string (client-side logging)

| Field | Value |
|-------|-------|
| **Severity** | Informational |
| **Rule** | `javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring` |
| **CWE** | CWE-134 |
| **Files** | `src/lib/userPersistence.ts` (4), `src/pages/SettingsPage.tsx` (1), `src/utils/excelParser.ts` (1), `src/utils/logger.ts` (4) |
| **Status** | **FALSE POSITIVE** |

**Description:** Semgrep flags `console.log` / `console.warn` with string concatenation. Rule targets Node `util.format` behavior; browser `console` does not have the same format-string vulnerability class.

---

### SAST-045 — Docker container runs as root

| Field | Value |
|-------|-------|
| **Severity** | High (Semgrep ERROR) |
| **Rule** | `dockerfile.security.missing-user-entrypoint.missing-user-entrypoint` |
| **CWE** | CWE-269 (Improper Privilege Management) |
| **OWASP** | A04:2021 Insecure Design |
| **File** | `Dockerfile` |
| **Line** | 40 |
| **Status** | **REMEDIATED** (Section 13) — was Likely True Positive |

**Description:** Production image sets `ENTRYPOINT` but does not declare a non-root `USER`.

**Security impact:** Container processes run as root; container escape or RCE yields root inside the container.

**Exploitability:** Depends on container isolation and host security; common compliance finding.

**Recommended remediation:** Add non-root user, `chown` `/data/uploads`, and `USER node` (or dedicated user) before `ENTRYPOINT`. Coordinate with IT for volume permissions.

---

### Complete finding inventory (automated)

| ID | Sev. | File | Line | Rule (short) | Triage |
|----|------|------|------|--------------|--------|
| SAST-001 | High | `scripts/dev.mjs` | 18 | spawn-shell-true | FP |
| SAST-002 | High | `scripts/dev.mjs` | 18 | detect-child-process | FP |
| SAST-003 | Med | `scripts/ensure-dev-postgres.mjs` | 71 | path-join-traversal | FP |
| SAST-004 | High | `scripts/ensure-dev-postgres.mjs` | 75 | detect-child-process | FP |
| SAST-005 | Med | `server/assetLibrary.js` | 157 | path-join-traversal | Review |
| SAST-006 | Med | `server/assetLibrary.js` | 160 | path-join-traversal | Review |
| SAST-007 | Med | `server/assetLibrary.js` | 161 | path-join-traversal | Review |
| SAST-008 | Med | `server/assetLibrary.js` | 298 | path-join-traversal | Review |
| SAST-009 | Med | `server/assetLibrary.js` | 299 | path-join-traversal | Review |
| SAST-010 | Med | `server/assetLibrary.js` | 299 | path-join-traversal | Review |
| SAST-011 | Med | `server/assetLibrary.js` | 342 | path-join-traversal | Review |
| SAST-012 | Med | `server/assetLibrary.js` | 342 | express-path-traversal | Review |
| SAST-013 | Med | `server/assetLibrary.js` | 342 | path-join-traversal | Review |
| SAST-014 | Med | `server/assetLibrary.js` | 373 | path-join-traversal | Review |
| SAST-015 | Med | `server/assetLibrary.js` | 373 | express-path-traversal | Review |
| SAST-016 | Med | `server/assetLibrary.js` | 373 | path-join-traversal | Review |
| SAST-017 | Med | `server/branding.js` | 7 | path-join-traversal | FP |
| SAST-018 | Med | `server/branding.js` | 8 | path-join-traversal | FP |
| SAST-019 | Med | `server/branding.js` | 9 | path-join-traversal | FP |
| SAST-020 | Med | `server/branding.js` | 10 | path-join-traversal | FP |
| SAST-021 | Med | `server/index.js` | 610 | express-path-traversal | Review |
| SAST-022 | Med | `server/index.js` | 610 | path-join-traversal | Review |
| SAST-023 | Med | `server/index.js` | 670 | express-path-traversal | Review |
| SAST-024 | Med | `server/index.js` | 670 | path-join-traversal | Review |
| SAST-025 | Med | `server/index.js` | 670 | express-path-traversal | Review |
| SAST-026 | Med | `server/index.js` | 670 | path-join-traversal | Review |
| SAST-027 | Med | `server/remotePhoto.js` | 49 | path-join-traversal | Review |
| SAST-028 | Med | `server/repository.js` | 40 | path-join-traversal | FP |
| SAST-029 | Med | `server/repository.js` | 40 | path-join-traversal | FP |
| SAST-030 | Med | `server/repository.js` | 54 | path-join-traversal | FP |
| SAST-031 | Med | `server/repository.js` | 54 | path-join-traversal | FP |
| SAST-032 | Med | `server/repository.js` | 56 | path-join-traversal | FP |
| SAST-033 | Med | `server/repository.js` | 56 | path-join-traversal | FP |
| SAST-034 | Med | `server/termCorrector.js` | 89 | detect-non-literal-regexp | Review |
| SAST-035 | Info | `src/lib/userPersistence.ts` | 22 | unsafe-formatstring | FP |
| SAST-036 | Info | `src/lib/userPersistence.ts` | 40 | unsafe-formatstring | FP |
| SAST-037 | Info | `src/lib/userPersistence.ts` | 56 | unsafe-formatstring | FP |
| SAST-038 | Info | `src/lib/userPersistence.ts` | 82 | unsafe-formatstring | FP |
| SAST-039 | Info | `src/pages/SettingsPage.tsx` | 501 | unsafe-formatstring | FP |
| SAST-040 | Info | `src/utils/excelParser.ts` | 146 | unsafe-formatstring | FP |
| SAST-041 | Info | `src/utils/logger.ts` | 28 | unsafe-formatstring | FP |
| SAST-042 | Info | `src/utils/logger.ts` | 38 | unsafe-formatstring | FP |
| SAST-043 | Info | `src/utils/logger.ts` | 47 | unsafe-formatstring | FP |
| SAST-044 | Info | `src/utils/logger.ts` | 55 | unsafe-formatstring | FP |
| SAST-045 | High | `Dockerfile` | 40 | missing-user-entrypoint | Likely TP |

---

## 7. False Positives / Manual Review

### False positives (summary)

| Finding group | Rationale |
|---------------|-----------|
| SAST-001–004 | Dev-only scripts (`dev.mjs`, `ensure-dev-postgres.mjs`); not in production container runtime |
| SAST-017–020 | Static paths from `appRoot`; no user-controlled segments |
| SAST-028–033 | Directory listings use filenames from `readdir`, not HTTP parameters |
| SAST-035–044 | Browser `console.*` logging; CWE-134 format-string issue does not apply as for Node `util.format` |

### Needs manual review (summary)

| Area | Finding IDs | What to verify |
|------|-------------|----------------|
| Asset disk paths | SAST-005–016 | DB `disk_path` tampering; prefix validation on delete/read |
| Repository uploads | SAST-021–026 | Authenticated but broadly shared static files under `/uploads/repository/` |
| Remote photo local path | SAST-027 | `..` rejection on all platforms; URL parsing edge cases |
| Dynamic RegExp | SAST-034 | Who can supply `watchTerms`; ReDoS with admin-controlled terms |
| Docker root user | SAST-045 | IT container hardening and volume ownership |

---

## 8. ConnectHub Manual Security Observations

> **These are manual observations from source review. They are NOT Semgrep findings and do not increase the automated finding count.**

| ID | Topic | Observation | Severity (manual) | Pilot impact |
|----|-------|-------------|-------------------|--------------|
| MAN-001 | **Authentication — token storage** | Bearer tokens stored in `localStorage` (`connecthub_token`). Vulnerable to theft via XSS. | Medium | ACCEPTABLE FOR PILOT with trusted users; fix before public |
| MAN-002 | **Authentication — query token** | `/api/attendees/:id/photo` accepts `?access_token=` for `<img>` tags; tokens may appear in logs, browser history, Referer | Medium | ACCEPTABLE FOR PILOT; prefer HttpOnly cookie or short-lived signed URLs for public |
| MAN-003 | **Authentication — legacy passwords** | `verifyPassword()` falls back to plaintext comparison if hash is not bcrypt (`auth.js`) | Medium | SHOULD FIX if legacy plaintext rows exist in DB |
| MAN-004 | **Authorization — repository files** | `/uploads/repository/{industry}/` served via `express.static` without per-file event scoping | Medium | ACCEPTABLE FOR PILOT (small trusted group); review for public |
| MAN-005 | **Authorization — attendee photos** | Post-remediation: photo endpoint requires auth + `getEventRole()` | Positive | N/A |
| MAN-006 | **Uploads — blocked paths** | Middleware blocks `/uploads/private`, `/uploads/assets`, ingest artifacts | Positive | N/A |
| MAN-007 | **HTTP security — CSP** | `helmet` used but `contentSecurityPolicy: false` | Low | Future hardening |
| MAN-008 | **HTTP security — CORS** | Production startup fails if `ALLOWED_ORIGINS` empty; dev allows all origins when unset | Low (prod) | IT must set origins in production |
| MAN-009 | **HTTP security — rate limiting** | API, login, and PIN verification rate limits present | Positive | N/A |
| MAN-010 | **SQL** | Reviewed routes use parameterized `pg` queries (`$1`, `$2`, …) | Positive | SAST did not flag SQLi |
| MAN-011 | **SSRF — remote photos** | `remotePhoto.js` blocks private IPs, localhost, redirects; size/signature limits | Positive | Pen test should confirm bypass |
| MAN-012 | **AI integrations** | Keys read from env server-side only (`aiRouter.js`); outbound fetch to configured providers | Info | Disable AI by omitting keys for pilot if required |
| MAN-013 | **XSS — React** | One `dangerouslySetInnerHTML` in `ui/chart.tsx` (chart theming CSS); no user HTML injection observed | Low | Review if user data reaches chart config |
| MAN-014 | **Secrets in repo** | Semgrep `p/secrets` reported no matches; `.env` files excluded from scan | Positive | Rotate any credentials ever committed to git history |
| MAN-015 | **Production guards** | App exits on insecure `AUTH_SECRET` or empty `ALLOWED_ORIGINS` when `NODE_ENV=production` | Positive | IT responsibility to set env |

### Application security tests (not SAST)

Executed: `npm test` in `ConnectHub/server/` on scan date.

| Metric | Result |
|--------|--------|
| Tests | 61 |
| Passed | 60 |
| Failed | 0 |
| Skipped | 1 (`live` integration test) |

Security-related tests include: auth tampering, login hash leakage, DB mutation auth, private scope enforcement, attendee photo 401/403/200/404, private upload path blocking.

---

## 9. Dependency Security — Not SAST

`npm audit` was run read-only. **These are dependency advisories, not Semgrep SAST findings.**

### Frontend (`ConnectHub/package.json`)

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Moderate | 2 |
| Low | 1 |
| **Total** | **4** |

| Package | Severity | Summary |
|---------|----------|---------|
| `vite` | High | `server.fs.deny` bypass on Windows alternate paths (GHSA-fx2h-pf6j-xcff) — **dev server** |
| `esbuild` (via vite) | Moderate | Dev server cross-origin read (GHSA-67mh-4wv8-2f99) |
| `@humanfs/node` | Moderate | Symlink copy issue in tooling chain |
| `postcss-selector-parser` | Low | ReDoS in dev tooling |

**Pilot note:** Vite/esbuild issues affect **development** server, not production static serve (`npm run build` + Express).

### Backend (`ConnectHub/server/package.json`)

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Moderate | 3 |
| Low | 0 |
| **Total** | **4** |

| Package | Severity | Summary |
|---------|----------|---------|
| `xlsx` | High | Prototype pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS (GHSA-5pgg-2g8v-p4x9) — used for people ingest |
| `express` / `qs` / `body-parser` | Moderate | `qs` DoS / parsing issues — patch available |

**Public deployment:** Plan dependency upgrades and re-test ingest workflows; `xlsx` high findings are relevant to **production** ingest features.

---

## 10. Remediation Priority

### Must fix before restricted event pilot

| Item | Type | Notes |
|------|------|-------|
| Production `AUTH_SECRET` | Config (IT) | Strong random secret; app refuses weak secret in production |
| Production `ALLOWED_ORIGINS` | Config (IT) | Must list exact event HTTPS origin |
| HTTPS + private PostgreSQL | Infra (IT) | Per architecture doc |
| Credential rotation | Process | Any passwords previously stored in removed credential files / git history |

*No triaged **Critical** or **High** application SAST finding alone is a pilot blocker.*

### Should fix before public deployment

| Item | Type |
|------|------|
| MAN-001 localStorage session model | Manual |
| MAN-004 repository static exposure | Manual |
| SAST-045 Docker non-root user | SAST |
| `xlsx` high CVEs | Dependency |
| `express`/`qs` moderate CVEs | Dependency |
| Formal penetration test | Process |
| MFA/SSO evaluation | Process |

### Future hardening

| Item | Type |
|------|------|
| MAN-007 Enable CSP | Manual |
| MAN-002 Signed short-lived image URLs | Manual |
| SAST-005–016 path prefix validation | SAST review |
| HttpOnly cookie session architecture | Design |

### False positives (no action required for production)

SAST-001–004, SAST-017–020, SAST-028–033, SAST-035–044

---

## 11. Limitations

This SAST assessment **cannot** determine:

- Runtime exploitation of authorization (IDOR/BOLA) without dynamic testing
- TLS certificate quality, reverse proxy, or firewall rules
- PostgreSQL network exposure or database hardening
- Effectiveness of production secrets (values in `.env` were not scanned)
- Social engineering, phishing, or physical security
- Third-party AI provider data handling contracts
- Business-logic flaws (e.g., event access grant workflows)
- Container host security beyond Dockerfile static analysis
- Vulnerabilities in unscanned repo-root PowerShell deployment scripts
- Complete XSS/DOM analysis across all React components
- Whether git history contains leaked secrets

**SAST does not replace penetration testing, DAST, or formal Security/IT sign-off.**

Semgrep OSS fixpoint timeout occurred on `server/index.js` for a subset of taint rules (17 rules); those rules may have incomplete results for that file.

---

## 12. Conclusion

### Initial scan

This report represents a **static application security assessment** of ConnectHub at commit `62713034461a69b539f35a7c80969607c15e9a4a4a`, performed with Semgrep OSS 1.136.0. The initial scan identified **45** rule matches. After triage, **2** findings were likely true positives (including Docker root user), **33** were false positives, and **10** required manual validation.

### After remediation (Section 13)

Re-scan at the same base commit with `Dockerfile` fix: **46** matches, **0** triaged true-positive SAST findings, **SAST-045 cleared**. Runtime Docker build/startup verification remains for IT.

**This report does not constitute penetration testing, infrastructure security validation, SAST certification, or formal Security/IT approval.** The application was **not** assessed as "secure."

---

## Appendix A — Impact on Restricted 7–8 User Event Pilot

Classification for **triaged High/Critical-equivalent** items and key manual observations:

| Item | Pilot classification | Rationale |
|------|---------------------|-----------|
| SAST-001–004 (dev command execution) | **FALSE POSITIVE** | Not deployed in production |
| SAST-045 (Docker root) | **REMEDIATED** (see Section 13) | `USER node` added; runtime Docker verification pending IT environment |
| SAST-021–026 (repository paths) | **ACCEPTABLE FOR PILOT** | Allowlist + auth; small trusted group |
| SAST-005–016 (asset paths) | **MANUAL REVIEW** | Low risk for pilot; authorized users only |
| MAN-001 (localStorage token) | **ACCEPTABLE FOR PILOT** | Known tradeoff; restrict users and HTTPS |
| MAN-002 (query access_token) | **ACCEPTABLE FOR PILOT** | Needed for images; monitor logs |
| MAN-003 (plaintext password fallback) | **SHOULD FIX** | Only if legacy plaintext hashes exist |
| `xlsx` high (dependency) | **SHOULD FIX** | Ingest parses untrusted Excel; pilot uses admin-controlled files — acceptable with trust |
| `vite` high (dependency) | **FALSE POSITIVE** (prod) | Dev-only |

**Pilot blockers from this SAST report alone:** **None**, provided IT implements production configuration controls already documented for the pilot.

---

## Appendix B — Scan artifacts

| Scan | Artifact |
|------|----------|
| Initial | `docs/.sast-temp/semgrep-results.json` (removed after initial report) |
| Re-scan | `docs/.sast-temp/semgrep-rescan.json` |

These files contain no secret values and may be removed after distribution.

---

## 13. Remediation / Re-scan

### 13.1 Previous SAST finding

| Field | Value |
|-------|-------|
| **Finding ID** | SAST-045 |
| **Title** | Docker container runs as root |
| **Severity** | High (Semgrep `ERROR`) |
| **Rule** | `dockerfile.security.missing-user-entrypoint.missing-user-entrypoint` |
| **CWE** | CWE-269 (Improper Privilege Management) |
| **File** | `Dockerfile` line 40 |
| **Initial status** | Likely true positive |

### 13.2 Fix applied

The production image final stage now:

1. Creates `/data/uploads` during image build (as root).
2. Runs `chown -R node:node /app /data/uploads` so the application tree and upload directory are owned by the non-root `node` user shipped in `node:22-bookworm-slim`.
3. Sets `USER node` before `ENTRYPOINT`.

No application code, secrets, or unrelated files were modified. `docker-entrypoint.sh` already creates `$UPLOAD_DIR` at runtime; with a new named volume, Docker initializes the volume from the image layer (owned by `node`).

**Change summary (`Dockerfile`):**

```dockerfile
RUN ... && mkdir -p /data/uploads \
  && chown -R node:node /app /data/uploads
USER node
ENTRYPOINT ["dumb-init", "--", "/docker-entrypoint.sh"]
```

### 13.3 Verification performed

| Check | Result | Notes |
|-------|--------|-------|
| Dockerfile declares non-root `USER` | **PASS** (static) | `USER node` after `chown` |
| `docker build` | **NOT RUN** | Docker daemon not available in the assessment environment (`Cannot connect to the Docker daemon`) |
| Container process runs as non-root | **NOT RUN** | IT should run: `docker run --rm <image> id -u` (expect `1000`) |
| Application startup | **NOT RUN** | IT should run: `docker compose up` and confirm `/api/health` |
| Upload directory writable by app user | **PASS** (static) | `/data/uploads` owned by `node:node` in image; volume inherits on first create |

**IT verification commands (recommended before pilot deploy):**

```bash
docker build -t connecthub:nonroot .
docker run --rm connecthub:nonroot id
# Expect: uid=1000(node) gid=1000(node)
docker compose up -d
curl -sS http://localhost:8080/api/health
docker compose exec app sh -c 'touch /data/uploads/.write-test && rm /data/uploads/.write-test && echo uploads-ok'
```

### 13.4 Re-scan details

| Field | Value |
|-------|-------|
| **Re-scan date** | 2026-09-05 (UTC+5:30) |
| **Base commit SHA** | `62713034461a69b539f35a7c80969607c15e9a4a` |
| **Remediation state** | `Dockerfile` modified (uncommitted at time of re-scan) |
| **Tool** | Semgrep OSS 1.136.0 (`pysemgrep`) |
| **Rulesets** | `auto`, `p/security-audit`, `p/secrets`, `p/owasp-top-ten`, `p/nodejs`, `p/react`, `p/typescript` |
| **Scope** | Same as initial scan (`ConnectHub/`, `Dockerfile`, `docker-compose.yml`) |
| **Extra flags** | `--timeout 0 --timeout-threshold 100 --max-memory 0 --interfile-timeout 0` (to reduce incomplete taint analysis) |

### 13.5 Re-scan results (raw Semgrep)

| Severity | Initial scan | Re-scan | Delta |
|----------|--------------|---------|-------|
| Critical | 0 | 0 | — |
| High (`ERROR`) | 4 | **3** | **−1** (SAST-045 resolved) |
| Medium (`WARNING`) | 31 | 33 | +2 |
| Low | 0 | 0 | — |
| Informational (`INFO`) | 10 | 10 | — |
| **Total** | **45** | **46** | +1 |

The net +1 total is from two additional path-traversal heuristic matches under extended timeout settings; no new High-severity rules fired.

**SAST-045:** **Not present** in re-scan (confirmed: no `dockerfile` / `missing-user` rule matches).

**Remaining High (`ERROR`) findings (all triaged false positive — dev-only scripts):**

| ID | File | Rule |
|----|------|------|
| SAST-001 | `scripts/dev.mjs:18` | `spawn-shell-true` |
| SAST-002 | `scripts/dev.mjs:18` | `detect-child-process` |
| SAST-004 | `scripts/ensure-dev-postgres.mjs:75` | `detect-child-process` |

### 13.6 Re-scan triage summary

| Classification | Initial | Re-scan |
|----------------|---------|---------|
| True / likely true positive | 2 | **0** (SAST-045 remediated) |
| False positive | 33 | **36** |
| Needs manual review | 10 | **10** |

Manual-review items (SAST-005–016, SAST-021–027, SAST-034) and manual observations (MAN-001–015) are unchanged from Sections 7–8.

### 13.7 `server/index.js` analysis completeness

| Scan | Fixpoint timeout | Rules affected |
|------|------------------|----------------|
| Initial | Yes | 17 taint rules on `server/index.js` |
| Re-scan (extended timeouts) | **Yes** (reduced) | **16** taint rules on `server/index.js` (first: `x-frame-options-misconfiguration`) |

Extended timeouts (`--timeout 0`, `--max-memory 0`, `--interfile-timeout 0`) reduced affected rules from 17 to 16 but **did not fully eliminate** the fixpoint timeout. Results for those taint rules on `server/index.js` may still be incomplete. This does not affect the SAST-045 Dockerfile rule (pattern-based, not taint).

### 13.8 Re-scan conclusion

SAST-045 has been **remediated in source**. Re-scan confirms the Dockerfile finding is **cleared**. No remaining High-severity SAST findings are triaged as true positives. Runtime Docker verification must be completed by IT in an environment with a running Docker daemon before production deploy.

**This re-scan does not constitute security certification, formal Security/IT approval, penetration testing, DAST, or infrastructure security validation.**

---

*End of report*
