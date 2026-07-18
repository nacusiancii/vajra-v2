### Transaction ID strategy — one ID for storage and display

Status: accepted (revises the earlier dual-number design). Clean databases are acceptable while we are still in fast alpha development.

Every finished transactional entity carries **one** identifier: the **transaction ID**. That same string is stored, shown in the cashier UI, printed on the Sale Invoice and Credit Voucher, and used as the Successor pointer in a Void chain and on the End of Day Report audit sheet. We do **not** keep a parallel short "Sale Number" / "Voucher Number" field — two sources of truth drifted in practice and complicated Edit revisions.

#### Shape

```
TT[-MODE]-SEQ[.REV]-DDMMYYYY
```

| Part       | Meaning                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `TT`       | Type code: `SA` Sale, `PU` Purchase, `RE` Receipt, `PA` Payment, `EX` Expense, `IN` Income, `ST` Stock Transfer                                |
| `MODE`     | For `SA` and `PU` only: `C` (Cash) or `R` (Credit). Omitted for other types                                                                    |
| `SEQ`      | Per-Business-Day sequence for that `(TT, MODE)` (or `TT` alone when no mode), starting at 1                                                    |
| `REV`      | Optional edit revision. The first finished row has no `.REV`. Each Edit successor of that sequence keeps the same `SEQ` and uses `.1`, `.2`, … |
| `DDMMYYYY` | Business Day start date (not wall-clock), same as before                                                                                       |

Examples:

- `SA-C-20-18072026` — Cash Sale sequence 20
- `SA-C-20.1-18072026` — first Edit successor of that sale
- `SA-R-3-18072026` — Credit Sale sequence 3 (invoice **and** voucher both print this ID)
- `PU-C-1-18072026` / `PU-R-2-18072026` — Cash / Credit Purchases, separate sequences
- `RE-4-18072026` — Receipt (no mode segment)

Cash and Credit sequences for Sales are independent; same for Purchases. Credit Voucher does not allocate a second sequence.

#### Why

- Cashiers still see a short day-local sequence inside the ID (`C-20`, `C-20.1`) without a second column to keep in sync.
- Edit-as-void-plus-successor (ADR-0007) needs a stable chain key; the ID is already that key.
- Separate Cash/Credit sequences match how the shop reads paper piles.
- Alpha: we can ship the new shape without migrating old rows.

#### Consequences

- UI and prints format/display the transaction ID (or a readable substring derived only by parsing it — never a separately stored number).
- Implementing Edit revisions and mode-split sequences is one scheme, not two features with two counters.
- Adding a transactional type means picking a new `TT` code and updating this ADR.
- Code and docs that still say "Sale Number" / "Voucher Number" as stored fields are stale and should be updated toward transaction ID.
