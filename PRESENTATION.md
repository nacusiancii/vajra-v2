# End of Day Report spreadsheet (issue #166)

Shopkeeper-facing change to the exported `.xlsx`. Not a Vue screen.

Default Loading Charge rules: ≤10 kg → ₹0, ≤30 kg → ₹10, above → ₹12. Reconstruction uses **current** settings, not a snapshot on the Sale.

## What changed

Line Items now calls the goods/Discount/Additional Charges amount **Line Total** and the Sale/Purchase figure **Invoice Total** (written only on the last row of that order). Loading Charge on a Sale is one synthetic row **per current price level** when that reconstruction matches the stored amount; bags and Loose that share a breakpoint merge. Mismatch is one lump row with the stored amount. Zero-charge levels and free-band Sales are omitted. The workbook has a seventh sheet, **Journal**, empty until capture (#164). Expense and Income stay on Money.

## Line Items before / after

**Sheet order (after):** Summary → Inventory → Transactions → Line Items → **Money → Journal → Audit**.

**Headers**

| #    | Before (#160)                                                                                  | After (#166)                                   |
| ---- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1–10 | Time, Order Id, Line Id, Line Kind, Transaction Type, Party Name, Product, Qty, Bag Size, Rate | unchanged                                      |
| 11   | **Amt**                                                                                        | **Line Total**                                 |
| 12   | Loading Charges                                                                                | Loading Charges                                |
| 13   | **Total** (last row of the order only)                                                         | **Invoice Total** (last row of the order only) |

**How the three money columns fill** — Sale C-1, 4×25 kg + 1×50 kg:

| Product          | Line Kind | Line Total | Loading Charges | Invoice Total |
| ---------------- | --------- | ---------: | --------------: | ------------: |
| Toor 25 kg       | goods     |     400.00 |                 |               |
| Toor 50 kg       | goods     |     500.00 |                 |               |
| 4 × ₹10 (≤30 kg) | loading   |            |           40.00 |               |
| 1 × ₹12 (above)  | loading   |            |           12.00 |    **952.00** |

- **Line Total** = goods / Additional Charges / Discount only. Loading Charge is never in this column.
- **Loading Charges** = loading rows only. Goods rows are blank.
- **Invoice Total** = static Sale/Purchase total, **only on the last row of that order**. Other cells are blank (not 0.00). AutoSum of the column adds one number per order.

## Loading by price level

Bags and Loose that share a breakpoint merge. Zero-charge levels are omitted. Stored Loading Charge is the invoice figure; settings at export time are only a grouping aid.

### Same price — 4×25 kg + 1×30 kg → one row

| Product              | Qty |     Rate | Loading Charges | Invoice Total |
| -------------------- | --: | -------: | --------------: | ------------: |
| Toor 25 kg           |   4 | 10000.00 |                 |               |
| Toor 30 kg           |   1 | 10000.00 |                 |               |
| **5 × ₹10 (≤30 kg)** |   5 |    10.00 |       **50.00** |        750.00 |

25 kg and 30 kg are the same price level. One row, not two.

### Split — 4×25 kg + 1×50 kg → two rows

| Product              | Qty |     Rate | Line Total | Loading Charges | Invoice Total |
| -------------------- | --: | -------: | ---------: | --------------: | ------------: |
| Toor 25 kg           |   4 | 10000.00 |     400.00 |                 |               |
| Toor 50 kg           |   1 | 10000.00 |     500.00 |                 |               |
| **4 × ₹10 (≤30 kg)** |   4 |    10.00 |            |       **40.00** |               |
| **1 × ₹12 (above)**  |   1 |    12.00 |            |       **12.00** |        952.00 |

Loading 40+12 = ₹52. Matches the Transactions sheet Loading column.

### Mismatch lump — 1×50 kg stored ₹10, current rule ₹12

Settings no longer match the stored invoice amount. One lump, not a split. Line Id is `loading` (not `loading-upto-30` / `loading-above`).

| Product             | Qty | Rate    | Loading Charges | Invoice Total |
| ------------------- | --- | ------- | --------------: | ------------: |
| Toor 50 kg          | 1   | 9800.00 |                 |               |
| **Loading Charges** |     |         |       **10.00** |        500.00 |

### Zero-charge omitted — Loose 8 kg + 1×50 kg

No `1 × ₹0 (≤10 kg)` row. The 8 kg parcel is silent.

| Product             | Qty | Bag Size | Loading Charges | Invoice Total |
| ------------------- | --: | -------- | --------------: | ------------: |
| Loose Toor          |   8 | Loose    |                 |               |
| Toor 50 kg          |   1 | 50       |                 |               |
| **1 × ₹12 (above)** |   1 |          |       **12.00** |        592.00 |

A Sale with Loading Charge applied but stored amount ₹0 (free-band) also emits **no** loading row.

## Journal sheet

Workbook tabs: `Summary | Inventory | Transactions | Line Items | Money | Journal | Audit`

Journal sits after Money, before Audit. Capture of Journal rows is issue **#164** and is not shipped. Expense and Income stay on **Money** (Tea, Commission). They are not Journal and are not renamed.

**Shipped — header only, empty body:**

| Party | Debit | Credit | Amount |
| ----- | ----- | ------ | ------ |
|       |       |        |        |

Debit and Credit are **account names**; Amount is rupees — Tally-shaped, not two money columns.

## ADR-0006 contradiction

This issue **explicitly supersedes** the previous ADR-0006 cut. Per-line Loading Charge in SQLite remains **cut**. Settings breakpoints are not snapshotted on the Sale.

| ADR-0006 (previous cut)                                                   | This issue (new cut)                                                                                              |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| One `loading` row per Sale when `loadingApplied \|\| loadingCharges > 0`  | One `loading` row **per price level** when reconstruction matches stored `loadingCharges`; otherwise **one lump** |
| Free-band (`loadingApplied && loadingCharges === 0`) still emits a ₹0 row | Free-band emits **nothing**                                                                                       |
| Six sheets: Summary, Inventory, Transactions, Line Items, Money, Audit    | Seven sheets: those six plus **Journal** (empty body)                                                             |
| Line Items money headers: `Amt`, `Loading Charges`, `Total`               | `Line Total`, `Loading Charges`, `Invoice Total`                                                                  |
| Loading Product `'Loading Charges'`, Line Id `'loading'`, Qty/Rate empty  | Split rows describe the level; lump fallback keeps the old shape                                                  |

Kept from ADR-0006: money = integer paise in domain, Excel `0.00` rupees; mass = grams; cart-level `loadingCharges` / `loadingApplied` unchanged; static values except Summary nets and Inventory Diff.

## UX nits from review

Flagged from the spreadsheet review. **Not fixed in this cut.**

1. **Invoice Total on the last row is SUM-safe but not eye-safe.** AutoSum of the column adds one number per order (blanks are skipped — do not repeat the figure on every row). On the sheet it sits next to whatever line happened to be last (often the last Loading Charge or Discount row), so it can look attached to that line rather than the whole invoice. Filter Line Kind = goods and the figure vanishes for every Sale that has loading, Discount, or Additional Charges.
2. **Line Id column width clips `loading-upto-30`** to `loading-upto-3` (width 12, confirmed in LibreOffice). Shopkeeper-facing IDs should not look truncated; these IDs are developer strings (`loading-upto-30`, `loading-above`, `discount`).
3. **Journal has no “empty until capture” note.** Inventory explains that Physical is blank for the shopkeeper to fill. Journal is header-only until #164, with no italic note, so next to an empty Audit tab it can read as “export forgot the data.”
