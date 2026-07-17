"""Fix BOM in jwt.txt"""

import sys

p = r"d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\jwt.txt"
with open(p, "rb") as f:
    data = f.read()

# Strip BOM
if data.startswith(b"\xef\xbb\xbf"):
    data = data[3:]

with open(p, "wb") as f:
    f.write(data)

print("OK, length =", len(data))