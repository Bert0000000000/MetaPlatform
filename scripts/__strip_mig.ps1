$TGT = "D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform"
foreach ($mod in @("TECH-LLMGW", "TECH-ONT", "TECH-WFE", "TECH-MSG")) {
    $jar = "$TGT\$mod\target\tech-$($mod.Replace('TECH-','').ToLower())-classes.jar"
    $tmp = "$TGT\$mod\target\thin-rebuild"
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
    New-Item -ItemType Directory -Path $tmp | Out-Null
    Write-Host "=== $mod rebuild ==="
    Set-Location $tmp
    & jar xf $jar 2>&1 | Out-Null
    if (Test-Path "db\migration") {
        Remove-Item -Recurse -Force "db\migration"
        if (Test-Path "db") {
            $remaining = Get-ChildItem "db" -ErrorAction SilentlyContinue
            if (-not $remaining) { Remove-Item -Recurse -Force "db" }
        }
    }
    & jar cf $jar . 2>&1 | Out-Null
    Write-Host ("  rebuilt, " + (Get-Item $jar).Length + "b")
    $leaks = & jar tf $jar 2>$null | Select-String "db/migration"
    if ($leaks) { Write-Host "  leaks:"; $leaks | ForEach-Object { Write-Host "    $_" } } else { Write-Host "  no migrations inside" }
    Remove-Item -Recurse -Force $tmp
}
