# VeLo Custom UI

A production-ready, dark-theme SOC dashboard built as a custom frontend for [Velociraptor](https://docs.velociraptor.app/) — the open-source digital forensics and incident response (DFIR) platform. This project adds a modern cybersecurity-oriented UI on top of the Velociraptor REST/gRPC-gateway API.

---

## Features

- **Real-time SOC Dashboard** — live KPI cards, activity charts, heatmaps, and a world geo-map of client endpoints
- **Hunt Management** — create, monitor, and browse artifact collection hunts
- **Client Inventory** — searchable client list with OS breakdown, last-seen timeline, and geo-location
- **VFS Browser** — interactive Virtual File System explorer per client
- **Case Management** — built-in case/incident tracking with notes and evidence links
- **AI Assistant** — optional Gemini-powered natural-language interface (Google AI Studio key required)
- **Multi-Org Support** — per-user Velociraptor server URL + org isolation
- **GeoIP Enrichment** — IP → country/city resolution via MaxMind GeoLite2 (offline) or ip-api.com (online fallback)
- **Role-Based Access** — admin and analyst roles with JWT authentication + refresh tokens

---

## Architecture

```
┌──────────────┐        ┌──────────────────────┐        ┌─────────────────────┐
│   Browser    │  HTTPS │  Nginx + Vue 3 SPA   │  HTTP  │  Node.js Backend    │
│  (Frontend)  │◄──────►│   (port 3000)        │◄──────►│  Express (port 5000)│
└──────────────┘        └──────────────────────┘        └──────────┬──────────┘
                                                                    │
                    ┌───────────────────────────────────────────────┤
                    │                                               │
             ┌──────▼──────┐   ┌────────────┐   ┌────────────────▼──────────────┐
             │  PostgreSQL  │   │   Redis    │   │  Velociraptor gRPC-gateway    │
             │  (port 5432) │   │ (port 6379)│   │  https://your-velo-server:8889│
             └─────────────┘   └────────────┘   └───────────────────────────────┘
```

| Service     | Technology         | Purpose                                     |
|-------------|-------------------|---------------------------------------------|
| Frontend    | Vue 3 + Vite + ECharts + Vuetify 3 | SPA served by Nginx |
| Backend     | Node.js 18 + Express            | REST API proxy to Velociraptor + auth |
| PostgreSQL  | Postgres 15        | Users, sessions, cases, audit log           |
| Redis       | Redis 7            | GeoIP lookup cache + WebSocket pub/sub      |
| Velociraptor| External (yours)   | DFIR data source — clients, hunts, VFS      |

---

## Prerequisites

| Tool          | Version  | Notes                                     |
|---------------|----------|-------------------------------------------|
| Docker        | 24+      | Install from https://docs.docker.com      |
| Docker Compose| v2.20+   | Bundled with Docker Desktop               |
| Velociraptor  | 0.7.x+   | Running with the REST API enabled         |
| (optional) MaxMind account | — | For offline GeoIP lookups |

Your Velociraptor server must be reachable from the machine running this stack. If it is on a private network, use an SSH tunnel or a Cloudflare/ngrok tunnel.

---

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/NDC12345/velo-custom-ui.git
cd velo-custom-ui

# Copy the environment template and fill in values
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your values — at minimum:

| Variable | What to set |
|---|---|
| `DB_PASSWORD` | Strong random password for PostgreSQL |
| `JWT_SECRET` / `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Three different random strings (≥32 chars) |
| `VELO_CREDENTIALS_ENCRYPTION_KEY` | 64 hex characters (32 bytes) |
| `COOKIE_SECRET` | Random string (≥32 chars) |
| `VELO_API_BASE_URL` | Base URL of your Velociraptor server |
| `VELO_SERVICE_USERNAME` / `VELO_SERVICE_PASSWORD` | Velociraptor service account credentials |

Generate secrets quickly:
```bash
# JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Build and start

```bash
docker compose up -d --build
```

First startup takes ~2–3 minutes (npm install + Vite build inside containers). After that:

```
http://localhost:3000   → Frontend (SOC dashboard)
http://localhost:5000   → Backend API
```

### 3. Create the first admin user

```bash
# Set admin credentials as env vars, then run the seed script
VELO_ADMIN_USERNAME="admin" \
VELO_ADMIN_PASSWORD="your-strong-password" \
node database/seeds/01-admin-user.js
```

Or pass them through the `.env` file — see the `VELO_ADMIN_USERNAME` / `VELO_ADMIN_PASSWORD` keys in `backend/.env.example`.

### 4. Log in

Open `http://localhost:3000`, log in with the admin credentials you just created, then navigate to **Settings → Velociraptor Connection** to enter your server URL and credentials per-user (they are stored encrypted in PostgreSQL).

---

## Velociraptor API Setup

### Enable the REST/gRPC-gateway

The backend communicates with Velociraptor via its built-in HTTP API (port `8889` by default). Ensure this is enabled in your Velociraptor server config:

```yaml
# velociraptor.config.yaml
API:
  bind_address: 0.0.0.0
  bind_port: 8080      # gRPC port
GUI:
  bind_address: 0.0.0.0
  bind_port: 8889      # REST/HTTP gateway
  gw_certificate: ...  # TLS cert
  gw_private_key: ...  # TLS key
```

If `VELO_API_VERIFY_SSL=false` is set the backend skips TLS certificate verification — useful for self-signed certs in development. **Set it to `true` in production.**

### Create a service account

Create a dedicated Velociraptor user with minimal required permissions for the backend WebSocket gateway:

```bash
velociraptor --config velociraptor.config.yaml \
  user add svc-velo-ui --role reader,api
```

Roles required:

| Role         | Used for                                    |
|-------------|---------------------------------------------|
| `reader`    | SearchClients, GetClient, GetClientFlows, ListAvailableEventResults |
| `api`       | API access (required for all API users) |
| `analyst`   | (optional) Create/read hunts and notebooks |

Use these credentials for `VELO_SERVICE_USERNAME` and `VELO_SERVICE_PASSWORD` in `.env`.

### Per-user server connection

Each dashboard user can also configure their **own** Velociraptor server URL in **Settings → Velociraptor Connection**. This supports multi-tenant setups where different analysts connect to different Velociraptor instances. Credentials are AES-256-GCM encrypted before being stored in PostgreSQL.

---

## User Management

Users are stored in the PostgreSQL `users` table. The recommended flow:

### Add an admin via the seed script

```bash
# From the project root (backend/.env must be configured)
node database/seeds/01-admin-user.js
```

This prompts for — or reads from env — the following:
- A local dashboard login account (username + hashed password)
- An optional initial Velociraptor server URL + credentials

### Add users via the API

Once logged in as admin, POST to `/api/auth/register` (admin-only endpoint):

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_jwt>" \
  -d '{
    "username": "analyst1",
    "email": "analyst1@company.com",
    "password": "SecurePass123!",
    "role": "analyst"
  }'
