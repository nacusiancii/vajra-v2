### Journal is a day-scoped side-record, not a transactional type

Status: accepted.

Cashiers need a **Journal**: a note for the open Business Day with an optional **debit** party+amount and an optional **credit** party+amount (at least one side required). Amounts need not match. There is no cash/UPI split. The note must not move Inventory, drawer, Credit Sales Total, or Credit Purchases Total.

A Journal lives in its own SQLite table, scoped to the open Business Day, separate from the transactional ledger (`txn` / `txn_line`). It is **not** a `TxnType` and does not receive a `JO` transaction-ID code (ADR-0009). Display serial is `J-{seq}` / `J-{seq}.{rev}` — a Journal serial, not a transaction ID. Storage and successor pointers use the integer primary key.

**Edit** is Void+Successor on the Journal table (same cashier word as ADR-0007, same chain mechanics: live tip only; already-voided rows cannot be edited). **Cancel** (Delete) voids the live tip without a successor. That exception is Journal-only because Journals are notes, not projection inputs; transactional rows still never void without a successor (ADR-0007 is not relaxed).

Approving Rollover wipes Journals with the day's transactional data (ADR-0001). They do not survive into the next Business Day. Issue #164 does not put Journals on the End of Day Report and does not bump `ledger_generation`; a later ticket adds a new Journal sheet (not columns on Transactions or Money) and only then do Journal writes start bumping generation (ADR-0006).

Each party is a free-text name snapshot. Optionally picking an existing Customer stores a nullable FK as picker convenience — never required, never auto-created, never Walk-in, never inferred from a string match. Customer delete is not blocked by Journals (`customerHasReferences` stays `txn`-only). Journals do not feed credit totals. Debit and Credit are stored legs; house meaning (who owes whom, whether amounts should match) is deferred to that later report ticket.

The cashier list page title is **Transactions & Records**. The `txn` table and `TxnType` are not renamed. Journals are not draftable (ADR-0010) and do not print (ADR-0008).

We chose a side-record over a `JO` `TxnType` so two parties and two unmatched amounts are first-class without stuffing a note into Expense/Income, the drawer schema, or the EOD Transactions dump. Isolation is the design: Inventory, `summariseDrawer`, print, and this ticket's End of Day Report stay byte-identical whether or not Journals exist.

#### Consequences

- Do not add `'JO'` to `TxnType` / `txn.type` CHECK / `formatTxnId`.
- Journal writes in #164 must not bump `ledger_generation` (the watermark would force a re-export that still omits them).
- Journal Cancel does not introduce void-without-successor for Sale/Purchase/Receipt/Payment/Expense/Income/Stock Transfer.
- Hybrid Customer FKs are `ON DELETE SET NULL` and out of `customerHasReferences`.
- Empty-day startDate is blocked when any Journal row exists, including voided.
