Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:FrontendRoot = Join-Path $script:RepositoryRoot 'frontend'
$script:RuntimeRoot = Join-Path $script:RepositoryRoot 'logs\applyfill-local'
$script:SecretsPath = Join-Path $script:RepositoryRoot '.applyfill.local'
$script:StatePath = Join-Path $script:RuntimeRoot 'state.json'
$script:ComposePath = Join-Path $script:RepositoryRoot 'compose.yaml'
$script:CorepackVersion = '0.34.5'

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "`n$Message" -ForegroundColor Cyan
}

function New-LocalSecret {
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return [Convert]::ToHexString($bytes).ToLowerInvariant()
}

function Protect-LocalFile {
    param([Parameter(Mandatory)][string]$Path)

    if ($env:OS -ne 'Windows_NT') {
        return
    }

    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $output = & icacls.exe $Path '/inheritance:r' '/grant:r' "${identity}:(F)" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "ApplyFill created its local settings but could not restrict access to the current Windows account. Details: $($output -join ' ')"
    }
}

function Test-DockerObject {
    param(
        [Parameter(Mandatory)][ValidateSet('container', 'volume')][string]$Kind,
        [Parameter(Mandatory)][string]$Name
    )

    & docker $Kind inspect $Name *> $null
    return $LASTEXITCODE -eq 0
}

function Get-ContainerSecrets {
    if (-not (Test-DockerObject -Kind container -Name 'applyfill-postgres')) {
        return $null
    }

    $lines = @(& docker container inspect applyfill-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' 2>$null)
    if ($LASTEXITCODE -ne 0) {
        return $null
    }

    $values = @{}
    foreach ($line in $lines) {
        if ($line -match '^(POSTGRES_PASSWORD|POSTGRES_APP_PASSWORD)=(.+)$') {
            $values[$Matches[1]] = $Matches[2]
        }
    }

    if (-not $values.POSTGRES_PASSWORD -or -not $values.POSTGRES_APP_PASSWORD) {
        return $null
    }

    return @{
        APPLYFILL_POSTGRES_ADMIN_PASSWORD = $values.POSTGRES_PASSWORD
        APPLYFILL_POSTGRES_APP_PASSWORD = $values.POSTGRES_APP_PASSWORD
    }
}

function Read-LocalSettings {
    if (-not (Test-Path -LiteralPath $script:SecretsPath)) {
        return $null
    }

    $settings = @{}
    foreach ($line in Get-Content -LiteralPath $script:SecretsPath) {
        if ($line -match '^([A-Z0-9_]+)=(.*)$') {
            $settings[$Matches[1]] = $Matches[2]
        }
    }

    $required = @(
        'APPLYFILL_POSTGRES_ADMIN_PASSWORD',
        'APPLYFILL_POSTGRES_APP_PASSWORD',
        'APPLYFILL_POSTGRES_PORT',
        'APPLYFILL_BROWSER_WORKER_TOKEN',
        'APPLYFILL_PRIVATE_AI_ROOT'
    )
    foreach ($name in $required) {
        if (-not $settings.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($settings[$name])) {
            throw "ApplyFill's local settings file is incomplete ($name is missing). Remove '$script:SecretsPath' and start again, or restore the matching file from your backup."
        }
    }

    if ($settings.APPLYFILL_BROWSER_WORKER_TOKEN.Length -lt 32) {
        throw "ApplyFill's local service token is invalid. Remove '$script:SecretsPath' and start again."
    }
    $databasePort = 0
    if (-not [int]::TryParse($settings.APPLYFILL_POSTGRES_PORT, [ref]$databasePort) -or
        $databasePort -lt 1024 -or $databasePort -gt 65535) {
        throw "ApplyFill's local database port is invalid. Use a number from 1024 through 65535 in '$script:SecretsPath'."
    }

    return $settings
}

function New-LocalSettings {
    $existingVolume = Test-DockerObject -Kind volume -Name 'applyfill-postgres-18'
    $containerSecrets = Get-ContainerSecrets
    if ($existingVolume -and $null -eq $containerSecrets) {
        throw "ApplyFill found an existing PostgreSQL data volume but could not recover its matching local password. Restore '$script:SecretsPath', or intentionally reset the development database with scripts/database/reset-development.ps1."
    }

    $privateAiRoot = Join-Path $script:RepositoryRoot 'private-ai\installed'
    $settings = [ordered]@{
        APPLYFILL_POSTGRES_ADMIN_PASSWORD = if ($containerSecrets) { $containerSecrets.APPLYFILL_POSTGRES_ADMIN_PASSWORD } else { New-LocalSecret }
        APPLYFILL_POSTGRES_APP_PASSWORD = if ($containerSecrets) { $containerSecrets.APPLYFILL_POSTGRES_APP_PASSWORD } else { New-LocalSecret }
        APPLYFILL_POSTGRES_PORT = '5432'
        APPLYFILL_BROWSER_WORKER_TOKEN = New-LocalSecret
        APPLYFILL_PRIVATE_AI_ROOT = $privateAiRoot
    }

    $temporaryPath = "$script:SecretsPath.part"
    $content = $settings.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }
    [System.IO.File]::WriteAllLines($temporaryPath, $content, [System.Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporaryPath -Destination $script:SecretsPath -Force
    Protect-LocalFile -Path $script:SecretsPath
    return $settings
}

function Get-OrCreateLocalSettings {
    $settings = Read-LocalSettings
    if ($null -ne $settings) {
        return $settings
    }
    return New-LocalSettings
}

function Assert-Command {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$FriendlyName
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $command) {
        throw "$FriendlyName is required but was not found. Install it, reopen PowerShell, and run this command again."
    }
    return $command
}

function Assert-Prerequisites {
    if ($PSVersionTable.PSVersion.Major -lt 7) {
        throw 'ApplyFill requires PowerShell 7 or newer. Open PowerShell 7 (pwsh) and run the launcher again.'
    }

    $null = Assert-Command -Name 'dotnet' -FriendlyName '.NET 10 SDK'
    $null = Assert-Command -Name 'docker' -FriendlyName 'Docker Desktop'
    $null = Assert-Command -Name 'node' -FriendlyName 'Node.js'

    $dotnetVersion = (& dotnet --version).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $dotnetVersion.StartsWith('10.', [StringComparison]::Ordinal)) {
        throw "ApplyFill requires the .NET 10 SDK. The active SDK is '$dotnetVersion'."
    }

    $nodeVersion = (& node --version).Trim().TrimStart('v')
    $nodeMajor = 0
    if (-not [int]::TryParse(($nodeVersion -split '\.')[0], [ref]$nodeMajor) -or $nodeMajor -lt 22) {
        throw "ApplyFill requires Node.js 22 or newer. The active version is '$nodeVersion'."
    }

    & docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Desktop is installed but is not running. Start Docker Desktop, wait until it is ready, and try again.'
    }

    if (-not (Get-Command 'corepack' -ErrorAction SilentlyContinue) -and
        -not (Get-Command 'npx.cmd' -ErrorAction SilentlyContinue) -and
        -not (Get-Command 'npx' -ErrorAction SilentlyContinue)) {
        throw 'Corepack is required to use the repository-pinned pnpm version. Install Corepack (or a Node.js distribution that includes it), reopen PowerShell, and try again.'
    }
}

