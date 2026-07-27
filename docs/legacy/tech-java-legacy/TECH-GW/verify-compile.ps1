$ErrorActionPreference = "Continue"
$stdoutPath = "d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-GW\compile-stdout.txt"
$stderrPath = "d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-GW\compile-stderr.txt"
$resultPath = "d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-GW\compile-result.txt"

if (Test-Path $stdoutPath) { Remove-Item $stdoutPath -Force }
if (Test-Path $stderrPath) { Remove-Item $stderrPath -Force }

$proc = Start-Process -FilePath "mvn" `
    -ArgumentList "-B","-ntp","-e","compile","-DskipTests","-f","d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-GW\pom.xml" `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru -NoNewWindow

$exited = $proc.WaitForExit(300000)
"WAITED=$exited EXIT=$($proc.ExitCode)" | Out-File $resultPath
