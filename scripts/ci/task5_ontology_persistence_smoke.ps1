Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$deadlineSeconds = 120
$dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'meta' }

function Invoke-Docker {
    & docker @args
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed ($LASTEXITCODE): docker $($args -join ' ')"
    }
}

function Wait-ContainerHealth {
    param([Parameter(Mandatory)][string]$Name)

    $deadline = (Get-Date).AddSeconds($deadlineSeconds)
    do {
        $status = & docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $Name
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to inspect container $Name"
        }
        if ($status -eq 'healthy') {
            return
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)

    throw "$Name did not become healthy within $deadlineSeconds seconds; last status: $status"
}

$compose = @(
    '-f', 'docker-compose.yml',
    '-f', 'docker-compose.override.yml',
    '-f', 'docker-compose.task5.yml',
    '-f', 'docker-compose.acceptance.yml'
)

Push-Location $repoRoot
try {
    Wait-ContainerHealth 'mate-postgres'
    Wait-ContainerHealth 'mate-neo4j'

    Invoke-Docker compose @compose up -d --no-deps --force-recreate mate-tech-ont
    Wait-ContainerHealth 'mate-tech-ont'

    $before = & docker exec mate-postgres psql -U $dbUser -d metaplatform_ont -Atc 'SELECT count(*) FROM ont_object_type'
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to read persisted ontology object types from PostgreSQL'
    }
    if ([int]$before -lt 1) {
        throw 'Ontology demo seed was not persisted in PostgreSQL'
    }

    Invoke-Docker compose @compose up -d --no-deps --force-recreate mate-tech-ont
    Wait-ContainerHealth 'mate-tech-ont'

    $after = & docker exec mate-postgres psql -U $dbUser -d metaplatform_ont -Atc 'SELECT count(*) FROM ont_object_type'
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to re-read persisted ontology object types from PostgreSQL'
    }
    if ([int]$after -ne [int]$before) {
        throw "Ontology object-type count changed across restart: $before -> $after"
    }

    Write-Output "Task5 ontology persistence verified: $before -> $after object types"
} finally {
    Pop-Location
}
