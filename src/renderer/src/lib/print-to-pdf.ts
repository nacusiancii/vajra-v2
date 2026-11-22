import { nextTick, ref, type Ref } from 'vue'
import type { SavePdfResult } from '@shared/api'
import { useSavePdf } from '@/queries/operations'

/**
 * Print-to-PDF jobs for a finish screen (ADR-0012). For each job the caller's
 * template mounts the matching `.print-root` while `printing` equals its kind;
 * the main process then snapshots the window into that job's PDF.
 */
export function usePrintToPdf<K extends string>(): {
  printing: Ref<K | null>
  results: Ref<SavePdfResult[]>
  save: (jobs: { kind: K; filename: string }[]) => Promise<void>
} {
  const printing = ref<K | null>(null) as Ref<K | null>
  const results = ref<SavePdfResult[]>([])
  const savePdf = useSavePdf()

  async function save(jobs: { kind: K; filename: string }[]): Promise<void> {
    if (printing.value) return
    results.value = []
    try {
      for (const job of jobs) {
        printing.value = job.kind
        await nextTick()
        results.value.push(await savePdf.mutateAsync(job.filename))
      }
    } finally {
      printing.value = null
    }
  }

  return { printing, results, save }
}
