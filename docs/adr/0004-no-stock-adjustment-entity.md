### No Stock Adjustment entity — corrections flow through real transactions

Vajra has no "Stock Adjustment" entity, no "write-off," no "shrinkage" entry, and no direct edit of stock numbers. Every stock movement inside Vajra is caused by a real-world event recorded as one of the existing transactional entities: Sale, Purchase, or Stock Transfer (for rebranding). Reconciliation between Vajra's closing stock and physical reality happens _outside_ Vajra — in the shopkeeper's own Excel sheet built off the exported End of Day Report. If reconciliation reveals a real missed transaction, the shopkeeper enters it through the normal Sale or Purchase interface and re-runs Rollover; otherwise the discrepancy is simply lived with and tomorrow's Opening Stock equals Vajra's computed closing stock.

We chose this because every "adjustment" entity in inventory systems eventually becomes a dumping ground for "I don't know" — phantom corrections that hide real operational problems and corrupt the meaning of the data. By forcing every stock movement to be a named real-world event (a sale, a purchase, a rebrand), Vajra keeps its records honest and pushes the messier reconciliation work to the tool that's best at it: the shopkeeper's spreadsheet, which can show whatever pivots and comparisons they want without burdening Vajra with a query layer.

#### Consequences

- Genuine non-transactional losses (a wet bag, rats, spillage) have no clean home in Vajra. They appear as silent drift between expected and actual stock, surfaced only by the shopkeeper's external reconciliation. This is accepted; Vajra does not promise to explain every kilogram.
- Rollover is intentionally re-runnable. The shopkeeper may export, reconcile in Excel, add missed transactions in Vajra, and re-export — repeated until they sign off. Only the approval step is terminal.
- There is no "edit" or "undo" pressure on the data model coming from reconciliation, because the answer is always "enter a new transaction," not "modify an old one."
- The End of Day Report becomes the only interface between Vajra and the reconciliation workflow. Its structure must be Excel-friendly enough that the shopkeeper can paste-or-import it into their sheet without manual reformatting.