function Invoke-Pnpm {
    param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)

    Push-Location $script:FrontendRoot
    try {
        $corepack = Get-Command 'corepack' -ErrorAction SilentlyContinue
        if ($corepack) {
            & $corepack.Source pnpm @Arguments
        }
        else {
            $npx = Get-Command 'npx.cmd' -ErrorAction SilentlyContinue
            if (-not $npx) { $npx = Get-Command 'npx' -ErrorAction Stop }
            & $npx.Source --yes "corepack@${script:CorepackVersion}" pnpm @Arguments
        }
        if ($LASTEXITCODE -ne 0) {
            throw "The frontend dependency command failed. Review the messages above, then run the launcher again."
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-CheckedNative {
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter(ValueFromRemainingArguments)][string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "'$Command' failed. Review the messages above, correct the problem, and run the launcher again."
    }
}

function Test-PortInUse {
    param([Parameter(Mandatory)][int]$Port)
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $task = $client.ConnectAsync([System.Net.IPAddress]::Loopback, $Port)
        return $task.Wait(250) -and $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

function Get-LocalState {
    if (-not (Test-Path -LiteralPath $script:StatePath)) {
        return $null
    }
    try {
        return Get-Content -LiteralPath $script:StatePath -Raw | ConvertFrom-Json
    }
    catch {
        return $null
    }
}

function Test-TrackedProcess {
    param([Parameter(Mandatory)]$Entry)

    $process = Get-Process -Id ([int]$Entry.pid) -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        return $false
    }

    try {
        $actual = $process.StartTime.ToUniversalTime()
        $expected = ([DateTimeOffset]$Entry.startedAtUtc).UtcDateTime
        return [Math]::Abs(($actual - $expected).TotalMilliseconds) -lt 1
    }
    catch {
        return $false
    }
}

function Save-LocalState {
    param([Parameter(Mandatory)]$State)
    New-Item -ItemType Directory -Path $script:RuntimeRoot -Force | Out-Null
    $State | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $script:StatePath -Encoding utf8NoBOM
}

function Start-TrackedProcess {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(Mandatory)][string[]]$ArgumentList,
        [Parameter(Mandatory)][string]$WorkingDirectory,
        [hashtable]$Environment = @{}
    )

    New-Item -ItemType Directory -Path $script:RuntimeRoot -Force | Out-Null
    $stdout = Join-Path $script:RuntimeRoot "$Name.out.log"
    $stderr = Join-Path $script:RuntimeRoot "$Name.error.log"
    Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue

    $previous = @{}
    try {
        foreach ($item in $Environment.GetEnumerator()) {
            $previous[$item.Key] = [Environment]::GetEnvironmentVariable($item.Key, 'Process')
            [Environment]::SetEnvironmentVariable($item.Key, [string]$item.Value, 'Process')
        }

        $safeArguments = $ArgumentList | ForEach-Object {
            if ($_ -match '[\s"]') { '"' + $_.Replace('"', '\"') + '"' } else { $_ }
        }
        $process = Start-Process -FilePath $FilePath -ArgumentList $safeArguments -WorkingDirectory $WorkingDirectory `
            -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
    }
    finally {
        foreach ($item in $Environment.GetEnumerator()) {
            [Environment]::SetEnvironmentVariable($item.Key, $previous[$item.Key], 'Process')
        }
    }

    return [ordered]@{
        name = $Name
        pid = $process.Id
        startedAtUtc = $process.StartTime.ToUniversalTime().ToString('O')
        standardOutput = $stdout
        standardError = $stderr
    }
}

function Wait-HttpReady {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Uri,
        [hashtable]$Headers = @{},
        [int]$TimeoutSeconds = 90,
        $ProcessEntry
    )

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        if ($null -ne $ProcessEntry -and -not (Test-TrackedProcess -Entry $ProcessEntry)) {
            $errorTail = if (Test-Path -LiteralPath $ProcessEntry.standardError) {
                (Get-Content -LiteralPath $ProcessEntry.standardError -Tail 20) -join [Environment]::NewLine
            } else { 'No error log was produced.' }
            throw "$Name stopped before it became ready.`n$errorTail"
        }
        try {
            $response = Invoke-WebRequest -Uri $Uri -Headers $Headers -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                return
            }
        }
        catch {
            # Startup normally refuses connections until the listener is ready.
        }
        Start-Sleep -Milliseconds 500
    } while ([DateTimeOffset]::UtcNow -lt $deadline)

    throw "$Name did not become ready within $TimeoutSeconds seconds. Its logs are in '$script:RuntimeRoot'."
}

