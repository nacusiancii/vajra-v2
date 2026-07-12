# Security Policy

## Supported versions

Vajra is an offline, single-machine desktop app. Only the latest commit on
`main` is supported for security fixes.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Prefer one of:

1. **GitHub private vulnerability reporting** (Security tab → Report a
   vulnerability), if enabled on this repository.
2. Contact the maintainer privately via the method listed on their
   [GitHub profile](https://github.com/nacusiancii).

Include enough detail to reproduce the issue. You should receive an
acknowledgement when the report is seen; timelines depend on severity and
maintainer availability.

## Scope notes

- Vajra has no built-in user authentication (see docs/adr/0002). Physical access
  to the machine is the trust boundary.
- Reports that require already controlling the local OS user are usually
  out of scope unless they escalate beyond that boundary in an unexpected way.
