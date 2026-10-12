$ErrorActionPreference = 'Stop'
$headers = @{ 'User-Agent' = 'MetaPlatform-v1.1-Research' }
$snapshots = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'commit-snapshots.json') -Raw -Encoding utf8 | ConvertFrom-Json
$specs = @(
    @{ Repo='open-metadata/OpenMetadata'; Paths=@('README.md','pom.xml','openmetadata-ui/src/main/resources/ui/package.json','openmetadata-service/src/main/java/org/openmetadata/service/OpenMetadataApplication.java','openmetadata-service/src/main/java/org/openmetadata/service/resources/services/database/DatabaseServiceResource.java','openmetadata-ui/src/main/resources/ui/src/pages/AddServicePage/AddServicePage.component.tsx','openmetadata-mcp/src/main/java/org/openmetadata/mcp/McpServer.java') },
    @{ Repo='nocobase/nocobase'; Paths=@('README.md','package.json','packages/core/server/src/application.ts','packages/core/server/src/plugin-manager/plugin-manager.ts','packages/plugins/@nocobase/plugin-data-source-main/src/server/index.ts','packages/plugins/@nocobase/plugin-workflow/src/server/index.ts','packages/plugins/@nocobase/plugin-acl/src/server/index.ts','packages/plugins/@nocobase/plugin-workflow/LICENSE','packages/plugins/@nocobase/plugin-data-source-main/LICENSE') },
    @{ Repo='datahub-project/datahub'; Paths=@('README.md','datahub-web-react/package.json','metadata-ingestion/src/datahub/ingestion/api/source.py','metadata-ingestion/src/datahub/emitter/rest_emitter.py','datahub-web-react/src/app/ingestV2/source/multiStepBuilder/IngestionSourceBuilder.tsx') },
    @{ Repo='protegeproject/webprotege'; Paths=@('README.md','pom.xml','webprotege-server-core/src/main/java/edu/stanford/bmir/protege/web/server/project/chg/ChangeManager.java','webprotege-server-core/src/main/java/edu/stanford/bmir/protege/web/server/sharing/ProjectSharingSettingsManagerImpl.java') },
    @{ Repo='ontop/ontop'; Paths=@('README.md','pom.xml','binding/owlapi/src/main/java/it/unibz/inf/ontop/owlapi/OntopOWLFactory.java') },
    @{ Repo='apache/jena'; Paths=@('README.md','jena-shacl/src/main/java/org/apache/jena/shacl/ShaclValidator.java') },
    @{ Repo='getzep/graphiti'; Paths=@('README.md','pyproject.toml','graphiti_core/graphiti.py','graphiti_core/edges.py') },
    @{ Repo='deepseek-ai/deepseek-harness'; Paths=@('README.md','packages/mcp/mcp-client/README.md','packages/mcp/mcp-client/package.json','packages/mcp/mcp-client/src/index.ts','packages/mcp/mcp-client/src/transport.ts','packages/mcp/mcp-client/src/tools.ts','packages/mcp/mcp-client/src/connection.ts') },
    @{ Repo='PrefectHQ/fastmcp'; Paths=@('README.md','pyproject.toml','src/fastmcp/server/server.py') },
    @{ Repo='directus/directus'; Paths=@('license') },
    @{ Repo='Budibase/budibase'; Paths=@('packages/pro/LICENSE.md','packages/builder/LICENSE','packages/client/LICENSE') }
)
$records = @()
foreach ($spec in $specs) {
    $snapshot = $snapshots | Where-Object full_name -eq $spec.Repo | Select-Object -First 1
    if (-not $snapshot) { Write-Output ('NO_SNAPSHOT ' + $spec.Repo); continue }
    foreach ($path in $spec.Paths) {
        $target = Join-Path $PSScriptRoot ('sources/' + $spec.Repo.Replace('/','__') + '/' + $path)
        $url = 'https://raw.githubusercontent.com/' + $spec.Repo + '/' + $snapshot.sha + '/' + $path
        try {
            if (-not (Test-Path -LiteralPath $target)) {
                New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
                $response = Invoke-WebRequest -Uri $url -Headers $headers -TimeoutSec 20
                [IO.File]::WriteAllText($target,$response.Content,[Text.UTF8Encoding]::new($false))
            }
            $hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLower()
            $records += [pscustomobject]@{ repo=$spec.Repo; sha=$snapshot.sha; path=$path; url=$url; sha256=$hash }
            Write-Output ('SOURCE ' + $spec.Repo + ' ' + $path)
        } catch { Write-Output ('FETCH_ERROR ' + $spec.Repo + ' ' + $path + ' ' + $_.Exception.Message) }
    }
}
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'source-manifest.json'),($records | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
