import path from 'node:path'
import { fileURLToPath } from 'node:url'
import frontendConfiguration from '../../frontend/vite.config.ts'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export default async (environment) => {
  const configured = typeof frontendConfiguration === 'function'
    ? await frontendConfiguration(environment)
    : frontendConfiguration

  return {
    ...configured,
    root: path.join(repositoryRoot, 'frontend'),
    server: {
      ...configured.server,
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        ...configured.server?.proxy,
        '/api': {
          target: 'http://127.0.0.1:5180',
          changeOrigin: false,
        },
        '/hubs': {
          target: 'ws://127.0.0.1:5180',
          changeOrigin: false,
          ws: true,
        },
      },
    },
  }
}
