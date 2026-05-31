import { useRouter } from 'vue-router'
import { isTxnWindow } from './window'

/**
 * What "leaving" a transaction screen means depends on where it lives.
 * In a standalone transaction window, finishing or cancelling closes the window
 * (the hub refreshes on focus). In the main window it falls back to the ledger.
 */
export function useTransactionExit(): () => void {
  const router = useRouter()
  return () => {
    if (isTxnWindow) {
      void window.api.closeCurrentWindow()
    } else {
      void router.push('/transactions')
    }
  }
}
