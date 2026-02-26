# AGENTS.md - Wikipedia Graph Developer Guide

This document provides guidelines for agents working on the wikipedia-graph codebase.

## Project Overview

Wikipedia Graph is a monorepo containing:
- **client/**: React 19 + Vite frontend (ESM)
- **server/**: Fastify + TypeScript backend (Node.js)
- **shared/**: Shared TypeScript types

## Build, Run & Test Commands

### Development
```bash
# Run all packages concurrently (requires Redis/Valkey running)
npm run dev

# Run server only
cd server && npm run dev        # Uses tsx watch

# Run client only
cd client && npm run dev        # Uses Vite dev server
```

### Building
```bash
# Build client (TypeScript + Vite)
cd client && npm run build

# Server runs with tsx (no build step needed)
cd server && npm run start
```

### Linting & Type Checking
```bash
# Client linting (ESLint)
cd client && npm run lint

# TypeScript type checking (no automatic command - use editor or manual tsc)
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit
```

### Running Tests
**No test framework is currently configured.** To add tests:
- Server: Consider adding Vitest or node:test
- Client: Already has eslint-plugin-react-hooks for React testing

### Infrastructure
```bash
# Run Redis/Valkey via mise
mise run valkey

# Or manually:
docker run --rm -it -p 6379:6379 --name valkey valkey/valkey:latest
```

Environment variables:
- `VALKEY_URL` or `REDIS_URL`: Redis connection string (default: `redis://localhost:6379`)
- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: `0.0.0.0`)
- `VITE_API_BASE`: Client API base URL (default: `http://localhost:3000`)

## Code Style Guidelines

### TypeScript
- Use strict TypeScript (`strict: true` in tsconfig)
- Enable `noUnusedLocals` and `noUnusedParameters`
- Use explicit return types for exported functions
- Use type inference for local variables

### Import Conventions

**Server (Node.js with ESM):**
- Include `.js` extension in relative imports: `import { foo } from './foo.js'`
- Use bare imports for packages: `import fastify from 'fastify'`

**Client (Vite/ESM):**
- Omit file extensions: `import { foo } from './foo'`
- Use `import type` for type-only imports

**Shared types:**
- Import from `@wikipedia-graph/shared`

### Naming Conventions
- **Files**: kebab-case (`cache.ts`, `graph-controller.ts`)
- **Components**: PascalCase (`App.tsx`, `GraphController.ts`)
- **Functions/variables**: camelCase
- **Types/interfaces**: PascalCase with `Type` suffix for type aliases, or noun for interfaces
- **Constants**: UPPER_SNAKE_CASE for true constants, camelCase otherwise

### React Patterns
- Use function components with hooks
- Use default exports for components: `export default App`
- Use named exports for utilities/hooks
- Follow React 19 patterns (no need for `use` keyword unless using promises)
- Use `useMemo` for expensive computations
- Use `useRef` for mutable refs
- Handle errors with try/catch in event handlers

### Error Handling
- Server: Use try/catch with `request.log.error()` for logging
- Server: Return appropriate HTTP status codes (400, 404, 500)
- Client: Display errors to users via UI, log to console
- Validate inputs with Zod schemas (server)

### Formatting
- Server: Use single quotes for strings
- Client JSX: Use double quotes for attributes, single quotes elsewhere
- Use semicolons
- Use Prettier if available (not currently configured)

### Package Management
- This is a npm workspace monorepo
- Add dependencies to appropriate package's `package.json`
- Use `file:../shared` for local shared package

### API Design
- RESTful endpoints
- Use query parameters for GET requests
- Return JSON responses
- Use Zod for request validation

## Architecture Notes

### Data Flow
1. User enters a seed article title in the client
2. Client calls `/expand` endpoint with the title
3. Server fetches inlinks/outlinks from Wikipedia API
4. Server returns `{ newNodes: string[], newEdges: {fromNode, targetNode}[] }`
5. Server caches results in Redis (1 day TTL)
6. Client renders/updates graph with Sigma.js

### API Response Format
```typescript
type ExpandEdge = { fromNode: string; targetNode: string }
type ExpandResponse = {
  newNodes: string[]      // Center node + all outlinks
  newEdges: ExpandEdge[] // Bidirectional edges to outlinks and inlinks
}
```

### Key Files
- `server/src/server.ts`: Fastify server setup and routes
- `server/src/wiki.ts`: Wikipedia API integration (outlinks from pages[].links, inlinks from backlinks)
- `server/src/cache.ts`: Redis caching layer
- `client/src/App.tsx`: Main React component
- `client/src/graph.ts`: Sigma.js graph controller - handles node/edge deduplication
- `client/src/api.ts`: API client calling `/expand` endpoint
- `shared/src/types.ts`: Shared TypeScript types
