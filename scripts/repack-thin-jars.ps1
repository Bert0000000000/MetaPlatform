# Repack thin (non-fat) jar for a single TECH-* module.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/repack-thin-jars.ps1 -ModuleName TECH-AGENT
param(
    [Parameter(Mandatory=$true)]
    [string]$ModuleName,
    [string]$JarToolPath = "C:\Program Files\Java\jdk-25.0.3\bin\jar.exe",
    [string]$MvnPath = "C:\Program Files\Java\apache-maven-3.9.16\bin\mvn.cmd"
)

$ErrorActionPreference = "Stop"

$root = "D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform"
$moduleDir = Join-Path $root $ModuleName
if (-not (Test-Path $moduleDir)) { Write-Error ("Module not found: " + $moduleDir); exit 1 }

$classesDir = Join-Path $moduleDir "target\classes"
if (-not (Test-Path $classesDir)) {
    Write-Host ("[" + $ModuleName + "] target\classes missing, building first...")
    Set-Location $moduleDir
    & $MvnPath compile -DskipTests -o
    if ($LASTEXITCODE -ne 0) { Write-Error ("[" + $ModuleName + "] compile failed"); exit 1 }
}

$artifact = $ModuleName.ToLower()
$thinJar = Join-Path $moduleDir ("target\" + $artifact + "-classes.jar")
Write-Host ("[" + $ModuleName + "] Building thin jar: " + $thinJar)

Set-Location $classesDir
& $JarToolPath -cf $thinJar .
if ($LASTEXITCODE -ne 0) { Write-Error "jar.exe failed"; exit 1 }

Set-Location $moduleDir
Write-Host ("[" + $ModuleName + "] Installing to local m2...")
$args = @("install:install-file", "-Dfile=$thinJar", "-DgroupId=com.metaplatform", "-DartifactId=$artifact", "-Dversion=0.0.1-SNAPSHOT", "-Dpackaging=jar", "-o")
& $MvnPath @args
if ($LASTEXITCODE -ne 0) { Write-Error "install:install-file failed"; exit 1 }

Write-Host ("[" + $ModuleName + "] Done.") -ForegroundColor Green
