$base = "http://localhost:8092/api"
function Invoke-Api($method, $path, $body) {
    $uri = "$base$path"
    $opts = @{ Uri = $uri; Method = $method; ContentType = "application/json"; UseBasicParsing = $true }
    if ($body) { $opts.Body = ($body | ConvertTo-Json -Depth 10 -Compress) }
    try {
        $res = Invoke-RestMethod @opts
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if ($resp) {
            $stream = $resp.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errBody = $reader.ReadToEnd()
            $reader.Close()
            throw "API failed: $method $path => $errBody"
        }
        throw "API failed: $method $path => $($_.Exception.Message)"
    }
    if ($res.success -eq $false -or ($res.PSObject.Properties.Name -contains 'success' -and -not $res.success)) {
        throw "API failed: $method $path => $($res | ConvertTo-Json -Depth 3)"
    }
    # Use Write-Output -NoEnumerate to preserve arrays, preventing PowerShell unrolling
    , $res.data
}

$ts = Get-Date -Format "yyyyMMddHHmmss"
$appCode = "m3e2e$ts"
Write-Host "==> 1. Create app ($appCode)"
$app = Invoke-Api POST "/apps" @{ code = $appCode; name = "M3 E2E"; description = "E2E test" }
$appId = $app.id
Write-Host "App id: $appId"

Write-Host "==> 2. Create object"
$obj = Invoke-Api POST "/apps/$appId/objects" (@{
    code = "request"
    name = "Request"
    description = "Request object"
    fields = @(
        @{ code = "amount"; name = "Amount"; type = "number"; required = $true }
        @{ code = "reason"; name = "Reason"; type = "text"; required = $true }
    )
})
$objId = $obj.id
Write-Host "Object id: $objId"

Write-Host "==> 3. Create form"
$form = Invoke-Api POST "/apps/$appId/forms" (@{
    code = "request_form"
    name = "Request Form"
    objectId = $objId
    schema = @{
        sections = @(@{
            title = "Basic Info"
            fields = @(
                @{ fieldKey = "amount"; label = "Amount"; widget = "number"; required = $true }
                @{ fieldKey = "reason"; label = "Reason"; widget = "input"; required = $true }
            )
        })
    }
})
$formId = $form.id
Write-Host "Form id: $formId"

Write-Host "==> 4. Publish form"
Invoke-Api POST "/apps/$appId/forms/$formId/publish" $null | Out-Null

Write-Host "==> 5. Create workflow with field permissions"
$bpmnXml = @"
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:flowable="http://flowable.org/bpmn"
  xmlns:mp="http://metaplatform.org/bpmn"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="m3e2eProcess$ts" name="M3 E2E Process" isExecutable="true">
    <bpmn:startEvent id="start_1" name="Start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="approval_1" name="Approval" flowable:candidateGroups="admin">
      <bpmn:extensionElements>
        <mp:fieldPermissions>[{"key":"amount","permission":"readonly"},{"key":"reason","permission":"editable"}]</mp:fieldPermissions>
      </bpmn:extensionElements>
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="end_1" name="End">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start_1" targetRef="approval_1" />
    <bpmn:sequenceFlow id="flow2" sourceRef="approval_1" targetRef="end_1" />
  </bpmn:process>
</definitions>
"@
Write-Host "BPMN XML length: $($bpmnXml.Length)"
Write-Host "BPMN XML first 200 chars: $($bpmnXml.Substring(0, [Math]::Min(200, $bpmnXml.Length)))"
$wf = Invoke-Api POST "/apps/$appId/workflows" (@{ name = "M3 E2E Workflow"; code = "m3e2e_wf"; formId = $formId; bpmnXml = $bpmnXml })
$wfId = $wf.id
Write-Host "Workflow id: $wfId"

Write-Host "==> 6. Verify workflow bpmnXml roundtrip"
$wf2 = Invoke-Api GET "/apps/$appId/workflows/$wfId" $null
if ($wf2.bpmnXml -notmatch "mp:fieldPermissions") { throw "fieldPermissions not persisted in BPMN XML" }
Write-Host "BPMN XML roundtrip OK"

Write-Host "==> 7. Publish workflow and bind to form"
Invoke-Api POST "/apps/$appId/workflows/$wfId/publish" $null | Out-Null
Invoke-Api POST "/apps/$appId/forms/$formId/workflow" (@{ workflowDefinitionId = $wfId }) | Out-Null
Write-Host "Published and bound"

Write-Host "==> 8. Submit form"
$sub = Invoke-Api POST "/public/forms/$formId/submit" (@{ values = @{ amount = 1000; reason = "test" }; submitterEmail = "test@example.com"; submitterName = "Tester" })
$subId = $sub.id
Write-Host "Submission id: $subId"
Start-Sleep -Seconds 5

Write-Host "==> 9. Check submissions API"
$subs = Invoke-Api GET "/public/forms/$formId/submissions" $null
if ($subs.rows.Count -ne 1) { throw "Expected 1 submission, got $($subs.rows.Count)" }
$firstSub = $subs.rows[0]
if ($firstSub.amount -ne 1000) { throw "Submission value not returned" }
Write-Host "Submissions API OK"
Write-Host "Submission workflow_status: $($firstSub.workflow_status), process_instance_id: $($firstSub.process_instance_id)"

Write-Host "==> 10. Check todo list"
$todos = Invoke-Api GET "/apps/$appId/todos" $null
$retry = 0
while ($todos.Count -lt 1 -and $retry -lt 10) {
    Start-Sleep -Seconds 2
    $todos = Invoke-Api GET "/apps/$appId/todos" $null
    $retry++
}
if ($todos.Count -lt 1) { throw "Expected at least 1 todo" }
$taskId = $todos[0].id
Write-Host "Todo task id: $taskId"

Write-Host "==> 11. Get process instance detail"
$instanceId = $subs.rows[0].process_instance_id
if (-not $instanceId) { throw "process_instance_id missing" }
$detail = Invoke-Api GET "/apps/$appId/process-instances/$instanceId" $null
if (-not $detail.bpmnXml) { throw "process instance detail missing bpmnXml" }
if ($detail.currentTasks.Count -lt 1) { throw "process instance detail missing currentTasks" }
Write-Host "Process instance detail OK"

Write-Host "==> 12. Complete task"
Invoke-Api POST "/apps/$appId/todos/$taskId/complete" (@{ comment = "Approved" }) | Out-Null
Write-Host "Task completed"

Start-Sleep -Seconds 3
try {
    $detail2 = Invoke-Api GET "/apps/$appId/process-instances/$instanceId" $null
    Write-Host ("Final process status: " + $detail2.instance.status)
} catch {
    Write-Host ("Process instance already finished (expected for end event): " + $_.Exception.Message)
}

Write-Host "==> M3 E2E PASSED"
