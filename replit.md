# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### Life Finance Simulator (`/`)
A premium dark-mode fintech interactive life simulator built with React + Vite.

- **Path**: `artifacts/life-finance-simulator/`
- **Stack**: React, Vite, TailwindCSS v4, Framer Motion, Recharts
- **Persistence**: localStorage (no backend)
- **Features**:
  - Multi-step onboarding wizard (name, age, country, income, goal)
  - Full simulation engine: yearly advance, inflation, investment returns, debt interest
  - 12+ interactive decisions per year (job change, invest, buy house, etc.)
  - 18 random event pool (crises, promotions, emergencies, windfalls)
  - Multi-scenario system: up to 6 parallel "alternative lives" with color/emoji
  - Achievement system: 20 achievements with toast notifications and trophy shelf
  - Deterministic AI Financial Advisor: 5-section structured reports per risk profile
  - Financial Projections engine: 20-year forecasts across optimista/base/pesimista scenarios
  - Animated net worth evolution chart + recharts timeline
  - Cross-scenario comparison charts and head-to-head stats table
  - Stress/happiness tracking with animated bars
  - Year progress bar (animated strip at top + sidebar progress indicator)
  - Recent decisions summary in sidebar
  - Reset simulation button (with confirmation) — resets year to 1, keeps profile
  - Landing page with "how it works" 3-step section and feature pills
  - localStorage auto-save via `lfs-scenarios-v2` key
  - Custom scrollbar, card-lift hover effects, smooth scroll, scrollbar-none utilities

### API Server (`/api`)
- **Path**: `artifacts/api-server/`
- Express 5 backend with health check endpoint

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
