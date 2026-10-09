/** Backend family identity: tenant + terminal slug, for current and legacy RIDs. */
export function objectTypeFamily(rid: string): string {
  const parts = rid.split('.');
  return JSON.stringify([
    parts[1] || '',
    parts.length >= 6 ? parts[4] : parts.length >= 4 ? parts[3] : rid,
  ]);
}
