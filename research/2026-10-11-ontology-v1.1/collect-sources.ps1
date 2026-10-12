$ErrorActionPreference = 'Stop'
$cacheRoot = Join-Path $PSScriptRoot 'cache'
$sourceRoot = Join-Path $PSScriptRoot 'sources'
New-Item -ItemType Directory -Path $sourceRoot -Force | Out-Null
$headers = @{ 'User-Agent' = 'MetaPlatform-v1.1-Research'; Accept = 'application/vnd.github+json' }
$metadata = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'github-metadata.json') -Raw -Encoding utf8 | ConvertFrom-Json
$records = @()
foreach ($meta in $metadata) {
    $safe = $meta.full_name.Replace('/', '__')
    $commitFile = Join-Path $cacheRoot ($safe + '__commit.json')
    try {
        if (-not (Test-Path -LiteralPath $commitFile)) {
            $url = 'https://api.github.com/repos/' + $meta.full_name + '/commits/' + $meta.default_branch
            $response = Invoke-WebRequest -Uri $url -Headers $headers -TimeoutSec 20
            [IO.File]::WriteAllText($commitFile, $response.Content, [Text.UTF8Encoding]::new($false))
        }
        $commit = Get-Content -LiteralPath $commitFile -Raw -Encoding utf8 | ConvertFrom-Json
        $records += [pscustomobject]@{ full_name=$meta.full_name; sha=$commit.sha; commit_date=$commit.commit.committer.date }
        $folder = Join-Path $sourceRoot $safe
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
        $licenseNames = @('LICENSE','LICENSE.txt','LICENSE.md','license.txt','COPYING','LICENSE-APACHE.txt')
        foreach ($licenseName in $licenseNames) {
            $target = Join-Path $folder $licenseName
            try {
                if (-not (Test-Path -LiteralPath $target)) {
                    $url = 'https://raw.githubusercontent.com/' + $meta.full_name + '/' + $commit.sha + '/' + $licenseName
                    $response = Invoke-WebRequest -Uri $url -Headers $headers -TimeoutSec 15
                    [IO.File]::WriteAllText($target, $response.Content, [Text.UTF8Encoding]::new($false))
                }
                $text = Get-Content -LiteralPath $target -Raw -Encoding utf8
                Write-Output ('LICENSE ' + $meta.full_name + ' ' + $licenseName + ' ' + ($text.Substring(0,[Math]::Min(250,$text.Length)) -replace '\s+',' '))
                if ($meta.full_name -notin @('nocobase/nocobase','Budibase/budibase','directus/directus')) { break }
            } catch {}
        }
        if (-not (Get-ChildItem -LiteralPath $folder -File)) { Write-Output ('LICENSE_MISSING ' + $meta.full_name) }
        if ($meta.full_name -in @('open-metadata/OpenMetadata','nocobase/nocobase','datahub-project/datahub','deepseek-ai/deepseek-harness','protegeproject/webprotege','ge-semtk/semtk')) {
            $treeFile = Join-Path $cacheRoot ($safe + '__tree.json')
            if (-not (Test-Path -LiteralPath $treeFile)) {
                $url = 'https://api.github.com/repos/' + $meta.full_name + '/git/trees/' + $commit.sha + '?recursive=1'
                $response = Invoke-WebRequest -Uri $url -Headers $headers -TimeoutSec 25
                [IO.File]::WriteAllText($treeFile, $response.Content, [Text.UTF8Encoding]::new($false))
            }
            $tree = Get-Content -LiteralPath $treeFile -Raw -Encoding utf8 | ConvertFrom-Json
            Write-Output ('TREE ' + $meta.full_name + ' ' + $tree.tree.Count + ' truncated=' + $tree.truncated)
        }
    } catch { Write-Output ('SOURCE_ERROR ' + $meta.full_name + ': ' + $_.Exception.Message) }
}
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'commit-snapshots.json'), ($records | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
