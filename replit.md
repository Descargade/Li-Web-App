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
  - Animated net worth evolution chart
  - Interactive timeline with event nodes
  - Scenario A/B comparison
  - Analysis tab with pie/bar charts
  - Stress/happiness tracking
  - Contextual AI-like feedback messages
  - Auto-save and reset

### API Server (`/api`)
- **Path**: `artifacts/api-server/`
- Express 5 backend with health check endpoint

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
