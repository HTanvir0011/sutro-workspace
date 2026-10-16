# Local preflight only. Never initializes, stages, commits or publishes.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')
node scripts/check-release.js
if ($LASTEXITCODE -ne 0) { throw 'Public build preflight failed.' }
git diff --stat
git diff --cached --name-only
Write-Output 'Review build-manifest.json and staged paths. Publication requires a separate owner-controlled action.'
