[CmdletBinding()]
param(
    [string]$TenantId = 'tenant-routing-isolated',
    [string]$Username = 'routing-isolated-admin',
    [int]$RoutingTopK = 3,
    [string]$KeycloakAdminUsername = $env:E2E_KEYCLOAK_ADMIN_USERNAME,
    [string]$KeycloakAdminPassword = $env:E2E_KEYCLOAK_ADMIN_PASSWORD,
    [switch]$RequireRoutingSelection,
    [switch]$SkipPlaywright
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$composeFiles = @(
    (Join-Path $repoRoot 'docker-compose.yml'),
    (Join-Path $repoRoot 'docker-compose.task5.yml')
)

function Invoke-Checked {
    param([scriptblock]$Command, [string]$FailureMessage)
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}

function Wait-HttpHealth {
    param([string]$Name, [string]$Url, [int]$TimeoutSeconds = 120)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Host "healthy: $Name"
                return
            }
        } catch {
            # The service may still be starting; wait until the bounded deadline.
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    throw "$Name did not become healthy at $Url"
}

if ($RoutingTopK -le 0) {
    throw 'RoutingTopK must be greater than zero.'
}

# Recreate Copilot and LLM Gateway: Task5 mounts the current backend source
# into both containers, so this activates the durable audit writer and the
# fail-closed tool-decision guard without a broad local-stack rebuild.
Push-Location $repoRoot
try {
    Invoke-Checked {
        docker compose -f $composeFiles[0] -f $composeFiles[1] up -d --no-build --force-recreate mate-tech-llmgw mate-app-copilot
    } 'Unable to recreate the LLM Gateway and Copilot from the local Task5 profile.'
} finally {
    Pop-Location
}

Wait-HttpHealth -Name 'mate-app-copilot' -Url 'http://127.0.0.1:8601/healthz'
Wait-HttpHealth -Name 'mate-tech-orchestrator' -Url 'http://127.0.0.1:8505/healthz'
Wait-HttpHealth -Name 'mate-api-gateway' -Url 'http://127.0.0.1:8100/healthz'

# A fresh random password stays only in this process environment. The script
# uses Keycloak's in-container admin variables and never writes or prints it.
$password = "routing-$([guid]::NewGuid().ToString('N'))"
$userRepresentation = @{
    username = $Username
    enabled = $true
    email = "$Username@metaplatform.local"
    emailVerified = $true
    firstName = 'Routing'
    lastName = 'Acceptance'
    attributes = @{ tenant_id = @($TenantId) }
} | ConvertTo-Json -Compress -Depth 4
$resolvedKeycloakAdminUsername = $KeycloakAdminUsername
if (-not $resolvedKeycloakAdminUsername) {
    $resolvedKeycloakAdminUsername = (& docker exec mate-keycloak sh -ceu 'printf %s "$KEYCLOAK_ADMIN"').Trim()
}
$resolvedKeycloakAdminPassword = $KeycloakAdminPassword
if (-not $resolvedKeycloakAdminPassword) {
    $resolvedKeycloakAdminPassword = (& docker exec mate-keycloak sh -ceu 'printf %s "$KEYCLOAK_ADMIN_PASSWORD"').Trim()
}
if (-not $resolvedKeycloakAdminUsername -or -not $resolvedKeycloakAdminPassword) {
    throw 'No Keycloak master administrator credentials are available. Set E2E_KEYCLOAK_ADMIN_USERNAME and E2E_KEYCLOAK_ADMIN_PASSWORD in the current shell; they are only used in-memory for this local acceptance run.'
}
$bootstrap = @'
set -eu
/opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master \
  --user "$ROUTING_KEYCLOAK_ADMIN_USERNAME" --password "$ROUTING_KEYCLOAK_ADMIN_PASSWORD" >/dev/null
# Keycloak 25 disables unmanaged attributes by default.  The tenant claim is
# provisioned only by the admin path below, so ADMIN_EDIT preserves the
# user-facing restriction while allowing the OIDC mapper to read tenant_id.
/opt/keycloak/bin/kcadm.sh update users/profile -r metaplatform \
  -s unmanagedAttributePolicy=ADMIN_EDIT >/dev/null
