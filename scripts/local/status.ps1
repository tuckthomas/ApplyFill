[CmdletBinding()]
param()

. (Join-Path $PSScriptRoot 'Common.ps1')

$state = Get-LocalState
if ($null -eq $state) {
    Write-Host 'ApplyFill is not running (no local launcher state was found).'
    exit 1
}

$settings = try { Read-LocalSettings } catch { $null }
$checks = @{
    api = @{ uri = 'http://127.0.0.1:5180/health/ready'; headers = @{} }
    'browser-worker' = @{
        uri = 'http://127.0.0.1:5098/health'
        headers = if ($settings) { @{ 'X-ApplyFill-Service-Token' = $settings.APPLYFILL_BROWSER_WORKER_TOKEN } } else { @{} }
    }
    web = @{ uri = 'http://127.0.0.1:5173/'; headers = @{} }
}

$allHealthy = $true
foreach ($entry in @($state.processes)) {
    $running = Test-TrackedProcess -Entry $entry
    $responsive = $false
    if ($running -and $checks.ContainsKey([string]$entry.name)) {
        $check = $checks[[string]$entry.name]
        try {
            $response = Invoke-WebRequest -Uri $check.uri -Headers $check.headers -UseBasicParsing -TimeoutSec 3
            $responsive = $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
        }
        catch { }
    }
    $healthy = $running -and $responsive
    $color = if ($healthy) { 'Green' } else { 'Red' }
    $label = if ($healthy) { 'ready' } elseif ($running) { 'not responding' } else { 'stopped' }
    Write-Host ("{0,-18} {1}" -f $entry.name, $label) -ForegroundColor $color
    $allHealthy = $allHealthy -and $healthy
}

$database = 'not running'
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $database = (& docker container inspect applyfill-postgres --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>$null).Trim()
    if ([string]::IsNullOrWhiteSpace($database)) { $database = 'not running' }
}
$databaseHealthy = $database -eq 'healthy'
Write-Host ("{0,-18} {1}" -f 'postgresql', $database) -ForegroundColor $(if ($databaseHealthy) { 'Green' } else { 'Red' })
$allHealthy = $allHealthy -and $databaseHealthy

if ($allHealthy) {
    Write-Host "`nApplyFill is ready at $($state.url)" -ForegroundColor Green
    exit 0
}

Write-Host "`nApplyFill is not fully running. Logs are in '$script:RuntimeRoot'." -ForegroundColor Yellow
exit 1
