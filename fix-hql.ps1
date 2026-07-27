$modules = @('TECH-MCP', 'TECH-A2A', 'TECH-DATA')
$totalFixed = 0
foreach ($mod in $modules) {
    $files = Get-ChildItem "$mod\src\main\java" -Recurse -Filter "*Repository.java" -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
    foreach ($file in $files) {
        $content = Get-Content $file -Raw
        $orig = $content
        # Find each @Query declaration with multi-line strings
        $idx = 0
        while ($idx -lt $content.Length) {
            $qstart = $content.IndexOf('@Query', $idx)
            if ($qstart -lt 0) { break }
            # Find the opening (
            $po = $content.IndexOf('(', $qstart)
            if ($po -lt 0) { break }
            # Find the opening "
            $qo = $content.IndexOf('"', $po)
            if ($qo -lt 0) { break }
            # Now scan to find the matching closing ") by tracking depth
            $depth = 1
            $i = $po + 1
            $inStr = $false
            $qc = -1
            while ($i -lt $content.Length -and $depth -gt 0) {
                $ch = $content[$i]
                if (-not $inStr) {
                    if ($ch -eq '"') { $inStr = $true }
                    elseif ($ch -eq '(') { $depth++ }
                    elseif ($ch -eq ')') { $depth-- }
                } else {
                    if ($ch -eq '\') { $i++; continue }
                    if ($ch -eq '"') { $inStr = $false; $qc = $i }
                }
                $i++
            }
            if ($depth -ne 0 -or $qc -lt 0) { $idx = $i; continue }
            $q = $content.Substring($qo + 1, $qc - $qo - 1)
            # Only process if this looks like a SELECT/DELETE/UPDATE statement
            if ($q -match '^\s*(SELECT|DELETE|UPDATE|INSERT)\s' -or $q.Length -gt 30) {
                $openCount = ($q.ToCharArray() | Where-Object { $_ -eq '(' }).Count
                $closeCount = ($q.ToCharArray() | Where-Object { $_ -eq ')' }).Count
                $imbalance = $closeCount - $openCount
                if ($imbalance -gt 0) {
                    $stripped = $q
                    for ($k = 0; $k -lt $imbalance; $k++) {
                        $idx2 = $stripped.LastIndexOf(')')
                        if ($idx2 -gt 0) {
                            $stripped = $stripped.Substring(0, $idx2) + $stripped.Substring($idx2 + 1)
                        }
                    }
                    Write-Host "$($file.Substring($file.IndexOf($mod))) HQL fixed (removed $imbalance extra parens)"
                    $content = $content.Replace('"' + $q + '"', '"' + $stripped + '"')
                }
            }
            $idx = $i
        }
        if ($content -ne $orig) {
            $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
            $totalFixed++
        }
    }
}
Write-Host "Total files modified: $totalFixed"
