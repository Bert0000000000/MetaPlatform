$mavenHome = "D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\tools\apache-maven-3.9.9"
$env:MAVEN_HOME = $mavenHome
$env:PATH = "$mavenHome\bin;$env:PATH"
Write-Host "Apache Maven 3.9.9 is now active: $(mvn -v | Select-Object -First 1)"
