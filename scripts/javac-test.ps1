$env:JAVA_HOME = 'C:\Program Files\Java\jdk-25.0.3'
Set-Location 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-ONT'
$cp = 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-MSG\target\classes'
$src = 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-ONT\src\main\java\com\metaplatform\ont\context\OntologyContextService.java'
$out = 'D:\tmp\javac-out'
New-Item -ItemType Directory -Path $out -Force | Out-Null
& $env:JAVA_HOME\bin\javac.exe -encoding UTF-8 -cp $cp -d $out $src 2>&1 | Out-String | Out-File 'D:\tmp\javac-test.log' -Encoding utf8
