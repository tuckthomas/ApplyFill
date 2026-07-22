using System.IO.Compression;

namespace ResumeBuilder.PrivateAi.Installation;

public static class RuntimeArchiveInstaller
{
    public static void ExtractVerifiedArchive(string archivePath, string destinationDirectory)
        => ExtractVerifiedArchives([archivePath], destinationDirectory);

    public static void ExtractVerifiedArchives(
        IEnumerable<string> archivePaths,
        string destinationDirectory)
    {
        ArgumentNullException.ThrowIfNull(archivePaths);
        ArgumentException.ThrowIfNullOrWhiteSpace(destinationDirectory);

        var destinationRoot = Path.GetFullPath(destinationDirectory);
        var stagingRoot = destinationRoot + ".staging";
        if (Directory.Exists(stagingRoot))
        {
            Directory.Delete(stagingRoot, true);
        }

        Directory.CreateDirectory(stagingRoot);
        var guardedRoot = stagingRoot.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        try
        {
            foreach (var archivePath in archivePaths)
            {
                ArgumentException.ThrowIfNullOrWhiteSpace(archivePath);
                using var archive = ZipFile.OpenRead(archivePath);
                foreach (var entry in archive.Entries)
                {
                    var outputPath = Path.GetFullPath(Path.Combine(stagingRoot, entry.FullName));
                    if (!outputPath.StartsWith(guardedRoot, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidDataException("Private AI runtime archive contains an unsafe path.");
                    }

                    if (string.IsNullOrEmpty(entry.Name))
                    {
                        Directory.CreateDirectory(outputPath);
                        continue;
                    }

                    Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
                    entry.ExtractToFile(outputPath, true);
                }
            }

            if (Directory.Exists(destinationRoot))
            {
                Directory.Delete(destinationRoot, true);
            }

            Directory.Move(stagingRoot, destinationRoot);
        }
        catch
        {
            if (Directory.Exists(stagingRoot))
            {
                Directory.Delete(stagingRoot, true);
            }

            throw;
        }
    }
}
