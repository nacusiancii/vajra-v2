import { nextTick, ref, type Ref } from 'vue'
import type { SavePdfResult } from '@shared/api'
import { useSavePdf } from '@/queries/operations'
import { showToast } from '@/lib/toast'

/**
 * Print-to-PDF jobs for a finish screen (ADR-0012). For each job the caller's
 * template mounts the matching `.print-root` while `printing` equals its kind;
 * the main process then snapshots the window into that job's PDF.
 */
export function usePrintToPdf<K extends string>(): {
  printing: Ref<K | null>
  results: Ref<SavePdfResult[]>
  saveAll: (jobs: { kind: K; filename: string }[]) => Promise<boolean>
} {
  const printing = ref<K | null>(null) as Ref<K | null>
  const results = ref<SavePdfResult[]>([])
  const savePdf = useSavePdf()

  /**
   * Save every job in order. On success, toast where the files went and return
   * true; on any failure return false and leave the errors in `results`.
   */
  async function saveAll(jobs: { kind: K; filename: string }[]): Promise<boolean> {
    if (printing.value) return false
    results.value = []
    try {
      for (const job of jobs) {
        printing.value = job.kind
        await nextTick()
        try {
          results.value.push(await savePdf.mutateAsync(job.filename))
        } catch (err) {
          results.value.push({
            ok: false,
            error: err instanceof Error ? err.message : 'Could not save PDF'
          })
        }
      }
    } finally {
      printing.value = null
    }
    const saved = results.value.flatMap((r) => (r.ok ? [r.path] : []))
    if (saved.length !== jobs.length) return false
    const folder = saved[0]?.split(/[/\\]/).slice(-2, -1)[0] ?? ''
    showToast(`Saved ${saved.length === 1 ? 'PDF' : `${saved.length} PDFs`} to ${folder}`)
    return true
  }

  return { printing, results, saveAll }
}
