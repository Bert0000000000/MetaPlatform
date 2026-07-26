$m2 = 'C:\Users\houuu\.m2\repository'
$needed = @('jackson-databind', 'jackson-core', 'jackson-annotations', 'lombok', 'spring-web', 'spring-core', 'spring-context', 'spring-beans', 'spring-aop', 'junit-jupiter-api', 'junit-jupiter-engine', 'junit-platform-commons', 'junit-platform-engine', 'opentest4j', 'apiguardian-api', 'spring-boot-starter-test', 'logback-classic', 'logback-core', 'slf4j-api', 'slf4j-jdk14', 'snappy-java', 'commons-logging', 'micrometer-observation', 'micrometer-commons')
$selected = @()
Get-ChildItem -Path $m2 -Recurse -File -Filter '*.jar' -ErrorAction SilentlyContinue | ForEach-Object {
    $name = $_.BaseName
    foreach ($n in $needed) {
        if ($name -like "$n-*") {
            $selected += $_.FullName
            break
        }
    }
}
$selected | Sort-Object -Unique | Out-File 'D:\tmp\classpath-min.txt' -Encoding utf8
Write-Output ("selected: " + ($selected | Sort-Object -Unique).Count)
