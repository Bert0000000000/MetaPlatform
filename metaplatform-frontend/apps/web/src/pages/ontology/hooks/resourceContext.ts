/** Cross-page resource context contains identifiers only. Never accept external return URLs. */
export function safeReturnTo(
  value: string | null | undefined,
): string | undefined {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return undefined;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\u0000-\u0020]/.test(decoded))
      return undefined;
  } catch {
    return undefined;
  }
  const url = new URL(value, 'https://workspace.invalid');
  if (url.origin !== 'https://workspace.invalid') return undefined;
  return `${url.pathname}${url.search}${url.hash}`;
}
export function resourceUrl(
  path: string,
  typeRef: string,
  returnTo?: string,
  changeRef?: string,
): string {
  const params = new URLSearchParams({ typeRef });
  const back = safeReturnTo(returnTo);
  if (back) params.set('returnTo', back);
  if (changeRef) params.set('changeRef', changeRef);
  if (path.startsWith('/ontology/explore/')) params.set('class', typeRef);
  return `${path}?${params}`;
}
