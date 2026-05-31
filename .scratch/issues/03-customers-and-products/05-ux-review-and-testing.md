Status: needs-triage

## Story: User experience review and testing for UI built so far

Hands-on review of the Customer Master and Product Master pages against the PRD user stories. Walk through each story and verify:

1. Searchable, filterable list works as described.
2. Combobox for Place / Product Group feels natural (type-or-pick).
3. Name uniqueness hard-block and duplicate warning (same place + phone) fire correctly.
4. Immutable fields (type, Default Bag Size) are clearly read-only in edit mode.
5. Visual indicators for missing Telugu translations are obvious at a glance.
6. Delete button behavior (currently always enabled — verify tooltip wording when references exist is wired).
7. Sort toggle (name vs last updated) works.
8. Overall look and feel against shadcn-vue defaults.

File findings as new issues or close PRD stories as verified.
