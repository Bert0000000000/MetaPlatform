import pathlib, re, glob
CN = chr(0x4e00) + '-' + chr(0x9fff)
# Match message.X(CN...) and (CN...) standalone as plain strings
p_msg = re.compile(r'message\.(?:error|success|warning|info)\(' + CN + r'[^()]*?\)')
p_bare = re.compile(r'\bmessage\(' + CN + r'[^()]*?\)')
p_report = re.compile(r'report\(' + CN + r'[^()]*?\)')
files = []
for ext in ('*.ts', '*.tsx'):
    files.extend(glob.glob('apps/web/src/**/' + ext, recursive=True))
hits = 0
for f in files:
    p = pathlib.Path(f)
    text = p.read_text(encoding='utf-8-sig', errors='ignore')
    new = text
    new = p_msg.sub(lambda m: chr(39) + m.group(0) + chr(39), new)
    new = p_bare.sub(lambda m: chr(39) + m.group(0) + chr(39), new)
    new = p_report.sub(lambda m: chr(39) + m.group(0) + chr(39), new)
    if new != text:
        hits += 1
        p.write_text(new, encoding='utf-8')
print('FILES_FIXED', hits)
