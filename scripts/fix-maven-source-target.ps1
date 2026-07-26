$modules = @('TECH-MSG','TECH-ONT','TECH-AGENT','APP-KB','TECH-ACTION','TECH-LLMGW','TECH-RAG','TECH-OBS','TECH-IAM')
foreach ($m in $modules) {
    $pom = "$m/pom.xml"
    if (-not (Test-Path $pom)) { continue }
    $c = Get-Content -Encoding UTF8 $pom -Raw
    $c = $c -replace '<source></source>', '<source>${java.version}</source>'
    $c = $c -replace '<target></target>', '<target>${java.version}</target>'
    Set-Content -Encoding UTF8 $pom $c
}
