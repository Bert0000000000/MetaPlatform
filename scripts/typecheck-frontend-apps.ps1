param([switch]$NoEmit)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\metaplatform-frontend')).Path
$tsc = Get-ChildItem (Join-Path $root 'node_modules\.pnpm') -Directory -Filter 'typescript@*' |
  Sort-Object Name -Descending | Select-Object -First 1
if (-not $tsc) { throw 'TypeScript package not found in pnpm store' }
$tscPath = Join-Path $tsc.FullName 'node_modules\typescript\bin\tsc'
$projects = Get-ChildItem (Join-Path $root 'apps') -Directory |
  ForEach-Object { Get-Item (Join-Path $_.FullName 'tsconfig.json') -ErrorAction SilentlyContinue }
$failed = @()
foreach ($project in $projects) {
  Write-Host "[typecheck] $($project.FullName)"
  $args = @('--project', $project.FullName, '--pretty', 'false')
  if ($NoEmit) { $args += '--noEmit' }
  & node $tscPath @args
  if ($LASTEXITCODE -ne 0) { $failed += $project.FullName }
}
if ($failed.Count -gt 0) {
  Write-Error ("Typecheck failed: " + ($failed -join ', '))
  exit 1
}
Write-Host "Frontend app typecheck passed ($($projects.Count) projects)."
