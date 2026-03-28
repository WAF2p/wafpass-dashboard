# wafpass-dashboard

Standalone React dashboard for WAF++ PASS scan results.

Fetches data from `wafpass-server` — no Python dependency, no local scan access.

## Features

- **Runs list** — all scans with score, project, branch, trigger
- **Run detail** — pillar score radar chart + findings table
- **Findings filters** — filter by status (PASS/FAIL/SKIP/WAIVED), severity, and pillar

## Dev setup

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. API calls to `/runs` are proxied to
`http://localhost:8000` (wafpass-server) in dev mode.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `""` (same origin) | Base URL of wafpass-server, e.g. `http://localhost:8000` |

In production the nginx config proxies `/runs` to `wafpass-server:8000` automatically,
so no `VITE_API_URL` is needed unless you're running them on separate origins.

## Production build

```bash
npm run build   # outputs to dist/
```

## Docker

```bash
docker build -t wafpass-dashboard .
docker run -p 3000:80 wafpass-dashboard
```

The nginx container proxies `/runs` → `wafpass-server:8000` (Docker network name).

## docker-compose (full stack)

From the repo root:

```bash
cp .env.example .env
docker compose up
```

Dashboard at `http://localhost:3000`, API at `http://localhost:8000`.
