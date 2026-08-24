# Keyboard accessibility (issue #168)

Cashier keyboard pass for the counter: digits on Home, named icon actions, one focus ring, and Escape after a finished Sale goes Home. Inventory stays a derived view. No command palette.

## What shipped

- On **Home**, digits **1–8** start **Cash Sale**, **Credit Sale**, **Cash Purchase**, **Credit Purchase**, **Receipt**, **Payment**, **Transactions**, and **Inventory**. Each digit is painted on the matching control.
- Those digits fire **only on Home**. They do not fire while typing, while a combobox is open, or while a dialog is open. Numpad digits work when **NumLock** is on.
- Tab order on Home is the same walk as before. What changed is a **visible focus ring** (Vajra, See all →, Masters & Records cards, Export Day Report) and **visible digits** on the eight shortcuts.
- Icon-only actions now have names: cart **Remove line**, **Transactions** **Edit**, **Product Master** / **Customer Master** **Edit** and **Delete**.
- After a **Sale** is already committed, **Escape** (and Close) on the finish preview take the same path as **Done** — back to Home, not left on the filled cart.
- Deleting a **Product** or **Customer** now opens a confirm (**Cancel**, then **Delete**). Clearing a **Draft** is still immediate — free deletion, not a **Void**.
- **Inventory** is still a derived view: rows have no action. Home **8** is the keyboard entry.

## Shortcut table

Listener lives on Home only. Blocked while typing, in a combobox, or in a dialog. Numpad needs **NumLock** (`1`–`8`, same as the main row). Expense, Income, Stock Transfer, Product Master, Customer Master, Settings, Rollover, and Export Day Report have no shortcut.

| Key   | Action          | Where the hint is                                        |
| ----- | --------------- | -------------------------------------------------------- |
| **1** | Cash Sale       | Trailing end of the Cash Sale link                       |
| **2** | Credit Sale     | Trailing end of the Credit Sale link                     |
| **3** | Cash Purchase   | Trailing end of the Cash Purchase link                   |
| **4** | Credit Purchase | Trailing end of the Credit Purchase link                 |
| **5** | Receipt         | Trailing end of the Receipt link                         |
| **6** | Payment         | Trailing end of the Payment link                         |
| **7** | Transactions    | Heading row of the Transactions card (Masters & Records) |
| **8** | Inventory       | Heading row of the Inventory card (Masters & Records)    |

The digit hint is not a tab stop and does not change the control’s accessible name.

## Home tab order — before / after

**After is the same walk.** Rings, named **Edit**, and visible digits are what changed. **Transactions** and **Inventory** still sit late in Tab (after Expense / Income / Stock Transfer, Drafts, Recent Edit pencils, Product Master, Customer Master). Press **7** / **8** to skip that.

**Before**

1. **Vajra** (no designed ring)
2. Cash Sale → Credit Sale → Cash Purchase → Credit Purchase
3. Receipt → Payment → Expense → Income → Stock Transfer
4. Drafts, if any: **Resume**, then **Clear** (immediate)
5. **See all →** (no designed ring), then Recent **Edit** pencils
6. Product Master → Customer Master → **Transactions** → **Inventory** → Settings → Rollover → Export Day Report

**After**

Same order. **Vajra**, **See all →**, management cards, and Export Day Report share one 3px focus ring. Digits **1–8** sit on the eight shortcut controls and are not tab stops. Recent **Edit** was already named; the pencil glyph is now hidden from AT.

**Destructive on Home (unchanged):** **Clear** on a Draft is labelled and immediate.

## Sale cart tab order — before / after

Cash Sale lands on walk-in **Name** (`autofocus`). Forward Tab from Name is unchanged. **Remove** is now named; the Cash/Credit mode toggle has a ring; finish **Escape** = Home. **NumericField Enter still blurs** (unchanged) — Tab is next-field.

**Before** (from walk-in Name)

Place → Phone → Product trigger → Bag/Loose → Qty → Rate → **Remove** (unnamed icon) → Add Line → Loading Charge → Additional Charges → Discount → UPI → Customer copy → Remarks → Save Draft → Finish — Cash

Mode toggle sat **before** autofocus (Shift-Tab from Name) with **no** ring. **Escape** on the finish preview closed the layer and left the cashier on the filled cart (Sale already committed).

**After** (from walk-in Name)

Place → Phone → Product trigger → Bag/Loose → Qty → Rate → **Remove line** (named, still in tab order, immediate) → Add Line → Loading Charge → Additional Charges → Discount → UPI → Customer copy → Remarks → Save Draft → (Clear Draft if a Draft is active) → Finish — Cash

- Cash / Credit mode toggle: labelled buttons, now with a focus ring. Still behind autofocus — Shift-Tab from Name, not in the forward path.
- Finish **Escape**, Close, overlay dismiss, and **Done** all go Home.
- Qty / Rate **Enter** still commits and blurs to `body`. Do not teach Enter-to-advance.

Purchase is the same goods-cart shape (named **Remove line**, mode ring). Purchase finish still commits and goes Home with no print dialog.

## Other screens

- **Transactions:** **Edit** is named the same way as Home Recent (`Edit {type} #{serial}`). The row is not a tab stop. Voided rows have no control. **Edit** is Void + Successor (the cashier-facing correction).
- **Product Master / Customer Master:** **Edit** / **Delete** are named (`Edit {name}`, `Delete {name}`). Missing-Telugu status is no longer a tab stop. Search, translation filter, and sort have accessible names. **Delete** opens a confirm: **Cancel** then **Delete**. Escape / Close / Cancel do not delete.
- **Inventory:** no row action, no “open Product”. Display-only derived view. Home **8** is the keyboard entry. Tab order is Back → Vajra → end.
- **CustomerSelect** Add / Edit (Sale, Purchase, Receipt, Payment): `aria-label` instead of `title`.

## Remaining gaps

Honest leftover list — not this PR:

- **NumericField Enter** still commit+blur to `body`. Tab is next-field. Do not teach Enter-to-advance.
- **Enter-to-next** not added (out of scope).
- **Command palette** not added (`CommandDialog.vue` still unused leftover).
- **Inventory** stays a derived view: no row action, no fake “open Product”. Home `8` is the only keyboard entry.
- **Cash walk-in product picker does not auto-open.** Name keeps landing focus. Credit/Purchase still auto-open the customer picker.
- **Second line** still needs Tab to **Add Line**; nothing adds a line on Enter.
- **Tab while EntityCombobox is open** dismisses the non-modal popover.
- **Escape on an uncommitted cart** does not go Home (only the finished slip/panel does).
- **Cart Remove** is still an icon in the Tab path after Rate (immediate).
- **Mode toggle** is behind autofocus (Shift-Tab), not in the forward path.
- **Settings** bag-type / loading-breakpoint icon deletes are still unnamed (explicitly out of this pass). Stock Transfer re-suggest already has a name.
- **ComboboxField** place/group list pick is still mouse-only; typing the string works.
- After NumericField Enter-blur, Tab restarts at header chrome, not at Finish.
- Numpad digits need NumLock (`event.key` `'1'`…`'8'`).

**#48** (unbounded / vim navigation) is still open and is not this PR.

## How to try

1. On **Home**, press **1** (do not click Cash Sale).
2. Walk-in **Name** is focused. **Tab** to Place, Phone, then Product.
3. **Enter** opens the picker. Type the Product name. **Enter** picks it. Qty is focused.
4. Type qty. **Tab** (not Enter) to Rate. Type the rate.
5. **Tab** through to **Finish**, or click **Finish**.
6. On the slip, press **Escape** (do not click Done). You should be on Home, with the Sale in Recent, cart gone.
