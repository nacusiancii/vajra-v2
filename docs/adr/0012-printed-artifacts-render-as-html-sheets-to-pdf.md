### Printed artifacts render as HTML sheets; PDF until the printer arrives

Status: accepted.

The Quotation and the Credit Voucher are drawn as Vue components sized to the real paper — a **10 cm × 21 cm upright sheet** — and printed by Chromium from the app window. The same component is the on-screen preview and the printed page, so the screen and the paper cannot disagree. A CSS `@page` rule sets the paper size; only a `.print-root` element mounted for the print call reaches the page, one child per page (one page per copy).

The shop's printer is a normal office printer, not a thermal roll: the Credit Voucher is proof of credit and has to last. We assume it prints both sides (duplex), so the voucher's back is just page 2 and the cashier is never asked to flip the sheet. The Quotation is upright; the voucher is the same paper landscape (a named CSS page, `@page voucher`), with the stub on the left of the front. The sheet turns over sideways (duplex "flip on short edge" for landscape), so on the back the stub strip is on the right; it stays blank and the perforation is printed on both sides.

Until that printer is bought, **printing means saving a PDF**: the main process calls `printToPDF`, writes the file to `~/Documents/VajraPrints` (overridable with `VAJRA_PRINT_DIR`), and opens it in the system viewer. Like the End of Day Report (ADR-0001), the PDF lives outside Vajra's owned data; Vajra never reads it back.

We chose HTML over a printer command language (ESC/POS, raw text) because the papers are layout-heavy (a pre-printed-pad lookalike, Telugu, a QR code, a two-sided voucher), Electron already ships a renderer with good Telugu shaping, and PDF works with no printer at all. Switching to a real printer later is a different sink for the same page, not a rewrite.

#### Consequences

- Telugu is shaped by Chromium with the bundled Noto Sans Telugu font, not by the printer (amends ADR-0003).
- **Departs from ADR-0008 for now:** ADR-0008 commits a Sale only after the printer driver acknowledges the job. A PDF has no driver, so today the Sale commits at finish and the PDFs are saved when the cashier presses "Print & finish"; a failed save offers "Continue without PDF". When the printer arrives, the silent-print path (`webContents.print` to the printer chosen in Settings) should restore ADR-0008's commit-after-acknowledgement order and its "printer not responding" prompt.
- Printerless Mode is a real toggle again, **off by default**. The finish screen's "Print & finish" saves the PDFs, then returns Home; with Printerless Mode on it shows the papers for hand-copying and saves nothing. The setting was renamed (`printerlessMode` → `printerless`) so the value the old lock forced into every saved row is ignored.
- A Credit Sale's Quotation (print or not, one or two copies) defaults from Settings; the cashier can still change it on the finish screen.
- The Credit Voucher and the Quotation are separate PDFs (separate print jobs), so on a duplex printer a Quotation never lands on the back of a voucher.
- The voucher's UPI QR is generated in the app from the UPI ID in Settings (the `qrcode` library, drawn as inline SVG so it is ready when the page is captured). No uploaded image.
- A voucher back holds about 15 product lines before it overflows the sheet; a longer cart is clipped. Issue #19 (max line items) is where that limit belongs.
- Paper sizes live in two CSS rules. If the bought printer needs a different size, that rule and the sheet components change, nothing else.
