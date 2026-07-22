import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDirectory = resolve('dist');
const indexPath = resolve(distDirectory, 'index.html');
const indexHtml = await readFile(indexPath, 'utf8');
const serviceWorkerSchemaVersion = 'offline-runtime-v2';
const buildId = createHash('sha256')
  .update(indexHtml)
  .update(serviceWorkerSchemaVersion)
  .digest('hex')
  .slice(0, 16);

const referencedAssets = new Set([
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/models/manifest.json',
  '/vendor/litert-lm/wasm/litertlm_wasm_internal.js',
]);
for (const match of indexHtml.matchAll(/(?:src|href)="(\/[^"?#]+)(?:[?#][^"]*)?"/g)) {
  const path = match[1];
  if (!path.startsWith('/models/') && !path.startsWith('/litert/')) referencedAssets.add(path);
}

const source = `const APP_SHELL_PREFIX = 'applyfill-app-shell-';
const APP_SHELL_CACHE = \`\${APP_SHELL_PREFIX}${buildId}\`;
const APP_SHELL_ASSETS = ${JSON.stringify([...referencedAssets], null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(APP_SHELL_PREFIX) && key !== APP_SHELL_CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if ((url.pathname.startsWith('/models/') && url.pathname !== '/models/manifest.json')
    || url.pathname.startsWith('/litert/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
`;

await writeFile(resolve(distDirectory, 'service-worker.js'), source, 'utf8');
console.log(`Generated service-worker.js for ${referencedAssets.size} shell assets (${buildId}).`);
