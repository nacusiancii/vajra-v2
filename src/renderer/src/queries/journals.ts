import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationReturnType,
  type UseQueryReturnType
} from '@tanstack/vue-query'
import type { CreateJournalInput, DayEntry, Journal } from '@domain/journal'

const KEYS = {
  dayEntries: ['dayEntries'] as const
}

export function useDayEntriesQuery(): UseQueryReturnType<DayEntry[], Error> {
  return useQuery({
    queryKey: KEYS.dayEntries,
    queryFn: () => window.api.listDayEntries()
  })
}

/** Journal writes are notes — invalidate the day-list only, never inventory. */
function invalidateDayEntries(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: KEYS.dayEntries })
}

export function useCreateJournal(): UseMutationReturnType<
  Journal,
  Error,
  CreateJournalInput,
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateJournalInput) => window.api.createJournal(input),
    onSuccess: () => invalidateDayEntries(qc)
  })
}

export function useEditJournal(): UseMutationReturnType<
  Journal,
  Error,
  { id: number; input: CreateJournalInput },
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: CreateJournalInput }) =>
      window.api.editJournal(id, input),
    onSuccess: () => invalidateDayEntries(qc)
  })
}

export function useCancelJournal(): UseMutationReturnType<void, Error, number, unknown> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => window.api.cancelJournal(id),
    onSuccess: () => invalidateDayEntries(qc)
  })
}
