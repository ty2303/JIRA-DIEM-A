# Nhom12 Frontend

React + Vite + TypeScript frontend for the Nhom12 application.

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (port 5173)
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Run tests
npm test

# Build for production
npm run build
```

## Folder Structure

```
src/
├── api/                  # API integration layer
│   ├── client.ts         # Axios instance with interceptors
│   ├── endpoints.ts      # API endpoint constants
│   └── types.ts          # Shared request/response types
│
├── features/             # Feature-based modules
│   └── example/          # Template — copy for new features
│       ├── components/   # Feature-specific UI components
│       ├── hooks/        # Feature-specific custom hooks
│       ├── services/     # API service functions
│       ├── stores/       # Zustand stores (feature-local state)
│       ├── types/        # Feature-specific TypeScript types
│       └── index.ts      # Public barrel export
│
├── components/           # Shared/reusable UI components
│   ├── ui/               # Design system primitives
│   └── layout/           # Layout components (Header, Sidebar, etc.)
│
├── hooks/                # Shared custom hooks
├── pages/                # Route-level page components
│
├── router/               # Routing configuration
│   ├── index.tsx         # createBrowserRouter definition
│   └── guards/           # Route guards (auth, roles, etc.)
│
├── stores/               # Global Zustand stores
├── types/                # Shared TypeScript types
├── utils/                # Pure utility functions
├── lib/                  # Third-party library wrappers
│   └── queryClient.ts    # TanStack Query client setup
│
├── assets/               # Static assets
│   ├── images/
│   └── styles/
│       └── globals.css
│
├── main.tsx              # App bootstrap (providers + router)
├── App.tsx               # Root layout component
└── vite-env.d.ts         # Vite/TypeScript env types
```

## Creating a New Feature

1. Copy `src/features/example/` to `src/features/<your-feature>/`
2. Add components, hooks, services, stores, and types
3. Export public API from `index.ts`
4. Add route in `src/router/index.tsx`
5. Import from `@/features/<your-feature>`

## Environment Variables

All environment variables must be prefixed with `VITE_` to be exposed to the client.

| Variable            | Description                          | Default                                              |
| ------------------- | ------------------------------------ | ---------------------------------------------------- |
| `VITE_APP_NAME`     | Application name                     | Nhom12 App                                           |
| `VITE_APP_ENV`      | Environment (development/production) | —                                                    |
| `VITE_API_BASE_URL` | API base URL                         | http://localhost:8080/api in dev, /api in production |

Files:

- `.env` — Default values (committed)
- `.env.development` — Dev overrides
- `.env.production` — Prod overrides
- `.env.local` — Local overrides (NOT committed, copy from `.env.local.example`)

## API Base URL

For local development, copy `frontend/.env.example` to `.env.local` if you need
to recreate the environment variables manually. The default development API URL
is `http://localhost:8080/api`.

For production builds, keep `VITE_API_BASE_URL=/api`.

## Path Aliases

Use `@/` to import from `src/`:

```typescript
import apiClient from '@/api/client';
import { useAuth } from '@/features/auth';
import { Button } from '@/components/ui/Button';
```

## State Management

- **Server state** (API data): TanStack Query — caching, refetching, mutations
- **Client state** (UI state): Zustand — minimal boilerplate, no Redux ceremony

## Tech Stack

| Tool              | Purpose                 |
| ----------------- | ----------------------- |
| React 19          | UI framework            |
| Vite 7            | Build tool + dev server |
| TypeScript        | Type safety             |
| SWC               | Fast compilation        |
| React Router v7   | Client-side routing     |
| TanStack Query v5 | Server state management |
| Zustand v5        | Client state management |
| Axios             | HTTP client             |
| Vitest            | Unit testing            |
| ESLint            | Code linting            |
