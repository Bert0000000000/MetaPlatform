# Build a complete classpath from local m2 repo
$m2 = 'C:\Users\houuu\.m2\repository'
$classpath = New-Object System.Collections.Generic.List[string]
Get-ChildItem -Path $m2 -Recurse -File -Filter '*.jar' -ErrorAction SilentlyContinue | ForEach-Object {
    $classpath.Add($_.FullName)
}
# Add Spring Boot fat jar exclusions
$classpath = $classpath | Where-Object { $_ -notmatch 'spring-boot-starter-web.*3\.5\.0\.jar' }
$classpath | Out-File 'D:\tmp\classpath.txt' -Encoding utf8
Write-Output ("classpath entries: " + $classpath.Count)
