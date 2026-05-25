### Single-machine, offline, no built-in authentication

Vajra runs as a single desktop process on one laptop at the shop. No network, no cloud, no second station, no login screen, no per-user identity. The machine itself is the credential — whoever sits at the counter has full powers, including initiating Rollover. The app must be resilient to crashes and data corruption, since power cuts and ungraceful shutdowns are part of the operating environment.

We chose this because the shop has one counter, one operator at a time, intermittent power, and a shopkeeper who trusts physical access to the laptop more than any digital control. Multi-station or cloud architectures would force concurrency, sync, and infrastructure that the shop does not have and does not want — and the resulting complexity would not pay off for a tool whose data lifetime is bounded by a single Business Day.

#### Consequences

- All data lives in a single local store on the machine. Easy to back up, easy to wipe, easy to inspect — but a hard-drive failure loses the open Business Day. Crash and corruption resilience is a first-class requirement, not a stretch goal.
- There is no in-app audit trail of who did what. Vajra cannot detect a cashier marking a Cash Sale as Credit and pocketing the cash. The shopkeeper's physical-world checks (paper credit book, drawer count at Rollover) remain the only safeguard.
- Rollover can be initiated by anyone at the laptop. A future, additive safeguard — a TOTP step (with recovery methods) gating Rollover — is anticipated but not built in v2.
- No second machine, even read-only. If the shopkeeper wants to view stock from home, they read the most recent End of Day Report file. Vajra does not offer a "view-only" remote.
- The print stack (thermal printer) and the reports folder are both local-machine concerns. No print servers, no shared drives.
