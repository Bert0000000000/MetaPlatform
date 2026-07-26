$env:JAVA_HOME = 'C:\Program Files\Java\jdk-25.0.3'
Set-Location 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-ONT'
& 'C:\Program Files\Java\apache-maven-3.9.16\bin\mvn.cmd' clean install -DskipTests 2>&1 | Select-String -Pattern 'BUILD|ERROR' | Select-Object -First 3
