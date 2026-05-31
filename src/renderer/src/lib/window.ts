/**
 * Window-role helpers.
 *
 * Transaction screens run in their own OS window, opened by the hub with a
 * `?role=txn` query (see main/index.ts). The hub (main window) carries no role.
 * The query is fixed at load time, so a module-level constant is enough.
 */

function readRole(): 'txn' | 'hub' {
  const role = new URLSearchParams(window.location.search).get('role')
  return role === 'txn' ? 'txn' : 'hub'
}

/** True when this renderer is a standalone transaction window (not the hub). */
export const isTxnWindow = readRole() === 'txn'
