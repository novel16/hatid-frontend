# Hatid rider client

A responsive, clickable rider prototype for mobile and desktop. Built with Next.js 16.4.3, React 19.3, TypeScript, Manrope and shared forest/mint design tokens.

## Run in Windows / Git Bash

```bash
cd "/c/Users/Novel/Desktop/laravel projects/hatid/frontend"
npm ci
npm run dev
```

Run npm ci for initial dependency setup or after copying from another operating system; normal startup only needs npm run dev. Open http://localhost:3011. Both dev and start scripts use port3011; the separate admin uses3012. The native API runs at http://127.0.0.1:8000. Copy .env.example to .env.local for that NEXT_PUBLIC_API_URL; the generic transport fallback is http://localhost. The Windows SWC/Tailwind/Lightning CSS bindings and next.cmd were restored from the existing lockfile during the3 November repair. Avoid starting a duplicate dev server when the VS Code terminal is already running it.

The later native startup repair found truncated SWC files and a missing Lucide ESM entry despite npm reporting the packages installed. A completed npm ci --include=optional --bin-links=true --no-audit --no-fund restored the existing locked versions and verified Git Bash startup plus login/JS/CSS responses. A normal run only needs npm run dev. Never interrupt an installation or copy node_modules between operating systems; dependency restoration requires a window without an active dev server.

For a production preview, stop the development server before running:

```bash
npm run build
npm run start
```

## Actual Notifications & Activity — 6 November

The inbox now reads the verified rider's API notifications, with All activity/Unread, full unread count and server10/50/100 pagination. Individual/all read confirmations persist in Laravel across refresh/devices. Mark-all covers currently unread alerts across all pages, preserves existing read timestamps and deletes no history. Clicking a record opens its owned delivery or recorded remittance detail and independently confirms read metadata; an interrupted read confirmation never blocks navigation. Targets are fixed internal routes, and remittance detail URLs follow opening/closing the visible record without resetting history filters.

The bell shares an account-keyed context with the inbox. It refreshes on route/focus/manual refresh and confirmed local delivery/remittance writes; no background polling or browser push. Loading/errors never become sample data or fabricated zero counts. Each page/filter attempt has a fresh identity, and its single result contains either success data or an error, so revisiting a failed filter cannot revive stale errors/rows. Explicit demo activity remains separate. Settings toggles control new in-app alerts while existing activity and financial history remain.

Alerts start with newly saved actions after this feature; there is no historical backfill. At most one combined delivery/payment alert appears for a grouped successful handover when Collection Alerts is on; Delivery Alerts is the fallback for delivery-only notifications. Non-delivered outcomes use Delivery Alerts; recorded remittances use Collection Alerts. GCash receipts and seller handovers remain manually confirmed external events.

Only one new frontend application file: features/settings/account-notifications.tsx owns the context, lifecycle and actual inbox together. Reuse shared controls/Pagination, lib/api helpers and existing transaction forms. Reading order: workspace layout/provider → shell bell or NotificationsScreen → AccountNotifications → notificationPath/protected request → API NotificationRequest/Service/Resource. nextNotificationView and remittanceDetailPath are small shared helpers for repeated state/navigation updates.

Verified:62 frontend tests, full zero-warning ESLint, TypeScript and scoped Prettier;253 API tests/1870 assertions and Pint. One independent read-only review found the stale-error/filter and detail-URL issues; corrections include RED→GREEN view-identity/URL regressions and mutually exclusive read state. Native four missing-Bearer routes return401/no cookies; Notifications/Collections detail URLs and23 script/style assets return HTTP200. Browser service timed out before opening a tab, so actual signed-in interaction/mobile visual QA is unverified. Production build remains deferred to preserve active .next; user servers stayed running. No dependencies, credentials, financial fixtures or payment/gateway actions were added.

## Actual earnings and dashboard — 5 November

