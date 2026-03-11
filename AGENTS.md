# AGENTS.md - wikigraph

## Project Overview

- Name: `wikipedia-graph`
- Type: client-only React + TypeScript app (Vite)
- Purpose: interactive Wikipedia graph explorer that expands nodes by querying Wikipedia directly from the browser

## Structure

- Root app
  - `package.json` - scripts and dependencies
  - `src/App.tsx` - thin app shell that composes hooks and UI components
  - `src/graph.ts` - Sigma/Graphology controller and interactions
  - `src/api/` - Wikipedia fetch logic
  - `src/components/` - UI building blocks, including `src/components/graph/` for graph overlays and controls
  - `src/hooks/` - React hooks for graph lifecycle, layout controls, hotkeys, overlays, and status handling
  - `src/store/useAppStore.ts` - Zustand store for shared app/UI state
  - `src/types.ts` - shared client data types
  - `Dockerfile` - builds and serves static client via Caddy
  - `docker-compose.yml` - deploys static app behind Traefik
  - `mise.toml` - local tooling/tasks

## Architecture Notes

- The app uses a split architecture:
  - `src/graph.ts` owns the imperative Sigma + Graphology controller.
  - React components render the UI and call into hooks.
  - `src/hooks/` adapts React state/events to the imperative graph controller.
- Shared cross-component UI state is stored in Zustand via `src/store/useAppStore.ts`.
- Zustand currently holds search state, spotlight visibility, controls visibility, layout settings, pause state, loading/count state, and status toast state.
- Prefer putting app-wide UI state in the Zustand store instead of re-introducing deep prop drilling through `App.tsx`.
- Keep `App.tsx` focused on composition, high-level flow, and wiring together hooks/components.
- Keep graph rendering and interaction logic inside `src/graph.ts`; avoid moving Sigma/Graphology internals into React components.

## State Ownership

- `src/graph.ts`
  - Owns imperative graph state, Sigma lifecycle, Graphology data, expansion application, hover behavior, and camera/layout worker integration.
  - Should not depend on React component state directly.
- `src/store/useAppStore.ts`
  - Owns shared app/UI state used across multiple components or hooks.
  - Current examples: search seed, selected Wikipedia language, spotlight visibility, controls visibility, layout settings, paused state, loading flag, node/edge counts, and toast state.
- `src/hooks/`
  - Own side effects and coordination logic that bridge React and external systems.
  - Examples: controller setup/teardown, hotkeys, toast timers, media-query handling, and syncing layout settings into the graph controller.
- Component local state
  - Use local state only for UI concerns that are private to one component.
  - Current example: the instructions accordion/open height behavior inside `src/components/SpotlightBar.tsx`.
- `src/App.tsx`
  - Should not become a second state store.
  - Prefer reading shared state from Zustand and delegating behavior to hooks/components rather than recreating cross-cutting state in `App.tsx`.

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
