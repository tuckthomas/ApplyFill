param(
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [string]$ContainerName = 'applyfill-postgres'
)

$ErrorActionPreference = 'Stop'
$resolved = [System.IO.Path]::GetFullPath($OutputPath)
$parent = Split-Path -Parent $resolved
New-Item -ItemType Directory -Force -Path $parent | Out-Null

$containerBackup = '/tmp/applyfill-backup.dump'
docker exec $ContainerName pg_dump --username applyfill_admin --dbname applyfill --format custom --no-owner --file $containerBackup
if ($LASTEXITCODE -ne 0) {
    throw 'PostgreSQL could not create the backup.'
}

docker cp "${ContainerName}:$containerBackup" $resolved
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $resolved)) {
    throw 'Docker could not copy the database backup to the requested path.'
}

docker exec $ContainerName rm -f $containerBackup | Out-Null

Write-Output "Database backup written to $resolved. Back up the local data-protection key directory separately."
