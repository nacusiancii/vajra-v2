# Transactional Core — design note

Built in one pass to bring Vajra to feature-complete. No per-feature PRDs preceded this
(the project's PRD-before-code rule was knowingly relaxed for this session); the decisions
below stand in for them. Where the glossary (CONTEXT.md) or an ADR was silent, the chosen
default is recorded here so it can be challenged later.

## Data model

Two new master-adjacent tables and one ledger pair, plus settings.

- `business_day(id, start_date, status open|closed, opened_at, closed_at)` — exactly one open
  at a time (ADR-0001). Bootstrapped on first DB open if none exists.
- `opening_stock(business_day_id, product_id, qty)` — the only stock value Vajra durably
  stores across days (ADR-0005). Frozen at Rollover approval.
- `txn` — one row per transactional entity (Sale, Purchase, Receipt, Payment, Expense,
  Income, Stock Transfer). Header fields shared by all types; type-specific columns are
  nullable. Internal id = `TT-NNNN-DDMMYYYY` (ADR-0009). `seq` = per-day per-type visible
  number; `voucher_seq` = per-day Credit Voucher number. Void chain via `voided` +
  `successor_id` (ADR-0007).
- `txn_line` — line items. `stock_delta` is the signed change in **default-bag-size units**,
  precomputed at write time so the projection is a pure SUM (ADR-0005). `side` is
  single|source|target (Stock Transfer uses source/target).
- `setting(key, value)` — printerless mode, loading-charge rules, bag types.

## Money model

Every txn carries four drawer columns: `cash_in, upi_in, cash_out, upi_out` (default 0).
Drawer aggregation is a SUM over non-voided rows regardless of type — no per-type branching.

- Cash Sale: cash_in / upi_in = amounts collected. Credit Sale: nothing collected today,
  `credit_amount` = total (credit issued).
- Receipt: money in (cash_in or upi_in by mode). Payment: money out.
- Income: money in. Expense: money out.
- **Purchase: no drawer impact** (assumption). The glossary models purchases as
  credit-then-settled-via-Payment and never mentions cash paid at purchase time, so a
  Purchase records stock-in + cost `total` only. Revisit if the shopkeeper pays cash at
  intake.

## Inventory projection (ADR-0005)

`closing(product) = opening_stock + Σ stock_delta over txn_line where txn.voided = 0`.

- Bulk: stock_delta per bag = bag_size_kg / default_bag_size_kg. Sale negative, Purchase
  positive. Packaged: ±qty whole units.
- Stock Transfer source legs negative, target legs positive.
- Projected-negative is surfaced as a warning, never blocks (ADR-0005 / ADR-0007).

## Pragmatic simplifications (per session brief)

- **Printing → on-screen preview.** Sale finish shows the Sale Invoice (Telugu-first,
  ADR-0003) and, for Credit Sales, the Credit Voucher with its Voucher Number. No printer
  driver, no print job; this also doubles as Printerless-Mode display. The
  commit-after-print-ack nuance (ADR-0008) is out of scope.
- **End-of-Day Report → simple working report**, not the formula-driven multi-sheet XLSX of
  ADR-0006. Rendered on screen and exportable as a self-contained HTML file to the reports
  dir. No Excel formulas, no cross-sheet references. ADR-0006 remains the eventual target.

## Rollover (CONTEXT.md)

Export (repeatable) → Approve. Approve = freeze projection as next day's opening_stock,
delete all txn + txn_line for the closing day, mark it closed, open the next Business Day.
