### Zero retention beyond the Business Day

Vajra runs the current Business Day and nothing else. At Rollover, the End of Day Report is exported as a file on disk, then all transactional data and operational logs from the closed day are purged. The Product Master, Customer Master, and the new Opening Stock survive — that is all.

We chose this because Vajra is a counter-side operations tool, not a ledger or accounting system. Preserving transactional history would force us to take on durability, query, retention, and privacy responsibilities that belong to the shopkeeper's paper book and their own filesystem, and that v1 quietly conflated. Keeping the boundary brutal makes the data model small, the rollover honest, and the shopkeeper — not the app — the owner of historical records.

#### Consequences

- No "yesterday view," no historical analytics, no audit trail inside Vajra. Anything resembling history is delivered as exported files only.
- The End of Day Report is the _only_ bridge between days. If it isn't exported and stored by the shopkeeper, that day's detail is gone forever — by design.
- At the start of Rollover, if old End of Day Report files are still in the reports folder, Vajra warns the shopkeeper so they can move/back-up/delete them first. Vajra does not manage that folder; it only checks it.
- Reopening a closed day is not a feature and never will be.
