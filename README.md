# Hatid rider client

A responsive, clickable rider prototype for mobile and desktop. Built with Next.js 16.4.3, React 19.3, TypeScript, Manrope and shared forest/mint design tokens.

## Run in WSL Ubuntu

```bash
cd /home/novel/projects/hatid/frontend
npm install
npm run dev
```

Open http://localhost:3011. Both dev and start scripts use port 3011; the separate admin uses port 3012. The API should be running through Sail at http://localhost. Copy .env.example to .env.local only when changing NEXT_PUBLIC_API_URL; the development fallback is http://localhost.

For a production preview, stop the development server before running:

```bash
npm run build
npm run start
```

## What is connected

Login, rider registration, current-user verification, password recovery/reset, password change and logout are wired to the Laravel API. Requests use Authorization: Bearer, credentials: omit and no-store, with a 15-second connection timeout. Login/register is accepted only after GET /api/v1/auth/me verifies the rider account. The access token stays in memory; a full page refresh requires signing in again. Expiry or a protected 401/403 clears the local session while preserving demo records. A successful password change signs out all devices through the API. Credential forms use native POST and auth submission stays disabled until the client handler is ready, preventing early native GET submissions. There are no seeded account credentials. Admin sign-in belongs to the separate admin application.

The root opens sign-in. Workspace pages require a verified rider session or explicit Try the interactive prototype / tour entry. A safe internal return path takes you back to the requested page. Demo access is also in memory; after a full refresh choose demo again. Client navigation guards control the UI; Laravel enforces real API authorization.

Authenticated Customers and Sellers now use the private rider directory API, with search, pagination, create/edit and archive/restore. Customer addresses are managed independently. These account records stay out of demo localStorage; directory writes require connectivity. GPS fields are read-only here until a real successful-delivery flow can authorize saving a location.

Other business screens, including parcel customer/seller pickers, use clearly labelled sample records in browser localStorage. Explicit demo mode keeps the sample directory as well. Demo records remain available after signing out and entering demo again. No parcel, delivery or remittance business endpoint exists yet. The actual account name/email come from the API and are not copied into local demo settings. Settings distinguishes the demo workspace profile from the connected account and includes Reset demo data.

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
- lib/api.ts: typed real authentication/directory API client, resource contracts and encoded listing queries.
- lib/prototype/: typed models, fixtures, pure domain functions and persistent demo store.

UI components call domain functions instead of recalculating financial rules. Money uses integer centavos. Delivered receipts and remittance allocations are immutable; operation IDs prevent replayed operations from duplicating money.

Read authentication in this order: lib/api.ts (normalization, transport, errors and endpoint calls), components/providers.tsx (session lifecycle and WorkspaceAccess), features/auth/auth-screen.tsx (forms), components/ui.tsx (shared Brand/PasswordInput/Field), then features/settings/workspace-settings.tsx (account actions). Passwords are sent unchanged; only email and account-name inputs are normalized.

Read the directory in this order: app/(workspace)/customers/page.tsx or sellers/page.tsx, features/people/people-screen.tsx (account/demo entry), features/people/account-directory.tsx (management views), features/people/use-directory.ts (shared server list/search/pagination), then lib/api.ts and the existing customer-dialog.tsx / seller-dialog.tsx. The provider's protected request owns session expiry and Bearer errors. Only account-directory.tsx and use-directory.ts are new source files for this stage; the shared Modal and feature forms are reused. CustomerDialog and SellerDialog accept API save callbacks and retain their explicit demo save path. AddressDialog lives in the existing customer form file and is reused by both directories. SellerPricingGuide is shared from the existing seller file.

Example review: Add customer submits name, optional phone and initial address; Laravel validates and assigns the authenticated owner, then returns a controlled customer resource. A successful save reloads the listing. Duplicate phone errors stay in the form, foreign IDs return 404 and authentication failures end the session. Archive is reversible; restoring a customer does not restore addresses archived separately. Seller fees use integer centavos in the API and exact decimal text in inputs; selecting an included/excluded mode is required.

The prototype reuses selectBatch() and selectNextStop() in lib/prototype/domain.ts across the dashboard, batch list, deliveries and map. Selecting a stop checks eligibility, supports unknown pins/offline manual selection, and sets the appropriate batch. Shared controls and related one-use helpers remain in existing files; framework route entries retain their page metadata.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```

The 33 tests cover 18 prototype-domain cases and 15 API-client cases. These include pricing, partial delivery, replay protection, unknown locations, GPS confirmation, five-candidate routing, holds, partial remittance, batch/stop selection, normalization without altering passwords, Bearer headers, cookie omission, API errors, safe return paths, encoded directory search and exact centavo formatting/input round-trips. Node 24 runs these TypeScript tests directly; no extra test framework is installed.

Directory stage verified on 3 November: all 33 tests, fresh TypeScript, zero-warning lint, whole-source formatting and production build passed. The build generated 25 static pages/route shells. Browser review covered desktop 1440x1000 and mobile 390x844: private empty directory, customer create/edit and formatted-phone search, duplicate-phone errors preserving inputs, separate address add/edit/archive/restore, parent archive/restore preserving independent address archives, explicit seller mode, included/excluded fee previews, exact PHP 17.50 edit, seller search/archive/restore, and customer persistence after re-login. A separate rider could not read/edit/search the other account's records through live MySQL API requests. Signing out and entering demo showed the original sample customers/sellers and prices with no QA records. The production browser console had no errors/warnings. QA users/records/tokens were removed, the task-owned production preview stopped and ports 3011/3012 verified free. The user can run npm run dev again.

Verified on 2 November 2026 after normalization: all 29 tests, lint with zero warnings, TypeScript, formatting, production build and git diff --check passed. Browser review verified mobile/desktop layout, guarded delivery links, explicit demo entry with return navigation, demo exit and incomplete reset-link handling. Live browser login with an uppercase email verified the rider through the API and returned to the requested delivery; settings showed the real account. Browser logout reduced its active server tokens from one to zero. The disposable local QA account was then removed, with no remaining QA tokens. All four auth pages also passed the native POST/pre-hydration submission check. The final production preview was checked on desktop and mobile with no console errors. Earlier prototype checks covered partial delivery, unknown-location GCash delivery with GPS skip, customer search, pricing preview, navigation and remittance acknowledgement.

The API has separate feature tests and review instructions in ../api/README.md.
