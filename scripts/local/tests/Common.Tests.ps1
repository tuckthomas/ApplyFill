. (Join-Path $PSScriptRoot '..\Common.ps1')

Describe 'ApplyFill local launcher helpers' {
    It 'creates distinct 256-bit lowercase hexadecimal secrets' {
        $first = New-LocalSecret
        $second = New-LocalSecret

        $first | Should Match '^[0-9a-f]{64}$'
        $second | Should Match '^[0-9a-f]{64}$'
        $first | Should Not Be $second
    }

    It 'recognizes only the exact process instance recorded by the launcher' {
        $current = Get-Process -Id $PID
        $entry = [pscustomobject]@{
            pid = $PID
            startedAtUtc = $current.StartTime.ToUniversalTime().ToString('O')
        }
        $wrongInstance = [pscustomobject]@{
            pid = $PID
            startedAtUtc = [DateTimeOffset]::UtcNow.AddDays(-1).ToString('O')
        }

        (Test-TrackedProcess -Entry $entry) | Should Be $true
        (Test-TrackedProcess -Entry $wrongInstance) | Should Be $false

        $jsonRoundTrip = $entry | ConvertTo-Json | ConvertFrom-Json
        (Test-TrackedProcess -Entry $jsonRoundTrip) | Should Be $true
    }

    It 'starts and stops only a launcher-tracked background process' {
        $entry = Start-TrackedProcess -Name 'launcher-test' `
            -FilePath (Join-Path $PSHOME 'pwsh.exe') `
            -ArgumentList @('-NoProfile', '-Command', 'Start-Sleep -Seconds 30') `
            -WorkingDirectory $script:RepositoryRoot
        try {
            (Test-TrackedProcess -Entry $entry) | Should Be $true
            Stop-TrackedProcesses -State ([pscustomobject]@{ processes = @($entry) })
            (Test-TrackedProcess -Entry $entry) | Should Be $false
        }
        finally {
            if (Test-TrackedProcess -Entry $entry) {
                Stop-Process -Id $entry.pid -Force -ErrorAction SilentlyContinue
            }
        }
    }

    It 'uses only loopback listeners and same-origin service proxies' {
        $configuration = Get-Content (Join-Path $PSScriptRoot '..\vite.proxy.config.mjs') -Raw

        $configuration | Should Match "host: '127\.0\.0\.1'"
        $configuration | Should Match "target: 'http://127\.0\.0\.1:5180'"
        $configuration | Should Match "target: 'ws://127\.0\.0\.1:5180'"
        $configuration | Should Not Match '0\.0\.0\.0'
    }

    It 'starts PostgreSQL in detached mode instead of attaching the launcher' {
        $launcher = Get-Content (Join-Path $PSScriptRoot '..\start.ps1') -Raw

        $launcher | Should Match "'up', '-d', 'postgres'"
        $launcher | Should Match "Invoke-CheckedNative -Command 'docker' -Arguments"
    }
}
