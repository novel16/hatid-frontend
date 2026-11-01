# Hatid rider client

A responsive, clickable rider prototype for mobile and desktop. Built with Next.js 16.4.3, React 19.3, TypeScript, Manrope and shared forest/mint design tokens.

## Run in WSL Ubuntu

```bash
cd /home/novel/projects/hatid/frontend
npm install
npm run dev -- --port 3000
```

Open http://localhost:3000. The API should be running through Sail at http://localhost. Copy .env.example to .env.local only when changing NEXT_PUBLIC_API_URL; the development fallback is http://localhost.

For a production preview, stop the development server before running:

```bash
npm run build
npm run start -- --port 3000
```

## What is connected

Login, rider registration, password recovery/reset and logout call the actual Laravel API. Requests use Authorization: Bearer and credentials: omit. The access token stays in memory and expires according to the API response; refreshing the page requires signing in again. There are no seeded account credentials. Admin sign-in belongs to the separate admin application.

Business screens use clearly labelled sample records in browser localStorage. Explore prototype works without an account, including after signing out; it is a design review environment, not an authorization boundary. No parcel, delivery or remittance business endpoint exists yet. Settings includes Reset demo data.

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

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```

The 14 domain tests cover pricing, partial delivery, replay protection, unknown locations, GPS confirmation, five-candidate routing, holds, partial net remittance, offline guards and immutable pricing. Node 24 runs these TypeScript tests directly.

Verified on 2 November 2026: lint with zero warnings, TypeScript, all 14 domain tests, formatting, production build and git diff --check passed. Browser review covered desktop/mobile, partial delivery, unknown-location GCash delivery with GPS skip, customer search, pricing preview, navigation and remittance acknowledgement.

The API has separate feature tests and review instructions in ../api/README.md.