Earnings & Reports uses confirmed full delivered receipts from Laravel. Day, Monday–Sunday week, calendar month and custom dates follow the actual confirmation time in Asia/Manila. Original intake weeks remain visible and unchanged. Search and actual cash/manual-GCash method apply to cards, trend, ledger and complete CSV; changing pages or10/50/100 entries never redefines totals. Apply commits date edits; export stays disabled while dates are unapplied or reads are unresolved. The CSV exports every matching record and pins the currently displayed dates, including across a midnight boundary. Cash/GCash are recorded inflows, not live balances. Seller remittance never earns the rider fee again.

The dashboard reads current ready/open work across all intake weeks, today's confirmed receipts/fees and separately labelled lifetime seller debt. Refresh or successful parcel changes invalidate old cards; loading/errors never reveal sample money or fabricated zeros. The actual paginated delivery list remains usable if summary loading fails. Account views and pending reads/downloads are isolated by verified account; explicit demo mode retains its own sample reports/dashboard.

Reading order: app/(workspace)/earnings/page.tsx → EarningsScreen → features/reports/account-earnings.tsx → reportPath/protected request in lib/api.ts → API ReportRequest/ReportService/ReportResource. DashboardScreen selects the account dashboard within its existing file. AccountEarnings is the only new frontend application file; it owns filters, chart, ledger and export together. Shared controls/Pagination and downloadFile remain in their existing modules. No dependency, migration, financial write or auth redesign.

Verification:57 frontend tests, full zero-warning ESLint, TypeScript, scoped Prettier/diff checks;222 API tests/1692 assertions and scoped Pint. Tests cover Manila date boundaries, carryover, owner/role/ability, actual method/search, all-row CSV across a200-row chunk boundary, exact cents and formula-safe text. Native MySQL report/dashboard/CSV read invariants passed under REPEATABLE-READ without changing records; missing-Bearer requests returned401 without cookies. Browser sign-in redirect and preserved demo separation passed. Authenticated browser layouts and native concurrent writes were not exercised; the existing development instant-navigation diagnostic remains visible. Production build remains deferred and the user's servers stayed live.

## What is connected

Login, rider registration, current-user verification, password recovery/reset, password change and logout are wired to the Laravel API. Requests use Authorization: Bearer, credentials: omit and no-store, with a 15-second connection timeout. Login/register and refresh restoration are accepted only after GET /api/v1/auth/me verifies the rider account. sessionStorage holds only access_token and expires_at for the current tab; the user comes from the API. Workspace/auth screens wait while checking. Invalid, expired, revoked or forbidden credentials are discarded; connection/server failures show Try again or Sign in again without granting workspace access. If browser storage is blocked, login still works in memory and shows a refresh-persistence warning. Logout, expiry, protected 401/403 and password change clear the tab session while preserving demo records. Tab closure removes browser storage but does not revoke the database-backed Sanctum token. sessionStorage remains JavaScript-readable and vulnerable to XSS. A successful password change signs out all devices through the API. Credential forms use native POST and auth submission stays disabled until the client handler is ready, preventing early native GET submissions. There are no seeded account credentials. Admin sign-in belongs to the separate admin application.

The root opens sign-in. Workspace pages require a verified rider session or explicit Try the interactive prototype / tour entry. A safe internal return path takes you back to the requested page. Demo access is also in memory; after a full refresh choose demo again. Client navigation guards control the UI; Laravel enforces real API authorization.

Signed-in Settings, Weekly Batches, Parcel Entry, Deliveries, Customers, Sellers, Collections/remittance, Earnings & Reports, dashboard summaries and Notifications use the actual API. Account records never enter demo localStorage. Both directories list owned database records with server search, active/archive filtering and shared10/50/100 pagination. Customer/address and seller create/edit/archive/restore use actual endpoints; directory pages have no static account rows or invented parcel counts/balances. Offline/sync remains a sample preview; actual map behavior is documented below. Demo records remain separate.

