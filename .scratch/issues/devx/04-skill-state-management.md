Status: needs-triage

## DevX: Agent skill for getting state management right

Create an agent skill that codifies the state management architecture:

- Vue Query owns backend-read cache (IPC calls treated as server state).
- Pinia owns UI-only state (drafts, nav, dialogs, filters). Never mirrors tables.
- Main process owns durable truth via SQLite.
- Mutations go through IPC; Vue Query invalidates on success.

The skill should guide agents to pick the right layer for new state and avoid common mistakes (e.g., caching query results in Pinia, or calling IPC directly from components).
