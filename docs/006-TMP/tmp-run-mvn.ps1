# Runs mvn test for a given module, waits for it to complete, and prints results.
param([string]$Module = "TECH-EA")

$modulePath = "d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\$Module"
$stdoutLog = "d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\$Module-stdout.log"
$stderrLog = "d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\$Module-stderr.log"

if (-not (Test-Path $modulePath)) { Write-Host "module not found: $modulePath"; exit 1 }

Set-Location $modulePath
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Starting mvn test for $Module"

$proc = Start-Process -FilePath 'C:\ProgramData\chocolatey\lib\maven\apache-maven-3.9.16\bin\mvn.cmd' `
    -ArgumentList 'test','-B' `
    -WorkingDirectory $modulePath `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -NoNewWindow -PassThru

Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Started PID=$($proc.Id)"

# Wait up to 10 minutes
$exited = $proc.WaitForExit(600000)
Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Exited=$exited Code=$($proc.ExitCode)"

# Print last 40 lines of stdout
if (Test-Path $stdoutLog) {
    Write-Host "----- stdout tail -----"
    Get-Content $stdoutLog -Tail 40 | ForEach-Object { Write-Host $_ }
} else {
    Write-Host "stdout log missing"
}