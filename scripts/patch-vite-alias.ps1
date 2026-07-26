$sharedIcons = "path.resolve(import.meta.dirname, '../../packages/shared/src/icons/index.tsx')"
$apps = @('apphub','arch','dashboard','dw','kb','mcphub','portal','superai')
foreach ($a in $apps) {
    $f = "metaplatform-frontend/apps/$a/vite.config.ts"
    if (Test-Path $f) {
        $c = Get-Content -Encoding UTF8 $f -Raw
        $lines = $c -split "`n"
        $out = New-Object System.Collections.Generic.List[string]
        $inserted = $false
        foreach ($line in $lines) {
            $out.Add($line)
            if (-not $inserted -and $line -match [regex]::Escape("@mate/shared$")) {
                $out.Add("      '@ant-design/icons$': $sharedIcons,")
                $inserted = $true
            }
        }
        if ($inserted) {
            Set-Content -Encoding UTF8 $f ($out -join "`n")
            Write-Output "patched: $f"
        } else {
            Write-Output "skip (no @mate/shared line found): $f"
        }
    } else {
        Write-Output "missing: $f"
    }
}
