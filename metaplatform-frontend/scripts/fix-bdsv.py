import pathlib
p = pathlib.Path('apps/web/src/pages/ontology/components/BigDataSourceView.tsx')
text = p.read_text(encoding='utf-8-sig', errors='ignore')
new = text
# Default export: App.useApp => InternalBody(message, modal); pass report too.
# Easier: drop the App/InternalBody indirection entirely and use App.useApp inline.
# Just replace the App/InternalBody shell with an App that provides both.
# Find the BigDataSourceView default export.
import re
new = re.sub(
    r'export default function BigDataSourceView\(\) \{\s*const \{ report \} = useApiErrorBoundary\(\);\s*return \(\s*<App>\s*<BigDataSourceViewImpl />\s*</App>\s*\);\s*\}',
    'function BigDataSourceViewShell() {\n  const { report } = useApiErrorBoundary();\n  return <App><BigDataSourceViewImpl report={report} /></App>;\n}\n\nexport default function BigDataSourceView() {\n  return <BigDataSourceViewShell />;\n}',
    new,
    count=1,
)
# And InternalBody signature.
new = new.replace(
    'function InternalBody({ message, modal }: { message: any; modal: any }) {\n  return <InnerBody message={message} modal={modal} />;\n}',
    'function InternalBody({ message, modal, report }: { message: any; modal: any; report: any }) {\n  return <InnerBody message={message} modal={modal} report={report} />;\n}',
    1
)
# And InnerBody signature.
new = new.replace(
    'function InnerBody({ message, modal }: { message: any; modal: any }) {',
    'function InnerBody({ message, modal, report }: { message: any; modal: any; report: any }) {',
    1
)
p.write_text(new, encoding='utf-8')
print('done')
