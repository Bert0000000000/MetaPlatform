param([switch]$Refresh)
$ErrorActionPreference = 'Stop'
$cacheRoot = Join-Path $PSScriptRoot 'cache'
New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null
$headers = @{ 'User-Agent' = 'MetaPlatform-v1.1-Research'; Accept = 'application/vnd.github+json' }
function Get-CachedJson([string]$Url, [string]$Name) {
    $target = Join-Path $cacheRoot $Name
    if ($Refresh -or -not (Test-Path -LiteralPath $target)) {
        $response = Invoke-WebRequest -Uri $Url -Headers $headers -TimeoutSec 25
        [System.IO.File]::WriteAllText($target, $response.Content, [System.Text.UTF8Encoding]::new($false))
    }
    return Get-Content -LiteralPath $target -Raw -Encoding utf8 | ConvertFrom-Json
}
$queries = @(
    @{ Name = 'search-ontology-platform.json'; Query = 'ontology platform stars:>100' },
    @{ Name = 'search-owl-editor.json'; Query = 'OWL ontology editor stars:>50' },
    @{ Name = 'search-knowledge-graph.json'; Query = 'knowledge graph platform stars:>1000' }
)
foreach ($entry in $queries) {
    try {
        $url = 'https://api.github.com/search/repositories?q=' + [uri]::EscapeDataString($entry.Query) + '&sort=stars&order=desc&per_page=15'
        $result = Get-CachedJson $url $entry.Name
        Write-Output ('SEARCH ' + $entry.Query + ': ' + $result.total_count)
    } catch { Write-Output ('SEARCH_ERROR ' + $entry.Name + ': ' + $_.Exception.Message) }
}
$repositories = @(
    'open-metadata/OpenMetadata', 'datahub-project/datahub',
    'nocobase/nocobase', 'appsmithorg/appsmith', 'budibase/budibase', 'directus/directus',
    'neo4j/neo4j', 'apache/jena', 'apache/hugegraph',
    'protegeproject/webprotege', 'protegeproject/protege', 'ontop/ontop',
    'VisualDataWeb/WebVOWL', 'ge-semtk/semtk', 'terminusdb/terminusdb',
    'getzep/graphiti', 'HKUDS/LightRAG', 'jlowin/fastmcp',
    'deepseek-ai/deepseek-harness', 'modelcontextprotocol/python-sdk'
)
$summary = @()
foreach ($fullName in $repositories) {
    try {
        $name = $fullName.Replace('/', '__') + '.json'
        $meta = Get-CachedJson ('https://api.github.com/repos/' + $fullName) $name
        $row = [ordered]@{
            full_name = $meta.full_name; stars = $meta.stargazers_count; forks = $meta.forks_count
            pushed_at = $meta.pushed_at; language = $meta.language; license_api = $meta.license.spdx_id
            archived = $meta.archived; default_branch = $meta.default_branch; size_kb = $meta.size
            created_at = $meta.created_at; url = $meta.html_url; description = $meta.description
        }
        $summary += [pscustomobject]$row
        Write-Output ($row | ConvertTo-Json -Compress)
    } catch { Write-Output ('REPO_ERROR ' + $fullName + ': ' + $_.Exception.Message) }
}
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'github-metadata.json'), ($summary | Sort-Object stars -Descending | ConvertTo-Json -Depth 6), [System.Text.UTF8Encoding]::new($false))
