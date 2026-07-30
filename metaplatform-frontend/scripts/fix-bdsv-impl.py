import pathlib
p = pathlib.Path('apps/web/src/pages/ontology/components/BigDataSourceView.tsx')
text = p.read_text(encoding='utf-8-sig', errors='ignore')
old = 'function BigDataSourceViewImpl() {\n  const { message, modal } = App.useApp();\n  return <InternalBody message={message} modal={modal} />;\n}'
new = 'function BigDataSourceViewImpl({ report }: { report: any }) {\n  const { message, modal } = App.useApp();\n  return <InternalBody message={message} modal={modal} report={report} />;\n}'
if old in text:
    text = text.replace(old, new, 1)
    p.write_text(text, encoding='utf-8')
    print('FIXED')
else:
    print('PATTERN NOT FOUND')
