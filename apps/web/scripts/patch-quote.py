import pathlib, re

FILES = [
    "apps/web/src/pages/agents/CapabilityConfigPage.tsx",
    "apps/web/src/pages/agents/components/CustomerCopilotDrawer.tsx",
    "apps/web/src/pages/agents/components/DocumentUpload.tsx",
]

PATTERN = re.compile("report\(([\u4e00-\u9fff][^()]*?)\)")
QUOTE = chr(34)
def repl(m):
    inner = m.group(1)
    if inner.startswith(chr(34)) or inner.startswith(chr(39)):
        return m.group(0)
    return "report(" + QUOTE + "+ QUOTE + " + QUOTE + """)"
for f in FILES:
    p = pathlib.Path(f)
    text = p.read_text(encoding="utf-8-sig")
    new = PATTERN.sub(repl, text)
    if new != text:
        p.write_text(new, encoding="utf-8")
        print("OK", f)
    else:
        print("SKIP", f)
