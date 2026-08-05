import subprocess, re, sys
r = subprocess.run(
    [r"D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-frontend\apps\web\node_modules\.bin\tsc.cmd",
     "-p", r"D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-frontend\apps\web\tsconfig.json",
     "--noEmit", "--skipLibCheck", "--incremental", "false"],
    cwd=r"D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-frontend",
    capture_output=True, text=True, timeout=120
)
print("EXIT", r.returncode)
ms = re.findall(r"error TS\d+", r.stderr)
print("ERRORS_TOTAL", len(ms))
seen = set()
for line in r.stdout.split(chr(10)) + r.stderr.split(chr(10)):
    if "error TS" in line and line not in seen:
        print(line[:300])
        seen.add(line)
        if len(seen) > 60:
            break
if not seen:
    print("NO_ERRORS")
