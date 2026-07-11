import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Electron IPC wraps thrown errors as:
 * `Error invoking remote method 'channel': Error: actual message`
 * Strip the wrapper so cashiers see the domain reason only.
 */
export function userFacingError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const match = raw.match(/Error invoking remote method '[^']+': Error: ([\s\S]+)$/)
  const message = (match?.[1] ?? raw).trim()
  return message || fallback
}
