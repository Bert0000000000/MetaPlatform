import pathlib
p = pathlib.Path('apps/web/src/pages/apphub/ReleaseRecordPage.tsx')
text = p.read_text(encoding='utf-8-sig', errors='ignore')
if 'react-router-dom' not in text:
    text = 'import { useParams } from ' + chr(34) + 'react-router-dom' + chr(34) + ';\n' + text
    p.write_text(text, encoding='utf-8')
    print('ADDED useParams import')
else:
    print('already has react-router-dom')
