import type { ModelManifestEntry, Sha256Digest } from '../runtime'

export interface ApprovedModelManifest {
  schemaVersion: 1
  generatedAt: string
  defaultModelId: string | null
  models: ModelManifestEntry[]
}

export interface CandidateModel {
  id: string
  task: 'generation' | 'embedding'
  source: string
  sourceRevision: string
  artifactName: string
  artifactByteSize?: number
  artifactDigest?: Sha256Digest
  format: '.litertlm' | '.tflite'
  quantization: string
  contextLimit: number | 'not-published'
  accelerators: string[]
  license: string
  redistribution: 'allowed' | 'terms-review-required'
  evaluationStatus: 'candidate' | 'rejected'
  notes: string
}

/** Production includes only candidates that pass the checked-in evaluation and approval record. */
export const approvedModelManifest: ApprovedModelManifest = {
  schemaVersion: 1,
  generatedAt: '2026-07-18T00:00:00.000Z',
  defaultModelId: 'gemma-4-e2b-it-web',
  models: [
    {
      id: 'gemma-4-e2b-it-web',
      version: '9262660a1676eed6d0c477ab1a86344430854664',
      displayName: 'Gemma 4 E2B Instruct (Web)',
      runtime: 'litert-lm-js',
      runtimeVersion: '0.14.0',
      format: '.litertlm',
      contextLimit: 131_072,
      operationalContextLimit: 4_096,
      artifact: {
        url:
          'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/9262660a1676eed6d0c477ab1a86344430854664/gemma-4-E2B-it-web.litertlm?download=true',
        byteSize: 2_008_432_640,
        digest: 'sha256-3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5',
      },
      supportedAccelerators: ['webgpu'],
      license: {
        name: 'Apache-2.0',
        url:
          'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/blob/9262660a1676eed6d0c477ab1a86344430854664/README.md',
        attribution: 'Gemma 4 E2B Instruct LiteRT-LM web artifact by Google / LiteRT Community',
        redistributionAllowed: true,
      },
      approvedTasks: [
        'profile-fact-selection',
        'job-posting-analysis',
        'resume-tailoring-draft',
      ],
    },
  ],
}

export const candidateModels: CandidateModel[] = [
  {
    id: 'gemma-4-e2b-it-web',
    task: 'generation',
    source: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm',
    sourceRevision: '9262660a1676eed6d0c477ab1a86344430854664',
    artifactName: 'gemma-4-E2B-it-web.litertlm',
    artifactByteSize: 2_008_432_640,
    artifactDigest: 'sha256-3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5',
    format: '.litertlm',
    quantization: 'Web-optimized upstream artifact; exact quantization not published in model card',
    contextLimit: 131_072,
    accelerators: ['LiteRT-LM.js WebGPU'],
    license: 'Apache-2.0 (repository metadata)',
    redistribution: 'allowed',
    evaluationStatus: 'candidate',
    notes: 'Smallest model currently listed by the official LiteRT-LM JavaScript guide.',
  },
  {
    id: 'gemma-4-e4b-it-web',
    task: 'generation',
    source: 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm',
    sourceRevision: 'f7ad3343bd6ebc9607f4dc3bc4f2398bd5749bc5',
    artifactName: 'gemma-4-E4B-it-web.litertlm',
    artifactByteSize: 2_969_059_328,
    artifactDigest: 'sha256-3904d826d5dddd25ea173e85204caec09e68ba038116e9b992b69cbdc94f57a0',
    format: '.litertlm',
    quantization: 'Web-optimized upstream artifact; exact quantization not published in model card',
    contextLimit: 131_072,
    accelerators: ['LiteRT-LM.js WebGPU'],
    license: 'Apache-2.0 (repository metadata)',
    redistribution: 'allowed',
    evaluationStatus: 'candidate',
    notes: 'Larger quality candidate; not suitable for an undisclosed automatic download.',
  },
  {
    id: 'qwen3-embedding-0.6b-litert',
    task: 'embedding',
    source: 'https://huggingface.co/litert-community/Qwen3-Embedding-0.6B-LiteRT',
    sourceRevision: 'main',
    artifactName: 'qwen3emb_gpu_fp16.tflite plus tokenizer and embedding table',
    format: '.tflite',
    quantization: 'FP16',
    contextLimit: 128,
    accelerators: ['LiteRT.js WebGPU'],
    license: 'Apache-2.0',
    redistribution: 'allowed',
    evaluationStatus: 'candidate',
    notes:
      'The published pipeline is roughly 881 MB and requires host-side token embedding lookup; evaluate only if deterministic lexical scoring is insufficient.',
  },
]

export function getDefaultApprovedModel(): ModelManifestEntry | undefined {
  return approvedModelManifest.models.find(
    (model) => model.id === approvedModelManifest.defaultModelId,
  )
}

export async function loadDeployedModelManifest(
  signal?: AbortSignal,
): Promise<ApprovedModelManifest> {
  const url = new URL(`${import.meta.env.BASE_URL}models/manifest.json`, globalThis.location.origin)
  const response = await fetch(url, { signal, credentials: 'same-origin' })
  if (!response.ok) {
    // Development can evaluate directly from the revision-pinned source. A
    // production deployment should run `pnpm model:prepare` and serve chunks.
    return approvedModelManifest
  }
  return (await response.json()) as ApprovedModelManifest
}
