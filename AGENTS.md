# AGENTS.md - wikigraph

## Project Overview

- Name: `wikipedia-graph`
- Type: client-only React + TypeScript app (Vite)
- Purpose: interactive Wikipedia graph explorer that expands nodes by querying Wikipedia directly from the browser

## Structure

- Root app
  - `package.json` - scripts and dependencies
  - `src/App.tsx` - app shell, controls, and orchestration
  - `src/graph.ts` - Sigma/Graphology controller and interactions
  - `src/api/` - Wikipedia fetch logic
  - `src/types.ts` - shared client data types
  - `Dockerfile` - builds and serves static client via Caddy
  - `docker-compose.yml` - deploys static app behind Traefik
  - `mise.toml` - local tooling/tasks

## Development

From repo root:

```bash
npm install
npm run dev
npm run build
npm run lint
npm run format
```

## Runtime Notes

- No backend service is required.
- All expansion requests go from browser to `https://<lang>.wikipedia.org/w/api.php`.
- Ensure CSP/network policy allows outbound requests to Wikipedia APIs when deployed.
