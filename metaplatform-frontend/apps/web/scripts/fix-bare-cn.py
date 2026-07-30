import pathlib, re, glob
CN = chr(0x4e00) + chr(45) + chr(0x9fff)
files = []
for ext in ("*.ts", "*.tsx"):
    files.extend(glob.glob("apps/web/src/**/" + ext, recursive=True))
fixed = 0
for f in files:
    p = pathlib.Path(f)
    text = p.read_text(encoding="utf-8-sig", errors="ignore")
    pat1 = re.compile("(message\.(?:error|success|warning|info)\(\s*)" + CN + chr(34) + r'([^()]*?)'" + CN + chr(34) + r'(\s*\))")
    pat2 = re.compile("(report\()" + CN + chr(34) + r'([^()]*?)'" + CN + chr(34) + r'(\))")
    new = pat1.sub(lambda m: m.group(1) + chr(34) + m.group(2) + chr(34) + m.group(3), text)
    new = pat2.sub(lambda m: m.group(1) + chr(34) + m.group(2) + chr(34) + m.group(3), new)
    if new != text:
        p.write_text(new, encoding="utf-8")
        fixed += 1
print("FIXED", fixed)