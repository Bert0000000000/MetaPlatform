$path = "D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\tools\m3-e2e-test.ps1"
$src = Get-Content $path -Raw
$src | Out-File $path -Encoding utf8
Write-Host "Rewritten with UTF-8 BOM"
