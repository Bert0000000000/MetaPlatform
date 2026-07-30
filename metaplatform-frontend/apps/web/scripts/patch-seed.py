import pathlib
p = pathlib.Path('apps/web/src/pages/ontology/actions/seed.ts')
text = p.read_text(encoding='utf-8-sig')
old = "  { name: 'approval_data', type: 'Object', required: true, desc: '????' },\n"
new = "  { name: 'approval_data', type: 'Object', required: true, desc: '????' },\n"
# If the file is corrupt, just rewrite the whole SEED_INPUT_PARAMS block.
import re
pattern = re.compile(r"export const SEED_INPUT_PARAMS: readonly SeedInputParam\[\] = \[.*?\];", re.DOTALL)
m = pattern.search(text)
if m:
    replacement = """export const SEED_INPUT_PARAMS: readonly SeedInputParam[] = [
  { name: 'recipient_id', type: 'String', required: true, desc: '??? ID' },
  { name: 'approval_data', type: 'Object', required: true, desc: '????' },
  { name: 'channel', type: 'Enum', required: false, desc: '???? (im/email/sms)' },
];"""
    text = text[:m.start()] + replacement + text[m.end():]
    p.write_text(text, encoding='utf-8')
    print('PATCHED via regex')
else:
    print('NO MATCH')
