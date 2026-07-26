$srcDir = 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-MSG\target\classes'
$outJar = 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-MSG\target\tech-msg-classes.jar'
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-25.0.3'
Set-Location $srcDir
& $env:JAVA_HOME\bin\jar.exe -cf $outJar .
Set-Location D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform
& 'C:\Program Files\Java\apache-maven-3.9.16\bin\mvn.cmd' install:install-file -Dfile=$outJar -DgroupId=com.metaplatform -DartifactId=tech-msg -Dversion=0.0.1-SNAPSHOT -Dpackaging=jar | Select-String -Pattern 'BUILD' | Select-Object -First 2
