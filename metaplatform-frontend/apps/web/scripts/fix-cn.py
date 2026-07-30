import pathlib, re, glob
CN = '[' + chr(0x4e00) + '-' + chr(0x9fff) + ']'
p1 = re.compile('port\\(' + CN + '[^()]*?\\)')
p2 = re.compile('message\\.(error|success|warning|info)\\(' + CN + '[^()]*?\\)')
files = []
for ext in ('*.ts', '*.tsx'):
    files.extend(glob.glob('apps/web/src/**/' + ext, recursive=True))
hits = [0, 0]
for f in files:
    p = pathlib.Path(f)
    text = p.read_text(encoding='utf-8-sig', errors='ignore')
    new = p1.sub(lambda m: chr(34) + m.group(0) + chr(34), text)
    new = p2.sub(lambda m: chr(34) + m.group(0) + chr(34), new)
    if new != text:
        hits[0] += len(p1.findall(text))
        hits[1] += len(p2.findall(text))
        p.write_text(new, encoding='utf-8')
print('REPORT', hits[0], 'MESSAGE', hits[1])
