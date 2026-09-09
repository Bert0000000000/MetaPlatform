import io
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "docs/active/V1.0-RELEASE-PLAN.md"
lines = io.open(path, encoding="utf-8").read().split("\n")
BS = chr(92)
PIPE = chr(124)


def unescaped_pipes(s: str) -> int:
    n = 0
    for j, ch in enumerate(s):
        if ch == PIPE and (j == 0 or s[j - 1] != BS):
            n += 1
    return n


in_table = False
expected = 0
issues = []
for i, ln in enumerate(lines, 1):
    t = ln.strip()
    raw = t.startswith(PIPE) and t.endswith(PIPE)
    if raw and not in_table:
        in_table, expected = True, unescaped_pipes(ln)
    elif raw and in_table:
        real = unescaped_pipes(ln)
        if real != expected:
            issues.append((i, real, expected, t[:70]))
    else:
        in_table = False

print("remaining column issues:", len(issues))
for i, c, e, t in issues:
    print(f"  L{i}: {c} cols (expect {e}) {t}")
