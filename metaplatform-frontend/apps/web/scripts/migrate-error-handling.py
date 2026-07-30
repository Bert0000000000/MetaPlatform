"""Migrate every page from message.error(<err expr> instanceof Error ? <err>.message : ...)
    to useApiErrorBoundary().report(<err expr>). Conservative rules.
"""
import pathlib
import re

ROOT = pathlib.Path('apps/web/src/pages')

# Match e/message.error(<X> instanceof Error ? <X>.message : ... )
# Generous match: any variable name (err, error, e) used as the caught exception.
patterns = [
    # (err.message || 'fallback')
    re.compile(
        r"message\.error\(\s*(\w+)\.message\s*\|\|\s*['\"`]([^'\"`]+)['\"`]\s*\)",
        flags=re.DOTALL,
    ),
    # (err instanceof Error ? err.message : 'fallback')
    re.compile(
        r"message\.error\(\s*(\w+)\s*instanceof\s*Error\s*\?\s*\1\.message\s*:\s*['\"`]([^'\"`]+)['\"`]\s*\)",
        flags=re.DOTALL,
    ),
    # (err as Error).message
    re.compile(
        r"message\.error\(\s*['\"`]([^'\"`]+)['\"`]\s*\+\s*\((\w+)\s*as\s*Error\)\.message\s*\)",
        flags=re.DOTALL,
    ),
    # 'fallback: ' + (err instanceof Error ? err.message : String(err))
    re.compile(
        r"message\.error\(\s*['\"`]([^'\"`]+?):\s*'\s*\+\s*\((\w+)\s*instanceof\s*Error\s*\?\s*\2\.message\s*:\s*String\(\2\)\)\s*\)",
        flags=re.DOTALL,
    ),
    # `xxx: ${err.message}` (with err.message only)
    re.compile(
        r"message\.error\(\s*`([^`]*)\$\{(\w+)\.message\}([^`]*)`\s*\)",
        flags=re.DOTALL,
    ),
    # `xxx: ${err instanceof Error ? err.message : String(err)}` template
    re.compile(
        r"message\.error\(\s*`([^`]*)\$\{(\w+)\s*instanceof\s*Error\s*\?\s*\2\.message\s*:\s*String\(\2\)\}([^`]*)`\s*\)",
        flags=re.DOTALL,
    ),
    # Plain object form: { content: `xxx`, key: 'kb-docs-load' }
    re.compile(
        r"message\.error\(\s*\{\s*content\s*:\s*`([^`]*)\$\{?(\w+)?\.?message?\}?([^`]*)`\s*[^}]*\}\s*\)",
        flags=re.DOTALL,
    ),
]


def transform(match: re.Match) -> str:
    # Build a `report(<ident>)` invocation, preserving any friendly prefix.
    groups = match.groups()
    ident = groups[-1] or groups[-2] or 'e'
    return 'report(' + ident + ')'


def migrate(text: str) -> tuple[str, int]:
    if 'useApiErrorBoundary' in text:
        return text, 0
    hits = 0
    new = text

    # 1) Inject import + hook binding if missing.
    if 'useApiErrorBoundary' not in new:
        if "from '@mate/shared'" in new:
            new = new.replace(
                "from '@mate/shared';",
                "import { useApiErrorBoundary } from '@mate/shared';",
                1,
            )
        else:
            new = "import { useApiErrorBoundary } from '@mate/shared';\n" + new

    for pat in patterns:
        new, n = pat.subn(transform, new)
        hits += n

    if 'report(' in new and 'const { report }' not in new:
        new = re.sub(
            r"(export default function \w+\([^)]*\)\s*\{)",
            r"\1\n  const { report } = useApiErrorBoundary();",
            new,
            count=1,
        )
    return new, hits


total_hits = 0
total_files = 0
for p in sorted(ROOT.rglob('*.tsx')):
    text = p.read_text(encoding='utf-8-sig')
    if 'message.error' not in text:
        continue
    if 'useApiErrorBoundary' in text:
        continue
    new, hits = migrate(text)
    if hits > 0:
        p.write_text(new, encoding='utf-8')
        total_files += 1
        total_hits += hits
        print(f'OK {p} (+{hits})')
print(f'TOTAL files={total_files} hits={total_hits}')
