import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationReturnType,
  type UseQueryReturnType
} from '@tanstack/vue-query'
import type { BusinessDay, InventoryRow, Txn } from '@domain/transaction'
import type { AppSettings } from '@domain/settings'
import type { EodExportResult } from '@shared/api'
import { buildEodReportXlsx, eodReportFilename } from '@shared/eod-xlsx'

const KEYS = {
  inventory: ['inventory'] as const,
  businessDay: ['businessDay'] as const,
  settings: ['settings'] as const,
  transactions: ['transactions'] as const,
  dayEntries: ['dayEntries'] as const
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
      void qc.invalidateQueries({ queryKey: KEYS.dayEntries })
    }
  })
}

export interface ExportEodReportInput {
  day: BusinessDay
  txns: Txn[]
  inventory: InventoryRow[]
  now?: Date
}

/**
 * End of Day Report export (ADR-0006).
 * Builds the multi-sheet workbook in the renderer, asks main to write it under
 * the silent export folder (no save dialog), then records the export watermark
 * so Approve Rollover may unlock. The watermark lives on the Business Day, so a
 * successful export invalidates that query here — callers never do it by hand.
 *
 * Resolves to `{ ok: false, error }` instead of throwing so the counter UI can
 * show one toast for both build and write failures.
 */
export function useExportEodReport(): UseMutationReturnType<
  EodExportResult,
  Error,
  ExportEodReportInput,
  unknown
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      day,
      txns,
      inventory,
      now = new Date()
    }: ExportEodReportInput): Promise<EodExportResult> => {
      try {
        const buffer = await buildEodReportXlsx(day, txns, inventory)
        const filename = eodReportFilename(now)
        const result = await window.api.exportEodReport({ data: buffer, filename })
        if (result.ok) await window.api.recordEodExport()
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not build export'
        return { ok: false, error: message }
      }
    },
    onSuccess: async (result) => {
      if (result.ok) await qc.invalidateQueries({ queryKey: KEYS.businessDay })
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
