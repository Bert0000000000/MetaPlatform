type FieldAliases = Readonly<Record<string, string>>;

/** Copies only declared top-level aliases; nested business values remain opaque. */
export function aliasFields<T>(raw: T, aliases: FieldAliases): T {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const source = raw as Record<string, unknown>;
  const result = { ...source };
  for (const [sourceKey, targetKey] of Object.entries(aliases)) {
    if (result[targetKey] === undefined && source[sourceKey] !== undefined) {
      result[targetKey] = source[sourceKey];
    }
  }
  return result as T;
}

/** Retains the existing array or items envelope and aliases each DTO once. */
export function aliasListFields<T>(raw: T, aliases: FieldAliases): T {
  if (Array.isArray(raw)) return raw.map((item) => aliasFields(item, aliases)) as T;
  if (raw !== null && typeof raw === 'object' && 'items' in raw && Array.isArray(raw.items)) {
    return { ...raw, items: raw.items.map((item) => aliasFields(item, aliases)) } as T;
  }
  return raw;
}
