import pathlib
p = pathlib.Path('apps/web/src/pages/ontology/components/BigDataSourceView.tsx')
text = p.read_text(encoding='utf-8-sig', errors='ignore')
# Update CreateSourceModal signature.
old1 = 'function CreateSourceModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {'
new1 = 'function CreateSourceModal({ onClose, onSuccess, report }: { onClose: () => void; onSuccess: () => void; report: any }) {'
if old1 in text:
    text = text.replace(old1, new1, 1)
# Update CreateSourceModal usage: pass report in JSX
old2 = '{showCreate && <CreateSourceModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); load(); }} />}'
new2 = '{showCreate && <CreateSourceModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); load(); }} report={report} />}'
if old2 in text:
    text = text.replace(old2, new2, 1)
# Now CreateSourceModal uses App.useApp's message, but we want report. Use the param.
# Update internal try/catch in CreateSourceModal: report(e).
# (already there: report(e) at line ~288)
# Remove the App.useApp message from CreateSourceModal if redundant.
# Check if CreateSourceModal uses message.
p.write_text(text, encoding='utf-8')
print('FIXED')
