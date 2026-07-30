"""Inject `const { report } = useApiErrorBoundary();` after every function
declaration that has `report(` calls but no `report` binding."""
import pathlib, re

ROOT = pathlib.Path('apps/web/src/pages')
fixed = 0
for p in ROOT.rglob('*.tsx'):
    text = p.read_text(encoding='utf-8-sig')
    if 'useApiErrorBoundary' not in text or 'report(' not in text:
        continue
    # Strip bad lines from previous migration round.
    text = text.replace("'@mate/shared';\nimport { useApiErrorBoundary } from", "'@mate/shared';")
    # Find any function header that has no `const { report }` inside.
    # For each function that contains `report(`, ensure a binding exists.
    # We look for the last function-starting line before a `report(` invocation.
    # Simplest: find all positions of 'function <Name>(' and for each, check if
    # body before next 'function' or end-of-file declares 'const { report }'.
    funcs = list(re.finditer(r"^(?:export default\s+)?function\s+(\w+)\s*\(", text, re.MULTILINE))
    # Walk functions bottom-up to insert binding right after the body's first '{'.
    inserts = []
    for m in funcs:
        start = m.end()
        # Find matching closing brace (simple search tracking depth).
        depth = 0
        i = start - 1  # The '(' position
        end = -1
        for j in range(i, len(text)):
            c = text[j]
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    end = j
                    break
        if end < 0:
            continue
        body = text[start:end + 1]
        if 'report(' not in body:
            continue
        if 'useApiErrorBoundary' not in body[:min(len(body), 500)]:
            # Body doesn't have a top-level binding; insert.
            # Insert right after the opening '{' at the position of the
            # statement boundary: find the first newline after '{' in the body.
            open_idx = text.find('{', i)
            line_end = text.find('\n', open_idx)
            if line_end < 0 or line_end > end:
                continue
            binding_line = chr(10) + '  const { report } = useApiErrorBoundary();' + chr(10)
            inserts.append((line_end, binding_line))
    # Apply in reverse so offsets stay valid.
    for pos, txt in sorted(inserts, key=lambda x: -x[0]):
        text = text[:pos] + txt + text[pos:]
        fixed += 1
    if fixed:
        p.write_text(text, encoding='utf-8')
        print('PATCHED', p)
