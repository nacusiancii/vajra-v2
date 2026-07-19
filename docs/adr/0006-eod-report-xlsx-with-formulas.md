### End of Day Report is a multi-sheet XLSX (ExcelJS)

The End of Day Report exports as a multi-sheet `.xlsx` file written with **ExcelJS**. HTML is no longer the shopkeeper-facing export path.

**v1 aggregates are static values** computed in Vajra from the same projection library the UI uses (`summariseDrawer`, Inventory rows). Live cross-sheet formulas that recompute totals inside Excel are preferred later; they are not required for this slice. Diff on Inventory may already use a simple `=Closing−Physical` formula so the shopkeeper can fill Physical and see the gap.

We chose multi-sheet XLSX because the EOD report is the shopkeeper's reconciliation tool, not a presentation artifact. They open the file in Excel or LibreOffice, enter physical counts, and keep the file outside Vajra. Vajra never reads the export back.

#### Sheets (shipped)

1. **Summary** — Business Day startDate, generated note, drawer rows: Cash in/out/net, UPI in/out/net, Credit Sales, Credit Purchases (same numbers as `summariseDrawer`). Static values for v1.
2. **Inventory** — Group, Product, Opening, Purchased, Sold, Transfer (in−out), Closing, Physical (empty for shopkeeper), Diff. Quantities are **default-bag units** (grams ÷ product Default Bag Size), documented in a header note — consistent with the cashier Inventory view. Closing is static; Diff may be `=Closing−Physical`.
3. **Transactions** — Live (non-voided) only, compact columns: No. (`displayTxnSerial`), Type, Mode, Counterparty, Total (₹), Cash in, UPI in, Cash out, UPI out, Credit, Discount, Loading, Remarks. Full line-item explosion is out of scope.
4. **Audit** — Voided transactions: id, display serial/type, total, successorId.

#### Future (not shipped)

- Live cross-sheet formulas for drawer nets and inventory closing.
- Transaction Summary sheet; per-entity ledgers (Sales, Purchases, Receipts+Payments, Expenses+Income).
- Stock Transfers decomposed into synthetic Sale+Purchase pairs on Inventory (today Transfer is a single net column).

#### Consequences

- Sheet names are a fixed schema pinned by unit tests (`tests/unit/shared/eod-xlsx.test.ts`). Renaming breaks consumers and tests.
- Money stays integer **paise** in the domain; Excel cells show rupees with number format `0.00`. No float money in the domain layer.
- Filename: `vajra-eod-YYYY-MM-DD.xlsx` (Business Day startDate). MIME is the standard Office Open XML spreadsheet type.
- Pure builder returns a Buffer (`buildEodReportXlsx`); the renderer only triggers the browser download.
- Approving Rollover overwrites any intermediate exports in spirit — only the final post-approval file the shopkeeper keeps is canonical.
- Telugu rendering applies to _slips_, not to this report — the report is shopkeeper-facing and stays English (ASCII-safe in Excel; ADR-0003).
