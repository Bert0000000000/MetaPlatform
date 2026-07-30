
from pathlib import Path

CN_TITLE = "# ARCH-CORE-01 \u67b6\u6784\u5185\u6838\u4e0e\u6a21\u5757\u8fb9\u754c\u6cbb\u7406\u5b9e\u65bd\u8ba1\u5212\n"

def C(s):
    return s

# Build file in memory then write once
p = Path('docs/superpowers/plans/2026-07-30-arch-core-01.md')
# Read current text (likely the corrupted one)
existing = p.read_text(encoding='utf-8')
# Find where the title line ends
nl = existing.find('\n')
print('first line bytes', existing[:nl].encode('utf-8'))
# Replace the first line with the proper title
new_text = CN_TITLE + existing[nl+1:]
p.write_text(new_text, encoding='utf-8')
print('after fix first line bytes', p.read_text(encoding='utf-8')[:nl].encode('utf-8'))
