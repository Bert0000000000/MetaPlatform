[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateNotNullOrEmpty()]
    [string]$AccessToken,

    [string]$GatewayUrl = "http://127.0.0.1:8100",

    [string]$TenantId = "tenant-default",

    [string]$DefinitionId = "order-review-local-acceptance"
)

$ErrorActionPreference = "Stop"
$baseUrl = $GatewayUrl.TrimEnd("/")
$headers = @{
    Authorization = "Bearer $AccessToken"
    "X-Tenant-Id" = $TenantId
}

function Invoke-WorkflowRequest {
    param(
        [Parameter(Mandatory)] [string]$Method,
        [Parameter(Mandatory)] [string]$Path,
        [object]$Body,
        [hashtable]$ExtraHeaders = @{}
    )

    $requestHeaders = @{}
    foreach ($entry in $headers.GetEnumerator()) {
        $requestHeaders[$entry.Key] = $entry.Value
    }
    foreach ($entry in $ExtraHeaders.GetEnumerator()) {
        $requestHeaders[$entry.Key] = $entry.Value
    }
    $request = @{
        Method = $Method
        Uri = "$baseUrl$Path"
        Headers = $requestHeaders
    }
    if ($null -ne $Body) {
        $request.ContentType = "application/json"
        $request.Body = $Body | ConvertTo-Json -Depth 12 -Compress
    }
    Invoke-RestMethod @request
}

$registry = Invoke-WorkflowRequest -Method "Get" -Path "/api/v1/workflow-definitions/node-registry"
if (-not $registry.items) {
    throw "WFE node registry is empty; verify Gateway routing and WFE readiness."
}

try {
    $current = Invoke-WorkflowRequest -Method "Get" -Path "/api/v1/workflow-definitions/$DefinitionId"
    $version = [int]$current.version
} catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 404) { throw }
    $version = 0
}

$plan = @{
    nodes = @(
        @{ id = "start"; type = "start"; label = "Start" },
        @{ id = "review"; type = "action"; action_type = "order.review"; requires_confirmation = $true; input = @{ order_id = "order-smoke-001" } },
        @{ id = "end"; type = "end"; label = "End" }
    )
    edges = @(
        @{ id = "edge-start-review"; source = "start"; target = "review" },
        @{ id = "edge-review-end"; source = "review"; target = "end" }
    )
}

$saved = Invoke-WorkflowRequest -Method "Put" -Path "/api/v1/workflow-definitions/$DefinitionId" -Body @{
    name = "PRD08 local acceptance order review"
    version = $version
    draft_plan = $plan
}
if (-not $saved.validation.valid) {
    throw "Saved Plan failed server validation: $($saved.validation | ConvertTo-Json -Compress)"
}

$nonce = [Guid]::NewGuid().ToString("N")
$published = Invoke-WorkflowRequest -Method "Post" -Path "/api/v1/workflow-definitions/${DefinitionId}:publish" -ExtraHeaders @{ "Idempotency-Key" = "prd08-publish-$nonce" }
if ($published.status -ne "published" -or $published.published_version -lt 1) {
    throw "Definition did not publish successfully."
}

$run = Invoke-WorkflowRequest -Method "Post" -Path "/api/v1/workflows/$DefinitionId/runs" -Body @{
    input = @{ source = "prd08-smoke" }
    correlation_id = "prd08-$nonce"
} -ExtraHeaders @{ "Idempotency-Key" = "prd08-run-$nonce" }
if (-not $run.run_id -or -not $run.status_url) {
    throw "Workflow did not return the required run_id and status_url."
}

$state = Invoke-WorkflowRequest -Method "Get" -Path $run.status_url
if ($state.definition_version -ne $run.definition_version) {
    throw "Run status does not retain the published definition version."
}

[PSCustomObject]@{
    definition_id = $DefinitionId
    published_version = $published.published_version
    run_id = $run.run_id
    run_status = $state.status
    definition_version = $state.definition_version
} | ConvertTo-Json -Compress
