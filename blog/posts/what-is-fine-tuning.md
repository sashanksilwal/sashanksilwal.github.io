A few months ago, a friend asked me why ChatGPT is so much better at answering questions than the "raw" models you can download off the internet. He'd tried running an open-source model locally, typed in a question, and got back something that read like a Wikipedia article having a seizure. Meanwhile ChatGPT was out here writing poetry and debugging code. Same underlying technology. Wildly different results.

The answer, in short, is fine-tuning. And once you understand it, a lot of the AI world starts making more sense.

## The Base Model Problem

When companies like Meta or Google train a large language model from scratch, the result is what's called a **base model** (sometimes called a "foundation model" or "pretrained model"). This model has read basically the entire internet. It knows facts, patterns, grammar, code, and a disturbing amount of Reddit arguments.

But here's the thing. A base model isn't trained to be *helpful*. It's trained to predict the next word in a sequence. That's it. If you give it the prompt "What is the capital of France?", it might continue with "What is the capital of Germany? What is the capital of Spain?" because in its training data, questions like that often appeared in a list. It's completing a pattern, not answering you.

This is the gap that fine-tuning fills. You take a model that *knows* a lot and teach it to *behave* in a way that's actually useful.

## Fine-Tuning: The Basics

Think of it like hiring someone who has two PhDs and speaks six languages, but has never held a job before. They have the knowledge. They just don't know how to apply it in context. Fine-tuning is the onboarding process.

In practice, fine-tuning means you take a pretrained model and train it a little bit more on a smaller, more specific dataset. Instead of the entire internet, you might train it on thousands of examples of questions paired with good answers. Or customer support conversations. Or medical diagnoses. The model learns "oh, when someone asks me something, I should respond like *this*, not like *that*."

The training data for fine-tuning is usually formatted as pairs: an input (what the user says) and a desired output (what the model should say back). The model adjusts its internal parameters to get better at producing those desired outputs. It's still the same model underneath, just with some of its billions of parameters nudged in a better direction.

## What Makes a Model "Better"?

This is where it gets interesting, because "better" means different things depending on who you ask.

For most people, "better" means the model is helpful, doesn't say anything dangerous, follows instructions, and admits when it doesn't know something. Getting a model to do all of these things requires more than just showing it good question-answer pairs. It requires teaching the model human preferences, which is genuinely hard to encode in a dataset.

Enter RLHF.

## RLHF: Teaching Models What Humans Actually Want

**RLHF** stands for Reinforcement Learning from Human Feedback. It's the technique that turned GPT-3 (smart but chaotic) into ChatGPT (smart and actually pleasant to talk to).

Here's how it works, roughly:

1. **Start with a fine-tuned model** that can already follow instructions somewhat.
2. **Generate multiple responses** to the same prompt.
3. **Have humans rank those responses** from best to worst. Which answer is most helpful? Which is safest? Which one would you actually want to receive?
4. **Train a "reward model"** on those human preferences. This reward model learns to score responses the way a human would.
5. **Use reinforcement learning** to train the original model to produce responses that score highly according to the reward model.

It's a roundabout process, but it works remarkably well. The model learns subtle things that are hard to write explicit rules for. Things like: don't be condescending, don't make up citations, if the question is ambiguous then ask for clarification instead of guessing.

The reason RLHF matters so much is that there's a huge gap between "technically correct" and "actually good." A model could give you a factually accurate answer that's buried in jargon, hedged with seventeen caveats, and formatted as a wall of text. RLHF helps the model learn that humans prefer clear, direct, well-structured responses.

## Full Fine-Tuning vs. LoRA: The Practical Side

Now, here's a practical problem. These models are enormous. GPT-3 had 175 billion parameters. Llama 3 has versions with 70 billion. Training all of those parameters requires serious hardware, hundreds of GPUs running for days or weeks.

**Full fine-tuning** means you update every single parameter in the model during training. This gives you the most flexibility and often the best results, but it's expensive. You need enough memory to store the model, the gradients (the math that tells each parameter how to change), and the optimizer states. For a 70-billion parameter model, you're looking at hundreds of gigabytes of GPU memory. Most people simply can't do this.

This is where **LoRA** comes in. LoRA stands for Low-Rank Adaptation, and the idea is clever. Instead of updating all 70 billion parameters, you freeze the original model and add small, trainable "adapter" layers on top. These adapters might have only a few million parameters, a tiny fraction of the full model.

Here's the analogy I like: imagine you have a massive pipe organ with thousands of pipes. Full fine-tuning is like retuning every single pipe. LoRA is like attaching small resonators to a few key pipes that shift the overall sound in the direction you want, without touching the rest of the instrument.

LoRA works because neural networks are surprisingly redundant. You don't need to change everything to change behavior meaningfully. In practice, LoRA gets you maybe 90-95% of the performance of full fine-tuning at a fraction of the cost. For most applications, that tradeoff is absolutely worth it.

There's also **QLoRA**, which combines LoRA with quantization (compressing the model's numbers to take up less memory). I go deeper into quantization methods in my post on [fitting big models on small GPUs](/blog/post.html?post=fitting-big-models-small-gpus). QLoRA lets you fine-tune a 65-billion parameter model on a single consumer GPU. That was kind of a big deal when it came out.

## How Companies Actually Do This

The pipeline at most AI companies looks something like this:

1. **Start with a base model** (either train one from scratch if you're Meta/Google, or grab an open-source one like Llama or Mistral).
2. **Supervised fine-tuning (SFT)**: Train on high-quality instruction-response pairs. This teaches the model to follow instructions and respond in a helpful format. Companies spend a lot of money getting humans to write or curate these examples.
3. **RLHF or a variant**: Align the model with human preferences. Some companies use DPO (Direct Preference Optimization) instead of full RLHF because it's simpler and doesn't require training a separate reward model.
4. **Safety training**: Additional fine-tuning to reduce harmful outputs. This usually involves more human feedback, red-teaming (trying to break the model on purpose), and specific datasets of things the model should refuse to do.
5. **Evaluation**: Test the model on benchmarks and with real users.

Each of these steps changes the model a little. The base model becomes an instruction-following model, which becomes an aligned model, which becomes a safe model. Same architecture throughout, just different parameter values.

## Why This Matters

Understanding fine-tuning explains a lot of things that otherwise seem mysterious. Why can the same base model power both a coding assistant and a medical chatbot? Fine-tuning on different data. Why do some open-source models feel "dumber" than commercial ones even when they have the same number of parameters? Usually worse fine-tuning data or less RLHF. Why do companies guard their fine-tuning datasets more closely than their model architectures? Because the data is often what makes the real difference.

The base model is the raw intelligence. Fine-tuning is what turns it into something you'd actually want to talk to. And increasingly, the competitive advantage in AI isn't in who has the biggest model. It's in who has the best data and the most thoughtful fine-tuning process to shape it.

If you want to go further down this rabbit hole, I also wrote about [model distillation](/blog/post.html?post=model-distillation), which is what happens when you use fine-tuning to compress a big model's knowledge into a smaller one.
