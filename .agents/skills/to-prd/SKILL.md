---
name: to-prd
description: Package already-decided work into one shared PRD when an idea is ready to fan out into multiple related tasks. Not a substitute for exploration — use once research/prototyping/discussion already happened and the user wants it written up for implementation.
---

# /to-prd — molehill in, mountain out

_This skill's process still bakes research → decide → interview into one flow. Now that exploration lives upstream (see AGENTS.md's "Design & exploration"), by the time this runs the thinking has usually already happened elsewhere — steps 1–4 below probably want a trim to assume that rather than re-deriving it. Flag it if the grilling reflex kicks in here instead of just writing up what's already decided._

Input: an issue number (`/to-prd 75`), a raw one-liner (`/to-prd "sell loose by kg"`), or nothing (use the current conversation). Output: a PRD published to the issue tracker that an implementing agent can execute **without asking a single question**.

The reader is an agent with zero conversation context. Every decision it would otherwise have to guess at must already be made and written down.

## Process

1. **Collect the molehill.** For an issue: fetch the body AND every comment — comments regularly override the body, newest wins. (`gh issue view` can fail on repos with Projects-classic; fall back to `gh api repos/{owner}/{repo}/issues/N` and `.../issues/N/comments`.) For a raw idea: the user's sentence is the molehill, verbatim.

2. **Research until the decisions get cheap.** Read `CONTEXT.md` (use its vocabulary exactly; missing term = flag it as NEW, don't invent a synonym), the ADRs touching this area, and the actual code seams — name the real modules that change, verified by reading them, not guessed from file names. Check prior art in the test suites. A PRD that names the wrong seams is worse than no PRD.

3. **Make every call.** Each fork in the design becomes a numbered Decision: the chosen path, the strongest rejected alternative, and why. If a decision contradicts an ADR or the glossary, say so explicitly in the Decision — never silently override (repo rule). It is fine — encouraged — for a Decision to push back on the issue itself when the codebase argues otherwise.

4. **One interview round, maximum.** If research leaves forks that are genuinely the user's to own (product behaviour, scope, money rules), ask ONE compact multiple-choice round — at most 4 questions, recommended option first. Everything else: decide yourself and record it under **Vetoable defaults**. Never a second round; unanswered = take the recommended option.

5. **Publish to the tracker.** Existing issue → rewrite the issue body as the PRD, with the original text preserved verbatim in the Molehill quote at top. Raw idea → create a new issue. Apply the `ready-for-agent` label. The tracker is the PRD's only home — nothing goes in `docs/`.

## Template

```markdown
> **Molehill:** <the original one-liner / issue text, verbatim>

## Problem

2–4 sentences from the cashier's or shopkeeper's chair. No solution language.

## Vocabulary

| Term | Status | Meaning |
Statuses: existing (cite CONTEXT.md), **NEW**, **retired**. NEW and retired
terms are flagged for `/grill-with-docs` promotion — the PRD does not edit
the glossary itself.

## Decisions

D1..Dn. Chosen path, strongest rejected alternative, why. Include data-shape
and unit decisions (money in paise, mass in grams). This section is the
mountain — a good PRD is mostly Decisions.

## Out of scope

What a keen agent might reasonably do here but must not.

## Tests

Few, high-value (per AGENTS.md): the domain invariants worth a unit test and
the counter flow worth a smoke. Name prior-art specs to imitate. No tests
that restate the implementation.

## Acceptance

Checkboxes an agent can self-verify: `pnpm fix` clean, CI green on push, plus
the named behaviours observable in the named smokes.

## Vetoable defaults

Decisions made without asking. Veto by commenting on the issue before or
during implementation.
```

## Qualities to hold

- **Decisions over stories.** No user-story inventories, no personas, no boilerplate. If a section would not change what the implementing agent types, delete it.
- **Mountain ≠ padding.** Exhaustive on decisions, edge cases, and conflicts; terse everywhere else.
- **No file paths or code in Decisions** — they rot. Exception: a snippet that encodes a decision more precisely than prose (schema, type shape, breakpoint table). Trim to the decision-rich part.
