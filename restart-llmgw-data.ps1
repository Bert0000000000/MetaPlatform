# 临时脚本：单独启动 LLMGW + DATA
$jvmArgs = '-Dspring.cloud.compatibility-verifier.enabled=false -Xms256m -Xmx512m'
$argString = "spring-boot:run -Dspring-boot.run.profiles=dev -Dspring-boot.run.jvmArguments=`"$jvmArgs`""

Write-Host "Starting TECH-LLMGW..."
$p1 = Start-Process -FilePath mvn -ArgumentList $argString -WorkingDirectory 'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-LLMGW' -WindowStyle Hidden -RedirectStandardOutput 'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-LLMGW\stdout.log' -RedirectStandardError 'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-LLMGW\stderr.log' -PassThru
Write-Host "  PID $($p1.Id)"

Write-Host "Starting TECH-DATA..."
$p2 = Start-Process -FilePath mvn -ArgumentList $argString -WorkingDirectory 'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-DATA' -WindowStyle Hidden -RedirectStandardOutput 'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-DATA\stdout.log' -RedirectStandardError 'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-DATA\stderr.log' -PassThru
Write-Host "  PID $($p2.Id)"
