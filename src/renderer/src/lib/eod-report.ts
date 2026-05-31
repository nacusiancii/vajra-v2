/**
 * Builds a simple, self-contained End of Day Report as an HTML document and triggers a
 * download. This is the pragmatic stand-in for the formula-driven XLSX of ADR-0006 — it is
 * a working, readable artifact the shopkeeper can save outside Vajra, without Excel formulas.
 */

import {
  summariseDrawer,
  TXN_TYPE_LABELS,
  type BusinessDay,
  type InventoryRow,
  type Txn
} from '@domain/transaction'

function rupees(n: number): string {
  return `₹${n.toFixed(2)}`
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c)
}

function counterparty(t: Txn): string {
  return esc(t.customerName ?? t.walkinName ?? t.label ?? '—')
}

export function buildEodReportHtml(
  day: BusinessDay,
  txns: Txn[],
  inventory: InventoryRow[]
): string {
  const drawer = summariseDrawer(txns)
  const live = txns.filter((t) => !t.voided)
  const voided = txns.filter((t) => t.voided)

  const summaryRows = [
    ['Cash in', rupees(drawer.cashIn)],
    ['Cash out', rupees(drawer.cashOut)],
    ['Cash net', rupees(drawer.cashNet)],
    ['UPI in', rupees(drawer.upiIn)],
    ['UPI out', rupees(drawer.upiOut)],
    ['UPI net', rupees(drawer.upiNet)],
    ['Credit issued', rupees(drawer.creditIssued)],
    ['Credit received', rupees(drawer.creditReceived)]
  ]
    .map(([k, v]) => `<tr><th>${k}</th><td class="num">${v}</td></tr>`)
    .join('')

  const txnRows = live
    .map(
      (t) =>
        `<tr><td>${t.seq}</td><td>${TXN_TYPE_LABELS[t.type]}</td><td>${counterparty(t)}</td>` +
        `<td class="num">${rupees(t.total)}</td><td class="num">${rupees(
          t.cashIn + t.upiIn - t.cashOut - t.upiOut
        )}</td></tr>`
    )
    .join('')

  const invRows = inventory
    .map(
      (r) =>
        `<tr><td>${esc(r.productGroupName)}</td><td>${esc(r.productName)}</td>` +
        `<td class="num">${r.opening}</td><td class="num">${r.purchased}</td>` +
        `<td class="num">${r.sold}</td><td class="num">${r.transferIn - r.transferOut}</td>` +
        `<td class="num">${r.closing}</td><td></td><td></td></tr>`
    )
    .join('')

  const auditRows = voided
    .map(
      (t) =>
        `<tr><td>${esc(t.id)}</td><td>${TXN_TYPE_LABELS[t.type]} #${t.seq}</td>` +
        `<td class="num">${rupees(t.total)}</td><td>${esc(t.successorId ?? '—')}</td></tr>`
    )
    .join('')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>Vajra End of Day Report — ${day.startDate}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; }
  h1 { font-size: 1.4rem; } h2 { margin-top: 2rem; font-size: 1.1rem; border-bottom: 2px solid #ddd; padding-bottom: .25rem; }
  table { border-collapse: collapse; width: 100%; margin-top: .5rem; font-size: .9rem; }
  th, td { border: 1px solid #ddd; padding: .35rem .6rem; text-align: left; }
  thead th, .summary th { background: #f5f5f5; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .meta { color: #666; }
</style></head><body>
  <h1>Vajra — End of Day Report</h1>
  <p class="meta">Business Day ${day.startDate} · generated for reconciliation</p>

  <h2>Summary</h2>
  <table class="summary">${summaryRows}</table>

  <h2>Inventory</h2>
  <table>
    <thead><tr><th>Group</th><th>Product</th><th>Opening</th><th>Purchased</th><th>Sold</th>
    <th>Transfer</th><th>Closing</th><th>Physical</th><th>Diff</th></tr></thead>
    <tbody>${invRows || '<tr><td colspan="9">No products</td></tr>'}</tbody>
  </table>
  <p class="meta">Fill the Physical column by hand during reconciliation.</p>

  <h2>Transactions</h2>
  <table>
    <thead><tr><th>No.</th><th>Type</th><th>Counterparty</th><th>Total</th><th>Drawer</th></tr></thead>
    <tbody>${txnRows || '<tr><td colspan="5">No transactions</td></tr>'}</tbody>
  </table>

  <h2>Audit (voided)</h2>
  <table>
    <thead><tr><th>Internal ID</th><th>Voided</th><th>Total</th><th>Successor</th></tr></thead>
    <tbody>${auditRows || '<tr><td colspan="4">No voided transactions</td></tr>'}</tbody>
  </table>
</body></html>`
}

/** Save the report as a downloadable file (the shopkeeper picks the location). */
export function downloadEodReport(day: BusinessDay, txns: Txn[], inventory: InventoryRow[]): void {
  const html = buildEodReportHtml(day, txns, inventory)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vajra-eod-${day.startDate}.html`
  a.click()
  URL.revokeObjectURL(url)
}
