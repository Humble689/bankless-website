# Practical Assignment — Error Handling + Logging

## Slide Requirements (from image)
Pick an open-source project on GitHub and:
1. Analyze poorly written error handling code
2. Improve exception strategies with targeted fixes
3. Add meaningful logging to sample code
4. Compare AI-generated logging suggestions with human reasoning

## Project Chosen
This repository: a Next.js + Chakra UI site (Bankless website).

## What Looked Weak (Before)
### 1) `import-notion.js`
- Used a `.then(...).catch(...)` chain with minimal context.
- Stream download wasn’t awaited (script could exit before downloads finished).
- Stream/file write errors weren’t handled.
- `fs.writeFile(..., cb)` threw inside a callback (easy to miss / crash without context).
- Regex-based extension parsing could throw on unexpected URLs.
- `readdirSync` could throw if the folder didn’t exist.

### 2) Snapshot GraphQL fetch
- Logged a generic message on non-200 responses and kept loading state stuck.
- `catch` used `console.log` and didn’t clear loading.
- No validation of the response shape.

### 3) `pages/tlBank.tsx` (wallet / NFT metadata)
- Per-token metadata fetch errors were logged but returned `undefined` (risking inconsistent UI state).
- Several async bootstraps were called without `.catch(...)` which can create unhandled promise rejections.
- Errors were logged without enough context to reproduce.

## Targeted Fixes Applied
### Logging primitive
- Added a tiny structured logger in `utils/logger.ts` (no dependencies):
  - `logger.debug/info/warn/error(message, meta)`
  - `normalizeError(error)` to safely log unknown thrown values

### Safer exception strategies
- `components/home/Snapshot/SnapshotSection.tsx`
  - Throw on `!res.ok` with status context
  - Validate response shape before use
  - Always clear loading in `finally` (prevents infinite loading)
  - Use `AbortController` to avoid noisy errors on unmount

- `pages/tlBank.tsx`
  - Wrap wallet connect/disconnect in `try/catch` with context
  - Make NFT metadata fetch resilient: per-token warning logs + return a sentinel object
  - Catch bootstrap promise rejections to avoid unhandled rejections
  - Mask wallet addresses in logs (privacy-conscious, still debuggable)

- `import-notion.js`
  - Refactored to `async/await` with one `main()` entry
  - Await image downloads; reject on stream/write errors
  - Create directories safely (`mkdirSync(..., { recursive: true })`)
  - Skip bad rows with a warning (missing fields or image processing failure)
  - Fail fast with a clear message + `process.exitCode = 1` when the overall import fails

## AI Logging Suggestions vs Human Reasoning
### Typical AI-style suggestions (generic)
- “Log everything” (request/response bodies, full objects)
- Add many debug logs on every branch
- Introduce correlation IDs, distributed tracing, and new infra libraries
- Log full wallet address / full URLs / full payloads for easier debugging

### Human reasoning (what was applied here)
- Log *events* that matter, not every line:
  - boundary failures (network, parsing, RPC calls, external APIs)
  - state transitions that help reproduce issues (which action, which tokenId)
- Keep logs contextual but privacy-aware:
  - mask wallet addresses instead of printing full addresses
- Prefer deterministic state handling over “just log it”:
  - always clear loading in `finally`
  - handle partial failures per-token without crashing the whole page
- Avoid adding heavy dependencies or new UX:
  - use a tiny logger wrapper rather than introducing a full logging stack

## Files Changed
- `utils/logger.ts`
- `pages/_app.tsx`
- `components/home/Snapshot/SnapshotSection.tsx`
- `pages/tlBank.tsx`
- `import-notion.js`
