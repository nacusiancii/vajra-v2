Status: needs-triage

## DevX: Add missing predefined scripts

Several common operations lack dedicated `pnpm` scripts. Examples:

- Rebuilding better-sqlite3 for Electron (`electron-builder install-app-deps`)
- Rebuilding better-sqlite3 for Node (Vitest) (`pnpm rebuild better-sqlite3`)
- Running only smoke tests vs only unit tests with short names

Document and add scripts so developers and agents don't need to remember raw commands.