Customer-page reading order: app/(workspace)/customers/page.tsx → CustomersScreen / AccountCustomersScreen in features/people/people-screen.tsx → directoryPath and protected request → existing Laravel CustomerController/CustomerService/CustomerResource. Shared CustomerDialog and AddressDialog stay in features/customers/customer-dialog.tsx; parcel intake now reuses CustomerDialog's onSave callback. No new source files or dependencies were added. The Customers page offers sign-in in demo mode; sample customer choices remain limited to explicit demo parcel workflows. Verification:50 frontend tests,25 directory API tests /316 assertions, scoped ESLint/TypeScript/Prettier, live Bearer API responses with2,001 total customers and2,000 dummy search matches, and HTTP200 for the Customers page and18 script assets. The temporary verification token was revoked. Browser interaction and production build were not run; user dev/API stayed live.

Actual delivery outcomes record full cash or rider-confirmed GCash receipts per parcel. Collections/remittance reads those receipts and records completed seller handovers. GCash happens in the rider's external account; Hatid does not verify or transfer money. Demo contact actions preview contact; actual delivery details provide a user-initiated phone link when a phone exists.

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

## Parcel entry and manual deliveries

The real workflow is `/batches/{id}` → shared Add Parcel modal with that batch selected → save and refresh the underlying delivery list/detail. Dashboard, Deliveries, batch details and mobile Add all open the same modal without navigating away. `/parcels/new?batch={id}` remains a compatibility bridge that opens this modal over Deliveries. Stop-level server pagination supports10/50/100; entries stay left, search right, below payment/status/batch filters. The weekly-batch filter is compact and floats its dropdown over the list. Original batch IDs/dates and saved pricing never move during retry or rollover.

Parcel modal revision,5 November: customer, weekly batch and seller use one reusable `components/search-select.tsx`. It provides ten-record pages, debounced/cancellable searches, explicit identity selection, arrows/Enter/Escape/PageUp/PageDown, loading/retry and compact paging. Real fields use `ParcelDirectorySelect` and authenticated API pages; demo fields search already-loaded sample data through getSelectPage. New customer/seller/address/batch forms remain reusable and retain the parcel draft. Dropdown results inside the modal use parent scrolling; the delivery batch filter uses the floating variant to avoid layout changes. Obsolete CustomerPicker and directory selection modal code/styles were removed.

Save parcel closes the modal; Save & add another retains relationships and clears parcel inputs. Saving or ambiguous responses block dismissal and retain the same operation UUID/payload for retry. Unreadable successful JSON is classified as status0, and parcel confirmation is validated before releasing the snapshot. Account delivery detail refreshes on a saved parcel revision, gates controls with a resolved read key and preserves explicit nonclosed selections, including held/failed parcels, without selecting newly added parcels automatically.

Reading order: workspace layout → ParcelEntryProvider/AddParcelButton in parcel-entry-screen.tsx → AccountParcelEntry → ParcelDirectorySelect → SearchSelect → protected request. Only SearchSelect is a new application source file; no dependency/backend/schema/native-data changes were needed. Verified53 frontend tests,44 parcel/delivery API tests/317 assertions, scoped zero-warning ESLint, TypeScript, formatting and HTTP200 for four affected routes/26 script assets. A read-only review found and verified fixes for unreadable save confirmations, stop refresh/selection safety and pager focus. Demo browser checks passed for search/keyboard/paging, parent scrolling, pricing, nested-form cancellation, Save/Save & add another and mobile390x844/desktop1280x900 bounds. Two labelled sample parcels were created in the isolated browser demo only. Signed-in weekly-filter visuals/account save were not browser-tested in this pass. User servers stayed live; production build remains deferred to preserve active dev output.

