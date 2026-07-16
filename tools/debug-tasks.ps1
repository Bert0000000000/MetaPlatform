$base = "http://localhost:8081/flowable-rest/service"
$auth = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:test"))

function Get-Tasks($url) {
    $res = Invoke-RestMethod -Uri $url -Method GET -Headers @{ Authorization = $auth } -UseBasicParsing
    Write-Host "URL: $url"
    Write-Host "Count: $($res.data.Count)"
    foreach ($t in $res.data) {
        Write-Host "  Task: $($t.id) name=$($t.name) assignee=$($t.assignee) candidateGroups=$($t.candidateGroup) procInst=$($t.processInstanceId)"
    }
}

Get-Tasks "$base/runtime/tasks?size=1000"
Get-Tasks "$base/runtime/tasks?candidateGroups=admin&size=1000"
Get-Tasks "$base/runtime/tasks?assignee=dev-user&size=1000"
Get-Tasks "$base/runtime/tasks?candidate=dev-user&size=1000"
Get-Tasks "$base/runtime/tasks?candidateGroups=admin&assignee=dev-user&size=1000"
