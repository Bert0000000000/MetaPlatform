# 注册 Mate Platform 开发环境网关路由
# 依赖：TECH-IAM 与 TECH-GW 已启动

$ErrorActionPreference = "Stop"
$gwUrl = "http://localhost:8000"

$adminUser = "admin"
$adminPass = "Meta@12345"
$adminEmail = "admin@metaplatform.local"
$tenantId = "default"

function Get-AdminToken {
    $registerBody = @{
        username = $adminUser
        email = $adminEmail
        password = $adminPass
        tenantId = $tenantId
        realName = "系统管理员"
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$gwUrl/api/v1/iam/auth/register" -Method POST -ContentType "application/json" -Body $registerBody | Out-Null
        Write-Host "Admin registered."
    } catch {
        Write-Host "Admin register skipped (maybe exists): $($_.Exception.Message)"
    }

    $loginBody = @{
        username = $adminUser
        password = $adminPass
        tenantId = $tenantId
    } | ConvertTo-Json

    $loginResp = Invoke-RestMethod -Uri "$gwUrl/api/v1/iam/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
    return $loginResp.data.accessToken
}

function Register-Route($token, $routeId, $name, $uri, $path) {
    $body = @{
        routeId = $routeId
        name = $name
        uri = $uri
        predicates = @(
            @{ name = "Path"; args = @{ pattern = $path } }
        )
        filters = @()
        priority = 100
        enabled = $true
    } | ConvertTo-Json -Depth 4

    $headers = @{ Authorization = "Bearer $token" }

    try {
        $resp = Invoke-RestMethod -Uri "$gwUrl/api/v1/gw/routes" -Method POST -ContentType "application/json" -Headers $headers -Body $body
        Write-Host "Registered route [$routeId] -> $uri$path"
    } catch {
        $err = $_.Exception.Response
        if ($err -and $err.StatusCode -eq 409) {
            Write-Host "Route [$routeId] already exists, skipping."
        } else {
            Write-Warning "Failed to register route [$routeId]: $($_.Exception.Message)"
        }
    }
}

Write-Host "Getting admin token..."
$token = Get-AdminToken
Write-Host "Token acquired."

$routes = @(
    @{ RouteId = "iam"; Name = "IAM Service"; Uri = "http://localhost:8101"; Path = "/api/v1/iam/**" },
    @{ RouteId = "ont"; Name = "Ontology Service"; Uri = "http://localhost:8201"; Path = "/api/v1/ont/**" },
    @{ RouteId = "rule"; Name = "Rule Service"; Uri = "http://localhost:8501"; Path = "/api/v1/rule/**" },
    @{ RouteId = "msg"; Name = "Message Service"; Uri = "http://localhost:8601"; Path = "/api/v1/msg/**" },
    @{ RouteId = "ea"; Name = "EA Service"; Uri = "http://localhost:8106"; Path = "/api/v1/ea/**" },
    @{ RouteId = "obs"; Name = "Observability Service"; Uri = "http://localhost:8301"; Path = "/api/v1/obs/**" },
    @{ RouteId = "llmgw"; Name = "LLM Gateway Service"; Uri = "http://localhost:8401"; Path = "/api/v1/llmgw/**" },
    @{ RouteId = "data"; Name = "Data Service"; Uri = "http://localhost:8701"; Path = "/api/v1/data/**" },
    @{ RouteId = "wfe"; Name = "Workflow Engine Service"; Uri = "http://localhost:8801"; Path = "/api/v1/wfe/**" },
    @{ RouteId = "action"; Name = "Action Engine Service"; Uri = "http://localhost:8104"; Path = "/api/v1/action/**" },
    @{ RouteId = "rag"; Name = "RAG Service"; Uri = "http://localhost:8901"; Path = "/api/v1/rag/**" },
    @{ RouteId = "agent"; Name = "Agent Service"; Uri = "http://localhost:8511"; Path = "/api/v1/agent/**" },
    @{ RouteId = "a2a"; Name = "A2A Service"; Uri = "http://localhost:8502"; Path = "/api/v1/a2a/**" },
    @{ RouteId = "mcp"; Name = "MCP Service"; Uri = "http://localhost:8105"; Path = "/api/v1/mcp/**" }
)

Write-Host "Registering routes..."
foreach ($r in $routes) {
    Register-Route -token $token -routeId $r.RouteId -name $r.Name -uri $r.Uri -path $r.Path
}

Write-Host "Refreshing gateway routes..."
$refreshHeaders = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "$gwUrl/api/v1/gw/routes/default/refresh" -Method POST -Headers $refreshHeaders | Out-Null
Write-Host "Gateway routes refreshed."
Write-Host "Done."