Parcel entry searches/paginates actual batches, customers and sellers. Existing customer/seller create forms accept an async account callback; no copied form or demo commit. The customer keeps separate active addresses, and manual address metadata can be added inline. Unknown address text/pins do not prevent delivery. Quote, fee, applied included/excluded mode, customer total and seller share are reviewed before saving; the API computes and freezes amounts. Overrides require a reason. One save creates one parcel. Save & add another retains relationship choices and clears human text/quote.

Delivery detail supports partial selection, confirmed full COD/GCash receipts, future holds, failed visits, explicit resume/retry and confirmed physical return to seller. Failed/future-held parcels cannot be delivered until resumed; due holds are ready. Returned/delivered parcels cannot be selected for another outcome. Receipts use actual method, optional external reference and server confirmation time. Activity is append-only. GCash confirmation is manual, with no transfer or verification. No map, route recommendation or GPS writes were added. Collection/remittance and reporting APIs remain pending.

Create/outcome forms retain a stable operation and exact payload after interrupted responses. Retry uses the same save/action, with inputs locked to prevent accidental changed replays. Validation failures preserve inputs for correction; the API rejects changed operation reuse and terminal money overwrites. This is an online workflow: drafts/ambiguous submissions are held only in component memory, with no durable offline queue or reload-proof draft recovery claim. Protected transport rejects responses after account changes; view revisions reject late navigation/default reads.

New source files: `features/parcels/account-parcel-entry.tsx` owns account form state, `parcel-directory.tsx` shares the three searchable pickers, `features/deliveries/account-deliveries.tsx` owns the paginated list, `account-delivery-detail.tsx` owns selection/history, and `account-outcome-dialog.tsx` shares all actual manual outcomes. Existing sample screens remain separate wrappers. Reuse `validationMessage()` for field errors, the existing integer-centavo domain functions for previews, and shared Modal/controls/Pagination throughout. No dependency was added.

Reading order: existing route entry → account screen → protected `request` in Providers/lib/api → Laravel request/controller/service/resource. For one handover, read account-delivery-detail → account-outcome-dialog → DeliveryService → ParcelResource → DeliveryTest. API schema/factory/tests are support files, separate from application source. Final verification is recorded in the project memory and implementation plan.

Verified4 November:165 API tests/1160 assertions,41 frontend tests, scoped ESLint/TypeScript/Pint/format/diff checks. Actual browser QA used a temporary account and covered current/older intake at one stop, partial cash then failed→retry→GCash, unknown address, refresh restoration and mobile390px form/dialog/list. Its account/fixtures were removed; user records and running dev/API were preserved. Production build was deferred to preserve the active .next. No native concurrent-device test or durable offline/reload-proof draft verification is claimed.

## Weekly batches

Verified riders can list, search by name, create and view their own intake batches. The API supplies native 10/50/100 pagination, original start/end dates and current/previous/upcoming calendar badges. An exact date range belongs to one batch per rider, guarded by a database unique constraint and controlled validation errors. Older dates never prevent opening a batch; no update/delete/archive endpoint or automatic closing was added.

New-batch defaults come from the current Monday–Sunday week in Asia/Manila. Opening the form refreshes those defaults even if the page stayed open through a week boundary. Dates are editable before save; overlapping but different ranges are not prohibited. The shared form validates date order and preserves native date/name values after an error. Successful account creation opens the saved detail; stale requests cannot redirect a different view.

Read app/(workspace)/batches routes → features/batches/batches-screen.tsx (account/demo choice and data flow) → features/batches/batch-components.tsx (the one new frontend file: shared BatchCard and BatchDialog) → components/providers.tsx protected request → lib/api.ts types. Account list data is never sliced locally or written to the demo selectedBatchId. The detail URL is the selected account view, separate from the calendar badge.

Actual batch detail now reuses the owned Deliveries list and links to account parcel entry with its batch ID. It shows real matching work without fabricated earnings or sending account IDs into sample state. Demo mode retains sample progress, selection and stop navigation, and reuses the same form/card with the exact-range duplicate guard.

