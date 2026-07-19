import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { defaultEodExportDir, writeEodReportFile } from '../../../src/main/eod-export'

describe('defaultEodExportDir', () => {
  it('is Documents/VajraExports under home', () => {
    expect(defaultEodExportDir('/home/shop')).toBe(
      path.join('/home/shop', 'Documents', 'VajraExports')
    )
  })
})

describe('writeEodReportFile', () => {
  it('creates the folder and writes a real .xlsx basename under an injected dir', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vajra-eod-write-'))
    try {
      const filename = '2026-05-23_14-07-09_eod_report.xlsx'
      // Minimal non-empty payload (not a real workbook — write path only)
      const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01])
      const result = writeEodReportFile(bytes, filename, dir)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.path).toBe(path.join(dir, filename))
      expect(fs.existsSync(result.path)).toBe(true)
      expect(fs.statSync(result.path).size).toBe(bytes.byteLength)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects path-like filenames', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vajra-eod-write-'))
    try {
      const result = writeEodReportFile(new Uint8Array([1]), '../escape_eod_report.xlsx', dir)
      expect(result.ok).toBe(false)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects empty bytes', () => {
    const result = writeEodReportFile(
      new Uint8Array([]),
      '2026-05-23_14-07-09_eod_report.xlsx',
      '/tmp'
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/empty/i)
  })
})
