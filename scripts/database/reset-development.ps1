$ErrorActionPreference = 'Stop'

$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$expectedVolume = 'applyfill-postgres-18'
if (-not $workspace.EndsWith('ResumeJobAssistant', [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to reset outside the ApplyFill workspace: $workspace"
}

docker compose --project-directory $workspace down
docker volume rm $expectedVolume
docker compose --project-directory $workspace up -d postgres

Write-Output 'Development database reset and PostgreSQL 18 restarted.'
