### End of Day Report is a multi-sheet XLSX with live formulas

The End of Day Report exports as a multi-sheet `.xlsx` file. Aggregated cells (totals, balances, inventory closing values, drawer nets) are emitted as **live Excel formulas referencing other sheets in the same file**, not as pre-computed static values. The same formula library Vajra uses to render its in-app inventory and summary views is mirrored into the XLSX, so the shopkeeper can open the file in Excel or LibreOffice, audit every computed cell, and modify inputs (e.g., add the Physical Stock count on the Inventory sheet) and watch downstream numbers update.

We chose this because the EOD report is the shopkeeper's reconciliation tool, not a presentation artifact. Static values demand trust ("the app says these are the totals"); formula-driven cells invite scrutiny ("here is exactly how the total was computed"). The shopkeeper is not a programmer, but Excel cell formulas are a familiar enough notation that they can verify a single sum without anyone's help — and they can extend the sheet with their own analysis without forking the data.

#### Sheets

1. **Summary** — Header (shop, Business Day, generated-at) + cash/UPI in/out/net (cross-sheet sums) + credit issued/received totals + signoff line.
2. **Inventory View** — Per Product, grouped by Product Group with subtotals: `Opening | +Purchased | −Sold | =Closing | −Physical Stock | =Diff`. Closing and Diff are formulas. Physical Stock is the empty column the shopkeeper fills in during reconciliation. Stock Transfers are decomposed at report time into a synthetic Sale (source) + Purchase (target) pair, so this sheet sees only Purchases and Sales.
3. **Transaction Summary** — All transaction lines, compact column set, for scanning.
4. **Transactions** — All transaction lines, full column set, for detail.
5–8. **Per-entity ledgers** — Sales, Purchases, Receipts+Payments (merged), Expenses+Income (merged). Merging Sales and Purchases into a single "stock movements" sheet is an open consideration.
9. **Audit** — Voided transactions with Successor references.

#### Consequences

- Sheet names and column letters are load-bearing: renaming a sheet or moving a column breaks every cross-sheet formula. The export code must treat these as a fixed schema, with tests pinning each formula's references.
- The same formula library drives the live UI view and the XLSX export. Adding or changing a computation means updating one place that knows how to render to both surfaces.
- Approving Rollover overwrites any intermediate exports — only the final post-approval file is canonical. The reports folder should therefore hold one `.xlsx` per past Business Day, named with the day's date (e.g., `vajra-eod-2026-05-23.xlsx`).
- Telugu rendering applies to *slips*, not to this report — the report is shopkeeper-facing and stays English (ASCII-safe in Excel).
