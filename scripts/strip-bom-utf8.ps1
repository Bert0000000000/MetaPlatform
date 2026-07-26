param([string[]]$Paths)
$totalFixed = 0
foreach ($p in $Paths) {
    if (-not (Test-Path $p)) { continue }
    $files = Get-ChildItem -Path $p -Recurse -File -Filter '*.java' -ErrorAction SilentlyContinue
    foreach ($f in $files) {
        $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
        if ($bytes.Length -gt 2 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
            $clean = New-Object byte[] ($bytes.Length - 3)
            [Array]::Copy($bytes, 3, $clean, 0, $clean.Length)
            [System.IO.File]::WriteAllBytes($f.FullName, $clean)
            $totalFixed++
        }
    }
}
Write-Output "BOM removed: $totalFixed"
