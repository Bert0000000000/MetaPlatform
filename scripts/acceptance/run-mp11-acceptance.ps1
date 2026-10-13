[CmdletBinding()]
param(
  [ValidateSet('Status','Start','Stop','PrepareBrowser','Browser','Frontend','Backend','Security','Recovery','Migrations','Verify')]
  [string]$Phase='Status',
  [string]$ConfigPath=''
)
$ErrorActionPreference='Stop'
if(!$ConfigPath){$ConfigPath=Join-Path $PSScriptRoot 'mp11/config.example.json'}
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$python=Join-Path $root 'mate-platform-backend/.venv/Scripts/python.exe'
$manage=Join-Path $PSScriptRoot 'mp11/manage.py'
$verify=Join-Path $PSScriptRoot 'mp11/verify.py'
$env:PYTHONDONTWRITEBYTECODE='1'
& $python $manage validate-config $ConfigPath
if($LASTEXITCODE -ne 0){throw 'Explicit candidate configuration rejected'}
function Invoke-Owned([string[]]$Arguments){
  & $python @Arguments
  if($LASTEXITCODE -ne 0){throw ('Candidate operation failed: '+$Arguments[-1])}
}
switch($Phase){
  'Status' { Invoke-Owned @($manage,'status') }
  'Start' {
    foreach($role in @('redis','keycloak')){Invoke-Owned @($manage,'start',$role)}
    # The launcher refuses occupied ports; use Status before starting an already running role.
    foreach($role in @('api','auth','web')){Invoke-Owned @($manage,'start',$role)}
  }
  'Stop' {foreach($role in @('web','auth','api','keycloak','redis')){Invoke-Owned @($manage,'stop',$role)}}
  'PrepareBrowser' {Invoke-Owned @($verify,'prepare-browser')}
  'Browser' {Invoke-Owned @($verify,'prepare-browser');Invoke-Owned @($verify,'refresh-browser');Invoke-Owned @($verify,'browser')}
  'Frontend' {Invoke-Owned @($verify,'frontend')}
  'Backend' {Invoke-Owned @($verify,'backend')}
  'Security' {Invoke-Owned @($verify,'security')}
  'Recovery' {Invoke-Owned @($verify,'faults')}
  'Migrations' {Invoke-Owned @($verify,'migrations')}
  'Verify' {Invoke-Owned @($verify)}
}
