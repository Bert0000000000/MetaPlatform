$path = "D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\tools\m3-e2e-test.ps1"
$src = Get-Content $path -Raw
$errs = $null
[System.Management.Automation.PSParser]::Tokenize($src, [ref]$errs)
if ($errs) {
    foreach ($e in $errs) {
        Write-Host ("Line " + $e.Token.StartLine + ": " + $e.Message)
    }
} else {
    Write-Host "No syntax errors found."
}
