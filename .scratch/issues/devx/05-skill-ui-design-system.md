Status: needs-triage

## DevX: Agent skill for UI design and using the design system right

Create an agent skill that codifies how to build UI in Vajra:

- Use shadcn-vue components as the base — don't hand-roll buttons, cards, inputs, etc.
- How to add new shadcn-vue components (`pnpm dlx shadcn-vue@latest add ...`).
- The Tailwind v4 + electron-vite config shape (no symlinks, use `vite.config.ts` for tooling only).
- Telugu font stack and glyph rendering expectations.
- Accessibility: `data-testid` conventions, keyboard navigation, ARIA roles.
- When to use Tooltip, Badge, Dialog, Select, Combobox patterns.

Should prevent agents from inventing bespoke styling or ignoring the design system.
