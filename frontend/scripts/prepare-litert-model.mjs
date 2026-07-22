import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const MODEL = {
  id: 'gemma-4-e2b-it-web',
  version: '9262660a1676eed6d0c477ab1a86344430854664',
  displayName: 'Gemma 4 E2B Instruct (Web)',
  runtime: 'litert-lm-js',
  runtimeVersion: '0.14.0',
  format: '.litertlm',
  contextLimit: 131072,
  byteSize: 2008432640,
  sha256: '3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5',
  source:
    'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/9262660a1676eed6d0c477ab1a86344430854664/gemma-4-E2B-it-web.litertlm?download=true',
}

const CHUNK_SIZE = 24 * 1024 * 1024
const cacheFile = resolve('.cache/local-ai', `${MODEL.id}-${MODEL.version}.litertlm`)
const outputDirectory = resolve('public/models', MODEL.id, MODEL.version)
const manifestFile = resolve('public/models/manifest.json')
const approval = JSON.parse(await readFile(resolve('model-approval.json'), 'utf8'))
const isApproved =
  approval.status === 'approved-structured-json' &&
  approval.modelId === MODEL.id &&
  approval.version === MODEL.version
const sourceFileArgumentIndex = process.argv.indexOf('--source-file')
const suppliedSourceFile =
  sourceFileArgumentIndex >= 0 ? process.argv[sourceFileArgumentIndex + 1] : undefined
let preparedSourceFile = cacheFile

async function sha256File(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function downloadWithResume() {
  if (suppliedSourceFile) {
    preparedSourceFile = resolve(suppliedSourceFile)
    const suppliedSize = (await stat(preparedSourceFile)).size
    if (suppliedSize !== MODEL.byteSize) {
      throw new Error(`Local model size mismatch: expected ${MODEL.byteSize}, received ${suppliedSize}.`)
    }
    const suppliedDigest = await sha256File(preparedSourceFile)
    if (suppliedDigest !== MODEL.sha256) {
      throw new Error('Local model SHA-256 mismatch.')
    }
    process.stdout.write(`Verified local model ${preparedSourceFile}.\n`)
    return
  }

  await mkdir(dirname(cacheFile), { recursive: true })
  let existingSize = 0
  try {
    existingSize = (await stat(cacheFile)).size
  } catch {
    // A missing cache starts a clean download.
  }
  if (existingSize > MODEL.byteSize) {
    await rm(cacheFile, { force: true })
    existingSize = 0
  }

  const response = await fetch(MODEL.source, {
    headers: existingSize > 0 ? { Range: `bytes=${existingSize}-` } : undefined,
    redirect: 'follow',
  })
  if (!response.ok || !response.body) {
    throw new Error(`Model download failed with HTTP ${response.status}.`)
  }

  let append = existingSize > 0 && response.status === 206
  if (existingSize > 0 && !append) {
    await rm(cacheFile, { force: true })
    existingSize = 0
  }
  const destination = createWriteStream(cacheFile, { flags: append ? 'a' : 'w' })
  let received = existingSize
  const progress = new TransformStream({
    transform(chunk, controller) {
      received += chunk.byteLength
      process.stdout.write(
        `\rDownloaded ${(received / 1024 / 1024).toFixed(1)} / ${(MODEL.byteSize / 1024 / 1024).toFixed(1)} MiB`,
      )
      controller.enqueue(chunk)
    },
  })
  await pipeline(Readable.fromWeb(response.body.pipeThrough(progress)), destination)
  process.stdout.write('\n')

  const completedSize = (await stat(cacheFile)).size
  if (completedSize !== MODEL.byteSize) {
    throw new Error(`Downloaded size mismatch: expected ${MODEL.byteSize}, received ${completedSize}.`)
  }
  const digest = await sha256File(cacheFile)
  if (digest !== MODEL.sha256) {
    await rm(cacheFile, { force: true })
    throw new Error(`Downloaded model SHA-256 mismatch. Cache was removed.`)
  }
}

async function splitAndWriteManifest() {
  await rm(outputDirectory, { recursive: true, force: true })
  await mkdir(outputDirectory, { recursive: true })
  const source = await open(preparedSourceFile, 'r')
  const chunks = []
  let offset = 0
  let index = 0
  try {
    while (offset < MODEL.byteSize) {
      const byteSize = Math.min(CHUNK_SIZE, MODEL.byteSize - offset)
      const bytes = Buffer.allocUnsafe(byteSize)
      const { bytesRead } = await source.read(bytes, 0, byteSize, offset)
      if (bytesRead !== byteSize) throw new Error('Unexpected end of model while splitting chunks.')
      const fileName = `${MODEL.id}.${String(index).padStart(3, '0')}.part`
      const temporaryFile = resolve(outputDirectory, `${fileName}.tmp`)
      const finalFile = resolve(outputDirectory, fileName)
      await writeFile(temporaryFile, bytes)
      await rename(temporaryFile, finalFile)
      chunks.push({
        url: `/models/${MODEL.id}/${MODEL.version}/${fileName}`,
        byteSize,
        digest: `sha256-${createHash('sha256').update(bytes).digest('hex')}`,
      })
      offset += byteSize
      index += 1
    }
  } finally {
    await source.close()
  }

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    // Packaging consumes, but never invents, the checked-in approval decision.
    defaultModelId: isApproved ? MODEL.id : null,
    models: [
      {
        id: MODEL.id,
        version: MODEL.version,
        displayName: MODEL.displayName,
        runtime: MODEL.runtime,
        runtimeVersion: MODEL.runtimeVersion,
        format: MODEL.format,
        contextLimit: MODEL.contextLimit,
        operationalContextLimit: 4096,
        artifact: {
          byteSize: MODEL.byteSize,
          digest: `sha256-${MODEL.sha256}`,
          chunks,
        },
        supportedAccelerators: ['webgpu'],
        license: {
          name: 'Apache-2.0',
          url: `https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/blob/${MODEL.version}/README.md`,
          attribution: 'Gemma 4 E2B Instruct LiteRT-LM web artifact by Google / LiteRT Community',
          redistributionAllowed: true,
        },
        approvedTasks: isApproved ? approval.approvedTasks : ['evaluation'],
        evaluationStatus: isApproved ? approval.status : 'evaluation-required',
      },
    ],
  }
  await mkdir(dirname(manifestFile), { recursive: true })
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  process.stdout.write(`Prepared ${chunks.length} verified chunks and ${manifestFile}.\n`)
}

await downloadWithResume()
await splitAndWriteManifest()
