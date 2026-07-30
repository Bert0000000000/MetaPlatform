import pathlib
p = pathlib.Path('packages/shared/src/index.ts')
t = p.read_text(encoding='utf-8-sig')
old = "export { useAsync } from './hooks/useAsync';"
new = "export { useAsync } from './hooks/useAsync';\nexport { useCachedAsync, type UseCachedAsyncOptions, type UseCachedAsyncResult } from './hooks/useCachedAsync';"
if old in t and 'useCachedAsync' not in t:
    t = t.replace(old, new)
    p.write_text(t, encoding='utf-8')
    print('PATCHED')
else:
    print('SKIP')
