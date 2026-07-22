using System.Diagnostics;
using System.Net;
using System.Net.Sockets;

namespace ResumeBuilder.PrivateAi.Runtime;

public sealed record LlamaCppRuntimeConfiguration(
    string ExecutablePath,
    string ModelPath,
    string VisionProjectorPath,
    string ModelAlias,
    int ContextTokens,
    string GpuLayers,
    TimeSpan StartupTimeout);

public sealed record LlamaCppRuntimeEndpoint(Uri BaseUri, string ApiKey);

public sealed class LlamaCppRuntimeSupervisor(HttpClient healthClient) : IAsyncDisposable
{
    private Process? _process;

    public LlamaCppRuntimeEndpoint? Endpoint { get; private set; }

    public async Task<LlamaCppRuntimeEndpoint> StartAsync(
        LlamaCppRuntimeConfiguration configuration,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        if (_process is { HasExited: false } && Endpoint is not null)
        {
            return Endpoint;
        }

        ValidateFile(configuration.ExecutablePath, "Private AI runtime");
        ValidateFile(configuration.ModelPath, "Private AI model");
        ValidateFile(configuration.VisionProjectorPath, "Private AI vision component");

        var port = ReserveLoopbackPort();
        var apiKey = Convert.ToHexStringLower(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
        var startInfo = new ProcessStartInfo
        {
            FileName = Path.GetFullPath(configuration.ExecutablePath),
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            WorkingDirectory = Path.GetDirectoryName(Path.GetFullPath(configuration.ExecutablePath))!,
        };
        startInfo.ArgumentList.Add("--model");
        startInfo.ArgumentList.Add(Path.GetFullPath(configuration.ModelPath));
        startInfo.ArgumentList.Add("--mmproj");
        startInfo.ArgumentList.Add(Path.GetFullPath(configuration.VisionProjectorPath));
        startInfo.ArgumentList.Add("--alias");
        startInfo.ArgumentList.Add(configuration.ModelAlias);
        startInfo.ArgumentList.Add("--host");
        startInfo.ArgumentList.Add(IPAddress.Loopback.ToString());
        startInfo.ArgumentList.Add("--port");
        startInfo.ArgumentList.Add(port.ToString(System.Globalization.CultureInfo.InvariantCulture));
        startInfo.ArgumentList.Add("--ctx-size");
        startInfo.ArgumentList.Add(configuration.ContextTokens.ToString(System.Globalization.CultureInfo.InvariantCulture));
        startInfo.ArgumentList.Add("--gpu-layers");
        startInfo.ArgumentList.Add(configuration.GpuLayers);
        startInfo.ArgumentList.Add("--no-webui");
        startInfo.ArgumentList.Add("--api-key");
        startInfo.ArgumentList.Add(apiKey);
        startInfo.ArgumentList.Add("--offline");
        startInfo.ArgumentList.Add("--fit");
        startInfo.ArgumentList.Add("on");
        startInfo.ArgumentList.Add("--fit-target");
        startInfo.ArgumentList.Add("1024");

        _process = Process.Start(startInfo) ?? throw new InvalidOperationException("Private AI could not be started.");
        Endpoint = new LlamaCppRuntimeEndpoint(
            new Uri($"http://127.0.0.1:{port}/", UriKind.Absolute),
            apiKey);

        try
        {
            await WaitUntilHealthyAsync(configuration.StartupTimeout, cancellationToken);
            return Endpoint;
        }
        catch
        {
            await StopAsync();
            throw;
        }
    }

    public async Task StopAsync()
    {
        var process = Interlocked.Exchange(ref _process, null);
        Endpoint = null;
        if (process is null)
        {
            return;
        }

        try
        {
            if (!process.HasExited)
            {
                process.Kill(true);
                await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(10));
            }
        }
        catch (InvalidOperationException)
        {
            // The process exited between the state check and shutdown request.
        }
        finally
        {
            process.Dispose();
        }
    }

    public ValueTask DisposeAsync() => new(StopAsync());

    private async Task WaitUntilHealthyAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        if (_process is null || Endpoint is null)
        {
            throw new InvalidOperationException("Private AI process was not started.");
        }

        using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutSource.CancelAfter(timeout);
        var healthUri = new Uri(Endpoint.BaseUri, "health");
        while (!timeoutSource.IsCancellationRequested)
        {
            if (_process.HasExited)
            {
                throw new InvalidOperationException("Private AI stopped while it was preparing.");
            }

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, healthUri);
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", Endpoint.ApiKey);
                using var response = await healthClient.SendAsync(request, timeoutSource.Token);
                if (response.IsSuccessStatusCode)
                {
                    return;
                }
            }
            catch (HttpRequestException)
            {
                // The loopback listener may not be ready yet.
            }

            await Task.Delay(250, timeoutSource.Token);
        }

        throw new TimeoutException("Private AI took too long to prepare.");
    }

    private static int ReserveLoopbackPort()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        return ((IPEndPoint)listener.LocalEndpoint).Port;
    }

    private static void ValidateFile(string path, string displayName)
    {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            throw new FileNotFoundException($"{displayName} is missing.", path);
        }
    }
}
