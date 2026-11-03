# Hatid rider client

A responsive, clickable rider prototype for mobile and desktop. Built with Next.js 16.4.3, React 19.3, TypeScript, Manrope and shared forest/mint design tokens.

## Run in Windows / Git Bash

```bash
cd "/c/Users/Novel/Desktop/laravel projects/hatid/frontend"
npm ci
npm run dev
```

Run npm ci for initial dependency setup or after copying from another operating system; normal startup only needs npm run dev. Open http://localhost:3011. Both dev and start scripts use port3011; the separate admin uses3012. The native API runs at http://127.0.0.1:8000. Copy .env.example to .env.local for that NEXT_PUBLIC_API_URL; the generic transport fallback is http://localhost. The Windows SWC/Tailwind/Lightning CSS bindings and next.cmd were restored from the existing lockfile during the3 November repair. Avoid starting a duplicate dev server when the VS Code terminal is already running it.

For a production preview, stop the development server before running:

```bash
npm run build
npm run start -- --port 3000
```

## What is connected

Login, rider registration, current-user verification, password recovery/reset, password change and logout are wired to the Laravel API. Requests use Authorization: Bearer, credentials: omit and no-store, with a 15-second connection timeout. Login/register and refresh restoration are accepted only after GET /api/v1/auth/me verifies the rider account. sessionStorage holds only access_token and expires_at for the current tab; the user comes from the API. Workspace/auth screens wait while checking. Invalid, expired, revoked or forbidden credentials are discarded; connection/server failures show Try again or Sign in again without granting workspace access. If browser storage is blocked, login still works in memory and shows a refresh-persistence warning. Logout, expiry, protected 401/403 and password change clear the tab session while preserving demo records. Tab closure removes browser storage but does not revoke the database-backed Sanctum token. sessionStorage remains JavaScript-readable and vulnerable to XSS. A successful password change signs out all devices through the API. Credential forms use native POST and auth submission stays disabled until the client handler is ready, preventing early native GET submissions. There are no seeded account credentials. Admin sign-in belongs to the separate admin application.

The root opens sign-in. Workspace pages require a verified rider session or explicit Try the interactive prototype / tour entry. A safe internal return path takes you back to the requested page. Demo access is also in memory; after a full refresh choose demo again. Client navigation guards control the UI; Laravel enforces real API authorization.

Business screens use clearly labelled sample records in browser localStorage. Demo records remain available after signing out and entering demo again. No parcel, delivery or remittance business endpoint exists yet. The actual account name/email come from the API and are not copied into local demo settings. Settings distinguishes the demo workspace profile from the connected account and includes Reset demo data.

Collections record manual cash/GCash receipts. GCash happens in the rider's external account; Hatid does not verify or transfer money. Contact actions display a prototype preview rather than sending messages or making calls.

The map is a schematic with sample road distance/ETA estimates. Recommendations compare at most five eligible candidates, and manual selection includes unpinned addresses. No live routing, tracking or traffic provider is connected. Changing a saved pin invalidates its old estimate. Device GPS is requested only through the explicit use-current-location action; a sample-location preview is also available.

Offline/sync controls simulate a local queue. This prototype has a web manifest, but does not implement a production service worker or server reconciliation.

## Review the workflows

1. Dashboard: metrics, next stop, weekly progress, batch selection and delivery list.
2. Add parcel: searchable customer picker, inline customer/address creation, seller default fee mode and live seller/rider/customer amounts. A pricing override requires a reason.
3. Deliveries: search/filter, multi-parcel customer stops, per-parcel selection, cash or manual GCash confirmation, hold/failure/return and history.
4. Unknown address: select it manually and deliver without a pin. After successful delivery, review/correct/confirm a fresh location or skip; skipping keeps the delivery and payment.
5. Route: five suggestions, browse all eligible stops, manual override and clickable navigation preview.
6. Money: separate cash/GCash records, retained fees, seller balances, partial remittance and allocations. Remittance requires connection and acknowledgement.
7. Earnings/reports, customers/addresses, seller defaults, batches, notifications, settings and offline/sync all have working controls.

Included quote PHP 115 / fee PHP 15 collects PHP 115, allocates PHP 100 to the seller and retains PHP 15. Excluded quote PHP 100 / fee PHP 15 has the same allocation. Existing parcel pricing stays unchanged when seller defaults change.

The fixture is a fixed sample week (26 October–1 November 2026). Recorded prototype actions use the current time.

## Code structure

- app/: route entries and layouts.
- components/: shared controls, native modal, navigation, map and delivery components.
- features/: screens grouped by workflow.
- lib/api.ts: typed real authentication API client.
- lib/prototype/: typed models, fixtures, pure domain functions and persistent demo store.

UI components call domain functions instead of recalculating financial rules. Money uses integer centavos. Delivered receipts and remittance allocations are immutable; operation IDs prevent replayed operations from duplicating money.

Read authentication in this order: lib/api.ts (normalization, transport, errors and endpoint calls), components/providers.tsx (session lifecycle and WorkspaceAccess), features/auth/auth-screen.tsx (forms), components/ui.tsx (shared Brand/PasswordInput/Field), then features/settings/workspace-settings.tsx (account actions). Passwords are sent unchanged; only email and account-name inputs are normalized.

The prototype reuses selectBatch() and selectNextStop() in lib/prototype/domain.ts across the dashboard, batch list, deliveries and map. Selecting a stop checks eligibility, supports unknown pins/offline manual selection, and sets the appropriate batch. Shared controls and related one-use helpers remain in existing files; framework route entries retain their page metadata.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```

The 29 tests cover 16 prototype-domain cases and 13 API-client cases. These include pricing, partial delivery, replay protection, unknown locations, GPS confirmation, five-candidate routing, holds, partial remittance, batch/stop selection, normalization without altering passwords, Bearer headers, cookie omission, API errors and safe return paths. Node 24 runs these TypeScript tests directly; no extra test framework is installed.

Verified on 2 November 2026 after normalization: all 29 tests, lint with zero warnings, TypeScript, formatting, production build and git diff --check passed. Browser review verified mobile/desktop layout, guarded delivery links, explicit demo entry with return navigation, demo exit and incomplete reset-link handling. Live browser login with an uppercase email verified the rider through the API and returned to the requested delivery; settings showed the real account. Browser logout reduced its active server tokens from one to zero. The disposable local QA account was then removed, with no remaining QA tokens. All four auth pages also passed the native POST/pre-hydration submission check. The final production preview was checked on desktop and mobile with no console errors. Earlier prototype checks covered partial delivery, unknown-location GCash delivery with GPS skip, customer search, pricing preview, navigation and remittance acknowledgement.

The API has separate feature tests and review instructions in ../api/README.md.
