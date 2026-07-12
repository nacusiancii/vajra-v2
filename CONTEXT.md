### Project Vajra — Glossary

The vocabulary Vajra runs on. Use these words exactly. If a concept you need isn't here, flag the gap — don't invent a synonym.

## Language

### The day

**Business Day**:
The single open window during which Vajra records sales and stock movements. Opened by a Rollover and closed by the next one. Exactly one Business Day is open at any time. The wall clock does not start or end it.
_Avoid_: Day, session, shift, trading day.

**Rollover**:
The iterative process — not a button — that closes the current Business Day and defines the next one. The shopkeeper exports the End of Day Report, reviews it (typically by entering physical counts into their own Excel sheet and comparing), and if any discrepancies are real missed transactions, re-enters those Sales or Purchases through the normal Vajra interface and **restarts** Rollover. The export step may be repeated as many times as needed until the shopkeeper is satisfied. Approving the report finalises it: transactional data is wiped, and the next Business Day begins with Opening Stock equal to the closing stock Vajra computed at approval. Until Rollover is approved, the current Business Day stays open and accepting transactions.
_Avoid_: Day close, EOD process, reset.

**End of Day Report**:
The exported artifact produced at the start of Rollover. Contains all transactional data for the closing Business Day (the day book). Lives as a file on disk outside Vajra's owned data. Vajra never reads it back as data — once exported, it belongs to the shopkeeper.
_Avoid_: Day book (as a separate concept), report, EOD.

**Opening Stock**:
The stock-on-hand for each Product at the moment a Business Day begins. Set during the previous Rollover as part of approving the End of Day Report — it is the closing stock Vajra computed at approval, frozen as the starting point of the next day.
_Avoid_: Starting inventory, initial stock.

**Inventory**:
A _derived view_, not a stored value. The current stock of any Product is computed at read time by replaying the Business Day's transactions (Sales, Purchases, Stock Transfers, with Void successors taken into account) against the day's Opening Stock. Vajra never persists "current stock" as a separate field anywhere — there is no source of truth for inventory other than the transactional ledger. The cashier UI shows a live computed view; the End of Day Report shows the same numbers, produced by the same formulas.
_Avoid_: Stock-on-hand (as a stored value), inventory table, balance.

### Master data (survives Rollover)

**Product Master**:
The catalog of things the shop can sell. Survives Rollover unchanged. Each entry is a single SKU identified by its name.

**Customer Master**:
The catalog of known counterparties. Survives Rollover unchanged. A single Customer entry serves both directions — the same record is referenced when the counterparty buys (Sale, Receipt) and when they supply (Purchase, Payment). No separate Supplier Master exists.

Each Customer has: a unique **name** (English, required), a **place** (English, required, autocompletes from values already in the DB), an optional **phone**, optional **Telugu translations** for name and place, and an optional **remarks** (single free-text field, overwritable — a sticky note for the shopkeeper, not a log). Creating a new Customer with a name that already exists is blocked; creating one whose name is _similar to_ an existing entry surfaces those matches and offers to reuse them, but the cashier can still proceed if they confirm.

UX-only flags about a Customer — e.g., "has ever supplied" used to bias Purchase-screen search — live outside the Customer Master so the master stays a pure identity record.
_Avoid_: Supplier Master, Vendor, Party.

**Walk-in Customer**:
A counter customer not held in the Customer Master. A Cash Sale to a walk-in may still capture **name**, **place**, and optionally **phone** directly on the Sale — these values live with the Sale itself, not as a new Customer Master entry. Place is captured because it carries business meaning to the shopkeeper when they review the End of Day Report, even though Vajra itself does not classify or interpret it. Credit Sales reject walk-ins; they require a Customer Master entry.
_Avoid_: Anonymous customer, guest customer.

### Products

**Product**:
A single SKU identified by its name. Belongs to exactly one Product Group. Is either Packaged or Bulk — never both. Has an optional **remarks** field (single free-text, overwritable). Type and Default Bag Size are immutable after creation.
_Avoid_: SKU (as a separate concept), item.

**Product Group**:
A category that groups related Products, e.g., "Toor Dal" groups "Toor Dal Premium" and "Toor Dal Regular." Used for browsing and reporting, not for pricing or stock.
_Avoid_: Category, family.

