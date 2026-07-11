import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationReturnType,
  type UseQueryReturnType
} from '@tanstack/vue-query'
import type {
  CreateMoneyTxnInput,
  CreatePurchaseInput,
  CreateSaleInput,
  CreateStockTransferInput,
  Txn
} from '@domain/transaction'
import type { Draft, DraftType, SaveSaleDraftInput } from '@domain/draft'
import type { MoneyTxnType } from '@shared/api'

const KEYS = {
  transactions: ['transactions'] as const,
  inventory: ['inventory'] as const,
  businessDay: ['businessDay'] as const,
  drafts: ['drafts'] as const
}

export function useTransactionsQuery(): UseQueryReturnType<Txn[], Error> {
  return useQuery({
    queryKey: KEYS.transactions,
    queryFn: () => window.api.listTransactions()
  })
}

/** Every mutation invalidates the ledger, the projection, and the day in one place. */
function invalidateAll(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: KEYS.transactions })
  void qc.invalidateQueries({ queryKey: KEYS.inventory })
  void qc.invalidateQueries({ queryKey: KEYS.businessDay })
}

export function useCreateSale(): UseMutationReturnType<Txn, Error, CreateSaleInput, unknown> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSaleInput) => window.api.createSale(input),
    onSuccess: () => invalidateAll(qc)
  })
}

export function useEditSale(): UseMutationReturnType<
  Txn,
  Error,
  { id: string; input: CreateSaleInput },
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateSaleInput }) =>
      window.api.editSale(id, input),
    onSuccess: () => invalidateAll(qc)
  })
}

export function useCreatePurchase(): UseMutationReturnType<
  Txn,
  Error,
  CreatePurchaseInput,
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePurchaseInput) => window.api.createPurchase(input),
    onSuccess: () => invalidateAll(qc)
  })
}

export function useEditPurchase(): UseMutationReturnType<
  Txn,
  Error,
  { id: string; input: CreatePurchaseInput },
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreatePurchaseInput }) =>
      window.api.editPurchase(id, input),
    onSuccess: () => invalidateAll(qc)
  })
}

export function useCreateStockTransfer(): UseMutationReturnType<
  Txn,
  Error,
  CreateStockTransferInput,
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStockTransferInput) => window.api.createStockTransfer(input),
    onSuccess: () => invalidateAll(qc)
  })
}

export function useEditStockTransfer(): UseMutationReturnType<
  Txn,
  Error,
  { id: string; input: CreateStockTransferInput },
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateStockTransferInput }) =>
      window.api.editStockTransfer(id, input),
    onSuccess: () => invalidateAll(qc)
  })
}

export function useCreateMoneyTxn(): UseMutationReturnType<
  Txn,
  Error,
  { type: MoneyTxnType; input: CreateMoneyTxnInput },
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ type, input }: { type: MoneyTxnType; input: CreateMoneyTxnInput }) =>
      window.api.createMoneyTxn(type, input),
    onSuccess: () => invalidateAll(qc)
  })
}

export function useEditMoneyTxn(): UseMutationReturnType<
  Txn,
  Error,
  { id: string; type: MoneyTxnType; input: CreateMoneyTxnInput },
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      type,
      input
    }: {
      id: string
      type: MoneyTxnType
      input: CreateMoneyTxnInput
    }) => window.api.editMoneyTxn(id, type, input),
    onSuccess: () => invalidateAll(qc)
  })
}

// ── Drafts (outside the ledger — only invalidate the drafts list) ────────────

function invalidateDrafts(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: KEYS.drafts })
}

export function useDraftsQuery(type?: DraftType): UseQueryReturnType<Draft[], Error> {
  return useQuery({
    queryKey: [...KEYS.drafts, type ?? 'all'] as const,
    queryFn: () => window.api.listDrafts(type)
  })
}

export function useSaveSaleDraft(): UseMutationReturnType<
  Draft,
  Error,
  SaveSaleDraftInput,
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveSaleDraftInput) => window.api.saveSaleDraft(input),
    onSuccess: () => invalidateDrafts(qc)
  })
}

export function useClearDraft(): UseMutationReturnType<void, Error, number, unknown> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => window.api.clearDraft(id),
    onSuccess: () => invalidateDrafts(qc)
  })
}
