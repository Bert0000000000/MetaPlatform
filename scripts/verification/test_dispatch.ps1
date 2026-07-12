$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1LWFkbWluIiwiZW1haWwiOiJhZG1pbkBtZXRhcGxhdGZvcm0uY29tIiwicm9sZSI6ImFkbWluIiwibmFtZSI6IueuoeeQhuWRmCIsInRlbmFudF9pZCI6ImRlZmF1bHQiLCJpYXQiOjE3ODM2NTg0MDEsImV4cCI6MTc4Mzc0NDgwMX0.Cx8Qi4y-3rDydTBl_E8vmI0p06F_2hVa52r7_k_45Ow"

$messages = @(
    "帮我建一个请假审批应用",
    "创建一个采购管理表单应用",
    "建一个销售业绩报表",
    "新建客户拜访记录流程"
)

foreach ($msg in $messages) {
    Write-Output "============================================================"
    Write-Output "USER: $msg"
    Write-Output "============================================================"

    $body = @{ message = $msg } | ConvertTo-Json -Compress
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $bodyBytes = $utf8.GetBytes($body)

    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3001/api/dispatch/dispatch" `
            -Method POST `
            -Body $bodyBytes `
            -ContentType "application/json; charset=utf-8" `
            -Headers @{ Authorization = "Bearer $token" } `
            -UseBasicParsing `
            -TimeoutSec 10

        $resp = $r.Content | ConvertFrom-Json
        Write-Output "Type: $($resp.data.type)"
        Write-Output "Agents: $($resp.data.agents.id -join ', ')"
        Write-Output "Response:"
        Write-Output $resp.data.response
        if ($resp.data.data.results) {
            $r0 = $resp.data.data.results[0]
            if ($r0.modules) {
                Write-Output ""
                Write-Output "📦 Modules created ($($r0.modulesCount)):"
                $r0.modules | ForEach-Object { Write-Output "   - $_" }
                Write-Output ""
                Write-Output "🎯 Primary page: $($r0.primaryPage.pageName) -> $($r0.primaryPage.moduleLabel)"
                $r0.extraPages | ForEach-Object { Write-Output "   + $($_.pageName) -> $($_.moduleLabel)" }
            }
        }
    } catch {
        Write-Output "ERR: $_"
    }
    Write-Output ""
}