**Packaged Product**:
A Product sold as-is in fixed pre-made packs, e.g., a 1 kg branded atta pack. Stock is counted in whole units.
_Avoid_: Retail product, fixed product.

**Bulk Product**:
A Product sold by the bag, with the bag size chosen at sale time (a Default Bag Type or a Dynamic bag weight) and the price set at sale time from a Quintal Rate. Stock is counted in units of the Product's Default Bag Size, and may be fractional (e.g., 1.5 bags) when a non-default bag weight has been sold or purchased.
_Avoid_: Loose product, open product.

**Default Bag Size**:
The Default Bag Type a Bulk Product's stock is measured against. Chosen only from the Settings catalog of Default Bag Types at Product create time; immutable thereafter. Selling or purchasing a different bag weight decrements or increments stock fractionally — a 25 kg bag against a 50 kg Default Bag Size moves 0.5 stock units.
_Avoid_: Pack size (as the stock unit).

**Default Bag Type**:
A shop-configured standard pack weight in Settings: a positive integer **kg** (immutable after create) plus an editable **loading charge** (₹ per bag; ₹0 allowed). Seeded with 25 kg, 30 kg, and 50 kg. The shop may add further sizes (e.g. 40 kg) without a Vajra release. Eligible as a Product's Default Bag Size and as a one-tap bag choice on Sale and Purchase bulk lines. Removing a Default Bag Type is blocked while any Product uses it as Default Bag Size, and the catalog must not be emptied.
_Avoid_: Pack size, sack size. Prefer this term over bare "Bag Type" when meaning the settings catalog entry.

**Bag Type**:
Informal shorthand for a bag weight on a line. Prefer **Default Bag Type** (catalog) or **Dynamic bag weight** (free-typed) when the distinction matters.
_Avoid_: Using "Bag Type" alone in new specs when Default vs Dynamic is ambiguous.

**Dynamic bag weight**:
A positive integer kg free-typed on a **Sale** or **Purchase** bulk line when the counterparty needs a size that is not (or is not chosen as) a Default Bag Type. Not eligible as a Product Default Bag Size. Stock still projects in Default Bag Size units. **Stock Transfer** bulk legs always use each Product's Default Bag Size — no Dynamic bag weight on transfers.
_Avoid_: Custom bag, other kg (as durable names).

**Quintal Rate**:
The per-quintal (100 kg) price entered by the cashier at sale time for a Bulk Product line. Drives the line's total before Loading Charges.
_Avoid_: Rate, kg rate, price-per-kg.

**Loading Charge**:
An opt-in surcharge on a **Sale** cart (not Purchase). When applied: each bulk line contributes (rate ₹/bag × qty). Rate for a Default Bag Type line comes from that type's Settings loading charge; rate for a Dynamic bag weight line comes from one **global default dynamic loading charge** (Settings), unless the cashier sets a **per-line custom ₹/bag** on that dynamic line only. On Edit Sale, rates recompute from **current** Settings (not historical snapshots); cart opt-in and any per-line dynamic ₹/bag overrides must still round-trip even when the computed total is ₹0.
_Avoid_: Hamali, handling fee.

### Stock movements

**Purchase**:
A transactional entry for stock arriving at the shop. Always either fully Cash or fully Credit — never partial — picked up front like a Sale. Cash mode pays the supplier now (cash and/or UPI at finish). Credit mode records goods received with nothing paid today; the face lands in **Credit received** for the day book. The cashier records per-quintal (Bulk) or per-unit (Packaged) rate plus any Additional Charges, and stock for the affected Products is bumped immediately. Like Sales, Purchases are wiped at Rollover — only their stock impact survives, carried forward as the next day's Opening Stock. Cost is never stored on the Product Master.
_Avoid_: Stock-in, GRN.

**Additional Charges**:
Extra costs or charges recorded against a Purchase or Sale beyond the pre-defined ones. Cashier-entered, per transaction. A single amount — no label, no breakdown.
_Avoid_: Other charges, expenses, sundry.

### Sales and payment

**Sale**:
A single counter transaction. Always either fully Cash or fully Credit — never partial. Cash mode collects cash and/or UPI at finish. Credit mode collects nothing today; a Credit Voucher is signed by the customer in exchange for goods, and the face lands in **Credit issued** for the day book. A new Sale starts by explicitly picking Cash or Credit before any customer or goods entry — nothing is chosen for the cashier, but Cash is pre-focused so the common case is a single key press — and the cashier may still toggle the mode any time during the cart. Every Sale produces a Sale Invoice on finish; a Credit Sale additionally produces a Credit Voucher.
_Avoid_: Bill, transaction (as a synonym for Sale).

