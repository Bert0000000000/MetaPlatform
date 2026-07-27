from pathlib import Path
p=Path('docs/superpowers/specs/2026-07-26-ontology-native-deerflow-final-delivery-plan.md')
lines=p.read_text(encoding='utf-8').splitlines()
for i,l in enumerate(lines):
    if l.startswith('> Version:'):
        lines[i]='> Version: v1.65 - 2026-07-27 (round 64 / RAG HQL+RagApplication scan fix + acceptance e2e_smoke.ps1 + 4 backends up)'
    if l.startswith('> Updated baseline:'):
        lines[i]='> Updated baseline: 2026-07-27 11:15 UTC+8, by Codex'
p.write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('UPDATED')
