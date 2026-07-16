$ProgressPreference = 'SilentlyContinue'
$url = 'http://127.0.0.1:8092/api/apps'
$headers = @{ 'Authorization' = 'Bearer dev' }
$out = ''
try {
    $r = Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing
    $out += "STATUS=$($r.StatusCode)`r`n"
    $out += "CONTENT-TYPE=$($r.Headers['Content-Type'])`r`n"
    $out += "BODY-LEN=$($r.Content.Length)`r`n"
    $preview = $r.Content.Substring(0, [Math]::Min(500, $r.Content.Length))
    $out += "BODY=$preview`r`n"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $bodyText = $reader.ReadToEnd()
    $out += "ERROR-STATUS=$statusCode`r`n"
    $out += "ERROR-BODY-LEN=$($bodyText.Length)`r`n"
    $preview = $bodyText.Substring(0, [Math]::Min(500, $bodyText.Length))
    $out += "ERROR-BODY=$preview`r`n"
}
Set-Content -Path 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\tools\.check-8092-result.txt' -Value $out -Encoding utf8