**Draft**:
An unfinished Sale or Purchase the cashier has explicitly parked mid-entry so they can leave the cart, do other work, and resume later. Only Sales and Purchases are draftable. Only an explicit Save creates a Draft; resuming a Draft replaces any open unfinished cart without saving it. Saving requires a counterparty — a Customer Master entry, or walk-in name and place where that Sale or Purchase allows walk-ins. A Draft does not affect Inventory, does not receive a Sale Number or Voucher Number, and is discarded at Rollover. Clearing a Draft is free deletion, not a Void.
_Avoid_: held cart, parked bill, incomplete transaction, temporary sale.

**Sale Invoice**:
The paper artifact produced when a Sale finishes — one business copy always, one customer copy by default (customer can opt-out). Carries the line items, totals, payment captured (cash and UPI), Customer details where available, and a user-visible **Sale Number** that resets to 1 each Business Day. Reprintable from the cashier UI until the next transaction starts; not reprintable thereafter.
_Avoid_: Bill, slip, receipt (collides with the Receipt entity).

**Credit Voucher**:
The paper artifact a Credit Sale produces _in addition to_ the Sale Invoice, in lieu of cash. Carries a Vajra-generated **Voucher Number** (user-visible, resets each Business Day) printed on the voucher and recorded against the Sale for traceability. The customer signs the voucher; the **shopkeeper keeps it** (it joins the shop's paper credit book). Printed once and never reprinted — the signature is what makes it valid, so a reprint is meaningless. Finishing a Credit Sale requires explicit confirmation that the voucher has been signed. A Credit Sale also requires a phone number on the chosen Customer — if the Customer Master entry has none, the cashier is forced to add it before finishing.

Two-sided layout:

- **Front** — Company Name (from Settings), Date (Business Day), Place (Customer's place), Mobile (Customer's phone), Voucher Number, Customer name, total Amount, and the signature line.
- **Back** — Chosen Products as line items in the form `quantity × ratio × price = line total` (Bulk: bags × bag-kg/100 × Quintal Rate; Packaged: qty × 1 × unit rate), plus Loading Charges and Additional Charges as their own lines, then the Total.
  _Avoid_: IOU, credit note, due slip.

**Receipt**:
Money a customer brings in _after_ a Credit Sale was finished — possibly that same day, possibly weeks later. The cashier enters **Cash**, **UPI**, and an optional **Settlement Discount** (rupees) independently against a Customer. Pure write-off (discount only, no cash or UPI) is allowed; all three zero is not. Drawer impact is cash/UPI in only — never **Credit received**. Receipts do _not_ reference a specific Voucher ID because they may be paying against a voucher issued in a past Business Day, which Vajra no longer holds; matching is the shopkeeper's paper-side job. Receipts can be partial or full. Like all other transactional entries, Receipts are wiped at Rollover.
_Avoid_: Repayment, settlement, credit-in.

**Payment**:
Money paid _out_ to a Customer — the shop settling a past Credit Purchase, or any other counterparty-bound outflow. The mirror of Receipt: Cash, UPI, and optional Settlement Discount (rupees) entered independently; pure write-off allowed. Drawer impact is cash/UPI out only. References a Customer and optionally a Voucher ID. Payments are not validated against any past Credit Purchase inside Vajra; reconciliation is on paper.
_Avoid_: Payout, supplier payment, settlement, refund.

**Settlement Discount**:
A rupee write-off recorded on a Receipt or Payment only — never on Sale, Purchase, Expense, or Income. Cashier-entered as an amount (not a percent). Realized money moved is cash + UPI; face is cash + UPI + Settlement Discount (derived when a view needs it); discount percent is derived from face when needed for reports. Pure write-off (Settlement Discount with zero cash and UPI) is valid.
_Avoid_: Discount % (as the stored entry), rebate, credit note.

### Day-book credit (drawer summary)

**Credit issued**:
The face total of goods sold on credit today — sum of Credit Sale amounts. Customers owe us this face. Not money in the drawer.
_Avoid_: Credit sales total (as a synonym that invites counting cash Sales).

**Credit received**:
The face total of goods bought on credit today — sum of Credit Purchase amounts. We owe suppliers this face. Not money in the drawer, and **not** money collected on Receipts (that is cash/UPI in).
_Avoid_: Credit purchases total (as a synonym); do not use this phrase for Receipt inflows.

### Other money movements

**Expense**:
A cash or UPI outflow with no counterparty record — rent, electricity, wages, tea. Carries a free-form label so the shopkeeper can categorise on the End of Day Report. Touches no stock. No Settlement Discount.
_Avoid_: Misc payment, other expense.

**Income**:
A cash or UPI inflow with no counterparty record — commissions and similar one-off money in. The mirror of Expense. Touches no stock. No Settlement Discount.
_Avoid_: Other income, misc income.

### Editing and audit

**Edit** (UX term):
The cashier-facing action for correcting a finished transaction within the current Business Day. Internally, an Edit is never a mutation — it is implemented as a Void of the original transaction plus the creation of a new transaction, linked by a Successor reference. The cashier sees one button labelled "Edit"; under the hood the chain grows.
_Avoid_: Mutation, in-place update.

**Void**:
A flag on a finished transaction marking it as superseded. The transaction row stays in place — its values are never changed — but it no longer contributes to the Inventory projection or to live totals. Voiding requires a Successor (the corrected transaction); a transaction is never voided without a replacement. Already-voided transactions cannot themselves be edited or voided again; only the live tip of a chain is mutable.
_Avoid_: Cancelled, deleted.

**Successor**:
The non-voided transaction that supersedes a voided one. A chain may grow arbitrarily long if the same logical entry is corrected multiple times in a day; only the most recent (un-voided) member of a chain affects Inventory and live totals. The full chain is preserved in the End of Day Report's audit sheet.

### Printing

**Printerless Mode**:
A settings-level toggle that lets Vajra operate without a printer. When on, finishing a Sale (or any other action that would print) commits the transaction without attempting a print and instead displays the would-be Sale Invoice / Credit Voucher details on screen — including the Sale Number and Voucher Number — so the cashier can write a manual copy by hand. Distinct from the per-transaction _"printer not responding — continue without slip?"_ prompt that handles a single transient print failure without changing the mode.

### Stock-only movements

**Stock Transfer**:
A rebranding or repackaging operation that moves stock from one Product to another without any money changing hands. Declared in two sides: the source Products and quantities removed, and the target Products and quantities added. Bulk legs always use each Product's **Default Bag Size** — no Dynamic bag weight and no alternate Default Bag Type pick on the leg. Example: 6 × 50 kg bags of "Toor Dal Regular" become 12 × 25 kg bags of "Toor Dal Premium" (each side in that Product's Default Bag Size). Vajra will show the kg totals on each side so the operator can see any yield difference. Like other transactional entries, Stock Transfers are wiped at Rollover; only their net stock impact survives.
_Avoid_: Rebranding, repack, conversion.

