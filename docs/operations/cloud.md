# Cloud operations: Render, Vercel and Supabase

[Operations home](README.md) · [Migration plan](../migration/personal-ai-planner.md) · [Architecture](../migration/render-vercel-supabase.md)

Production runtime deployed on **2026-11-08** for `feat/personal-ai-planner-v1`.

---

## 1. System Topology & Active Resources

```mermaid
flowchart LR
    Browser["Web Browser (Client)"] -->|HTTPS / WSS| Vercel["Vercel Edge (Frontend)<br/>planner-t1.vercel.app"]
    Vercel -->|Same-origin rewrite /api/v1/*| Render["Render Singapore (API & Worker)<br/>planner-api-sg.onrender.com"]
    Render -->|PostgreSQL 17 + pgvector (TLS)| SupabaseDB[("Supabase DB (Mumbai)<br/>Schema: planner")]
    Render -->|Private HTTPS Storage| SupabaseStorage["Supabase Storage<br/>Bucket: planner-private"]
    Render -->|HTTPS REST API| Resend["Resend API<br/>Transactional Email"]
```

### Component Inventory

| Component | Provider & Tier | Identifier / Name | Region | Endpoint / Host |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | Vercel (Hobby) | `planner-t1`<br/>(`prj_BO2EKC5jEswXZMw9OSgm6QL0BBUm`) | Edge (HKG/SIN) | `https://planner-t1.vercel.app` |
| **API & Worker** | Render (Free) | `planner-api-sg`<br/>(`srv-dbo21jp5efls73clvcp0`) | Singapore (`singapore`) | `https://planner-api-sg.onrender.com` |
| **Database** | Supabase (Free) | `mybfctyrtdjrrmndfdvf` | Mumbai (`aws-0-ap-south-1`) | `aws-0-ap-south-1.pooler.supabase.com:5432/postgres` (schema `planner`) |
| **Object Storage**| Supabase Storage | `planner-private` (Private) | Mumbai | Proxy via API `/files/*` |
| **Email Service** | Resend | API-based HTTPS delivery | Global | `onboarding@resend.dev` |

> [!IMPORTANT]
> **Zero hardcoded credentials:** Never commit passwords, tokens, connection strings, or encryption keys to Git. All secrets are configured strictly through Render environment variables and Vercel project settings.

---

## 2. Environment Variables & Configuration

### Backend: Render (`planner-api-sg`)

All settings are configured in the Render Dashboard under **Environment**:

| Variable Key | Required Value / Description | Sensitive |
| :--- | :--- | :--- |
| `PLANNER_ENVIRONMENT` | `production` | No |
| `PLANNER_WEB_ORIGIN` | `https://planner-t1.vercel.app` (Strictly without trailing slash) | No |
| `PLANNER_DATABASE_URL` | `postgresql+psycopg://postgres.[REF]:[PASS]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require` | **Yes** |
| `PLANNER_DATABASE_SCHEMA`| `planner` | No |
| `PLANNER_POOL_SIZE` | `4` (Tuned for Supabase Session pooler) | No |
| `PLANNER_POOL_OVERFLOW` | `2` | No |
| `PLANNER_SUPABASE_URL` | `https://[REF].supabase.co` | No |
| `PLANNER_SUPABASE_SERVICE_ROLE_KEY` | Server-only `service_role` JWT token | **Yes** |
| `PLANNER_SUPABASE_STORAGE_BUCKET` | `planner-private` | No |
| `PLANNER_WORKER_MODE` | `poll` | No |
| `PLANNER_RUN_WORKER` | `true` (Runs polling worker alongside FastAPI) | No |
| `PLANNER_MIGRATE_ON_START` | `true` (Applies Alembic migrations automatically upon boot) | No |
| `PLANNER_ENCRYPTION_KEY` | 32+ character key or Fernet secret for encrypting sensitive fields | **Yes** |
| `PLANNER_SMTP_FROM` | `Planner <onboarding@resend.dev>` (or custom verified domain) | No |
| `PLANNER_RESEND_API_KEY`| Resend API key (`re_...`) | **Yes** |

### Frontend: Vercel (`planner-t1`)

Configured in Vercel under **Settings → Environment Variables**:

| Variable Key | Environments | Value | Description |
| :--- | :--- | :--- | :--- |
| `API_ORIGIN` | Production, Preview, Development | `https://planner-api-sg.onrender.com` | Upstream API origin proxied via Next.js rewrites |

---

## 3. Deployment Runbook

### A. Deploying Frontend Changes (Vercel)

1. Make sure `apps/web/.vercelignore` exists to prevent uploading unneeded build caches and dependencies.
2. Deploy directly using Vercel CLI:
   ```bash
   cd apps/web
   npx vercel deploy --prod --yes --token=<VERCEL_TOKEN>
   ```
3. Alternatively, link GitHub repository `datphan3201/Notes` (branch `feat/personal-ai-planner-v1`) in Vercel project settings for automatic continuous deployment on push.

### B. Deploying Backend Changes (Render)

1. Commit and push changes to `feat/personal-ai-planner-v1`:
   ```bash
   git push origin feat/personal-ai-planner-v1
   ```
2. Render will automatically build the Docker image and deploy.
3. To trigger an immediate manual deploy via Render API:
   ```bash
   curl -X POST https://api.render.com/v1/services/srv-dbo21jp5efls73clvcp0/deploys \
     -H "Authorization: Bearer <RENDER_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"clearCache": "do_not_clear"}'
   ```
