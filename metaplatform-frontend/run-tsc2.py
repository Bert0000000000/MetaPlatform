import subprocess
import re
import sys
import time
si = subprocess.STARTUPINFO()
si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
si.wShowWindow = subprocess.SW_HIDE
start = time.time()
r = subprocess.Popen([r'D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\metaplatform-frontend\\node_modules\\.bin\\tsc.cmd', '-p', r'D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\metaplatform-frontend\\apps\\web\\tsconfig.json', '--noEmit', '--skipLibCheck', '--incremental', 'false'], cwd=r'D:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\metaplatform-frontend', stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
deadline = start + 30
while time.time() < deadline:
    if r.poll() is not None:
        break
    time.sleep(0.5)
try:
    out, err = r.communicate(timeout=10)
except subprocess.TimeoutExpired:
    r.kill()
    out, err = r.communicate()
print('elapsed', round(time.time() - start, 1), 's')
print('EXIT', r.returncode)
ms = re.findall(r'error TS\\d+', out + err)
print('ERRORS', len(ms))
seen = set()
for line in (out + err).split(chr(10)):
    if 'error TS' in line and line not in seen:
        print(line[:200])
        seen.add(line)
        if len(seen) > 30:
            break
