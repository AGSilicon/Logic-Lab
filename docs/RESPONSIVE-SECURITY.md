# LogicLab responsive and security update

## What changed

- Removed the desktop-only 980px minimum page width and fixed 720px minimum editor height.
- Added tablet and phone breakpoints. On phones the circuit canvas remains the main surface; the component library and inspector open as drawers.
- Added touch-friendly pointer hit areas on component ports and touch drag-to-pan on the empty canvas.
- Kept LogicLab's blue/neutral visual direction while introducing original SVG gate symbols and selection styling. CircuitVerse source code and branded assets are not copied.
- Reduced the LogicLab gate footprint to a compact 72 x 64 world-unit symbol while preserving the existing project data model.
- Added a 2 MB import limit and structural validation for circuits, components, ports, coordinates and wire endpoints.
- Added Cloudflare Pages response-header configuration in `public/_headers`.

## Current storage and account model

The current Phase 1 implementation has two storage modes:

1. Browser `localStorage`: works without sign-in, but data is limited to that browser/device.
2. Optional GitHub App integration: the user connects a private repository and LogicLab stores project JSON files in that repository.

This is not yet a Tinkercad-style central user database. For that, integrate Supabase Auth + PostgreSQL with per-user Row Level Security. Do not expose a Supabase service-role key in browser code.

## Production security checklist

- Set `APP_ORIGIN` to the exact production origin (no trailing slash).
- Set `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG` and a random 32-byte base64 `SESSION_ENCRYPTION_KEY` as server-side Cloudflare Pages environment variables.
- Never commit `.dev.vars`, OAuth secrets, access tokens or private keys.
- Keep the GitHub App installation restricted to the repositories the user explicitly selects.
- Deploy `public/_headers` on Cloudflare Pages. GitHub Pages does not apply Cloudflare `_headers`; configure equivalent security headers at the actual hosting layer if using another provider.
- Test on real iOS Safari and Android Chrome, including drag, wire-connect, zoom, import/export and narrow landscape screens.
- Run `npm ci`, `npm run test` and `npm run build` in CI before production deployment.

## Known limitation

The source archive did not include a complete installed dependency tree. A build could not be verified in this environment because `npm ci` timed out and TypeScript dependencies were unavailable. Run the commands above after installing dependencies in your development environment.