4. **Startup lifecycle:**
   - Container executes [Dockerfile](../../apps/api/Dockerfile) CMD `python -m planner.serve`.
   - `planner.serve` checks environment configuration.
   - If `PLANNER_MIGRATE_ON_START=true`, it runs `alembic upgrade head` into the `planner` schema.
   - Launches `FastAPI` server on `PORT` and starts the asynchronous background polling worker.

---

## 4. Operational Playbooks

### Managing User Roles (Promoting to Admin)

To promote or modify a user's role in the production Supabase database:

```bash
PLANNER_DATABASE_URL="postgresql+psycopg://postgres.[REF]:[PASS]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require" \
PLANNER_DATABASE_SCHEMA="planner" \
python3 -m planner.admin <user_email> admin
```

- Target roles: `admin`, `user`.
- An immutable audit trail is logged to `planner.admin_actions`.

### Database Schema Migrations

- Migrations are versioned under [apps/api/migrations/versions](../../apps/api/migrations/versions).
- Follow expand-and-contract practices: never delete or rename columns in a single deploy while existing instances are serving traffic.
- To run migrations manually outside container boot:
  ```bash
  cd apps/api
  PLANNER_DATABASE_URL="<CONNECTION_STRING>" \
  PLANNER_DATABASE_SCHEMA="planner" \
  alembic upgrade head
  ```

### Data Synchronization / Migration

To migrate or sync data from a local environment or baseline backup into Supabase:
- Use the atomic binary synchronization tool: [tools/deploy/migrate_to_supabase.py](../../tools/deploy/migrate_to_supabase.py).
- Features: schema mapping (`public` → `planner`), foreign key resolution, sequence alignment, binary embedding preservation, and zero data truncation.

---

## 5. Health Checks & Latency Monitoring

### Verification Endpoints

1. **Frontend Proxy Health:**
   ```bash
   curl -s -w "\nHTTP: %{http_code} | Total: %{time_total}s\n" https://planner-t1.vercel.app/api/v1/health
   # Expected: {"status":"ready"} (HTTP 200)
   ```
2. **Backend Direct Readiness (Checks DB connectivity):**
   ```bash
   curl -s -w "\nHTTP: %{http_code} | Total: %{time_total}s\n" https://planner-api-sg.onrender.com/ready
   # Expected: {"status":"ready"} (HTTP 200)
   ```
3. **Backend Liveness:**
   ```bash
   curl -s -w "\nHTTP: %{http_code} | Total: %{time_total}s\n" https://planner-api-sg.onrender.com/health
   # Expected: {"status":"ok"} (HTTP 200)
   ```
4. **End-to-End Page Latency:**
   ```bash
   curl -s -o /dev/null -w "HTTP: %{http_code} | TTFB: %{time_starttransfer}s | Total: %{time_total}s\n" https://planner-t1.vercel.app/login
   # Expected TTFB: ~0.45s - 0.70s (warm container)
   ```

---

## 6. Known Characteristics & Platform Limits (Free Tier)

### Render Free Tier
- **Inactivity Sleep:** Services sleep after 15 minutes of zero incoming HTTP traffic.
- **Cold Start:** The first request after sleep requires **30 to 50 seconds** to spin up the container and verify readiness. Subsequent requests are fast (~450ms).
- **Ephemeral Filesystem:** Storage is wiped upon restart; all uploaded files must be uploaded to private Supabase Storage (`planner-private`).
- **SMTP Port Blocks:** Render blocks outbound TCP ports 25, 465, and 587. Email delivery is routed via HTTPS to the Resend API.
- **Monthly Usage Limit:** Free tier grants 750 free instance hours per calendar month per account.

### Supabase Free Tier
- **Session Pooling:** Connect using port `5432` with `aws-0-ap-south-1.pooler.supabase.com` to prevent connection exhaustion.
- **Inactivity Pause:** Supabase projects pause after 7 days without queries. Keeping active usage or scheduled jobs prevents pausing.

---

## 7. Incident Troubleshooting Guide

| Symptom / Error | Root Cause | Resolution |
| :--- | :--- | :--- |
| **HTTP 403: Untrusted request origin** | `PLANNER_WEB_ORIGIN` in Render does not exactly match the browser's origin `https://planner-t1.vercel.app`. | In Render environment variables, verify `PLANNER_WEB_ORIGIN=https://planner-t1.vercel.app` (no trailing slash). Trigger a service redeploy/restart. |
| **HTTP 504 / 502 on initial request** | Render container was asleep and cold start exceeded Vercel's edge proxy timeout (~15s). | Wait 30 seconds and retry the request. Once awake, the container remains active for 15 minutes. |
| **User lost Admin permissions** | Legacy import or default registration sets `role="user"`. | Execute `python3 -m planner.admin <email> admin` with the Supabase connection string and `planner` schema. |
| **Database connection pool exhaustion** | Excessive concurrent connections or leaked sessions. | Verify `PLANNER_POOL_SIZE=4` and `PLANNER_POOL_OVERFLOW=2` in Render settings. Ensure connection uses Session Pooler port `5432`. |
| **Render build failure / crash loop** | Missing required production environment variable. | Check container deployment logs via Render Dashboard or API. `planner.serve` outputs a consolidated checklist of any missing production requirements. |
