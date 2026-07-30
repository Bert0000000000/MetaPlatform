import subprocess, re
r = subprocess.run(
    [r"D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-frontend\node_modules\typescript\bin\tsc.exe",
     "-p", r"D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-frontend\apps\web\tsconfig.json",
     "--noEmit", "--skipLibCheck", "--incremental", "false"],
    cwd=r"D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-frontend",
    capture_output=True, text=True, timeout=30
)
print("EXIT", r.returncode)
ms = re.findall(r"error TS\d+", r.stderr)
print("ERRORS", len(ms))
seen = set()
for line in r.stderr.split(chr(10)):
    if "error TS" in line and line not in seen:
        print(line[:200])
        seen.add(line)
        if len(seen) > 30:
            break
