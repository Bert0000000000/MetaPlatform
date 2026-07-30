import subprocess
import re
import time
import os
os.makedirs(r'D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\metaplatform-frontend\\tsc-logs', exist_ok=True)
out_path = r'D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\metaplatform-frontend\\tsc-logs\\out.log'
err_path = r'D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\metaplatform-frontend\\tsc-logs\\err.log'
start = time.time()
r = subprocess.Popen('cmd /c ' + chr(34) + r'D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\metaplatform-frontend\\node_modules\\.bin\\tsc.cmd -p D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\metaplatform-frontend\\apps\\web\\tsconfig.json --noEmit --skipLibCheck --incremental false > ' + out_path + ' 2> ' + err_path + chr(34), shell=True)
deadline = start + 45
while time.time() < deadline:
    if r.poll() is not None:
        break
    time.sleep(1)
r.wait()
print('elapsed', round(time.time() - start, 1), 's')
print('EXIT', r.returncode)
err = open(err_path, 'r', encoding='utf-8', errors='ignore').read()
ms = re.findall(r'error TS\\d+', err)
print('ERRORS', len(ms))
seen = set()
for line in err.split(chr(10)):
    if 'error TS' in line and line not in seen:
        print(line[:200])
        seen.add(line)
        if len(seen) > 50:
            break
