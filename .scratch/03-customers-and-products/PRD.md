Understand the Users and what they want to achieve:

## Customer Master page

1. Shopkeeper/Cashier: I want to see all saved Customers in a searchable, filterable list so that I can quickly check if a Customer exists and whether their details are complete.
2. Shopkeeper/Cashier: I want to search Customers by English name so that I can find a specific entry fast.
3. Shopkeeper/Cashier: I want to filter Customers by Place (multi-select faceted filter) and by "missing translation" (single-select) so that I can focus on entries from a specific town or entries that still need Telugu names.
4. Shopkeeper/Cashier: I want a visual indicator on each Customer row when Telugu name or Telugu place is missing so that gaps are obvious at a glance without filtering.
5. Shopkeeper/Cashier: I want to sort Customers alphabetically by English name (default) or by last updated so that I can find entries by name or see recent changes.
6. Shopkeeper/Cashier: I want to add a new Customer with name (required, unique), place (required, autocomplete from existing), phone (optional), Telugu name (optional), Telugu place (optional), and remarks (optional) so that the Customer Master stays accurate.
7. Shopkeeper/Cashier: I want Place to autocomplete from existing values (combobox: pick existing or type new) so that I don't create typo-variants of the same town.
8. Shopkeeper/Cashier: I want the system to hard-block creating a Customer with an exact duplicate name, and soft-warn when place AND phone match an existing entry, so that I avoid accidental duplicates.
9. Shopkeeper/Cashier: I want to edit any field on an existing Customer so that I can fix mistakes or add Telugu translations later.
10. Shopkeeper/Cashier: I want to delete a Customer only when nothing in Vajra's current data (Opening Stock, transactions) references them, with the delete button disabled and a tooltip explaining why when blocked, so that I never break referential integrity.

## Product Master page

11. Shopkeeper/Cashier: I want to see all saved Products in a searchable, filterable list so that I can check the catalog and whether Telugu names are complete.
12. Shopkeeper/Cashier: I want to search Products by English name so that I can find a specific entry fast.
13. Shopkeeper/Cashier: I want to filter Products by Product Group (multi-select faceted filter) and by "missing translation" (single-select) so that I can review one category at a time or focus on translation gaps.
14. Shopkeeper/Cashier: I want a visual indicator on each Product row when Telugu name is missing so that gaps are obvious at a glance.
15. Shopkeeper/Cashier: I want to sort Products alphabetically by English name (default) or by last updated.
16. Shopkeeper/Cashier: I want to add a new Product with name (required, unique), Product Group (required, combobox — pick existing or type new), type (Packaged or Bulk, required), Default Bag Size (required for Bulk, dropdown of Bag Types), Telugu name (optional), and remarks (optional).
17. Shopkeeper/Cashier: I want to edit an existing Product's name, Product Group, Telugu name, and remarks — but type and Default Bag Size are immutable after creation (displayed read-only on the edit form).
18. Shopkeeper/Cashier: I want to delete a Product only when nothing in Vajra's current data references it, with the delete button disabled and a tooltip explaining why when blocked.

## Scope boundaries

- No Inventory/stock column on the Product page — that belongs to a separate Inventory page.
- No stored sale rate on Product Master — rate is determined at sale time.
- No "is supplier" flag shown on these pages.
- Product Group management is inline only (combobox on Product form) — no separate management page.
- Place management is inline only (combobox on Customer form) — no separate management page.
- Telugu search deferred until Telugu input method is figured out.
- The "similar name → reuse existing" deduplication UX belongs to the Sale/Purchase customer picker, not the Customer Master page.

Outcome:

As a developer, I want to build Customer and Product pages that meet all user stories above, with a state management and persistence layer that makes master data easy to query, mutate, and test — serving as a foundation for the transactional screens (Sale, Purchase, etc.) that reference this data.
