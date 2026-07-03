### Transaction ID strategy — user-visible per-day numbers, internally type-and-date-qualified

Every transactional entity (Sale, Purchase, Receipt, Payment, Expense, Income, Stock Transfer) carries two identifiers:

- A **user-visible number** that resets to 1 at the start of each Business Day and increments per transaction of that type within the day. The Sale Invoice shows the Sale Number; the Credit Voucher shows the Voucher Number; the cashier UI labels every row by this short number.
- A **globally-unique internal ID** of the form `TT-NNNN-DDMMYYYY`, where `TT` is a two-letter transaction-type code (SA = Sale, PU = Purchase, RE = Receipt, PA = Payment, EX = Expense, IN = Income, ST = Stock Transfer), `NNNN` is the per-day number, and `DDMMYYYY` is the Business Day's start date. The internal ID is what the Successor reference in a Void chain points to, what the End of Day Report's audit sheet joins on, and what any cross-sheet formula in the EOD XLSX uses to anchor a row. The internal ID is never shown to the cashier or printed on paper.

We chose this split because the cashier's mental model is short, day-local, and rooted in physical paper (Sale 42, Voucher 7) — a long opaque ID at the counter would slow recognition and look bureaucratic. But Vajra needs a globally-unique identifier inside its data so chains, formulas, and audit records survive the day's growth without ambiguity. Encoding the type and date into the ID — rather than relying on a global counter or a UUID — keeps the identifier human-readable even when it does surface (in logs, in the audit sheet, in support conversations), and removes any ambiguity about which day a referenced row belongs to.

#### Consequences

- The user-visible Sale Number resets at Rollover, matching the per-day reset of all transactional data. The shopkeeper's paper credit book keys its rows by Voucher Number + date — Vajra's choice mirrors that habit.
- Per-day numbering means there is no global notion of "we've done N sales since launch." That is deliberate; zero-retention (ADR-0001) already rules out aggregating across days.
- The internal ID's date suffix is the Business Day's _start date_, not the wall-clock date — so a Business Day that runs past midnight still produces IDs anchored to the day it began.
- Two-letter type codes are a closed set, listed above. Adding a new transactional entity (the rare case) means picking a new two-letter code and updating this ADR — collisions are impossible by enumeration.
- The Successor pointer on a Voided transaction stores the full internal ID of the replacement, so the audit sheet can render the chain unambiguously and Excel-side joins are straightforward.
