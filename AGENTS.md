<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Hatid client standards

- Local port is 3011 for both npm run dev and npm run start; the sibling admin uses 3012. Keep API CORS/client URLs aligned with these ports.
- Before handing server startup back to the user, stop any task-owned preview occupying this app's port and verify the port is free. Leave user-owned or unrelated processes untouched. Only one dev/start process can listen on this app's port at a time.
- Keep this rider app responsive on mobile and desktop. Admin is a separate sibling app.
- Use shared controls/tokens and feature folders; keep route entries small.
- The user is learning and wants fewer, easier-to-review files. Prefer cohesive feature files and reuse existing components. Keep one-use components/dialogs/helpers beside their screen unless size, responsibility or real reuse justifies extraction; avoid splitting every small JSX block into another file.
- Keep framework-required route entries, shared UI and independently testable business rules separate where useful. Do not replace readable feature boundaries with a giant file just to reduce the count.
- For each feature, explain any new file and give a short reading order from route to screen, state/domain logic and API client. Clearly distinguish real API behavior from prototype behavior.
- Keep financial and workflow rules in typed domain functions, with money in integer centavos.
- Never duplicate the rider fee or recalculate saved parcel prices after a seller-default change.
- Auth uses the actual Laravel API through Bearer tokens and credentials: omit; tokens currently stay in memory.
- Frontend normalization/auth wiring is explicitly authorized. Reuse lib/api.ts for normalized identity inputs and transport/errors; never trim passwords. providers.tsx owns verified rider sessions, expiry/401/403, logout/password-change handling and explicit demo mode. WorkspaceAccess is a client navigation guard; Laravel remains the authorization boundary. A browser refresh clears memory-only account/demo access while preserving local sample records.
- Reuse Brand/PasswordInput from ui.tsx and selectBatch/selectNextStop from the existing prototype domain. Framework page files retain metadata. The only new test module in this stage is lib/api.test.ts; npm test runs it and the domain tests with Node 24.
- Credential forms use native POST and auth submission stays disabled until hydration attaches the client handler. Never allow credentials to fall back to a URL query. The user also added Superpowers; use its relevant debugging/verification workflows alongside Ponytail.
- Business data, schematic maps, road estimates and offline synchronization are prototype-only until real APIs are implemented. Label them honestly.
- The customer/seller feature now connects authenticated /customers and /sellers management to the private rider API. Reuse the protected request, shared directory hook and existing customer/seller/address forms; do not copy account records into demo localStorage. Explicit demo mode and parcel pickers remain sample workflows until parcel APIs exist. Directory GPS is read-only, and real directory writes require connectivity.
- GCash is external and manually confirmed. Do not add gateway verification, wallet balances or transfers.
- Deliveries can be partial per parcel. Saving GPS is optional after successful delivery, with explicit review/confirmation; skipping preserves payment.
- Compare at most five eligible routing candidates and retain manual override, including unknown locations.
- Run lint, typecheck, meaningful domain tests and production build for functional changes. Stop the dev server before building into the same .next directory.

## Required skills, simplicity and comments

- Always use the installed Ponytail skill for every feature and other coding change, including fixes and refactors. Follow its workflow before implementation.
- Use the relevant Superpowers skills when needed, such as for planning, debugging, testing or verification. Keep the workflow proportionate to the task and within the user's authorized scope.
- Avoid over-engineering and over-architecture. Add abstractions, layers, dependencies or files only for a demonstrated requirement or meaningful reuse; do not build speculative flexibility.
- Prefer clear names, straightforward control flow, guard clauses and small cohesive functions. Avoid deep nesting, clever shortcuts or complex generic code when a simple, readable implementation works. Do not sacrifice readability just to shorten code.
- Reuse existing helpers/components and native or framework features before introducing custom solutions. Preserve validation, authorization, security, accessibility, data integrity and meaningful tests when simplifying.
- Add a brief purpose comment or docblock before every function and method, including small helpers and callbacks. Use the language's usual style, including PHPDoc for PHP. Explain intent or the business rule, keep comments accurate, and avoid narrating each line of code.
- Apply the comment rule to every new or modified function/method. Do not perform a broad comment-only rewrite of untouched code unless the user requests it.

## Reusable React components

- Extract repeated UI or interaction patterns into shared components and reuse them across pages. Check existing components first. The preference for fewer files must not lead to copied UI or prevent useful component reuse.
- Use one shared Modal shell within this app for common dialog layout, opening/closing, backdrop and keyboard/focus accessibility. Compose each page's title, content and actions through simple props and children; reuse that shell in feature-specific dialogs.
- Keep feature-specific form content, state, validation and submission behaviour with the feature, composed inside shared UI. Extract repeated logic into small helpers or hooks when there is real reuse.
- Keep component APIs focused and readable. Add only variants required by actual screens; avoid a universal component with many unrelated flags or business rules.

## Device resource limits

- The user's device has 8 GB RAM and an 11th-generation Intel Core i5. Run tests, builds and page compilation sequentially, with only one heavy operation active at a time. Never launch multiple suites/builds/compilers together.
- Keep checks focused on the change, and do not repeat passing suites without a new reason. Start the Next.js apps one at a time; reuse an existing valid production build for previews when possible.
- If a task-owned process stalls, stop it safely before trying another heavy operation. Preserve unrelated processes and follow the project runtime rules for any WSL/Docker recovery.
