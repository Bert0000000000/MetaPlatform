param([string]$CmdPath = "")
if (-not (Test-Path $CmdPath)) {
    Write-Host ("Cmd file not found: " + $CmdPath)
    exit 1
}
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", $CmdPath) -WindowStyle Minimized -PassThru
Write-Host ("Started cmd {0} pid={1}" -f $CmdPath, $proc.Id)