user_id=$(/opt/keycloak/bin/kcadm.sh get users -r metaplatform -q username="$ROUTING_USERNAME" --fields id \
  | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p' | head -n 1)
if [ -z "$user_id" ]; then
  printf '%s' "$ROUTING_USER_BODY" \
    | /opt/keycloak/bin/kcadm.sh create users -r metaplatform -f - >/dev/null
  user_id=$(/opt/keycloak/bin/kcadm.sh get users -r metaplatform -q username="$ROUTING_USERNAME" --fields id \
    | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p' | head -n 1)
else
  /opt/keycloak/bin/kcadm.sh update "users/$user_id" -r metaplatform \
    -s "attributes.tenant_id=[\"$ROUTING_TENANT_ID\"]" >/dev/null
fi
[ -n "$user_id" ]
/opt/keycloak/bin/kcadm.sh set-password -r metaplatform --username "$ROUTING_USERNAME" \
  --new-password "$ROUTING_PASSWORD" >/dev/null
/opt/keycloak/bin/kcadm.sh add-roles -r metaplatform --uusername "$ROUTING_USERNAME" \
  --rolename PLATFORM_ADMIN >/dev/null
'@
Invoke-Checked {
    docker exec `
        -e "ROUTING_TENANT_ID=$TenantId" `
        -e "ROUTING_USERNAME=$Username" `
        -e "ROUTING_PASSWORD=$password" `
        -e "ROUTING_USER_BODY=$userRepresentation" `
        -e "ROUTING_KEYCLOAK_ADMIN_USERNAME=$resolvedKeycloakAdminUsername" `
        -e "ROUTING_KEYCLOAK_ADMIN_PASSWORD=$resolvedKeycloakAdminPassword" `
        mate-keycloak sh -ceu $bootstrap
} 'Unable to provision the isolated local Keycloak acceptance account. Supply the current master administrator credentials through E2E_KEYCLOAK_ADMIN_USERNAME and E2E_KEYCLOAK_ADMIN_PASSWORD; this script will not bypass Keycloak or modify its database directly.'

if (-not $SkipPlaywright) {
    $webDir = Join-Path $repoRoot 'metaplatform-frontend\apps\web'
    Push-Location $webDir
    try {
        $env:E2E_TENANT_B_ID = $TenantId
        $env:E2E_TENANT_B_USERNAME = $Username
        $env:E2E_TENANT_B_PASSWORD = $password
        $env:E2E_ROUTING_TOP_K = "$RoutingTopK"
        if ($RequireRoutingSelection) {
            $env:E2E_REQUIRE_ROUTING_SELECTION = 'true'
        } else {
            Remove-Item Env:E2E_REQUIRE_ROUTING_SELECTION -ErrorAction SilentlyContinue
        }
        Invoke-Checked {
            pnpm exec playwright test tests/e2e/superai-routing.spec.ts -g '路由只使用当前租户' --project=web
        } 'The first two-tenant Playwright routing acceptance run failed.'
        Invoke-Checked {
            pnpm exec playwright test tests/e2e/superai-routing.spec.ts -g '路由只使用当前租户' --project=web
        } 'The repeated two-tenant Playwright routing acceptance run failed.'
    } finally {
        Remove-Item Env:E2E_TENANT_B_ID -ErrorAction SilentlyContinue
        Remove-Item Env:E2E_TENANT_B_USERNAME -ErrorAction SilentlyContinue
        Remove-Item Env:E2E_TENANT_B_PASSWORD -ErrorAction SilentlyContinue
        Remove-Item Env:E2E_ROUTING_TOP_K -ErrorAction SilentlyContinue
        Remove-Item Env:E2E_REQUIRE_ROUTING_SELECTION -ErrorAction SilentlyContinue
        Pop-Location
    }
}

$dbUser = (& docker exec mate-postgres sh -ceu 'printf %s "$POSTGRES_USER"').Trim()
if (-not $dbUser) {
    throw 'Unable to resolve the local PostgreSQL service user.'
}
$query = "SELECT COALESCE(json_agg(json_build_object('tenant_id', tenant_id, 'event_type', event_type, 'payload', payload))::text, '[]') FROM outbox_event WHERE event_type IN ('copilot.routing.decided', 'copilot.routing.denied');"
$auditJson = & docker exec mate-postgres psql -U $dbUser -d metaplatform -Atc $query
if ($LASTEXITCODE -ne 0) {
    throw 'Unable to query durable Copilot routing audit records.'
}
$auditRecords = @($auditJson | ConvertFrom-Json)
$defaultTenantEvents = @($auditRecords | Where-Object {
    $_.tenant_id -eq 'tenant-default' -and $_.event_type -in @('copilot.routing.decided', 'copilot.routing.denied')
})
$denied = @($auditRecords | Where-Object {
    $_.tenant_id -eq $TenantId -and $_.event_type -eq 'copilot.routing.denied'
})
if ($defaultTenantEvents.Count -lt 1 -or $denied.Count -lt 1) {
    throw 'Durable audit is missing either the default-tenant route or the denied isolated-tenant route.'
}
if ($RequireRoutingSelection -and @($defaultTenantEvents | Where-Object { $_.event_type -eq 'copilot.routing.decided' }).Count -lt 1) {
    throw 'A real Provider was required, but the default-tenant route did not produce a selected durable audit event.'
}
foreach ($record in @($defaultTenantEvents + $denied)) {
    if (-not $record.payload.trace_id -or -not $record.payload.correlation_id) {
        throw 'Durable routing audit record is missing trace or correlation evidence.'
    }
}

Write-Host 'PRD-05 semantic-router Docker and two-tenant acceptance passed.'
