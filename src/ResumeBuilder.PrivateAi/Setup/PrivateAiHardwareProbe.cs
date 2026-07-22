using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using ResumeBuilder.PrivateAi.Catalog;

namespace ResumeBuilder.PrivateAi.Setup;

public sealed record PrivateAiHardwareProbeResult(
    PrivateAiHardware Hardware,
    string? GpuName,
    string? ComputeCapability,
    bool UsesCpuFallback);

public static class PrivateAiHardwareProbe
{
    public static async Task<PrivateAiHardwareProbeResult> ProbeAsync(CancellationToken cancellationToken = default)
    {
        if (!OperatingSystem.IsWindows() || RuntimeInformation.OSArchitecture != Architecture.X64)
        {
            throw new PrivateAiUnavailableException("This Private AI preview currently supports 64-bit Windows computers.");
        }

        var systemMemory = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes;
        if (systemMemory <= 0)
        {
            throw new PrivateAiUnavailableException("ApplyFill could not determine how much memory is available.");
        }

        var gpu = await TryProbeNvidiaGpuAsync(cancellationToken);
        return new PrivateAiHardwareProbeResult(
            new PrivateAiHardware("win-x64", systemMemory, gpu?.DedicatedBytes ?? 0),
            gpu?.Name,
            gpu?.ComputeCapability,
            gpu is null);
    }

    private static async Task<NvidiaGpu?> TryProbeNvidiaGpuAsync(CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "nvidia-smi.exe",
            Arguments = "--query-gpu=name,memory.total,compute_cap --format=csv,noheader,nounits",
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };

        try
        {
            using var process = Process.Start(startInfo);
            if (process is null)
            {
                return null;
            }

            var output = await process.StandardOutput.ReadLineAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken).WaitAsync(TimeSpan.FromSeconds(5), cancellationToken);
            if (process.ExitCode != 0 || string.IsNullOrWhiteSpace(output))
            {
                return null;
            }

            var fields = output.Split(',', StringSplitOptions.TrimEntries);
            if (fields.Length != 3 || !long.TryParse(fields[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var mebibytes))
            {
                return null;
            }

            return new NvidiaGpu(fields[0], checked(mebibytes * 1024 * 1024), fields[2]);
        }
        catch (Exception exception) when (exception is System.ComponentModel.Win32Exception or InvalidOperationException or TimeoutException)
        {
            return null;
        }
    }

    private sealed record NvidiaGpu(string Name, long DedicatedBytes, string ComputeCapability);
}
