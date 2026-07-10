# Plan: PickMeUp reliability hardening

## Summary

Improve correctness and privacy in the package extraction and Android SMS import paths without changing the visible product design.

## Context

The current implementation can lose additional packages from multi-package screenshots, advance the SMS sync cursor past failed messages, treat pickup codes as globally unique forever, and trust unvalidated localStorage data. Android also backs up sensitive local data by default and logs full pickup codes.

## Tasks

1. Add pure reliability helpers and regression tests
   - Files: `services/packageMergeService.ts`, `services/smsSyncService.ts`, `tests/*.test.ts`, `tsconfig.test.json`, `package.json`
   - Change: introduce testable package merge and safe SMS cursor functions.
   - Tests: same-code duplicate window, reused code on another day, failed-message checkpoint behavior.
   - Verification: `npm test`

2. Preserve all packages found in OCR text
   - Files: `services/extractionService.ts`, `tests/extractionService.test.ts`
   - Change: combine template, heuristic, and direct-code candidates instead of returning after the first template match.
   - Tests: OCR text containing two pickup codes returns both.
   - Verification: `npm test`

3. Use safer package deduplication and SMS cursor updates
   - Files: `App.tsx`
   - Change: merge probable duplicates only within a bounded time window and do not advance the cursor beyond the earliest failed SMS.
   - Verification: `npm run typecheck`, `npm test`, `npm run build`

4. Validate and migrate persisted data
   - Files: `services/storageService.ts`, `tests/storageService.test.ts`
   - Change: add a versioned storage envelope, migrate the existing array format, and discard malformed records.
   - Verification: `npm test`

5. Reduce Android privacy exposure
   - Files: `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/java/com/pickmeup/assistant/SmsAutoImportReceiver.java`
   - Change: disable automatic backup and redact pickup codes in logs.
   - Verification: Android lint/build when an Android SDK is available.

6. Add continuous verification
   - Files: `.github/workflows/ci.yml`
   - Change: run typecheck, tests, and production Web build on pushes and pull requests.
   - Verification: GitHub Actions run.

## Risks and Edge Cases

- Reused pickup codes must not create duplicate records for the same delivery while still allowing a genuinely new delivery later.
- A permanently unrecognized SMS can intentionally hold the cursor back; the existing overlap and duplicate handling keep retries safe, but a future retry-limit UI would improve this further.
- Android release validation requires an Android SDK and is not available in the current execution environment.
- Tailwind CDN removal is intentionally excluded from this branch because it requires dependency and lockfile regeneration plus a verified production build.

## Rollback / Cleanup

The work is isolated on `codex/reliability-hardening`. Revert or close the pull request without affecting `master` if verification fails.
