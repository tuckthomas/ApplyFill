import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = import.meta.dirname;
const outdir = resolve(root, 'dist');

await rm(outdir, { force: true, recursive: true });
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: {
    background: resolve(root, 'src/background.ts'),
    content: resolve(root, 'src/content.ts'),
    popup: resolve(root, 'src/popup.ts'),
  },
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  outdir,
  sourcemap: false,
  legalComments: 'none',
  minify: true,
});

await Promise.all([
  cp(resolve(root, 'public/manifest.json'), resolve(outdir, 'manifest.json')),
  cp(resolve(root, 'public/popup.html'), resolve(outdir, 'popup.html')),
  cp(resolve(root, 'public/popup.css'), resolve(outdir, 'popup.css')),
]);
