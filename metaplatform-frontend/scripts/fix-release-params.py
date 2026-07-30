import pathlib
p = pathlib.Path('apps/web/src/pages/apphub/ReleaseRecordPage.tsx')
text = p.read_text(encoding='utf-8-sig', errors='ignore')
# Find existing react-router-dom import
import re
m = re.search(r\"import \{([^}]*?)\} from 'react-router-dom';\", text)
if m:
    inside = m.group(1)
    if 'useParams' not in inside:
        new_import = 'import { ' + inside.strip() + ', useParams } from ' + chr(34) + 'react-router-dom' + chr(34) + ';'
        text = text.replace(m.group(0), new_import, 1)
        p.write_text(text, encoding='utf-8')
        print('FIXED useParams import')
else:
    print('NO react-router-dom import found')
