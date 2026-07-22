import type {
  AcceleratorCapability,
  AcceleratorId,
  RuntimeCapabilities,
} from './types'

interface NavigatorWithLocalAi {
  gpu?: {
    requestAdapter(): Promise<unknown | null>
  }
  ml?: {
    createContext?: (...args: unknown[]) => unknown
  }
}

interface WebAssemblyWithJspi {
  Suspending?: unknown
  promising?: unknown
}

const unavailable = (
  failureCode: AcceleratorCapability['failureCode'],
  detail: string,
  experimental = false,
): AcceleratorCapability => ({ available: false, experimental, failureCode, detail })

export async function detectRuntimeCapabilities(
  browserNavigator: NavigatorWithLocalAi | undefined =
    typeof navigator === 'undefined' ? undefined : (navigator as NavigatorWithLocalAi),
): Promise<RuntimeCapabilities> {
  const secureContext = typeof isSecureContext === 'undefined' ? false : isSecureContext
  const wasm = typeof WebAssembly !== 'undefined'
  const wasmWithJspi = WebAssembly as unknown as WebAssemblyWithJspi
  const jspi = wasm && Boolean(wasmWithJspi.Suspending && wasmWithJspi.promising)
  const hasWebNn = Boolean(browserNavigator?.ml?.createContext)
  const hasWebGpuApi = Boolean(browserNavigator?.gpu?.requestAdapter)
  let hasWebGpuAdapter = false

  if (secureContext && hasWebGpuApi) {
    try {
      hasWebGpuAdapter = Boolean(await browserNavigator?.gpu?.requestAdapter())
    } catch {
      hasWebGpuAdapter = false
    }
  }

  const webNnCapability = !secureContext
    ? unavailable('insecure-context', 'WebNN requires a secure browser context.', true)
    : !hasWebNn
      ? unavailable('webnn-api-missing', 'The experimental WebNN API is not enabled.', true)
      : !jspi
        ? unavailable('webnn-jspi-missing', 'LiteRT WebNN requires WebAssembly JSPI.', true)
        : { available: true, experimental: true }

  const webGpuCapability = !secureContext
    ? unavailable('insecure-context', 'WebGPU requires a secure browser context.')
    : !hasWebGpuApi
      ? unavailable('webgpu-api-missing', 'The browser does not expose WebGPU.')
      : !hasWebGpuAdapter
        ? unavailable('webgpu-adapter-missing', 'No usable WebGPU adapter was returned.')
        : { available: true, experimental: false }

  const wasmCapability = wasm
    ? { available: true, experimental: false }
    : unavailable('wasm-missing', 'WebAssembly is not available in this browser.')

  const accelerators: Record<AcceleratorId, AcceleratorCapability> = {
    'webnn-npu': webNnCapability,
    'webnn-gpu': webNnCapability,
    'webnn-cpu': webNnCapability,
    webgpu: webGpuCapability,
    wasm: wasmCapability,
  }

  return {
    secureContext,
    jspi,
    crossOriginIsolated:
      typeof globalThis.crossOriginIsolated === 'boolean' && globalThis.crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    accelerators,
  }
}
