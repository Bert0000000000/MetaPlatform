import pathlib
p = pathlib.Path('apps/web/src/pages/apphub/ReleaseRecordPage.tsx')
text = p.read_text(encoding='utf-8-sig', errors='ignore')
# Add useParams import (check if already imported)
if 'useParams' not in text:
    new = text.replace('import { useState, useEffect } from ' + chr(34) + 'react' + chr(34) + ';', 'import { useState, useEffect } from ' + chr(34) + 'react' + chr(34) + ';\nimport { useParams } from ' + chr(34) + 'react-router-dom' + chr(34) + ';', 1)
else:
    new = text
# Change interface default props to optional + read useParams as fallback
new = new.replace(
    'interface ReleaseRecordPageProps {\n  appId: string;\n}',
    'interface ReleaseRecordPageProps {\n  appId?: string;\n}',
    1
)
new = new.replace(
    'export default function ReleaseRecordPage({ appId }: ReleaseRecordPageProps) {',
    'export default function ReleaseRecordPage({ appId: appIdProp }: ReleaseRecordPageProps) {\n  const { appId: routeAppId } = useParams<' + chr(34) + 'appId' + chr(34) + '>();\n  const appId = appIdProp ?? routeAppId ?? ' + chr(34) + '' + chr(34) + ';',
    1
)
p.write_text(new, encoding='utf-8')
print('done')
