# AGENTS.md

This file provides repository-specific instructions for agentic coding assistants operating in this project.

## Project Overview

- Product: `Amaruzen`
- Domain: yoga center operations (classes, students, swaps, room booking)
- Stack:
  - Next.js 14 (App Router)
  - TypeScript (strict mode)
  - Prisma + PostgreSQL (Supabase)
  - NextAuth v4 (JWT sessions)
  - Tailwind CSS
  - Netlify deployment

## Repository Layout

- `src/app/` app routes (UI + API)
- `src/lib/` shared backend logic (`auth`, `prisma`, `sesiones`, `email`)
- `src/components/` reusable client components
- `prisma/schema.prisma` data model
- `prisma/migrations/*/migration.sql` SQL migrations
- `netlify.toml` build config

## Commands

- Install deps:
  - `npm install`
- Local dev:
  - `npm run dev`
- Build:
  - `npm run build`
- Start production build locally:
  - `npm run start`
- Lint:
  - `npm run lint`

## Test Commands

There is currently **no automated test runner** configured (no `test` script, no Jest/Vitest/Playwright setup).

When validating changes:

- Primary quality gate:
  - `npm run lint`
- Secondary quality gate:
  - `npm run build`
- Manual validation by role:
  - Admin: `/admin/*`
  - Alumno: `/dashboard/*`
  - Profesional: `/profesional/*`

If you add a test runner in the future, define:

- full test suite command
- single test command pattern (e.g. `npm test -- path/to/test`)
- update this file immediately

## Deployment Notes

- Netlify build command:
  - `npx prisma generate && npm run build`
- Node version set in `netlify.toml` (`20`)
- DB migrations are managed with SQL files and Supabase SQL Editor in this environment.
- Local `prisma generate` may fail in restricted networks due to Prisma binary download/cert issues.

## Auth & Roles

- Roles in Prisma enum `Role`:
  - `ADMIN`
  - `ALUMNO`
  - `PROFESIONAL`
- Route protection in `src/middleware.ts`:
  - `/admin/:path*`
  - `/dashboard/:path*`
  - `/profesional/:path*`
- Helpers:
  - `requireAuth()`
  - `requireAdmin()`
  - `requireProfesional()`
- JWT callback uses `roleChecked` flag to avoid querying the DB for role on every request.

## Calendar Architecture (Materialized Sessions)

- Central concept: weekly calendar by day + room lanes.
- Architecture: **materialized sessions**
  - `Horario` defines recurring schedules (by `diaSemana`) or one-off schedules (by `fecha`)
  - `Sesion` holds pre-generated rows for each scheduled occurrence
  - Sessions are materialized via `upsertSesionesEnRango()` which runs a batch SQL `INSERT...ON CONFLICT`
  - Cancellations are stored directly on `Sesion.cancelada` (manual cancellations are preserved across upserts)
  - Approved room bookings in `Reserva`
- **SesionExcepcion has been removed** — all session state lives in `Sesion` directly.
- **Clase no longer has scheduling fields** (`diaSemana`, `horaInicio`, `horaFin` were removed) — all scheduling is on `Horario`.
- A `Clase` can have multiple `Horario` records (multi-horario support).

### Key functions

- `upsertSesionesEnRango(desde, hasta)` in `src/lib/sesiones.ts` — batch materializes sessions from active Horarios
- `calcularSesionesSemana(lunes)` in `src/lib/sesiones.ts` — upsert + query for calendar data
- `materializarSesion(horarioId, fecha)` in `src/lib/sesiones.ts` — single-session creation fallback
- `calcularOcupacionesSemanaBatch(sesiones)` in `src/lib/sesiones.ts` — batch occupancy via SQL CTE
- `calcularOcupacionSesion(horarioId, fecha, aforo)` in `src/lib/sesiones.ts` — single-session occupancy
- `generarSesionesPorRango(desde, hasta)` in `src/lib/sesiones.ts` — public wrapper for upsert

### Occupancy rule

- Occupied seats are computed as:
  - active enrollments (`InscripcionHorario`) - absences (`Ausencia`) + pending/approved incoming swaps - pending/approved outgoing swaps

