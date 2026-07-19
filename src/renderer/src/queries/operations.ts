import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationReturnType,
  type UseQueryReturnType
} from '@tanstack/vue-query'
import type { BusinessDay, InventoryRow } from '@domain/transaction'
import type { AppSettings } from '@domain/settings'

const KEYS = {
  inventory: ['inventory'] as const,
  businessDay: ['businessDay'] as const,
  settings: ['settings'] as const,
  transactions: ['transactions'] as const
}

export function useInventoryQuery(): UseQueryReturnType<InventoryRow[], Error> {
  return useQuery({ queryKey: KEYS.inventory, queryFn: () => window.api.inventory() })
}

export function useBusinessDayQuery(): UseQueryReturnType<BusinessDay, Error> {
  return useQuery({ queryKey: KEYS.businessDay, queryFn: () => window.api.currentBusinessDay() })
}

/** Change open Business Day startDate (empty day only — no finished txns, no Drafts). */
export function useUpdateOpenBusinessDayStartDate(): UseMutationReturnType<
  BusinessDay,
  Error,
  string,
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (startDate: string) => window.api.updateOpenBusinessDayStartDate(startDate),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.businessDay })
    }
  })
}

export function useApproveRollover(): UseMutationReturnType<BusinessDay, Error, string, unknown> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (nextStartDate: string) => window.api.approveRollover(nextStartDate),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.businessDay })
      void qc.invalidateQueries({ queryKey: KEYS.inventory })
      void qc.invalidateQueries({ queryKey: KEYS.transactions })
    }
  })
}

export function useSettingsQuery(): UseQueryReturnType<AppSettings, Error> {
  return useQuery({ queryKey: KEYS.settings, queryFn: () => window.api.getSettings() })
}

export function useUpdateSettings(): UseMutationReturnType<
  AppSettings,
  Error,
  AppSettings,
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (settings: AppSettings) => window.api.updateSettings(settings),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.settings })
  })
}
