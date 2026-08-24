# Cash net filter

On the **Transactions** screen you can now see which rows make up **Cash net** (Cash in − Cash out).

## What the filter is

A checkbox labelled **Cash net** sits under the four cards and above the ledger.

- **Off** (the default): every transaction for the open Business Day.
- **On**: only the live rows that moved cash today — the rows whose cash in or cash out add up to the day's Cash net.

The four cards — **Cash net**, **UPI net**, **Credit Sales**, **Credit Purchases** — always stay the full-day figures. Turning the filter on does not change any card, including Cash net.

## What it includes and excludes

When **Cash net** is on:

| Transaction                                                          | In the list?                                  |
| -------------------------------------------------------------------- | --------------------------------------------- |
| Cash Sale (cash collected)                                           | Yes                                           |
| Mixed cash + UPI (Sale, Purchase, Receipt, Payment, Expense, Income) | Yes — cash moved                              |
| 100% UPI (Sale, Purchase, Receipt, Payment, Expense, Income)         | No — UPI is not cash                          |
| Credit Sale                                                          | No — nothing collected today                  |
| Credit Purchase                                                      | No — nothing paid today                       |
| Cash Receipt                                                         | Yes                                           |
| UPI-only Receipt                                                     | No                                            |
| Settlement Discount-only Receipt or Payment                          | No — write-off, no cash                       |
| Expense                                                              | Yes if cash went out; no if UPI only          |
| Stock Transfer                                                       | No — stock only, no money                     |
| Voided (even a voided cash Sale)                                     | No — voided rows do not count toward Cash net |

A mixed cash + UPI row that stays in the list still shows **Drawer** as cash and UPI together. The filter does not split that column.

## Example: three rows

Suppose today's ledger is:

1. **Cash Sale** — ₹5,200 cash collected
2. **Credit Sale** — ₹18,400 (goods out, nothing collected today)
3. **Receipt** — ₹3,000 UPI only (a customer settling later; no cash)

### The four cards — same with the filter off or on

| Card             | Amount     |
| ---------------- | ---------- |
| Cash net         | ₹5,200.00  |
| UPI net          | ₹3,000.00  |
| Credit Sales     | ₹18,400.00 |
| Credit Purchases | ₹0.00      |

Cash net is ₹5,200 because only the Cash Sale moved cash. The Credit Sale is credit. The Receipt is UPI.

### Which rows remain

| Filter | Rows you see                                    |
| ------ | ----------------------------------------------- |
| Off    | All three — Cash Sale, Credit Sale, UPI Receipt |
| On     | Only the Cash Sale                              |

The cards do not change when the list is filtered. Cash net on the card is still ₹5,200.00 — the day's figure, not a second, smaller total for the filtered list.

## Empty states

| Situation                                                        | Message                        |
| ---------------------------------------------------------------- | ------------------------------ |
| No transactions on this Business Day                             | **No transactions yet today.** |
| The day has rows, but Cash net is on and none of them moved cash | **No matches**                 |

An empty day still says **No transactions yet today.** even if the checkbox is on. **No matches** is only when there _are_ rows (Credit Sales, UPI-only, voided, Stock Transfers, and the like) and the filter hides all of them. Uncheck to see them again.

## Keyboard

Tab to the **Cash net** checkbox. Space turns it on or off. Clicking the label works too.

Leaving Transactions and coming back starts with the checkbox off.
