# Engineering Change Management (ECM) on Convex

Production-oriented ECM application built with Convex + React + Vite + TypeScript.

## Features Implemented

- Multi-tenant organizations with membership roles: `admin`, `engineer`, `approver`, `viewer`
- Items/parts registry with search, edit, lifecycle state, CSV import, and import history
- Change Requests (CR) with sequential numbering (`CR-000001`), affected item snapshots, workflow transitions
- ECO auto-creation on CR approval, checklist + signoff APIs, release-note generation on close
- Parallel approvals with org-configurable approval policy (`minApproverCount` + extra categories)
- Threaded comments with `@mentions`
- Notifications panel (mark read / mark all read)
- Attachments via Convex file storage
- Dashboard, reporting, audit queries + CSV export actions
- Immutable audit logging on core mutations
- Dev-only seed mutation

## Tech Stack

- Frontend: React 19 + Vite + Tailwind CSS
- Backend: Convex (`schema.ts`, queries, mutations, actions)
- Auth: Convex Auth Password provider
- Forms/validation: `react-hook-form` + `zod`
- Lint/format: ESLint + Prettier
- Tests: Vitest (critical pure workflow/revision helpers)

## Project Layout

- `src/`: React app, routes, pages, components
- `convex/`: Convex schema + backend functions
- `convex/lib/`: backend authz/workflow/platform helpers
- `tests/`: unit tests

## Setup

1. Install dependencies:

```bash
npm install
```

2. Ensure `.env.local` contains your Convex deployment values (created by `npm init convex@latest`):

- `CONVEX_DEPLOYMENT`
- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`

3. Run backend + frontend:

```bash
npm run dev:backend
npm run dev:frontend
```

## Auth Model

- Convex Auth Password provider is configured in `convex/auth.ts`
- App-level user metadata is stored in `userProfiles`
- On first sign-in, the frontend calls:
  - `users.bootstrapProfile`
  - `organizations.bootstrapDefaultOrganization`
- Authorization for all org-scoped APIs is enforced in backend helpers (`convex/lib/authz.ts`)

## Dev Seed

After signing in and entering an org, run the dev seed mutation from the Convex dashboard or client console:

- Function: `devSeed:seedDemoData`
- Behavior:
  - adds sample user profiles + memberships
  - creates sample items
  - creates several CRs in different statuses
  - adds sample approvals/comments/notifications/audit entries

Seeding is restricted to `dev:` deployments and admin members.

## Commands

- `npm run dev` (parallel frontend + backend)
- `npm run dev:backend`
- `npm run dev:frontend`
- `npm run build`
- `npm run lint`
- `npm test`

## Reporting / Audit Export

- `reports:exportChangeRequestsCsv` returns `{ fileName, csv }`
- `audit:exportCsv` returns `{ fileName, csv }`
- The frontend downloads these in-browser

## Deployment Notes

- Deploy with your standard Convex + Vite workflow (`convex deploy` + static frontend hosting)
- If your existing Convex deployment contains old template/demo data in tables with the same names
  (for example `changeRequests`), schema validation can fail during `convex dev --once`.
  Use a fresh Convex deployment or clear legacy documents before enabling strict schema sync/codegen.

## Quick Domain Model Tour

- `organizations`, `memberships`, `userProfiles`
- `items`
- `changeRequests`, `changeRequestItems`
- `ecos`, `approvals`
- `comments`, `attachments`, `notifications`
- `auditLogs`, `counters`, `itemImports`, `approvalPolicies`

## Testing

Current tests cover critical pure backend logic:

- workflow transition permissions
- revision increment rules
- mention parsing
- SLA calculations

Backend integration tests for Convex functions can be added next using a Convex test harness / isolated test deployment.
