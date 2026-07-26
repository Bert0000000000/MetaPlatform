$env:JAVA_HOME = 'C:\Program Files\Java\jdk-25.0.3'
Set-Location 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-MSG'
Remove-Item target -Recurse -Force -ErrorAction SilentlyContinue
& 'C:\Program Files\Java\apache-maven-3.9.16\bin\mvn.cmd' clean install -DskipTests 2>&1 | Select-String -Pattern 'BUILD' | Select-Object -First 2
tar tf 'C:\Users\houuu\.m2\repository\com\metaplatform\tech-msg\0.0.1-SNAPSHOT\tech-msg-0.0.1-SNAPSHOT.jar' 2>&1 | Select-String 'topology' | Select-Object -First 3
