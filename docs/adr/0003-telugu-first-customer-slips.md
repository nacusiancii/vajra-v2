### Telugu-first customer-facing slips, English-first operator UI

Vajra's UI is English-only. Customer Master and Product Master carry an optional Telugu translation alongside the required English value. Customer-facing artifacts — Sale Invoice, Credit Voucher, customer copies — prefer Telugu for customer name, place, and product line names when a translation is present, and **fall back to English** when it is not. Walk-in sales have no Telugu master: the English strings stored on the Sale print as today. The End of Day Report and any other shopkeeper-facing artifact stays English. Operator UI (cart, pickers, masters) stays English. There is no bilingual print-settings UI in v2.

**Supersedes the prior blank-gap rule.** Earlier wording of this ADR required leaving a blank handwriting gap when Telugu was missing (never English-fallback on the face). That consequence is **revoked**: missing Telugu must not produce blank customer/place/product fields or empty dashed underlines. Telugu-first with English fallback is the authoritative customer-face rule.

We chose this split because the slip serves the customer, not the operator. Customers in this shop read Telugu more comfortably than English; cashiers and the shopkeeper read English fine for an operational UI they see hundreds of times a day. English fallback keeps unfinished masters usable at the counter instead of forcing hand-writing or blank faces.

#### Consequences

- Every new Customer and Product entry has two name fields (English required, Telugu optional). A simple transliteration helper button is desirable for v2 but not a blocker; OS-level IME is acceptable interim.
- Slip rendering must be tested early on the target thermal printer — Telugu conjuncts and matras are non-trivial for cheap bitmap-font printers. Printer purchase is driven by Telugu rendering quality, not the other way around. If the chosen printer fails Telugu, this ADR must be revisited before the slip layer is finalised.
- Customer-face fields use Telugu when set and English when not — layouts show the resolved string, not a reserved blank gap for missing translations.
- No Telugu UI mode in v2. If the shopkeeper later wants their own Telugu view of the app, that is a new ADR and a substantial UI investment.
