$env:DB_USER='meta'
$env:DB_PASSWORD='meta'
Set-Location 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-IAM'
& mvn spring-boot:run '-Dspring-boot.run.profiles=dev' '-Dspring-boot.run.jvmArguments=-Dspring.cloud.compatibility-verifier.enabled=false' *> 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-IAM\iam-dev.log'
