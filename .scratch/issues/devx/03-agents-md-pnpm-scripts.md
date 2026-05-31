Status: needs-triage

## DevX: Guide agents to use pnpm scripts via AGENTS.md

AGENTS.md should document the available `pnpm` scripts and instruct agents to use them rather than raw commands. Agents currently guess at `npx`, `electron-vite`, etc. instead of using `pnpm exec` or the named scripts.

Should cover: `dev`, `dev:linux`, `build`, `test`, `test:smoke`, `verify`, and any new scripts from issue 02.
