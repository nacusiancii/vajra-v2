### Draft Transactions — day-scoped parking outside the ledger

Cashiers need to park an unfinished Sale or Purchase, take other counter work, and resume later. A **Draft** is that parked cart: only Sales and Purchases are draftable; money movements and Stock Transfers are not. Saving is **explicit** only — no auto-save on navigate away, and Resume never creates a Draft. A counterparty is required before save (Customer Master entry, or walk-in name and place where the flow allows walk-ins). Resume replaces any open unfinished cart without a conflict dialog; losing dirty in-progress entry is acceptable.

Drafts live in **SQLite**, scoped to the open Business Day, in storage **separate from the transactional ledger** (`txn` / `txn_line`). They never receive Sale Numbers or Voucher Numbers, never enter the Inventory projection or drawer totals, and are not Void/Successor material — clear is free deletion; finish is the normal create path then drop the Draft. A single **global cap** limits how many Drafts may exist at once (Sale + Purchase combined; no per-type caps). The cap is a **configurable setting**, default **5**. Approving Rollover wipes Drafts with the day's transactional data after confirm (ADR-0001); they do not survive into the next Business Day.

We chose a separate day-scoped store over ledger rows so Inventory stays a pure projection over finished work (ADR-0005), and over Pinia/localStorage-only so parked carts survive process restart on a single offline machine (ADR-0002). Explicit save keeps the cashier in control of what is parked. A modest default cap (five) is enough at counter volume and can be raised in Settings without a model change; split caps by type add bookkeeping without a real workflow need. Auto-saving on Resume would create “mystery Drafts” the cashier never asked for.

#### Consequences

- The Draft payload is cart state (type, mode, counterparty, lines, charges, remarks, etc.), not a half-written `txn`. Finish must go through the existing create/validate path.
- Home and the open cart both expose Clear; Home lists Drafts for Resume.
- Wire wipe-on-Rollover-approve into the same approve path that deletes the day's ledger (implementation may ship with Rollover work; the retention rule is decided here).
- The draft-cap setting is global (one pool for Sale + Purchase). Changing the default or exposing the control in Settings is a product tweak, not a model change; per-type caps remain rejected unless a real workflow demands them.