function Stop-TrackedProcesses {
    param($State)
    if ($null -eq $State -or $null -eq $State.processes) {
        return
    }

    $entries = @($State.processes)
    [array]::Reverse($entries)
    foreach ($entry in $entries) {
        if (Test-TrackedProcess -Entry $entry) {
            if ($env:OS -eq 'Windows_NT') {
                # Browser and local-model processes are children of the worker and must not be orphaned.
                & taskkill.exe /PID ([int]$entry.pid) /T /F *> $null
            }
            else {
                Stop-Process -Id ([int]$entry.pid) -Force -ErrorAction SilentlyContinue
            }
            try { Wait-Process -Id ([int]$entry.pid) -Timeout 10 -ErrorAction SilentlyContinue } catch { }
        }
    }
}

function Get-FrontendNeedsInstall {
    $modulesMarker = Join-Path $script:FrontendRoot 'node_modules\.modules.yaml'
    if (-not (Test-Path -LiteralPath $modulesMarker)) {
        return $true
    }
    $markerTime = (Get-Item -LiteralPath $modulesMarker).LastWriteTimeUtc
    $newerInputs = @(Get-Item (Join-Path $script:FrontendRoot 'package.json'), (Join-Path $script:FrontendRoot 'pnpm-lock.yaml') |
        Where-Object LastWriteTimeUtc -gt $markerTime)
    return $newerInputs.Count -gt 0
}

function Get-FrontendNeedsBuild {
    $output = Join-Path $script:FrontendRoot 'dist\index.html'
    if (-not (Test-Path -LiteralPath $output)) {
        return $true
    }
    $outputTime = (Get-Item -LiteralPath $output).LastWriteTimeUtc
    $inputs = Get-ChildItem -LiteralPath (Join-Path $script:FrontendRoot 'src') -Recurse -File
    $inputs += Get-Item (Join-Path $script:FrontendRoot 'index.html'), (Join-Path $script:FrontendRoot 'package.json'), (Join-Path $script:FrontendRoot 'pnpm-lock.yaml'), (Join-Path $script:FrontendRoot 'vite.config.ts')
    $newerInputs = @($inputs | Where-Object LastWriteTimeUtc -gt $outputTime)
    return $newerInputs.Count -gt 0
}