Verified on 4 November: 125 API tests / 905 assertions, 40 frontend tests, scoped lint/type/format checks and a read-only review. Browser demo/shared-form checks covered reversed dates, duplicate errors, preserved inputs, unchanged three-batch sample count, older detail access and mobile390px bounds. Authenticated account behavior was tested in isolated API tests; no user account/batch records were created through the browser. The additive native migration was applied without resetting data. User dev/API were kept running; no production build was run into active .next. Existing protected-route instant-navigation diagnostics remain outside this feature.

## Seller management

The Sellers page now requires a verified rider. Active/Archived status, name/contact search and10/50/100 entries use Laravel pagination through the protected Bearer request. Add/edit shares SellerDialog with parcel entry; existing values stay available after an API validation/network failure, and save controls/dismissal are disabled while saving. Archive/restore confirms the selected seller, preserves its identity and reloads the current directory. Removing the last record on a page returns to the last available page.

Only name, optional contact, included/excluded mode and integer-centavo default fee are saved. Seller edits affect future intake; existing parcel totals/fees/seller shares remain frozen. Cards show actual fee preferences without simulated balance/count fields. Demo Sellers offers sign-in; explicit sample parcel seller choices remain separate.

Reading order: app/(workspace)/sellers/page.tsx → SellersScreen/AccountSellersScreen and shared useAccountDirectory in features/people/people-screen.tsx → features/sellers/seller-dialog.tsx → directoryPath/protected request → API SellerRequest/SellerService/SellerResource. No new application source file, dependency or migration. Verified53 frontend tests,46 isolated Directory/Parcel API tests/421 assertions, scoped zero-warning lint, TypeScript, Pint and formatting. Browser checks verified sign-in redirect, demo/account separation and the shared parcel seller form's fee input/mode/cancel behavior without saving native records. Signed-in seller-card/mutation browser checks and production build remain pending; the user's live dev/API were preserved.

## Collections and remittance

Verified riders see real receipt, seller-balance and remittance-history tabs with shared server pagination10/50/100, search and method/balance filters. Four summary cards are explicitly lifetime account totals; list filters do not change their scope. Receipts come only from successful deliveries with full rider-confirmed payment, using the actual cash/GCash method. This screen cannot create another customer collection. Archived sellers remain payable. No single-page export is presented as a complete report.

Partial handovers automatically allocate to the oldest confirmed seller share first, with parcel ID as the tie-break across original intake weeks. Only the outstanding seller share is allocated. Collect115/fee15 leaves100 due to the seller; remit60 leaves40 due, with rider earnings still15. The handover method is separate from the original collection method. GCash transfers happen outside Hatid and require explicit rider confirmation.

The handover form uses the shared searchable selector and checks the selected seller's fresh balance. It retains entered values after validation failures, preserves one exact UUID/payload after an ambiguous response and locks editing/dismissal until confirmed. A later rejected retry (including429) cannot clear that unresolved operation. Details show immutable ten-row allocation pages with parent-modal scrolling. Draft/retry state is held in component memory; recovery across reload/logout and a durable offline queue are outside this stage.

New application files: features/collections/account-collections.tsx owns account tabs/lists and the reusable local LedgerSection; account-remittance-dialog.tsx owns the handover form and read-only allocation detail. Reading order: existing route/CollectionsScreen account guard → AccountCollections → AccountRemittanceDialog → lib/api.ts query/retry helpers and protected request → API CollectionRequest/CollectionService/Resources. Demo money stays separate.

Verified5 November:55 frontend tests,202 API tests/1552 assertions, scoped zero-warning lint, TypeScript, Pint and formatting. A fresh review found an ambiguous→429 retry defect; its regression failed first and then passed, retaining the same operation through429/422/409/503. Native database reads/invariants passed and only the additive remittance migration was applied without reset/seed or financial mutations. Browser checks verified the sign-in redirect and preserved demo dialog/cancel flow. Signed-in money mutations, real concurrent MySQL handovers and production build remain unverified; user servers stayed live.

