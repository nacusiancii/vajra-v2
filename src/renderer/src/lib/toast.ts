/**
 * Minimal global toast — success/error feedback without a third-party toaster.
 * Hosted once in App.vue; call showToast from any view.
 */

import { ref, readonly, type DeepReadonly, type Ref } from 'vue'

export type ToastKind = 'success' | 'error'

export interface ToastState {
  message: string
  kind: ToastKind
  visible: boolean
}

const state = ref<ToastState>({
  message: '',
  kind: 'success',
  visible: false
})

let hideTimer: ReturnType<typeof setTimeout> | null = null

const DEFAULT_MS = 4_500

/** Show a short toast; replaces any currently visible toast. */
export function showToast(message: string, kind: ToastKind = 'success', ms = DEFAULT_MS): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  state.value = { message, kind, visible: true }
  hideTimer = setTimeout(() => {
    state.value = { ...state.value, visible: false }
    hideTimer = null
  }, ms)
}

export function useToastState(): DeepReadonly<Ref<ToastState>> {
  return readonly(state)
}
