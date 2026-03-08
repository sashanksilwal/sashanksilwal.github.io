Last month I ran Llama 2 70B on a single RTX 3090. Not a cluster. Not a cloud instance with 8xA100s. One consumer GPU with 24GB of VRAM, sitting under my desk. The model ran at about 12 tokens per second for inference, which is perfectly usable for most applications. A year ago this would have been impossible. What changed is quantization, and it changed everything about who gets to use large models.

## The Memory Problem

A 70B parameter model in FP16 takes roughly 140GB of memory. That's the model weights alone, before you account for KV cache, activations, or anything else. An A100 80GB can't even hold it. You need at least two.

The math is simple: 70 billion parameters times 2 bytes per parameter (FP16) equals 140 billion bytes. Quantize to 4 bits per parameter and you're at 35GB. Quantize to 3 bits and you're under 27GB. Suddenly a 24GB consumer GPU is in the conversation.

But not all quantization is equal, and the differences matter a lot in practice.

## GPTQ: The OG Post-Training Quantization

GPTQ (Frantar et al., 2022) was the method that kicked off the "run big models on small GPUs" movement. It works by quantizing weights layer by layer, using a small calibration dataset (usually 128 samples from C4 or similar) to minimize the quantization error in a mathematically principled way. Specifically, it solves an optimal brain quantization problem using second-order information (the Hessian).

In practice:

```python
from transformers import AutoModelForCausalLM, GPTQConfig

quantization_config = GPTQConfig(
    bits=4,
    dataset="c4",
    group_size=128,
    desc_act=True
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-70b-hf",
    quantization_config=quantization_config,
    device_map="auto"
)
```

The `group_size` parameter is important. It controls how many weights share a single scale and zero-point. Smaller groups (64 or 128) give better quality but use slightly more memory. Larger groups (1024) save memory but the quality degrades noticeably on reasoning tasks.

GPTQ produces GPU-native models. They run on CUDA with custom kernels (ExLlama, ExLlamaV2, AutoGPTQ). Speed is good. The main downside: quantization itself is slow and requires the full model in memory to calibrate, so you need the big GPU to create the quantized model (or you download someone else's quantized version from HuggingFace, which is what most people do).

## GGUF: CPU-Friendly and Flexible

GGUF is the format used by llama.cpp and its ecosystem. Where GPTQ is GPU-first, GGUF was designed for CPU inference and CPU/GPU hybrid inference. This matters if you don't have a GPU at all, or if your model almost-but-doesn't-quite fit in VRAM.

The killer feature of GGUF is layer-level offloading. You can put 35 of 80 layers on GPU and the rest on CPU. Performance is worse than full GPU, but it actually works:

```bash
# Run a 70B model with 35 layers on GPU, rest on CPU
./llama-server -m llama-2-70b.Q4_K_M.gguf \
    -ngl 35 \
    -c 4096 \
    --host 0.0.0.0 --port 8080
```

GGUF also supports a wider range of quantization formats. The naming convention tells you what you're getting: Q4_K_M means 4-bit quantization with K-quant method, medium size. Q5_K_S is 5-bit, small. Q2_K is 2-bit (don't do this unless you enjoy reading incoherent text).

My recommendation: Q4_K_M is the sweet spot for most use cases. Q5_K_M if you can afford the extra memory and want slightly better quality. Q3_K_L if you're tight on memory but still need reasonable outputs.

## AWQ: The New Contender

Activation-Aware Weight Quantization (Lin et al., 2023) takes a different approach. Instead of treating all weights equally, AWQ observes that a small fraction of weights (about 1%) are disproportionately important because they correspond to large activation magnitudes. These "salient" weights get protected during quantization, either by keeping them at higher precision or by scaling them up before quantizing.

The result: AWQ consistently matches or beats GPTQ quality at the same bit width, and quantization is faster because it doesn't need the Hessian computation.

```python
from awq import AutoAWQForCausalLM

model = AutoAWQForCausalLM.from_pretrained(
    "meta-llama/Llama-2-70b-hf",
    safetensors=True
)

quant_config = {
    "zero_point": True,
    "q_group_size": 128,
    "w_bit": 4
}

model.quantize(
    tokenizer,
    quant_config=quant_config,
    calib_data="pileval"
)
```

AWQ models also work well with vLLM for serving, which makes them a good choice if you're running an inference server rather than doing local experiments.