## Account settings

Signed-in riders can save their name and optional phone through PATCH /api/v1/settings; email stays read-only. Partial deliveryAlerts, collectionAlerts and compactView preferences are saved to the same account and restored through /auth/me. Compact mode applies immediately to the workspace. Live delivery/collection alerts and offline sync remain future business features; current activity and sync screens use sample data.

The Devices panel uses the existing owned, active-token endpoints with server pagination at 10/50/100 entries. Confirming a revoke affects that sign-in only; revoking this device or every device ends this tab's account access. Failures remain visible and retryable. Closing a tab removes local credentials without revoking its server token.

Read features/settings/workspace-settings.tsx (profile/preferences and existing password form), features/settings/devices-panel.tsx (new focused device loading/pagination/confirmation UI), components/providers.tsx (protected requests, account updates and session cleanup), then lib/api.ts (shared types/transport). The new panel is separate because device pagination and revocation have their own asynchronous state; it reuses the existing Modal and Pagination controls. Confirmed saves invalidate older focus-triggered account reads.

Verified on 4 November: 99 API tests / 745 assertions and 40 frontend tests passed, plus scoped ESLint, TypeScript and formatting checks. The additive account-settings migration was applied. Browser review used demo mode for desktop/mobile layout, compact mode and cancel-safe sample reset; account saving and device authorization/revocation were tested in isolated API tests, without changing the user's account credentials. No production build was run into the user's active dev output. The existing dev-only instant-navigation diagnostic remains visible on protected routes.

## Reusable pagination

Read components/pagination.tsx (shared top entry selector, controlled footer and the local-list hook), lib/pagination.ts (range and page-number logic), then a caller such as features/deliveries/deliveries-screen.tsx. lib/pagination.test.ts checks empty, partial, clamped and long-page ranges. These are the three new files; no dependency was added.

Local lists filter first, then share the hook/component:

    const pagination = usePagination(filtered, JSON.stringify([search, status, method, batchId]));
    <PaginationEntries {...pagination.controls} label="Deliveries pagination" />
    <StopTable stops={pagination.items} />
    <Pagination {...pagination.controls} label="Deliveries pagination" />

Include every search/filter value in the reset key. Entry choices are 10, 50 and 100, defaulting to 10. Changing entries or filters resets page 1; removing records clamps the selected page. Totals and CSV exports continue using complete filtered records, not pagination.items.

For current and future searchable paginated lists, place PaginationEntries on the toolbar's left and search on the right, without helper text or count badges between them. On mobile, stack entries above the full-width search. Reuse the existing toolbar styles. The footer Pagination shows Showing from–to of total on the left and page navigation on the right (stacked on mobile). Both controls share the same state; the footer no longer contains the entries dropdown.

For a server list, render the API's data directly and pass meta.current_page, the selected perPage and meta.total to Pagination. Its onChange callback receives {page, perPage}; use those values in the next ?page=...&per_page=... request, and pass disabled={loading}. Do not slice an already-paginated server response. Laravel's native links/meta remain the source of the server result count.

Customers and Sellers in this checkout use actual API pagination through directoryPath/useAccountDirectory and the shared controls. Sample collection/remittance/report lists remain separate and continue using the local-list hook.