## Flagged ambiguities

**"Payment"**: The entity (cash/UPI out to a Customer) collides with the everyday meaning of "payment captured at the finish of a Cash Sale." When unambiguous in context, use Payment for the entity; for the cash/UPI a customer hands over during Sale finish, say _cash collected_ and _UPI collected_, not "payment."

**"Credit received"**: In the day-book drawer summary this means **Credit Purchase** face (goods we took on credit). It must never mean money a customer paid on a **Receipt** — that money is cash/UPI in only. The everyday reading "credit money we received" is the trap; the pair is Credit issued (Sale) ↔ Credit received (Purchase).

## Example dialogue

> **Cashier:** "Customer's waiting — can I just start ringing up?"
>
> **Shopkeeper:** "Did we Rollover yesterday's day?"
>
> **Cashier:** "I don't think so. The app's showing yesterday's date at the top."
>
> **Shopkeeper:** "Then there's no open Business Day yet. We have to close yesterday first — export the End of Day Report, I'll tally the stock, sign off, and set today's Opening Stock. Then you can sell."
>
> **Cashier:** "Won't we lose yesterday's transactions?"
>
> **Shopkeeper:** "They go into the End of Day Report file. After that Vajra forgets them. That's the point — we keep the day's book on paper and in that file, not inside the app."
