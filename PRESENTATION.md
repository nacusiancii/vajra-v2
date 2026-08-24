# Inventory printable & clickable (#165)

Inventory is still a _derived view_ of the open Business Day — Opening Stock plus today's Sales, Purchases, and Stock Transfers. Nothing here stores "current stock." This work makes that view printable, clickable, and ordered the way the shopkeeper walks the godown.

Two papers, two jobs:

- **Stock paper** — every Product (or the filtered slice), grouped, in Inventory Product Order.
- **Product lines paper** — that Product's live lines for today: who, what kind of movement, how much, rate, and the goods amount only.

Neither paper is a Sale Invoice or a Credit Voucher. Printerless Mode does not apply.

---

## Walkthrough

1. **Home → Inventory.** Under Masters & Records, open Inventory. The page is live stock for the open Business Day: Opening, + Purchased, − Sold, ± Transfer, = Closing. Numbers are bags of the Product's Default Bag Size. If a row projects below zero, an amber banner appears on screen (it does not print).

2. **Filter.** Search by Product name, and/or tick Product Groups on **Group**. Empty search and no groups ticked = the whole catalog. Filters that match nothing show **No matches**; Print on the toolbar then stays disabled.

3. **Click a Product.** The whole row is the button (mouse, Enter, or Space). Filters stay on the page — they do not move into the dialog. A dialog opens for that Product: Product Group, bags of Default Bag Size, and today's live Sales, Purchases, and Stock Transfers. Drafts are not here. A Voided predecessor is not here — only the live tip of an Edit chain.

4. **Read the lines.** Columns, in order:

   | Column           | What you are looking at                                                                                                   |
   | ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
   | **Sl. No.**      | Row 1, 2, 3… on _this_ Product today. Not a Transaction ID.                                                               |
   | **Party Name**   | Customer Master name, Walk-in Customer (`Walk in` when blank), or `—` on Stock Transfer.                                  |
   | **Type**         | `Cash Sale`, `Credit Sale`, `Cash Purchase`, `Credit Purchase`, or `Stock Transfer (source)` / `Stock Transfer (target)`. |
   | **Quantity**     | That line's bags of its Bag Type, or kg if Loose. Not the Inventory closing figure.                                       |
   | **Quintal Rate** | Bag lines: Quintal Rate. Loose: rupees `/kg`. Stock Transfer: `—`.                                                        |
   | **Total**        | That Product's goods amount on the line. Stock Transfer: `—`.                                                             |

   If there are no live lines: **No live Sales, Purchases, or Stock Transfers for this Product today.**

5. **Print stock vs print that Product's lines.**
   - Dialog **closed**, toolbar **Print** → the filtered stock tables with Product Group headings, in Inventory Product Order. Search, Group, Print, Back, and the negative-stock banner stay off the paper.
   - Dialog **open**, dialog **Print** (or Ctrl+P) → that Product's live-lines table only. Stock tables, page chrome, overlay, and buttons stay off the paper.
   - Empty click-through still prints: title plus the empty sentence.

6. **Set the order on Product Master.** Home → Product Master. Sort defaults to **Inventory order**, so Up/Down are visible on landing. Use those chevrons on a Product's row — not a number in the Product dialog. First in a Product Group cannot go Up; last cannot go Down. Search or Missing Translation disables the chevrons until you clear them (otherwise a hidden sibling would jump). Switching sort to Name or Last Updated hides Up/Down. Inventory (and its stock paper) follow this order immediately.

---

## What "product total" excludes

The Total column is the **line goods amount** (`line_total`) for that Product on that Sale or Purchase. It is the bags × Quintal Rate (or kg × Loose rate) for this Product only.

It is **not**:

- the Sale or Purchase invoice total
- Loading Charges (cart-level, Sales)
- Additional Charges (cashier-entered on the transaction)
- Discount (rupees off the Sale total)

A Credit Sale that also has Loading Charges and Discount still shows only this Product's goods line here. Add those other faces on the Sale Invoice / Credit Voucher, not on this paper.

Stock Transfer never carries money. Party Name, Quintal Rate, and Total are `—` — not ₹0.00 (that would look like a free Sale).

Loose is priced per kg. The rate cell is `/kg`. Vajra does not invent a Quintal Rate from a Loose line.

---

## How order is set

**Inventory Product Order** lives on the Product Master. It is not Opening Stock and not stored current stock.

- Applied **within** a Product Group. Group headings stay. Product Groups themselves stay in name order — Sugar cannot slot between two dals.
- Until a Product has an order (NULL), it sorts by **name** after siblings that do have an order. An untouched catalog is Product Group, then name.
- The first Up/Down in an all-null group writes 1…n for the whole group (name order, with that one swap). Later moves permute that list.
- Moving a Product to another Product Group clears its order so a Dal "3" does not land ahead of Rice "1".
- New Products start NULL (name order) until you move them.

This is SCHEMA 6. During development, a schema bump **wipes the shop DB** and recreates empty — no migrate path. Catalog and the day's book must be re-entered.

The End of Day Report Inventory sheet and Rollover's closing table do **not** use this order yet. That is #166, not a bug in this screen.

---

## Remaining risks

- **Dialog print is a portal trick.** The live-lines dialog is portaled to `body`. Print CSS hides `#app` while that dialog is open so paper is the Product table, not a dimmed empty page plus the Inventory title. If the portal or the hide rule regresses, product-lines paper breaks.
- **SCHEMA 6 wipes the shop DB.** First launch of this build after SCHEMA 5 is a clean database.
- **End of Day Report Inventory sheet does not inherit Inventory Product Order** (#166). Godown paper from Inventory and the EOD Inventory sheet can disagree on sequence until that work lands. Do not "fix" it by changing the stock formula.
- **Do not persist current stock.** Closing on this page is computed at read time. There is still no inventory table to print from.
- **Printerless Mode does not gate this Print.** Settings default is locked on; if Inventory Print read that flag, the button would do nothing. This Print is `window.print()` on a view — not a Sale Invoice / Credit Voucher.

Operator English only (like the End of Day Report). Telugu stays on customer slips.
