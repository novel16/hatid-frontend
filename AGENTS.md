<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Hatid client standards

- Active application path: C:/Users/Novel/Desktop/laravel projects/hatid/frontend. Use native Windows Node24 from this copy. The previous WSL copy is no longer the active source. On3 November npm ci restored Windows dependencies and next.cmd from the existing package-lock.json; Windows SWC/Tailwind/Lightning CSS bindings and dev startup were verified. Do not copy node_modules between Linux and Windows.
- Native development uses NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 in .env.local; .env.example documents that address. The client transport's generic fallback remains http://localhost, so retain the native environment file. The API and frontend were started in the user's VS Code terminals during the repair; check the ports before starting duplicate servers.
- Local port is 3011 for both npm run dev and npm run start; the sibling admin uses 3012. Keep API CORS/client URLs aligned with these ports.
- Before handing server startup back to the user, stop any task-owned preview occupying this app's port and verify the port is free. Leave user-owned or unrelated processes untouched. Only one dev/start process can listen on this app's port at a time.
- Latest runtime preference (3 November): keep the user's npm run dev running. Run checks in the assistant's own terminal, sequentially, and reuse the existing server for browser review. A separate terminal still uses the same device RAM and ports. Do not stop/restart the user's dev server or start a duplicate server. This supersedes earlier permission to stop dev for a completed build.
- Keep this rider app responsive on mobile and desktop. Admin is a separate sibling app.
- Use shared controls/tokens and feature folders; keep route entries small.
- The user is learning and wants fewer, easier-to-review files. Prefer cohesive feature files and reuse existing components. Keep one-use components/dialogs/helpers beside their screen unless size, responsibility or real reuse justifies extraction; avoid splitting every small JSX block into another file.
- Keep framework-required route entries, shared UI and independently testable business rules separate where useful. Do not replace readable feature boundaries with a giant file just to reduce the count.
- For each feature, explain any new file and give a short reading order from route to screen, state/domain logic and API client. Clearly distinguish real API behavior from prototype behavior.
- Keep financial and workflow rules in typed domain functions, with money in integer centavos.
- Never duplicate the rider fee or recalculate saved parcel prices after a seller-default change.
- Auth uses the actual Laravel API through Bearer tokens and credentials: omit. The user chose sessionStorage for refresh persistence: store token/expiry only, never passwords or cached account identity, and verify /auth/me before restoring access. JavaScript-readable storage remains vulnerable to XSS; tab closure does not revoke the server token.
- Frontend normalization/auth wiring is explicitly authorized. Reuse lib/api.ts for normalized identity inputs, transport/errors and rider verification; never trim passwords. providers.tsx owns tab-session restoration, checking/retry, expiry/401/403, logout/password-change cleanup and explicit demo mode. WorkspaceAccess waits for verification before redirect/render and remains a client navigation guard; Laravel is the authorization boundary. Connection failures preserve unverified credentials for retry without granting access. Demo access remains memory-only; local sample records stay separate.
- Reuse Brand/PasswordInput from ui.tsx and selectBatch/selectNextStop from the existing prototype domain. Framework page files retain metadata. The only new test module in this stage is lib/api.test.ts; npm test runs it and the domain tests with Node 24.
- Credential forms use native POST and auth submission stays disabled until hydration attaches the client handler. Never allow credentials to fall back to a URL query. The user also added Superpowers; use its relevant debugging/verification workflows alongside Ponytail.
- Settings is connected for the verified rider: PATCH /settings saves name/optional phone and partial preferences; email is read-only. UserResource supplies defaults through /auth/me. Providers owns protected requests, saveSettings, revokeDevice and signOutEverywhere, and ignores older focus reads after a confirmed save. Keep real profile/preferences in verified memory/API only, separate from demo localStorage. DevicesPanel consumes server pagination without slicing, reuses Modal/Pagination, confirms revocation and clears this tab for current/all-device sign-out. Saved alert preferences do not imply live business notifications or push/offline sync exist.
- Business data, schematic maps, road estimates and offline synchronization are prototype-only until real APIs are implemented. Label them honestly.
- GCash is external and manually confirmed. Do not add gateway verification, wallet balances or transfers.
- Deliveries can be partial per parcel. Saving GPS is optional after successful delivery, with explicit review/confirmation; skipping preserves payment.
- Compare at most five eligible routing candidates and retain manual override, including unknown locations.
- Run lint, typecheck and meaningful tests sequentially for functional changes. Never build into the active dev server's .next directory. Keep the user's dev server running; use a properly isolated build output when supported, otherwise defer the production build and report that check as pending until the user provides a suitable build window.

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
- Standard for current and future searchable paginated lists: place PaginationEntries on the toolbar's left and search on the right, without helper text or count badges between them. On mobile, stack entries above the full-width search. Reuse the existing toolbar styles and pagination controls; keep Showing from–to of total in the footer.
- Reuse components/pagination.tsx for full lists. Put PaginationEntries above the list; Pagination keeps Showing from–to of total at the footer's left with page navigation on the right (stacked on mobile). Both share controlled page/perPage/total/onChange state and support server metadata; usePagination is only for already-loaded local lists. Keep 10/50/100 entries, reset on filters/size changes, preserve full totals/exports, and never slice an API response that is already paginated. Business directory screens in this checkout are still sample lists; API-connected directories remain on the other feature branch until the user combines them. Settings devices already use real server pagination.

<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass. When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues:

- Crashes, hangs, OOMs, or unexpected slowness
- Incorrect behavior, output, errors, or diagnostics
- Missing, unclear, or conflicting documentation
- Unexpected CLI, codemod, Skill, or upgrade behavior and non-obvious workarounds

Continue the current user request without reporting immediately. Routine debugging is not feedback. Verify changes before retaining them as feedback candidates. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Retain qualifying friction even if it is later fixed or worked around; record the final outcome during the reporting pass.

Before the final response, run one reporting pass. If candidates remain, from this file's directory run `npx --no-install next internal agent-feedback-instructions` once without piping or truncating its output. Follow its output or error guidance. If a network sandbox blocks it, retry with network access; if it still returns no output, continue normally.

<!-- END:nextjs-agent-feedback -->
