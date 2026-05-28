Status: needs-triage

## DevX: Architecture review for unit test harness

Review the current Vitest setup and test patterns before they scale:

- Is the `tests/unit/domain/` structure right? Should tests live next to source files?
- Do we need test fixtures/factories for domain entities?
- Should repositories get their own integration tests with a real SQLite DB?
- Vitest config: is `vitest.config.ts` at the root the right approach, or should it live inside `electron.vite.config.ts`?
- How should we handle tests that need Electron APIs (e.g., `app.getPath`)?
