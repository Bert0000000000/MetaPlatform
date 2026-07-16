Set-Location D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-app-service
. D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\tools\use-maven-3.9.9.ps1
$env:SPRING_PROFILES_ACTIVE = 'dev'
mvn --% spring-boot:run -Dspring-boot.run.jvmArguments="-Xms512m -Xmx1024m" 2>&1 | Tee-Object -FilePath D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-app-service\.dev.log