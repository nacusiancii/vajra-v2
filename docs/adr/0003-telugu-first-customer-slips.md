### Telugu-first customer-facing slips, English-first operator UI

Vajra's UI is English-only. Customer Master and Product Master carry an optional Telugu translation alongside the required English value. Customer-facing artifacts — Sale slips, Credit Vouchers, customer copies — render in Telugu by default; English is opt-in per print. The End of Day Report and any other shopkeeper-facing artifact stays English. When a Telugu translation is missing for a field that would otherwise print in Telugu, Vajra leaves a blank space on the slip rather than falling back to English text, so the cashier can hand-write the value.

We chose this split because the slip serves the customer, not the operator. Customers in this shop read Telugu more comfortably than English; cashiers and the shopkeeper read English fine for an operational UI they see hundreds of times a day. The blank-instead-of-fallback rule is deliberate: an English-fallback would visually clash with the rest of a Telugu slip, train the shopkeeper to leave translations un-filled forever, and silently degrade the quality of customer-facing output.

#### Consequences

- Every new Customer and Product entry has two name fields (English required, Telugu optional). A simple transliteration helper button is desirable for v2 but not a blocker; OS-level IME is acceptable interim.
- Slip rendering must be tested early on the target thermal printer — Telugu conjuncts and matras are non-trivial for cheap bitmap-font printers. Printer purchase is driven by Telugu rendering quality, not the other way around. If the chosen printer fails Telugu, this ADR must be revisited before the slip layer is finalised.
- The "blank space for handwriting" rule means slip layouts must reserve consistent horizontal room for fields that *could* be Telugu, even when Telugu is absent — the slip is designed for the bilingual case and tolerates the monolingual one, not the other way around.
- No Telugu UI mode in v2. If the shopkeeper later wants their own Telugu view of the app, that is a new ADR and a substantial UI investment.