## The Quality Question

Here's what nobody wants to hear: 4-bit quantization is not free. You lose quality. The question is how much and whether it matters for your use case.

On standard benchmarks (MMLU, HellaSwag, ARC), a 4-bit quantized 70B model typically scores 1-3 points below the FP16 version. That sounds small. For many applications (summarization, extraction, simple Q&A) it is small. But for tasks requiring precise reasoning, code generation, or math, those 1-3 points can translate to noticeably worse outputs.

The practical rule I follow: a 4-bit 70B model is generally better than a FP16 13B model. If your choice is between running a larger model quantized or a smaller model at full precision, go with the larger quantized model. The extra parameters carry more information than the extra precision.

But there are exceptions. Heavily quantized models (2-bit, 3-bit) can fall apart on multi-step reasoning. I've seen 2-bit Llama 70B produce worse results than a full-precision 7B model on code tasks. Test on your actual workload before committing.

## Distillation: A Different Kind of Small

Quantization compresses an existing model. Distillation trains a new, smaller model to mimic the behavior of a larger one. I [wrote about distillation separately](/blog/post.html?post=model-distillation) if you want the full picture. They solve the same problem (running capable models on limited hardware) but they work in fundamentally different ways.

The recent DeepSeek-R1 distilled models are a good example. The distilled 7B and 14B versions capture a surprising amount of the full model's reasoning capability, particularly for math and code. They run at full precision on modest hardware and often outperform quantized versions of much larger models at comparable inference speeds.

The tradeoff is obvious: distillation requires significant compute to [fine-tune](/blog/post.html?post=what-is-fine-tuning) the student, and you lose the generality of the original model. A distilled model inherits the teacher's strengths on the training distribution but can be worse on out-of-distribution inputs. Quantization preserves the original model's behavior more faithfully, even if every individual output is slightly degraded.

For production systems, I often end up using both. Distill to get into the right parameter range, then quantize the distilled model to squeeze it onto the target hardware.

## Practical Setup: 70B on a 3090

Here's what actually worked for me. Hardware: RTX 3090 (24GB VRAM), 64GB system RAM, NVMe SSD.

For pure GPU inference, I use a Q4_K_M GGUF with all layers offloaded to GPU. The 70B model at Q4_K_M is about 40GB on disk, but with all 80 layers on GPU you need the weights for the loaded layers to fit in 24GB. This doesn't quite work for 70B fully on GPU. So I offload about 55 layers to GPU and keep 25 on CPU:

```bash
./llama-server -m llama-2-70b-chat.Q4_K_M.gguf \
    -ngl 55 \
    -c 2048 \
    -t 8 \
    --mlock
```

This gives me roughly 8-12 tokens/second for generation, depending on context length. The `--mlock` flag keeps the CPU-side weights in RAM instead of letting the OS swap them, which is important because swapping to disk kills performance.

For serving to multiple users, I switch to vLLM with an AWQ model:

```bash
python -m vllm.entrypoints.openai.api_server \
    --model TheBloke/Llama-2-70B-Chat-AWQ \
    --quantization awq \
    --tensor-parallel-size 1 \
    --max-model-len 2048 \
    --gpu-memory-utilization 0.95
```

This requires careful tuning of `max-model-len` and `gpu-memory-utilization` to avoid OOM errors. Start conservative and increase until things break.

## What I'd Actually Recommend

If you're just getting started: download a Q4_K_M GGUF from HuggingFace and run it with llama.cpp. It takes five minutes and you'll have a working setup.

If you're building a production service: use AWQ with vLLM. The throughput optimizations in vLLM (PagedAttention, continuous batching) matter more than the marginal quality differences between quantization methods.

If quality is critical: benchmark GPTQ, AWQ, and GGUF on your actual task. The differences are model-specific and task-specific. I've seen cases where GPTQ beats AWQ and vice versa, depending on the model architecture and the evaluation.

If you're resource-constrained and need the best possible quality: look at distilled models first. A well-distilled 14B model at full precision might serve you better than a 70B model at 3-bit quantization, and it'll be faster too.

The gap between "what the big labs can run" and "what you can run at home" has never been smaller. The 70B models that required a small datacenter two years ago now run on hardware you can buy for $1500. That's not just a nice convenience. It changes who gets to build with these models, and that changes what gets built.
