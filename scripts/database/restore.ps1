param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [string]$ContainerName = 'applyfill-postgres'
)

$ErrorActionPreference = 'Stop'
$resolved = (Resolve-Path -LiteralPath $InputPath).Path
$containerBackup = '/tmp/applyfill-restore.dump'
docker cp $resolved "${ContainerName}:$containerBackup"
if ($LASTEXITCODE -ne 0) {
    throw 'Docker could not copy the backup into the PostgreSQL container.'
}

docker exec $ContainerName pg_restore --username applyfill_admin --dbname applyfill --clean --if-exists --no-owner $containerBackup
if ($LASTEXITCODE -ne 0) {
    throw 'PostgreSQL could not restore the backup.'
}

docker exec $ContainerName rm -f $containerBackup | Out-Null

Write-Output 'Database restore completed. Restore the matching local data-protection keys before revealing sensitive values.'