Pagination is used by customer/seller directories, delivery stops, weekly batches and their stops, seller balances, collection/remittance records, the fee ledger and notifications. Short dashboard previews, routing candidates and form pickers keep their existing behavior.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```

The current branch has62 tests:16 prototype-domain,32 API/client,7 maps/GPS and7 pagination/select cases. Node24 runs these TypeScript tests directly with test-concurrency=1 to keep checks sequential. No extra test framework is installed.

Full ESLint passed on5 November. The modified earnings screen now passes formatting; three previously flagged, untouched files remain: features/settings/devices-panel.tsx, lib/prototype/domain.test.ts and lib/prototype/domain.ts. Changed files pass formatting; those unrelated files were not rewritten. Production build remains deferred while the user's dev server owns .next.

Verified on 2 November 2026 after normalization: all 29 tests, lint with zero warnings, TypeScript, formatting, production build and git diff --check passed. Browser review verified mobile/desktop layout, guarded delivery links, explicit demo entry with return navigation, demo exit and incomplete reset-link handling. Live browser login with an uppercase email verified the rider through the API and returned to the requested delivery; settings showed the real account. Browser logout reduced its active server tokens from one to zero. The disposable local QA account was then removed, with no remaining QA tokens. All four auth pages also passed the native POST/pre-hydration submission check. The final production preview was checked on desktop and mobile with no console errors. Earlier prototype checks covered partial delivery, unknown-location GCash delivery with GPS skip, customer search, pricing preview, navigation and remittance acknowledgement.

The API has separate feature tests and review instructions in ../api/README.md.

## Vehicle, address GPS and actual maps — 4 November

Signup uses a shared native VehicleSelect; Settings completes/changes the verified account's motorcycle/bicycle/car choice. Phone remains optional. Existing accounts without a vehicle keep manual delivery and receive a Settings link before automatic road comparisons.

An actual delivered/full-payment outcome offers the separate optional AccountLocationDialog. Review explicitly requests fresh browser GPS, shows accuracy/time, permits coordinate/map correction, and requires review/replacement confirmation. Skip and GPS/provider failures preserve the already saved handover. A pin version conflict reloads the current address before another replacement; only server-confirmed results update account state. No actual identity, parcel, GPS or recommendation enters demo localStorage.

Authenticated MapScreen uses AccountMap; demo mode retains its labelled schematic flow. Opening the account page reads free metadata only. Current-GPS/Compare is explicit, ranks up to five owned ready stops by returned estimated time then road distance, keeps unreachable/null routes honest and preserves manual override across refreshes. Choose customer reuses AccountDeliveriesScreen's native server pagination (10/50/100) and includes unknown locations. Failed/future-held/closed work is not automatic ready work. Changing account, vehicle or query anchor remounts the map view; late revalidation cannot revoke a newer manual choice. An unavailable manual-stop refresh retains the choice rather than treating a connection error as a closed delivery.

Open map lazily loads native Leaflet1.9.4 and authenticated tiles through Laravel, keeping every provider key on the server. GridLayer queues tile requests, cancels/revokes unloaded resources and uses text nodes for labels. It shares GeoMap with pin review. Navigation opens external Google Maps URLs using coordinates/vehicle, with no paid Google APIs or fabricated internal turn instructions. Estimates have no live-traffic/global-shortest/island-route guarantee. Shared usage and failure states preserve manual delivery/external navigation. Physical phone GPS requires HTTPS plus permission; native localhost works on this computer, while a phone's LAN HTTP address is not a secure context.

Four new application source files:

| File                                           | Purpose                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| components/geo-map.tsx                         | Reusable client-only raster map, Bearer tiles, markers and optional draft correction |
| features/map/account-map.tsx                   | Actual route-page state, fresh origin, comparisons and manual choice                 |
| features/customers/account-location-dialog.tsx | Optional evidence-backed GPS review/save after handover                              |
| lib/maps.ts                                    | Shared GPS/navigation/readiness and cancellable manual-selection decisions           |

The one new frontend test file is lib/maps.test.ts; api.test.ts additionally checks PNG transport/errors/header-only tokens. Leaflet and its types are the only new dependencies; no React wrapper or test framework was added. Read MapScreen → AccountMap → lib/maps → Providers/lib/api → Laravel map endpoints. For GPS, read AccountDeliveryDetail → AccountLocationDialog → DeliveryService::saveLocation. Keep production builds out of the active dev .next; run checks sequentially. See project memory/maps plan for actual verification and remaining browser/phone checks.
