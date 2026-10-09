param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('preflight', 'postgres', 'core', 'migration', 'builder')]
    [string]$Mode,
    [Parameter(Mandatory = $true)]
    [string]$SourceCommit,
    [string]$NodePath,
    [string]$PnpmPath
)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$python = Join-Path $repo 'mate-platform-backend/.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python -PathType Leaf)) { throw 'Prepare the locked Python 3.12 workspace first.' }
$runnerArgs = @((Join-Path $PSScriptRoot 'run_builder_v2_validation.py'), $Mode, '--source-commit', $SourceCommit)
if ($NodePath) { $runnerArgs += @('--node', $NodePath) }
if ($PnpmPath) { $runnerArgs += @('--pnpm', $PnpmPath) }
& $python @runnerArgs
exit $LASTEXITCODE
