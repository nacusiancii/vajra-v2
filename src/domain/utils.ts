export function isNameTaken(
  name: string,
  existing: Array<{ id: number; name: string }>,
  excludeId?: number
): boolean {
  const lower = name.trim().toLowerCase()
  return existing.some((e) => e.id !== excludeId && e.name.toLowerCase() === lower)
}
