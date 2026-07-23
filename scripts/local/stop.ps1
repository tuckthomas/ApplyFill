[CmdletBinding()]
param([switch]$KeepDatabase)

. (Join-Path $PSScriptRoot 'Common.ps1')

$state = Get-LocalState
Stop-TrackedProcesses -State $state
Remove-Item -LiteralPath $script:StatePath -Force -ErrorAction SilentlyContinue

if (-not $KeepDatabase -and (Get-Command docker -ErrorAction SilentlyContinue)) {
    $settings = Read-LocalSettings
    if ($null -ne $settings) {
        & docker compose --env-file $script:SecretsPath -f $script:ComposePath stop postgres
        if ($LASTEXITCODE -ne 0) {
            Write-Warning 'ApplyFill stopped, but PostgreSQL did not stop cleanly. You can stop it from Docker Desktop.'
            exit 1
        }
    }
}

Write-Host 'ApplyFill has stopped. Your database, profile, resumes, and Private AI files were kept.' -ForegroundColor Green