### Editing classes / horarios

- When a `Horario` is deactivated (removed from a class), its future `Sesion` rows are deleted (if no active swaps reference them).
- When a `Horario.diaSemana` changes, old-day sessions are deleted before the new day's sessions are generated.
- After any class edit, `generarSesionesPorRango` is called for the next 84 days to materialize new sessions.

## API Conventions

- API handlers live under `src/app/api/**/route.ts`
- Return JSON with `NextResponse.json(...)`
- Use Spanish error messages consistently (existing pattern)
- Validate required input fields early and return `400` on missing/invalid payload
- Return `401` unauthenticated, `403` unauthorized, `404` missing resources, `409` business conflicts

### Important endpoints (current)

- Admin weekly calendar:
  - `GET /api/admin/sesiones/semana?fecha=YYYY-MM-DD`
- Admin session detail:
  - `GET /api/admin/sesiones/ficha?sesionRef=...`
- Admin session cancellation:
  - `POST /api/admin/sesiones/cancelar`
- Admin classes CRUD:
  - `GET /api/admin/clases` (supports `?withFormData=1` to include profesores + salas in one round-trip)
  - `POST /api/admin/clases`
  - `PUT /api/admin/clases/[id]`
  - `DELETE /api/admin/clases/[id]`
- Alumno weekly calendar:
  - `GET /api/alumno/sesiones/semana?fecha=YYYY-MM-DD`
- Profesional weekly calendar:
  - `GET /api/profesional/sesiones/semana?fecha=YYYY-MM-DD`
- Profesional booking requests:
  - `GET/POST /api/profesional/reservas`
- Admin booking moderation:
  - `GET /api/admin/reservas`
  - `PUT /api/admin/reservas/[id]`

## Prisma & Data Rules

- Keep model names and relation names aligned with existing Spanish domain terms.
- Time values are stored as `String` (`HH:mm`) for class/session ranges.
- Normalize date-only semantics to midnight when matching by day.
- Preserve unique constraints behavior:
  - `Sesion @@unique([horarioId, fecha])`
  - `InscripcionHorario @@unique([inscripcionId, horarioId])`

## Coding Style

## TypeScript

- Strict TypeScript is enabled; avoid `any`.
- Prefer explicit local `type` declarations near usage in page components.
- Use discriminated unions where event types differ (e.g. `CLASE` vs `RESERVA`).

## Imports

- Use alias imports for project code: `@/...`
- Group imports:
  1. framework/libs (`next`, `react`)
  2. internal libs/components
  3. type-only imports where useful

## Naming

- Follow existing language choice:
  - Spanish domain nouns (`clase`, `sesion`, `cambio`, `reserva`, `aforo`)
  - English technical helpers allowed (`parse`, `map`, `build`)
- API route files should stay concise and action-oriented.

## Formatting

- No Prettier config exists; follow existing formatting conventions.
- Keep lines readable, avoid deeply nested conditionals when possible.
- Prefer small helper functions for date/time parsing and overlap checks.

## Error Handling

- Fail fast on invalid params.
- Include human-readable Spanish `error` messages in JSON.
- For conflict checks (room overlap, capacity), use `409`.
- In async batch email sending, avoid breaking the main transaction flow unnecessarily.

## UI Guidelines

- Keep mobile + desktop both first-class.
- Desktop calendar uses grid-by-hour and room lanes.
- Mobile calendar uses compact day list cards.
- Do not remove existing swap modal behavior for students unless replacing with equivalent UX.

## Security & Privacy

- Never commit secrets (`.env`, API keys, DB passwords).
- Do not expose private user data beyond what each role needs.
- Keep role checks server-side in API handlers.

## Existing Rules Files

- `.cursor/rules/`: not present
- `.cursorrules`: not present
- `.github/copilot-instructions.md`: not present

No extra external instruction files are currently configured; this `AGENTS.md` is the canonical agent guide.

## Change Management Checklist

Before finishing a task:

- run `npm run lint`
- run `npm run build` when feasible
- verify affected role flows manually
- ensure API responses remain backwards-compatible where UI still depends on them
- update `AGENTS.md` if architecture/contracts change
