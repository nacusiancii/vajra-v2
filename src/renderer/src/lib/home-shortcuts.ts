export const HOME_SHORTCUTS = [
  { key: '1', to: '/sale?mode=cash' },
  { key: '2', to: '/sale?mode=credit' },
  { key: '3', to: '/purchase?mode=cash' },
  { key: '4', to: '/purchase?mode=credit' },
  { key: '5', to: '/receipt' },
  { key: '6', to: '/payment' },
  { key: '7', to: '/transactions' },
  { key: '8', to: '/inventory' }
] as const

const BLOCKED_TARGET =
  'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="dialog"], [data-slot="dialog-content"], [data-slot="popover-content"], [data-slot="select-content"]'

/** True when a Home digit shortcut must not fire (modifiers, repeat, or a typing/overlay target). */
export function isShortcutBlocked(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return true
  const el = event.target
  if (!(el instanceof Element)) return false
  return el.closest(BLOCKED_TARGET) != null
}