```

Available roles: `admin`, `analyst`

### Reset a password

```bash
# Connect to your PostgreSQL container
docker exec -it velo-postgres psql -U velo_admin -d velo_custom

-- Update password (bcrypt hash with 12 rounds)
UPDATE users SET password_hash = '<bcrypt_hash>' WHERE username = '<username>';
```

Generate a bcrypt hash:
```bash
node -e "const b=require('bcrypt'); b.hash('newpassword',12).then(console.log)"
```

---

## Environment Variables Reference

All variables are defined in `backend/.env.example`. Key groups:

### Required

| Variable | Description |
|---|---|
| `DB_PASSWORD` | PostgreSQL password |
| `JWT_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Token signing keys (must differ) |
| `VELO_CREDENTIALS_ENCRYPTION_KEY` | 64-char hex key for AES-256-GCM encryption |
| `COOKIE_SECRET` | HTTP cookie signing secret |
| `VELO_API_BASE_URL` | Velociraptor server HTTP API URL |
| `VELO_SERVICE_USERNAME` / `VELO_SERVICE_PASSWORD` | Velociraptor service account |

### Optional / Feature flags

| Variable | Default | Description |
|---|---|---|
| `GOOGLE_AI_API_KEY` | _(blank)_ | Enables AI assistant (Gemini). Leave blank to disable. |
| `MMDB_PATH` | `/geoip/GeoLite2-City.mmdb` | Path to MaxMind MMDB; falls back to ip-api.com if absent |
| `VELO_API_VERIFY_SSL` | `true` | Set `false` only for self-signed certs in dev |
| `VELO_ORG_ID` | _(blank)_ | Velociraptor org ID for multi-tenant deployments |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost (10 is faster for dev, 14 for high-security production) |
| `REDIS_GEO_TTL_DAYS` | `7` | GeoIP lookup cache TTL in days |
| `WS_POLL_INTERVAL_MS` | `10000` | How often the WebSocket gateway polls Velociraptor for live client data |

---

## GeoIP Setup (Optional but Recommended)

