import pathlib, re
ROOT = pathlib.Path('apps/web/src/pages')
migrated = 0
for p in ROOT.rglob('*.tsx'):
    text = p.read_text(encoding='utf-8-sig')
    if 'useApiErrorBoundary' not in text:
        continue
    # Pattern: '<X> } \nimport { useApiErrorBoundary } from '@mate/shared';\n'
    # We need: '<X>, useApiErrorBoundary } from '@mate/shared';\n'
    pattern = re.compile(
        r"([^{}\n]+?)\s*\}\s*\nimport\s+\{\s*useApiErrorBoundary\s*\}\s+from\s+['\"]@mate/shared['\"];",
    )
    def fix(m):
        last = m.group(1).rstrip()
        # remove any trailing whitespace
        return f'{last}, useApiErrorBoundary }} from \'@mate/shared\';'.replace('}}', '}')
    new = pattern.sub(fix, text)
    if new != text:
        p.write_text(new, encoding='utf-8')
        migrated += 1
        print('FIXED', p)
print('TOTAL', migrated)
