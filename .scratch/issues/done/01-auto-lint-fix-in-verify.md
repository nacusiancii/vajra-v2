Status: needs-triage

## DevX: Automatically lint-fix in pnpm verify

`pnpm verify` currently runs typecheck, unit tests, and smoke tests. It should also run lint with auto-fix so that formatting and lint issues are caught and corrected in the same pass. Consider whether lint-fix should run before typecheck (fix first, then verify) or as a separate step.