By default the backend resolves client IPs to geo-locations using [ip-api.com](http://ip-api.com/) (free, 45 requests/minute). For production deployments with many clients, use MaxMind's offline database:

1. Create a free account at https://dev.maxmind.com/
2. Download `GeoLite2-City.mmdb`
3. Place it in the `geoip-data/` directory:
   ```
   velo-custom-ui/
   └── geoip-data/
       └── GeoLite2-City.mmdb   ← place here
   ```
4. The Docker volume `./geoip-data:/geoip:ro` mounts it automatically. Set `MMDB_PATH=/geoip/GeoLite2-City.mmdb` in `.env`.

---

## Development Mode

To run services locally without Docker (useful for rapid frontend iteration):

### Backend

```bash
cd backend
cp .env.example .env    # configure as above
npm install
npm run dev             # nodemon with hot-reload
```

### Frontend

```bash
cd frontend
npm install
# Set VITE_API_URL to point to your backend
echo "VITE_API_URL=http://localhost:5000" > .env.local
npm run dev             # Vite dev server on http://localhost:5173
```

### Full stack (Docker Compose, development profile)

```bash
docker compose -f docker-compose.yml up
```

To rebuild after source changes:

```bash
docker compose build --no-cache frontend
docker compose up -d --force-recreate frontend
```

---

## Production Deployment

### Recommended stack

- **Reverse proxy**: Nginx or Caddy in front of the frontend container (handles TLS termination)
- **TLS**: Use Let's Encrypt (Certbot) or Cloudflare Proxy
- **Secrets management**: Use Docker Secrets or a dedicated vault (HashiCorp Vault, AWS Secrets Manager) — do not commit `.env` to source control
- **Backups**: Schedule daily `pg_dump` of the PostgreSQL container volume

### Example Nginx reverse-proxy config

```nginx
server {
    listen 443 ssl http2;
    server_name soc.yourcompany.com;

    ssl_certificate     /etc/letsencrypt/live/soc.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/soc.yourcompany.com/privkey.pem;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
    }

    location /api/ {
        proxy_pass         http://localhost:5000;
        proxy_set_header   Host $host;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
    }
}
```

### Production docker-compose

A hardened `docker-compose.prod.yml` is included. Use it instead of the default:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Security Checklist

Before going to production:

- [ ] All secrets in `.env` are unique, strong, and not committed to git
- [ ] `VELO_API_VERIFY_SSL=true` — TLS verification enabled
- [ ] `VELO_SKIP_AUTH_CHECK=false` — authentication enforced
- [ ] `AUTH_RATE_LIMIT_MAX` is set to a low value (5–10) to prevent brute-force attacks
- [ ] PostgreSQL is not exposed on a public interface (`DB_HOST=postgres` stays internal)
- [ ] Redis has no public exposure
- [ ] The backend API (`port 5000`) is not directly internet-accessible — only through the Nginx reverse proxy
- [ ] GeoIP uses MaxMind MMDB (offline) — no client IPs are sent to third-party APIs
- [ ] Log rotation is configured (`logrotate` or a Docker logging driver with `max-size`)
- [ ] Regular `pg_dump` backups are scheduled
- [ ] The Velociraptor service account has only the minimum required roles (`reader`, `api`)

---

## Directory Structure

```
velo-custom-ui/
├── backend/
│   ├── src/
│   │   ├── config/          # Database, JWT, Velociraptor API client
│   │   ├── controllers/     # Route handlers (auth, proxy, geo, ai, dashboard)
│   │   ├── middleware/       # Auth guards, CSRF, rate limiting, error handler
│   │   ├── routes/          # Express router definitions
│   │   ├── services/        # GeoIP, dashboard aggregation, WebSocket gateway
│   │   └── utils/           # Logging, error classes, helpers
│   ├── .env.example         # Environment variable template ← copy to .env
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components (charts, layout, maps)
│   │   ├── views/           # Page-level views (Dashboard, Clients, Hunts, …)
│   │   ├── stores/          # Pinia state stores
│   │   ├── services/        # API client wrappers
│   │   └── router/          # Vue Router config
│   ├── Dockerfile
│   └── package.json
├── database/
│   ├── schema.sql           # Initial schema (auto-applied on first Postgres boot)
│   ├── migrations/          # Incremental SQL migrations (auto-applied via Docker)
│   └── seeds/
│       └── 01-admin-user.js # Admin user creation script
├── geoip-data/
│   └── README.md            # Instructions for placing GeoLite2-City.mmdb
├── docker-compose.yml       # Development / default compose file
├── docker-compose.prod.yml  # Hardened production compose file
└── README.md                # This file
```

---

## Troubleshooting

### Frontend shows "Dashboard API error"

1. Check backend is healthy: `docker logs velo-backend --tail 50`
2. Confirm `VELO_API_BASE_URL` in `.env` is reachable from inside the backend container:
   ```bash
   docker exec -it velo-backend curl -k https://your-velo-server:8889/api/v1/GetServerInfo
   ```
3. If the Velociraptor server uses a self-signed cert, set `VELO_API_VERIFY_SSL=false` for testing.

### "SearchClients failed" in backend logs

The service account credentials may be wrong or the account lacks the required roles. Verify:
```bash
velociraptor --config velociraptor.config.yaml user show svc-velo-ui
```

### Geo map shows no client locations

- IP enrichment requires routable (public) IP addresses. Private IPs (`10.x`, `192.168.x`, `172.16–31.x`) resolve to `Unknown`.
- Check GeoIP backend logs: `docker logs velo-backend 2>&1 | grep GeoIP`
- If using MaxMind MMDB, verify the file exists: `docker exec velo-backend ls -la /geoip/`

### Cannot connect to PostgreSQL

Ensure `DB_PASSWORD` in `.env` matches the value used when the `postgres_data` volume was first initialised. If you changed the password after first boot, you need to destroy and recreate the volume:
```bash
docker compose down -v   # WARNING: destroys all data
docker compose up -d --build
```

### Token expired / login loop

Reduce `JWT_ACCESS_EXPIRES_IN` claims are too short or clocks are out of sync. Check server time: `docker exec velo-backend date`.

---



For licensing inquiries contact: **your-email@company.com**
