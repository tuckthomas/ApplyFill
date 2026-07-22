export * from './acceleratorSelection'
export * from './artifactLoader'
export * from './capabilities'
export * from './fakeRuntime'
export * from './lifecycle'
export * from './liteRtLmRuntime'
export * from './modelCache'
export * from './types'

import { LiteRtLmRuntime } from './liteRtLmRuntime'

export const localAiRuntime = new LiteRtLmRuntime()
