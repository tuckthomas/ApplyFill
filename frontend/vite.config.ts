import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const runtimeAssets = {
  'vendor/litert/wasm': [
    'litert_wasm_compat_internal.js',
    'litert_wasm_compat_internal.wasm',
    'litert_wasm_internal.js',
    'litert_wasm_internal.wasm',
    'litert_wasm_jspi_internal.js',
    'litert_wasm_jspi_internal.wasm',
    'litert_wasm_threaded_internal.js',
    'litert_wasm_threaded_internal.wasm',
  ].map((file) => resolve('node_modules/@litertjs/core/wasm', file)),
  'vendor/litert-lm/wasm': [
    // The Asyncify builds are over Cloudflare's 25 MiB static-asset limit.
    // Modern desktop browsers use the smaller JSPI builds; capability checks
    // fail explicitly rather than falling back to Google's package CDN.
    'litertlm_wasm_compat_internal.js',
    'litertlm_wasm_compat_internal.wasm',
    'litertlm_wasm_internal.js',
    'litertlm_wasm_internal.wasm',
  ].map((file) => resolve('node_modules/@litert-lm/core/wasm', file)),
} as const

function localAiRuntimeAssets(): Plugin {
  return {
    name: 'applyfill-local-ai-runtime-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split('?', 1)[0]
        if (!pathname) {
          next()
          return
        }

        for (const [outputDirectory, sources] of Object.entries(runtimeAssets)) {
          const prefix = `/${outputDirectory}/`
          if (!pathname.startsWith(prefix)) continue

          const requestedFile = pathname.slice(prefix.length)
          const source = sources.find((candidate) => basename(candidate) === requestedFile)
          if (!source) break

          response.setHeader(
            'Content-Type',
            requestedFile.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
          )
          response.end(readFileSync(source))
          return
        }

        next()
      })
    },
    generateBundle() {
      for (const [outputDirectory, sources] of Object.entries(runtimeAssets)) {
        for (const source of sources) {
          this.emitFile({
            type: 'asset',
            fileName: `${outputDirectory}/${basename(source)}`,
            source: readFileSync(source),
          })
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
  },
  plugins: [react(), localAiRuntimeAssets()],
}))
