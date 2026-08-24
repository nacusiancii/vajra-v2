# Journal (#164)

A Business Day **Journal** for the shopkeeper: a note that is on the day, and that does **not** move balances.

Sibling **#166** owns End of Day Report Journal columns. This slice is capture + live listing only.

---

## 1. What it is

A **Journal** is a finished row of the current Business Day with three facts:

| Field                   | Shopkeeper meaning                                              |
| ----------------------- | --------------------------------------------------------------- |
| **Party**               | Who the note is about (typed name — not a Customer Master pick) |
| **Debit** or **Credit** | Accounting side of the note                                     |
| **Amount**              | Rupees of the note                                              |

It gets a Transaction ID, shows on Home Recent and Transactions, Edits as void+successor, and is wiped at Rollover with the rest of the day.

It does **not** move cash, UPI, Credit Sales, Credit Purchases, or Inventory. Drawer cards stay the same. The Amount is the row's Total; the Drawer cell stays **₹0.00**.

Debit/Credit on a Journal is **not** Credit Sale / Credit Purchase mode.

---

## 2. Cashier path

1. **Home** — Journal is a secondary outline button (after Income, before Stock Transfer). Not in the Cash/Credit Sale/Purchase grid.
2. **Journal** screen (`/journal`) — heading **New Journal**.
3. Fill **Party** (autofocus), **Debit / Credit** (default **Debit**), **Amount** (₹), optional **Remarks**.
4. **Record Journal** — returns to Home. No print, no Draft, no toast.
5. **Home Recent** shows Type **Journal Debit** or **Journal Credit**, Party, Amount. No lowercase `credit` badge (that badge is Sale/Purchase credit mode only).
6. **Transactions** (`See all`) — same Type text, Counterparty = Party, Total = Amount, **Drawer ₹0.00**, Status live.
7. **Edit** from the pencil — heading **Edit Journal**, fields restored. Save voids the old row and writes a successor (same as every other Edit).

Empty Party → `Journal needs a Party`. Zero/blank Amount → `Amount must be greater than zero`.

---

## 3. What it does _not_ do

- No cash / UPI split (Expense and Income do that).
- No Credit Sales / Credit Purchases totals.
- No Inventory / stock lines.
- No print (Journals commit silently).
- No Draft (only Sale and Purchase can be drafted).
- No EOD XLSX Journal columns or Journal sheet — that is **#166**.
- No Party Master, no Customer Master pick on this screen.
- Not Expense or Income (those move cash/UPI).

---

## 4. Walkthrough

No screenshots in this Electron worktree. The screens, in order:

**Home.** Primary grid is still Cash/Credit Sale and Purchase. Secondary row (`secondary-actions`) is Receipt, Payment, Expense, Income, **Journal**, Stock Transfer.

**New Journal** (`journal-page`). Narrow stacked form, same shell as Expense:

- **Party** — free-text (`journal-party`)
- **Debit / Credit** — two buttons, Debit selected (`journal-side`, `journal-side-debit`, `journal-side-credit`). Same fill colour for both sides; the word is the distinction, not Sale's amber Credit tint.
- **Amount** — rupee field (`journal-amount`)
- **Remarks** — optional (`journal-remarks`)
- **Record Journal** (`journal-finish`); errors on `journal-error`

Tab order: Party → Debit → Credit → Amount → Remarks → Record Journal. Enter on Amount does not Record.

**Home Recent** (`recent-transactions` / `home-txn-row`): `#serial  Journal Debit  Ravi  ₹25.00` plus pencil (`txn-edit`).

**Transactions** (`transactions-page` / `txn-row`): No. / Type / Counterparty / Total / Drawer / Status / Actions. Drawer **₹0.00**. Cash net, UPI net, Credit Sales, Credit Purchases cards do not change.

**Smoke** (`tests/smoke/journal.spec.ts`): Home Journal → reject empty Party and zero Amount → Party `Ravi`, Amount `25`, leave Debit → Record → Recent **Journal Debit** / Ravi / 25, no exact-text `credit` badge → pencil **Edit Journal** hydrates → Transactions **Journal Debit**, Drawer **₹0.00**.

---

## 5. Domain shape for #166

#166 can read a live Journal with no new IPC:

| #166 need      | On `Txn`                                    |
| -------------- | ------------------------------------------- |
| Type           | `type: 'JN'` (label `Journal`)              |
| Debit / Credit | `journalSide: 'debit' \| 'credit'`          |
| Amount         | `total` (integer paise)                     |
| Party          | `label` (via existing counterparty display) |

Drawer columns and `creditAmount` are 0; `lines` is empty. A live Journal **already appears** on the EOD Transactions sheet (Type `Journal`, Total = amount, cash/UPI/Credit = 0). This slice does **not** add Debit/Credit columns there.

---

## 6. Remaining risks

| Risk                            | Why it matters                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SCHEMA_VERSION 6 wipe**       | Dev DBs at version 5 are destroyed, not migrated (existing policy).                                                                                                                   |
| **Debit default**               | Debit is pre-selected. A cashier can fill Party + Amount and Record without touching the toggle — that path is always Debit. The Record button says **Record Journal**, not the side. |
| **EOD Transactions until #166** | Live Journals already list on the Transactions sheet without Debit/Credit columns.                                                                                                    |
| **Smoke is Debit-only**         | The required smoke never Records Journal Credit. Badge-absent is locked for Debit.                                                                                                    |

UI and UX reviews found **no blocking issues**. Nits above are the leftovers.

---

_Issue [#164](https://github.com/nacusiancii/vajra-v2/issues/164). Shopkeeper word: **Journal**._
