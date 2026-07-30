import pathlib
p = pathlib.Path('packages/shared/src/hooks/useApiErrorBoundary.ts')
t = p.read_text(encoding='utf-8-sig')

# Use a delimiter-free approach: split on unique anchors and rejoin.
import re
m = re.search(r'  if \(isApiError\(err\)\) \{[\s\S]+?  \}', t)
if not m:
    print('MISS BLOCK')
    raise SystemExit(1)

old = m.group(0)
new = """  if (isApiError(err)) {
    const e = err as BizError | HttpError;
    const bizCode = (e as BizError).code;
    const httpStatus = (e as HttpError).status;
    const code: string = String(bizCode ?? `HTTP_${httpStatus ?? 0}`);
    const message: string = e.message || '????';
    const traceId: string | undefined = e.traceId;
    const status: number = httpStatus ?? 0;
    return { code, message, traceId, status, raw: err };
  }"""
t2 = t.replace(old, new)
p.write_text(t2, encoding='utf-8')
print('PATCHED' if t2 != t else 'NO CHANGE')
