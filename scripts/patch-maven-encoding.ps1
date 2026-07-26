$moduleNames = @('TECH-MSG','TECH-ONT','TECH-AGENT','APP-KB','TECH-ACTION','TECH-LLMGW','TECH-RAG','TECH-OBS','TECH-IAM')
foreach ($m in $moduleNames) {
    $pom = "$m/pom.xml"
    if (-not (Test-Path $pom)) { continue }
    $c = Get-Content -Encoding UTF8 $pom -Raw
    if ($c -match 'UTF-8.*source.*encoding|maven-compiler-plugin') {
        if ($c -notmatch '<encoding>UTF-8</encoding>') {
            $c = $c -replace '(<artifactId>maven-compiler-plugin</artifactId>\s*<configuration>)', ('$1' + "`n                    <encoding>UTF-8</encoding>" + "`n                    <source>${java.version}</source>" + "`n                    <target>${java.version}</target>")
            Set-Content -Encoding UTF8 $pom $c
            Write-Output "patched: $pom"
        }
    }
}
