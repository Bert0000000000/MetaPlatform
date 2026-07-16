#!/usr/bin/env pwsh
# Build script for metaplatform-process-engine using javac directly
$ErrorActionPreference = 'Stop'

$env:JAVA_HOME = 'C:\tools\jdk21\jdk-21.0.2'
$javac = 'C:\tools\jdk21\jdk-21.0.2\bin\javac.exe'
$m2 = 'C:\Users\houuu\.m2\repository'
$srcDir = 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-process-engine\src\main\java'
$outDir = 'C:\Users\houuu\.m2\process-engine-build'

# Ensure output dir exists
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Collect classpath jars
$jars = @()
$jarPatterns = @(
    "org\springframework\boot\spring-boot-starter-web\3.2.5\*.jar"
    "org\springframework\boot\spring-boot-starter\3.2.5\*.jar"
    "org\springframework\boot\spring-boot-starter-data-jpa\3.2.5\*.jar"
    "org\springframework\boot\spring-boot-starter-validation\3.2.5\*.jar"
    "org\springframework\boot\spring-boot-starter-actuator\3.2.5\*.jar"
    "org\springframework\boot\spring-boot\3.2.5\*.jar"
    "org\springframework\boot\spring-boot-autoconfigure\3.2.5\*.jar"
    "com\fasterxml\jackson\core\jackson-databind\*\*.jar"
    "com\fasterxml\jackson\core\jackson-core\*\*.jar"
    "com\fasterxml\jackson\core\jackson-annotations\*\*.jar"
    "com\fasterxml\jackson\datatype\jackson-datatype-jsr310\*\*.jar"
    "com\googlecode\aviator\aviator\5.4.3\*.jar"
    "jakarta\persistence\jakarta.persistence-api\*\*.jar"
    "jakarta\validation\jakarta.validation-api\*\*.jar"
    "jakarta\transaction\jakarta.transaction-api\*\*.jar"
    "jakarta\annotation\jakarta.annotation-api\*\*.jar"
    "org\springframework\spring-context\6.1.6\*.jar"
    "org\springframework\spring-beans\6.1.6\*.jar"
    "org\springframework\spring-tx\6.1.6\*.jar"
    "org\springframework\spring-web\6.1.6\*.jar"
    "org\springframework\spring-core\6.1.6\*.jar"
    "org\springframework\spring-expression\6.1.6\*.jar"
    "org\springframework\spring-aop\6.1.6\*.jar"
    "org\springframework\spring-jcl\6.1.6\*.jar"
    "org\springframework\spring-orm\6.1.6\*.jar"
    "org\springframework\spring-aspects\6.1.6\*.jar"
    "org\springframework\data\spring-data-jpa\3.2.5\*.jar"
    "org\springframework\data\spring-data-commons\3.2.5\*.jar"
    "org\hibernate\orm\hibernate-core\6.4.4.Final\*.jar"
    "org\slf4j\slf4j-api\2.0.13\*.jar"
    "com\fasterxml\jackson\module\jackson-module-parameter-names\*\*.jar"
    "org\springframework\kafka\spring-kafka\*\*.jar"
    "org\apache\kafka\kafka-clients\*\*.jar"
)

foreach ($pattern in $jarPatterns) {
    $found = Get-ChildItem -Path "$m2\$pattern" -ErrorAction SilentlyContinue
    foreach ($f in $found) {
        $jars += $f.FullName
    }
}

$cp = $jars -join [IO.Path]::PathSeparator

# Find source files
$sources = Get-ChildItem -Path $srcDir -Filter '*.java' -Recurse | Select-Object -ExpandProperty FullName
$srcCount = $sources.Count
Write-Host "Found $srcCount source files"
Write-Host "Classpath has $($jars.Count) jars"

# Write sources to argfile (UTF-8 without BOM)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllLines("$outDir\sources.txt", $sources, $utf8NoBom)

# Compile
& $javac --release 21 -d $outDir -cp $cp "@$outDir\sources.txt"
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "`nBUILD SUCCESS - All $srcCount source files compiled successfully" -ForegroundColor Green
    
    # Count generated .class files
    $classCount = (Get-ChildItem -Path $outDir -Filter '*.class' -Recurse).Count
    Write-Host "Generated $classCount .class files"
} else {
    Write-Host "`nBUILD FAILED with exit code $exitCode" -ForegroundColor Red
}

exit $exitCode
