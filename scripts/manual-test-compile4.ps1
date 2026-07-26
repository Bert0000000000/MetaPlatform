$env:JAVA_HOME = 'C:\Program Files\Java\jdk-25.0.3'
Set-Location 'D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/TECH-AGENT'
$outDir = 'target/test-classes-test'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
Copy-Item -Path (Join-Path 'src/test/resources' '*') -Destination $outDir -Recurse -Force -ErrorAction SilentlyContinue
$cp = (Get-Content 'D:/tmp/classpath-min.txt' -Raw) -replace [Environment]::NewLine, ";"
$files = Get-ChildItem -Path 'src/test/java' -Recurse -Filter '*.java' -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match 'verification' }
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $env:JAVA_HOME + '\bin\javac.exe'
$psi.Arguments = @('-encoding', 'UTF-8', '-cp', ($cp + ';target/classes'), '-d', $outDir, '-sourcepath', 'src/test/java') + ($files | ForEach-Object { $_.FullName })
$psi.UseShellExecute = $false
$psi.RedirectStandardError = $true
$psi.RedirectStandardOutput = $true
$proc = [System.Diagnostics.Process]::Start($psi)
$out = $proc.StandardOutput.ReadToEnd()
$err = $proc.StandardError.ReadToEnd()
$proc.WaitForExit()
Write-Output ("exit: " + $proc.ExitCode)
Write-Output ("stdout: " + $out)
Write-Output ("stderr: " + $err)
