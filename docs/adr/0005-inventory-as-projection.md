### Inventory is a projection, not a stored value

Vajra has no `stock_on_hand` field, no inventory table, no per-Product running-total column. The current stock of any Product is computed on demand by replaying the Business Day's transactional ledger against the day's Opening Stock — summing Sales, Purchases, Stock Transfer legs, and respecting Void/Successor chains so only the live tip of each chain contributes. The cashier's live inventory view in the UI and the Inventory sheet of the End of Day Report both render this same projection through the same formula library; there is no other source of truth for "how much do we have right now."

We chose this because storing inventory separately is the single most common source of drift in retail systems — every transaction handler must remember to update the running total, every Void must remember to reverse it, every edit becomes a four-way consistency exercise. By making stock a derived view from an immutable ledger, every correction (a missed sale entered late, a typo voided and re-entered) propagates automatically with no double-bookkeeping. The cost — recomputing on read — is irrelevant at this scale, since a Business Day has hundreds of transactions, not millions.

#### Consequences

- The transactional tables (Sales, Purchases, Stock Transfers) are the canonical record of stock movement. They are append-only within a day; mutation is allowed only via the Void+Successor pattern, which preserves replay semantics.
- Voiding a Purchase or Stock Transfer can produce a *projected* negative stock if downstream Sales have already consumed the stock the voided row supplied. Vajra surfaces this as a visible condition on the projection — it does not block the Void. The shopkeeper deals with the underlying mistake (probably by entering a corrective transaction).
- The formula library that drives the projection is shared between the live UI and the XLSX export. Adding a new transaction type means updating one place; both surfaces follow.
- Opening Stock for a Business Day is the projection's frozen result at the moment of Rollover approval. It is the only stock-related value Vajra durably stores across days.
