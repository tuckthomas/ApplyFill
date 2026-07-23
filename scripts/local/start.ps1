[CmdletBinding()]
param(
    [switch]$NoOpen,
    [switch]$SkipBrowserInstall,
    [switch]$CheckOnly
)

. (Join-Path $PSScriptRoot 'Common.ps1')

$started = @()
function Save-StartingState {
    Save-LocalState -State ([ordered]@{
        version = 1
        startedAtUtc = [DateTimeOffset]::UtcNow.ToString('O')
        url = 'http://127.0.0.1:5173/'
        databaseContainer = 'applyfill-postgres'
        processes = $started
    })
}

try {
    Write-Step 'Checking this computer...'
    Assert-Prerequisites

    foreach ($requiredPath in @(
        $script:ComposePath,
        (Join-Path $script:RepositoryRoot 'src\ResumeBuilder.Api\ResumeBuilder.Api.csproj'),
        (Join-Path $script:RepositoryRoot 'src\ResumeBuilder.BrowserWorker\ResumeBuilder.BrowserWorker.csproj'),
        (Join-Path $script:FrontendRoot 'package.json')
    )) {
        if (-not (Test-Path -LiteralPath $requiredPath)) {
            throw "ApplyFill is incomplete: '$requiredPath' was not found. Restore the repository and try again."
        }
    }

    $state = Get-LocalState
    if ($null -ne $state) {
        $trackedProcesses = @($state.processes)
        $runningProcesses = @($trackedProcesses | Where-Object { Test-TrackedProcess -Entry $_ })
        if ($trackedProcesses.Count -ge 3 -and $runningProcesses.Count -eq $trackedProcesses.Count) {
            Write-Host 'ApplyFill is already running at http://127.0.0.1:5173/.' -ForegroundColor Green
            if (-not $NoOpen -and -not $CheckOnly) {
                Start-Process 'http://127.0.0.1:5173/'
            }
            exit 0
        }
        if ($runningProcesses.Count -gt 0) {
            throw "ApplyFill is only partly running. Run '.\scripts\local\stop.ps1', then start it again."
        }
        Remove-Item -LiteralPath $script:StatePath -Force -ErrorAction SilentlyContinue
    }

    $occupied = @(@(5098, 5173, 5180) | Where-Object { Test-PortInUse -Port $_ })
    if ($occupied.Count -gt 0) {
        throw "ApplyFill cannot start because another program is using local port(s): $($occupied -join ', '). Stop that program and try again."
    }

    if ($CheckOnly) {
        Write-Host 'All required programs and local ports are ready. No files, containers, or processes were changed.' -ForegroundColor Green
        exit 0
    }

    $settings = Get-OrCreateLocalSettings

    Write-Step 'Starting the private PostgreSQL 18 database...'
    $previousComposeValues = @{}
    foreach ($name in @('APPLYFILL_POSTGRES_ADMIN_PASSWORD', 'APPLYFILL_POSTGRES_APP_PASSWORD', 'APPLYFILL_POSTGRES_PORT')) {
        $previousComposeValues[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, [string]$settings[$name], 'Process')
    }
    try {
        Invoke-CheckedNative -Command 'docker' -Arguments @(
            'compose', '--env-file', $script:SecretsPath,
            '-f', $script:ComposePath,
            'up', '-d', 'postgres'
        )
    }
    finally {
        foreach ($name in $previousComposeValues.Keys) {
            [Environment]::SetEnvironmentVariable($name, $previousComposeValues[$name], 'Process')
        }
    }

    $databaseDeadline = [DateTimeOffset]::UtcNow.AddMinutes(2)
    do {
        $databaseHealth = (& docker container inspect applyfill-postgres --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>$null).Trim()
        if ($databaseHealth -eq 'healthy') { break }
        Start-Sleep -Seconds 1
    } while ([DateTimeOffset]::UtcNow -lt $databaseDeadline)
    if ($databaseHealth -ne 'healthy') {
        throw "PostgreSQL did not become healthy. Run 'docker logs applyfill-postgres' to see the database message."
    }

    Write-Step 'Preparing the web application...'
    if (Get-FrontendNeedsInstall) {
        Invoke-Pnpm install --frozen-lockfile
    }
    if (Get-FrontendNeedsBuild) {
        Invoke-Pnpm build
    }

    Write-Step 'Building the local services...'
    Invoke-CheckedNative -Command 'dotnet' -Arguments @(
        'build', (Join-Path $script:RepositoryRoot 'src\ResumeBuilder.Api\ResumeBuilder.Api.csproj'), '--nologo'
    )
    Invoke-CheckedNative -Command 'dotnet' -Arguments @(
        'build', (Join-Path $script:RepositoryRoot 'src\ResumeBuilder.BrowserWorker\ResumeBuilder.BrowserWorker.csproj'), '--nologo'
    )

    Write-Step 'Updating the private database...'
    $escapedAdminPassword = ([string]$settings.APPLYFILL_POSTGRES_ADMIN_PASSWORD).Replace('"', '""')
    $migrationConnectionString = "Host=127.0.0.1;Port=$($settings.APPLYFILL_POSTGRES_PORT);Database=applyfill;Username=applyfill_admin;Password=`"$escapedAdminPassword`""
    $previousMigrationConnection = [Environment]::GetEnvironmentVariable('ConnectionStrings__ApplyFill', 'Process')
    try {
        [Environment]::SetEnvironmentVariable('ConnectionStrings__ApplyFill', $migrationConnectionString, 'Process')
        Invoke-CheckedNative -Command 'dotnet' -Arguments @('tool', 'restore')
        Invoke-CheckedNative -Command 'dotnet' -Arguments @(
            'tool', 'run', 'dotnet-ef', 'database', 'update', '--no-build',
            '--project', (Join-Path $script:RepositoryRoot 'src\ResumeBuilder.Infrastructure\ResumeBuilder.Infrastructure.csproj'),
            '--startup-project', (Join-Path $script:RepositoryRoot 'src\ResumeBuilder.Api\ResumeBuilder.Api.csproj'),
            '--context', 'ApplyFillDbContext'
        )
    }
    finally {
        [Environment]::SetEnvironmentVariable('ConnectionStrings__ApplyFill', $previousMigrationConnection, 'Process')
    }

    $workerOutput = Join-Path $script:RepositoryRoot 'src\ResumeBuilder.BrowserWorker\bin\Debug\net10.0'
    if (-not $SkipBrowserInstall) {
        $playwrightInstaller = Join-Path $workerOutput 'playwright.ps1'
        if (-not (Test-Path -LiteralPath $playwrightInstaller)) {
            throw "The managed-browser installer was not created by the build. Check the BrowserWorker build output and try again."
        }
        Write-Step 'Checking the managed browser...'
        Invoke-CheckedNative -Command (Join-Path $PSHOME 'pwsh.exe') -Arguments @(
            '-NoProfile', '-File', $playwrightInstaller, 'install', 'chromium'
        )
    }

    Write-Step 'Starting ApplyFill services...'
    $escapedDatabasePassword = ([string]$settings.APPLYFILL_POSTGRES_APP_PASSWORD).Replace('"', '""')
    $connectionString = "Host=127.0.0.1;Port=$($settings.APPLYFILL_POSTGRES_PORT);Database=applyfill;Username=applyfill_app;Password=`"$escapedDatabasePassword`""
    $dotnet = (Get-Command dotnet -ErrorAction Stop).Source
    $api = Start-TrackedProcess -Name 'api' -FilePath $dotnet `
        -ArgumentList @((Join-Path $script:RepositoryRoot 'src\ResumeBuilder.Api\bin\Debug\net10.0\ResumeBuilder.Api.dll')) `
        -WorkingDirectory (Join-Path $script:RepositoryRoot 'src\ResumeBuilder.Api') `
        -Environment @{
            ASPNETCORE_ENVIRONMENT = 'Development'
            ASPNETCORE_URLS = 'http://127.0.0.1:5180'
            ConnectionStrings__ApplyFill = $connectionString
            ApplyFill__Database__ApplyMigrations = 'false'
            ApplyFill__Worker__ServiceToken = $settings.APPLYFILL_BROWSER_WORKER_TOKEN
            ApplyFill__AllowedOrigins__0 = 'http://127.0.0.1:5173'
        }
    $started += $api
    Save-StartingState
    Wait-HttpReady -Name 'ApplyFill data service' -Uri 'http://127.0.0.1:5180/health/ready' -ProcessEntry $api -TimeoutSeconds 120

    $worker = Start-TrackedProcess -Name 'browser-worker' -FilePath $dotnet `
        -ArgumentList @((Join-Path $workerOutput 'ResumeBuilder.BrowserWorker.dll')) `
        -WorkingDirectory (Join-Path $script:RepositoryRoot 'src\ResumeBuilder.BrowserWorker') `
        -Environment @{
            ASPNETCORE_ENVIRONMENT = 'Development'
            ASPNETCORE_URLS = 'http://127.0.0.1:5098'
            APPLYFILL_BROWSER_WORKER_TOKEN = $settings.APPLYFILL_BROWSER_WORKER_TOKEN
            APPLYFILL_PRIVATE_AI_ROOT = $settings.APPLYFILL_PRIVATE_AI_ROOT
            ApplyFillApi__BaseUri = 'http://127.0.0.1:5180'
        }
    $started += $worker
    Save-StartingState
    Wait-HttpReady -Name 'ApplyFill browser service' -Uri 'http://127.0.0.1:5098/health' `
        -Headers @{ 'X-ApplyFill-Service-Token' = $settings.APPLYFILL_BROWSER_WORKER_TOKEN } -ProcessEntry $worker

    $node = (Get-Command node -ErrorAction Stop).Source
    $vite = Start-TrackedProcess -Name 'web' -FilePath $node `
        -ArgumentList @(
            (Join-Path $script:FrontendRoot 'node_modules\vite\bin\vite.js'),
            '--config', (Join-Path $PSScriptRoot 'vite.proxy.config.mjs')
        ) `
        -WorkingDirectory $script:RepositoryRoot
    $started += $vite
    Save-StartingState
    Wait-HttpReady -Name 'ApplyFill web page' -Uri 'http://127.0.0.1:5173/' -ProcessEntry $vite -TimeoutSeconds 45

    $state = [ordered]@{
        version = 1
        startedAtUtc = [DateTimeOffset]::UtcNow.ToString('O')
        url = 'http://127.0.0.1:5173/'
        databaseContainer = 'applyfill-postgres'
        processes = $started
    }
    Save-LocalState -State $state

    Write-Host "`nApplyFill is ready at http://127.0.0.1:5173/" -ForegroundColor Green
    Write-Host "Use '.\scripts\local\status.ps1' to check it and '.\scripts\local\stop.ps1' to stop it."
    if (-not $NoOpen) {
        Start-Process 'http://127.0.0.1:5173/'
    }
}
catch {
    if ($started.Count -gt 0) {
        Stop-TrackedProcesses -State ([pscustomobject]@{ processes = $started })
    }
    Remove-Item -LiteralPath $script:StatePath -Force -ErrorAction SilentlyContinue
    Write-Error "ApplyFill could not start: $($_.Exception.Message)"
    exit 1
}
