<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Hatid client standards

- Keep this rider app responsive on mobile and desktop. Admin is a separate sibling app.
- Use shared controls/tokens and feature folders; keep route entries small.
- Keep financial and workflow rules in typed domain functions, with money in integer centavos.
- Never duplicate the rider fee or recalculate saved parcel prices after a seller-default change.
- Auth uses the actual Laravel API through Bearer tokens and credentials: omit; tokens currently stay in memory.
- Business data, schematic maps, road estimates and offline synchronization are prototype-only until real APIs are implemented. Label them honestly.
- GCash is external and manually confirmed. Do not add gateway verification, wallet balances or transfers.
- Deliveries can be partial per parcel. Saving GPS is optional after successful delivery, with explicit review/confirmation; skipping preserves payment.
- Compare at most five eligible routing candidates and retain manual override, including unknown locations.
- Run lint, typecheck, meaningful domain tests and production build for functional changes. Stop the dev server before building into the same .next directory.
