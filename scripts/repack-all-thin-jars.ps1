# Repack thin (non-fat) jar for all TECH-* modules that produce downstream
# cross-module dependencies (TECH-AGENT -> TECH-ONT, TECH-LLMGW, TECH-WFE, TECH-MSG).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/repack-all-thin-jars.ps1
param(
    [string[]]$Modules = @("TECH-AGENT", "TECH-ONT", "TECH-LLMGW", "TECH-WFE", "TECH-MSG", "TECH-RAG")
)

$script = Join-Path "D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\scripts" "repack-thin-jars.ps1"
foreach ($m in $Modules) {
    Write-Host ("==================== " + $m + " ====================") -ForegroundColor Cyan
    & $script -ModuleName $m
    if ($LASTEXITCODE -ne 0) {
        Write-Host ("[" + $m + "] FAILED") -ForegroundColor Red
    }
}
Write-Host ("Done.") -ForegroundColor Green
