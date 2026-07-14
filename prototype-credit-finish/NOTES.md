# Prototype: Credit Sale finish dual-panel layouts

**Issue:** [#115](https://github.com/nacusiancii/vajra-v2/issues/115) (explores [#78](https://github.com/nacusiancii/vajra-v2/issues/78))

## Question

> What should the Credit Sale **finish** surface look like with two full previews (Sale Invoice + Credit Voucher) instead of one invoice and a folded voucher line?

## One-line plan

Three structurally different finish dialogs on a throwaway route (`#/prototype/credit-finish?variant=A|B|C`), mock Credit Sale data, floating PrototypeSwitcher in dev — screenshot before + each variant for human pick.

## How to run (one command path)

```bash
pnpm dev:linux
```

Then open the app and navigate to:

- `#/prototype/credit-finish` (defaults to **A**)
- `#/prototype/credit-finish?variant=B`
- `#/prototype/credit-finish?variant=C`

Arrow keys / bottom bar cycle variants (dev only; hidden in production builds).

### Screenshots only (opt-in Playwright)

```bash
PROTOTYPE_SCREENSHOTS=1 pnpm test:smoke:headless -- tests/smoke/prototype-credit-finish-screenshots.spec.ts
```

Writes PNGs into `prototype-credit-finish/screenshots/`. Marked prototype / opt-in — not part of default CI smoke.

## Variants

| Key   | Name                                   | Structure                                                               |
| ----- | -------------------------------------- | ----------------------------------------------------------------------- |
| **A** | Side-by-side equal columns             | Wide dialog: Invoice \| Voucher grid; shared print footer               |
| **B** | Stacked tabs / steps                   | Narrow density: full-width one artifact at a time; step 1/2 tabs + Next |
| **C** | Master-detail (invoice + voucher rail) | Invoice primary + amber voucher secondary rail (expand for back)        |

Each surfaces #78 controls: invoice **customer copy** checkbox (default on); **business copy** locked on; voucher **will print** locked; Sale Number + Voucher Number both visible (mock equal `3`).

## Screenshots

| File                              | Caption                                                                  |
| --------------------------------- | ------------------------------------------------------------------------ |
| `screenshots/00-before.png`       | Today’s single-panel finish (`SlipPreview`) — voucher folded to one line |
| `screenshots/A-side-by-side.png`  | Variant A                                                                |
| `screenshots/B-stacked-tabs.png`  | Variant B                                                                |
| `screenshots/C-master-detail.png` | Variant C                                                                |

## Constraints respected

- Glossary: Sale Invoice, Credit Voucher, Sale Number, Voucher Number, Credit Sale, Printerless Mode
- Money = integer paise; mass = grams in mock lines
- No #81/#82 numbering implementation (mock equal numbers)
- No production finish rewrite; Cash Sale path untouched
- Voucher pre-finish sign/print-once gate unchanged (this surface is finish-time dual preview only)

## Verdict

**(human TBD)** — pick A / B / C (or mashup) after reviewing screenshots / running the prototype.
