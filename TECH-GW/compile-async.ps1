$proc = Start-Process -FilePath "mvn" -ArgumentList "-B","-ntp","-e","compile","-DskipTests","-f","d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-GW\pom.xml" -RedirectStandardOutput "d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-GW\compile-out.txt" -RedirectStandardError "d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-GW\compile-err.txt" -PassThru -NoNewWindow
$proc.WaitForExit(180000) | Out-Null
"EXIT=$($proc.ExitCode)" | Out-File "d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-GW\compile-result.txt"
