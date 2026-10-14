Over fall break, I worked on quantizing a model. This post collects what I learned while trying to understand Qwen-Image-2.1-Turbo: what each part does, where the memory goes, and what changes when you store the weights with fewer bits.

Claude helped me build the interactive explainers below. Being able to change a setting and see the shapes, noise levels, or memory estimates made the pieces easier to connect. I wanted to keep all of those tools and examples together, so this includes the full guide, not just the final memory calculator.

A text prompt goes in. An image comes out. The part I wanted to understand was everything in between: what represents the prompt, what changes during sampling, and what finally becomes pixels.

## Explore the model

[Open the interactive guide in a full page](/blog/demos/qwen-image-2-1-turbo.html). This is the easiest way to explore the diagrams on a phone or read the whole manual without scrolling inside the embed.

<iframe src="/blog/demos/qwen-image-2-1-turbo.html" title="Qwen-Image-2.1-Turbo interactive theory of operation: pipeline, denoising, attention, and memory" style="width:100%;height:850px;border:1px solid var(--border-color, #888);border-radius:12px;display:block;margin:28px auto;" loading="lazy" sandbox="allow-scripts allow-same-origin"></iframe>

The guide's token vectors, attention grid, and images are teaching illustrations, not outputs from a running model. Its model-specific figures are reproduced from the supplied guide; the memory calculator estimates working memory rather than measuring a device. Treat its fit indicators as estimates, not guarantees.

## All the tools and examples

The full guide contains ten figures. You can jump directly to any of them:

1. [Prompt-to-image pipeline](/blog/demos/qwen-image-2-1-turbo.html#fig1): select a stage and change the image size to inspect its output shape.
2. [Tokens and vectors](/blog/demos/qwen-image-2-1-turbo.html#fig2): enter a prompt and compare illustrative vectors before and after contextual encoding.
3. [One word, two meanings](/blog/demos/qwen-image-2-1-turbo.html#fig3): compare “bank” in a river sentence and a money sentence.
4. [Pixels and the latent](/blog/demos/qwen-image-2-1-turbo.html#fig4): explore the illustrated relationship between image blocks and latent channels.
5. [Image sizes and token counts](/blog/demos/qwen-image-2-1-turbo.html#fig5): compare resolutions, latent grids, and numbers of image tokens.
6. [Eight denoising steps](/blog/demos/qwen-image-2-1-turbo.html#fig6): play the animation or move the slider through the noise schedule.
7. [Inside the transformer](/blog/demos/qwen-image-2-1-turbo.html#fig7): follow image tokens, text tokens, and the noise level through its blocks.
8. [Attention and the KV cache](/blog/demos/qwen-image-2-1-turbo.html#fig8): select token rows and compare the first step with later steps.
9. [Transformer runs per image](/blog/demos/qwen-image-2-1-turbo.html#fig9): compare the guide's illustrative base-model workload with the Turbo schedule.
10. [Memory calculator](/blog/demos/qwen-image-2-1-turbo.html#fig10): change weight precision, resolution, staged loading, and tiled decoding.

## Three parts, three different jobs

The **text encoder** turns the prompt into contextual vectors. Those vectors give the image model a numerical representation of the words and their relationships. In the guide, try changing the prompt and switching between the vectors before and after the encoder. The values are illustrative, but the distinction is the point: a token's meaning depends on its context.

The **diffusion transformer** repeatedly updates a noisy latent representation using that prompt information. Move the denoising slider to see how the illustrated noise level changes across the sampling schedule. The model works in a compressed space; it does not redraw every output pixel directly at each step.

The **VAE decoder** turns the resulting latent into pixels. The latent visualization connects the image's spatial dimensions to the number of values that the transformer works with. Its block view is a simplified illustration of compression, not a claim that a learned decoder reconstructs each block independently.

This guide focuses on how the components fit together at inference time. For the idea behind training a faster model to imitate a slower one, see [Model Distillation](/blog/model-distillation.html).

## Explore the memory tradeoff

The last figure lets you change text encoder precision and transformer precision separately. It also lets you compare keeping the components loaded with releasing the text encoder after it has encoded the prompt. Toggle tiled VAE decoding to see how a different execution strategy changes the estimated peak.

That distinction matters: weight size is only part of the memory budget. Activations, temporary buffers, image resolution, and which components remain resident all affect the peak. A smaller checkpoint file does not by itself establish that a generation will fit.

[My post on fitting big models on small GPUs](/blog/fitting-big-models-small-gpus.html) covers the broader quantization tradeoff. Here, the useful question is more specific: which component occupies memory at the moment the pipeline needs the most of it?
