# Engineering Change Management (ECM) - Convex

This repository contains a web-based Engineering Change Management system built with:

- Convex (database, backend functions, auth, file storage)
- React + Vite + TypeScript
- Tailwind CSS

The app is being rebuilt from a clean baseline (template/demo code removed) and implemented in verifiable steps.

## Current Status

- Template demo app removed
- Clean Convex + React auth scaffold in place
- ECM domain features in progress

## Run (Baseline)

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

## Notes

- Convex auth uses the Password provider.
- `convex/auth.config.ts` accepts `CONVEX_SITE_URL` or `VITE_CONVEX_SITE_URL`.
- Full setup, seed, and deployment docs will be added after the ECM modules are implemented.
