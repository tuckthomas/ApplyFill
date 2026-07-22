import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

const distDirectory = resolve('dist');
const cloudflareAssetLimitBytes = 25 * 1024 * 1024;
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.txt', '.webmanifest']);
const requiredFiles = ['index.html', '_headers', 'manifest.webmanifest', 'service-worker.js'];
const forbiddenPatterns = [
  /localhost:5033/,
  /VITE_API_BASE_URL/,
  /generativelanguage\.googleapis\.com/,
  /\/api\/ai\//,
];

const files = [];
const visit = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await visit(path);
    else files.push(path);
  }
};

await visit(distDirectory);

for (const requiredFile of requiredFiles) {
  if (!files.some((file) => relative(distDirectory, file).replaceAll('\\', '/') === requiredFile)) {
    throw new Error(`Static build is missing ${requiredFile}.`);
  }
}

for (const file of files) {
  const details = await stat(file);
  const displayPath = relative(distDirectory, file).replaceAll('\\', '/');
  if (details.size > cloudflareAssetLimitBytes) {
    throw new Error(`${displayPath} is ${details.size} bytes and exceeds Cloudflare Workers' 25 MiB static-asset limit.`);
  }

  if (!textExtensions.has(extname(file))) continue;
  const content = await readFile(file, 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) throw new Error(`${displayPath} contains forbidden production reference ${pattern}.`);
  }
}

console.log(`Verified ${files.length} static files; no file exceeds 25 MiB and no remote ApplyFill AI endpoint is bundled.`);
