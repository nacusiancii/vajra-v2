/**
 * EOD export basename helpers — kept off `eod-xlsx.ts` so the main process can
 * validate the write path without `require('exceljs')`.
 *
 * ExcelJS is renderer-bundled. Main only writes the bytes. Pulling ExcelJS into
 * main made the Windows asar need nested `util-deprecate` (pnpm + electron-builder
 * 26.8.1 drops it) and the installed app crashed on launch (#187).
 */

/**
 * Filename for a silent EOD export — `{yyyy-mm-dd_HH-mm-ss}_eod_report.xlsx`.
 * Uses **local wall clock of export**, not the Business Day startDate.
 */
export function eodReportFilename(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const yyyy = now.getFullYear()
  const mm = pad(now.getMonth() + 1)
  const dd = pad(now.getDate())
  const HH = pad(now.getHours())
  const MM = pad(now.getMinutes())
  const ss = pad(now.getSeconds())
  return `${yyyy}-${mm}-${dd}_${HH}-${MM}-${ss}_eod_report.xlsx`
}

/** Safe basename pattern for main-process write (path segments rejected). */
export const EOD_REPORT_FILENAME_RE = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_eod_report\.xlsx$/
