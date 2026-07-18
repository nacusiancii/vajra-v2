# Prototype: Credit Sale finish — optional invoice print (C-iteration)

**Issue:** [#115](https://github.com/nacusiancii/vajra-v2/issues/115) (explores [#78](https://github.com/nacusiancii/vajra-v2/issues/78))

## Question

> On Variant C’s layout, how should Credit Sale finish present **optional Sale Invoice printing** (with a compact multi-copy control like **2x**) while the **Credit Voucher stays locked / always prints**?

## One-line plan

Keep C’s asymmetric master-detail shell; rewrite header copy (voucher = locked signed paper; invoice = optional); three structurally different print-control treatments (`C1|C2|C3`). **Winner lean: C1** with the refined minimal Print Queue below.

## Product rules under exploration

| Artifact       | Rule                                                                 |
| -------------- | -------------------------------------------------------------------- |
| Credit Voucher | Non-negotiable · always will-print · locked · signed secondary paper |
| Sale Invoice   | **Optional** · cashier may skip all invoice copies                   |
| Invoice copies | When invoice on: **1x or 2x** (not separate always-on business row)  |

### Defaults (stated for review)

- **Invoice default: OFF** (unchecked) — opt-in.
- **Copies when enabled: 2x** pressed by default — opt-out (one click → 1x).
- Voucher always locked (shown on amber rail, **not** as a Print Queue decision).

### Print Queue (winning C1 — simplified)

```
Print queue
[ ] Print invoice   [2x]
```

- Checkbox label: **Print invoice** (opt-in, default unchecked).
- Tag always reads **2x** (not cycling 1x/2x text); pressed = 2 copies, unpressed = 1 copy.
- **No** business/master “always prints” row — cashiers already know the master copy story; don’t restate it here.
- **No** locked Credit Voucher row in Print Queue — the amber voucher rail already says will-print; Print Queue only holds real decisions.

## ADR tension (do not edit ADRs in this flight)

**ADR-0008** currently states every Sale produces a Sale Invoice with **business copy always** and customer copy default-on with opt-out. This prototype **explicitly explores a product fork** for **Credit Sale only**: invoice may be omitted entirely (voucher is enough paper for the counter). Production must not silently adopt this without an ADR update if/when a winner ships.

## How to run

```bash
pnpm dev:linux
```

Navigate to:

- `#/prototype/credit-finish?variant=C1` (default if bare route) — **winning print treatment**
- `#/prototype/credit-finish?variant=C2`
- `#/prototype/credit-finish?variant=C3`

Arrow keys / bottom PrototypeSwitcher cycle variants (dev only).

Legacy keys `A|B|C` remain for prior shell comparison (`C` maps to C1 print controls).

### Screenshots only (opt-in Playwright)

```bash
PROTOTYPE_SCREENSHOTS=1 pnpm test:smoke:headless -- tests/smoke/prototype-credit-finish-screenshots.spec.ts
```

Writes PNGs into `prototype-credit-finish/screenshots/`. Committed on the draft PR so review does not need local Electron. Not part of default CI smoke.

## Variants (C shell + print-control structure)

| Key    | Name                          | Print-control structure                                                                 | Invoice-off preview                                         |
| ------ | ----------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **C1** | Checkbox + compact **2x** tag | `[ ] Print invoice` + **`2x`** opt-out tag (pressed=2, off=1; dim when invoice off)     | Dim invoice + **Not printing** badge (column stays)         |
| **C2** | Segmented No \| 1 \| 2        | Single segmented control: **No invoice \| 1 copy \| 2 copies**; voucher locked below    | **Hides** invoice column; voucher-forward single stack      |
| **C3** | Voucher-first + optional chip | Locked voucher hero first; **Add Sale Invoice?** chip → ± stepper pill (1x–2x) + Remove | Dim invoice + **Not printing** (controls lead with voucher) |

All keep: master-detail frame (invoice panel + amber voucher rail) when invoice column is shown.
Print controls sit **above** the invoice preview so the control treatment is visible without scrolling.

## Screenshots (local only)

| File                                    | Caption                                 |
| --------------------------------------- | --------------------------------------- |
| `screenshots/C1-checkbox-2x-tag.png`    | C1 default (invoice off)                |
| `screenshots/C1-invoice-on-2x.png`      | C1 invoice checked, 2x tag pressed      |
| `screenshots/C1-invoice-on-1x.png`      | C1 invoice checked, 2x tag unselected   |
| `screenshots/C2-segmented-no-1-2.png`   | C2 default (No invoice → layout reflow) |
| `screenshots/C2-invoice-2-copies.png`   | C2 with 2 copies selected               |
| `screenshots/C3-voucher-first-chip.png` | C3 default (chip off)                   |
| `screenshots/C3-invoice-chip-on.png`    | C3 chip opened + stepper                |

Prior flight PNGs (`00-before`, `A/B/C-*.png`) may still exist locally; not re-captured this iteration.

## Constraints respected

- Glossary: Sale Invoice, Credit Voucher, Sale Number, Voucher Number, Credit Sale
- Money = integer paise; mass = grams in mock lines
- No #81/#82 numbering implementation
- No production finish rewrite; no ADR / CONTEXT edits

## Verdict

**C1 lean (human-confirmed UX direction)** — minimal Print Queue:

`[ ] Print invoice` (opt-in) + `2x` tag (opt-out). No master-copy always-prints restatement; voucher decision stays on the amber rail.

C2 / C3 remain for side-by-side comparison only.

---

## Handoff summary

| Item             | Value                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Variant keys     | **C1**, **C2**, **C3** (default route → C1)                                                                   |
| Shell            | Variant C master-detail (`VariantCMasterDetail.vue`)                                                          |
| Winning print UX | C1 — `[ ] Print invoice` + `2x` opt-out tag                                                                   |
| Route            | `#/prototype/credit-finish?variant=C1\|C2\|C3`                                                                |
| Dev              | `pnpm dev:linux` then hash above                                                                              |
| Screenshots cmd  | `PROTOTYPE_SCREENSHOTS=1 pnpm test:smoke:headless -- tests/smoke/prototype-credit-finish-screenshots.spec.ts` |
| PNG dir          | `prototype-credit-finish/screenshots/` (committed on draft PR)                                                |
| Branch           | `grok/proto-78` (PR #116) · local worktree may be `grok/proto-78c`                                            |

### Files touched (source)

- `src/renderer/src/views/prototype/CreditFinishPrototype.vue`
- `src/renderer/src/views/prototype/credit-finish/VariantCMasterDetail.vue`
- `src/renderer/src/views/prototype/credit-finish/PrintControlsC1.vue` (**refined**)
- `src/renderer/src/views/prototype/credit-finish/PrintControlsC2.vue`
- `src/renderer/src/views/prototype/credit-finish/PrintControlsC3.vue`
- `src/renderer/src/views/prototype/credit-finish/usePrintInvoiceState.ts`
- `tests/smoke/prototype-credit-finish-screenshots.spec.ts`
- `prototype-credit-finish/NOTES.md`
