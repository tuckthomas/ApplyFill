# Private AI model and runtime decision

**Decision date:** 2026-07-22  
**Hardware acceptance baseline:** NVIDIA RTX 2070 (8 GiB VRAM, compute capability 7.5), 32 GiB system RAM, Windows x64

## User-facing decision

ApplyFill exposes one action: **Set Up Private AI**. It detects the computer, selects the approved configuration, downloads pinned artifacts with visible byte progress, verifies SHA-256, and starts/stops the bundled runtime. Model names, repositories, servers, ports, GPU layers, and quantization stay in advanced diagnostics.

No user is expected to install or launch a model runner, Python, CUDA toolkit, container, or terminal command.

## Selected internal baseline

- General page understanding and GUI grounding: Qwen3-VL-8B-Instruct, Q4_K_M language weights with Q8_0 vision projector. The official Qwen repository describes Qwen3-VL as a visual-agent model and publishes official GGUF artifacts for llama.cpp.
- Compatibility fallback: Qwen3-VL-4B-Instruct with the same artifact format and contract.
- Resume and complex-document reading: PaddleOCR-VL-1.6 GGUF. PaddleOCR publishes it as a 0.9B document model with structured Markdown/JSON output and Apache-2.0 licensing.
- First Windows runtime: pinned llama.cpp CUDA 12.4 binaries. llama.cpp supports multimodal requests, schema-constrained JSON, CPU/GPU partial offload, and an OpenAI-compatible loopback API.

## Resource policy

- Only one model is active at a time.
- The 8B configuration is preferred on the baseline machine even when some layers spill into system RAM.
- The 4B configuration is selected automatically when memory or stability checks reject 8B.
- Images are bounded to the manifest's pixel limit and normal operation uses an 8,192-token context, not the model's advertised maximum.
- The runtime binds only to loopback. Remote image URLs, runtime tools, filesystem tools, browsing, code execution, and model-initiated downloads are disabled.

## Pinned inventory

The machine-readable manifests under `private-ai/catalog/` contain immutable repository revisions, byte sizes, artifact URLs, and SHA-256 digests. At the current revisions:

| Component | Revision/version | Download bytes | License |
| --- | --- | ---: | --- |
| Qwen3-VL 8B Q4 + Q8 projector | `f982a07559d4a2f6c8744d840bf6fccab30eea96` | 5,780,074,528 | Apache-2.0 |
| Qwen3-VL 4B Q4 + Q8 projector | `1cd86afb9a95c410a6038ab3b40d8b578c892266` | 2,951,255,968 | Apache-2.0 |
| PaddleOCR-VL 1.6 GGUF + projector | `511b09642bb324401f15f97cc23bc67e8f0a291d` | 1,817,539,616 | Apache-2.0 |
| llama.cpp Windows CUDA 12.4 runtime | `b10091` | 641,193,012 | MIT |

## Sources

- [Official Qwen3-VL 8B GGUF repository](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF)
- [Official Qwen3-VL 4B model repository](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct)
- [Official PaddleOCR repository](https://github.com/PaddlePaddle/PaddleOCR)
- [Official PaddleOCR-VL 1.6 repository](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6)
- [Official llama.cpp multimodal documentation](https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md)
- [Official llama.cpp server documentation](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)

## Acceptance still requiring measured evidence

The architecture and artifacts are selected, but final acceptance requires running the checked-in corpus on the physical RTX 2070 and recording accuracy, first-frame latency, steady-state latency, peak VRAM/RAM, cancellation time, and recovery behavior. Those results must decide whether 8B remains the default or 4B becomes the automatic baseline; they may not be guessed from parameter count or artifact size.
