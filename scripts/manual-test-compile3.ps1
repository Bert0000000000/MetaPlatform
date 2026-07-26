$env:JAVA_HOME = 'C:\Program Files\Java\jdk-25.0.3'
Set-Location 'D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/TECH-AGENT'
$argFile = 'D:/tmp/javac-args3.txt'
$outDir = 'target/test-classes-test'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
Copy-Item -Path (Join-Path 'src/test/resources' '*') -Destination $outDir -Recurse -Force -ErrorAction SilentlyContinue
$cp = (Get-Content 'D:/tmp/classpath-min.txt' -Raw) -replace [Environment]::NewLine, ";"
$lines = @()
$lines += '-encoding UTF-8'
$lines += '-cp "' + $cp + ';target/classes"'
$lines += '-d "' + $outDir + '"'
$lines += '-sourcepath "src/test/java"'
$files = Get-ChildItem -Path 'src/test/java' -Recurse -Filter '*.java' -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match 'verification' }
foreach ($f in $files) {
    $lines += '"' + $f.FullName + '"'
}
$content = ($lines -join "`r`n") + "`r`n"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($argFile, $content, $utf8NoBom)
& $env:JAVA_HOME\bin\javac.exe '@D:/tmp/javac-args3.txt' 2>&1 | Out-String | Out-File 'D:/tmp/test-compile3.log' -Encoding utf8
Write-Output ("compiled files: " + $files.Count)
