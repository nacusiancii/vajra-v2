### End of Day Report is a multi-sheet XLSX (ExcelJS)

The End of Day Report exports as a multi-sheet `.xlsx` file written with **ExcelJS**. HTML is no longer the shopkeeper-facing export path.

**v1 formula vs static cells.** Cheap same-sheet formulas ship where the layout is stable and the shopkeeper benefits immediately: on **Summary**, Cash net is `=B6-B7` (Cash in − Cash out) and UPI net is `=B9-B10` (UPI in − UPI out); on **Inventory**, each product Diff is `=G{r}-H{r}` (Closing − Physical), with Physical left empty for reconciliation input. Everything else is a **static value** written from Vajra's projection library (`summariseDrawer` for drawer in/out and credit totals; Inventory Opening/Purchased/Sold/Transfer/Closing from `InventoryRow`). Closing stock is not re-derived from the Transactions sheet. Cross-sheet `SUM`s (e.g. Summary nets from Transactions columns) stay future work until column letters are pinned and tested.

We chose multi-sheet XLSX because the EOD report is the shopkeeper's reconciliation tool, not a presentation artifact. They open the file in Excel or LibreOffice, enter physical counts, and keep the file outside Vajra. Vajra never reads the export back.

#### Sheets (shipped)

1. **Summary** — Business Day startDate, generated note, drawer rows: Cash in/out/net, UPI in/out/net, Credit Sales, Credit Purchases. In/out and credit amounts are static from `summariseDrawer`; Cash net and UPI net are same-sheet Excel formulas (row layout pinned by unit tests).
2. **Inventory** — Group, Product, Opening, Purchased, Sold, Transfer (in−out), Closing, Physical (empty for shopkeeper), Diff. Quantities are **default-bag units** (grams ÷ product Default Bag Size), documented in a header note — consistent with the cashier Inventory view. Movement columns and Closing are static; Diff is `=Closing−Physical`.
3. **Transactions** — Live (non-voided) only, compact columns: No. (`displayTxnSerial`), Type, Mode, Counterparty, Total (₹), Cash in, UPI in, Cash out, UPI out, Credit, Discount, Loading, Remarks.
4. **Line Items** — Live stock-moving txns only (SA/PU/ST). One row per `txn_line` (`Line Kind` = `goods`) plus cart-level synthetic rows: `loading` (one per Sale when `loadingApplied` or `loadingCharges` > 0 — not split across goods lines; no per-line loading in SQLite), `additional` (`additionalCharges` > 0), `discount` (Sale Discount > 0). Columns: Time, Order Id (`displayTxnSerial`), Line Id, Line Kind, Transaction Type, Party Name, Product, Qty, Bag Size (kg or Loose), Rate (₹), Amt, Loading Charges, Total (order total on the last row of each order). Money-only types (RE/PA/IN/EX) are out of scope here.
5. **Audit** — Voided transactions: id, display serial/type, total, successorId.

#### Future (not shipped)

- Live cross-sheet formulas (e.g. Summary nets from Transactions columns; inventory closing from line movements).
- Money / non-stock sheet for Receipts, Payments, Income, Expenses.
- Transaction Summary sheet; per-entity ledgers (Sales, Purchases, Receipts+Payments, Expenses+Income).
- Stock Transfers decomposed into synthetic Sale+Purchase pairs on Inventory (today Transfer is a single net column).
- Per-line Loading Charges in the ledger (explicitly cut — report uses synthetic `loading` rows).

#### Consequences

- Sheet names are a fixed schema pinned by unit tests (`tests/unit/shared/eod-xlsx.test.ts`). Renaming breaks consumers and tests.
- Money stays integer **paise** in the domain; Excel cells show rupees with number format `0.00`. No float money in the domain layer.
- Filename: `{yyyy-mm-dd_HH-mm-ss}_eod_report.xlsx` using **local wall clock of export** (not Business Day startDate). MIME is the standard Office Open XML spreadsheet type. (Supersedes the earlier `vajra-eod-YYYY-MM-DD.xlsx` name.)
- Pure builder returns an `ArrayBuffer` (`buildEodReportXlsx`); the renderer builds the workbook and the **main process** writes it under `~/Documents/VajraExports` (or `VAJRA_EOD_EXPORT_DIR`) with no save dialog — success/failure is reported via toast.
- Approving Rollover overwrites any intermediate exports in spirit — only the final post-approval file the shopkeeper keeps is canonical.
- Telugu rendering applies to _slips_, not to this report — the report is shopkeeper-facing and stays English (ASCII-safe in Excel; ADR-0003).
