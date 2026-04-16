"Just stack more layers" is a meme that mostly works in image models. ResNets are 100+ layers deep and still getting better. Transformers stack 96 layers in GPT-3 without visibly breaking. So the natural intuition when you first pick up a graph neural network is to go deep. Stack six, eight, twelve message-passing layers, and watch performance improve.

It doesn't. It usually gets worse.

The interesting thing is that deeper GNNs fail for at least three distinct reasons, each with its own mechanism and its own fix. This isn't one problem called "depth." It's three problems that share a symptom. A lot of GNN papers that claim to "solve depth" address only one of them, which is why depth remains a mess in the field.

The three failure modes are **oversmoothing**, **oversquashing**, and **underreaching**. They get lumped together and shouldn't be. (If you're not sure a GNN is the right tool in the first place, I wrote about that in an [earlier post](/blog/post.html?post=should-you-use-a-gnn). This one assumes you've decided yes.)

## Oversmoothing: everything converges to the same vector

Take a vanilla GCN. Each layer averages a node's representation with its neighbors' representations (roughly, with some normalization). Stack two layers and you're averaging two hops out. Stack four and it's four hops. Do this enough times and something subtle happens: every node's representation becomes the same vector, independent of its initial features.

This isn't a training bug. It's baked into the update rule. GCN layers implement a form of graph Laplacian smoothing, and if you iterate a smoothing operator enough times on any connected graph, you converge to the stationary distribution: constant across all nodes in the same connected component.

More formally, for a symmetric normalized adjacency $\hat{A} = D^{-1/2}(A + I) D^{-1/2}$, iterating $\hat{A}^k X$ drives node representations toward the eigenvector of $\hat{A}$ corresponding to the largest eigenvalue. That eigenvalue is 1, with multiplicity equal to the number of connected components. Li et al. (2018) formalized this and Oono & Suzuki (2020) tightened the bound: representations collapse exponentially in depth under mild conditions.

What this looks like in practice: train a 2-layer GCN, get reasonable accuracy. Add layers. By layer 4, accuracy starts dropping. By layer 8, every node has roughly the same embedding and the classifier can barely tell them apart.

Fixes:

- **Residual connections.** Skip connections around each GCN layer preserve original features. Works, but only partially.
- **PairNorm, GraphNorm.** Normalize representations to keep them from collapsing to a constant vector.
- **Initial residuals (GCNII).** Mix in the input features at every layer, not just the previous layer's output. One of the better-studied fixes.

Oversmoothing is the most famous failure mode, and the one with the most literature. But it's not the only thing going wrong.

## Oversquashing: too much signal through a narrow channel

Oversquashing is subtler and, in my opinion, more important. It comes from the graph's global structure, specifically from bottlenecks.

Imagine a graph that looks like two dense clusters connected by a single edge. Any information from cluster A that needs to reach cluster B has to pass through that one edge. A message-passing layer updates each node's representation using a fixed-size vector of neighbor information. But the amount of information that could in principle flow from cluster A to cluster B is huge: $O(n)$ in the size of cluster A. You're trying to stuff $O(n)$ bits of information through a single message of constant size.

That's oversquashing. The information exists, the path exists, but the representational bandwidth along the path is a bottleneck.

Alon & Yahav (2021) named this effect and showed it explains a lot of failure cases in GNNs on tasks requiring long-range reasoning. The key insight: oversquashing isn't about depth in the "deeper is worse" sense. It's about the topology of the graph itself. Some graphs have bottlenecks. Message passing over those graphs will lose information regardless of how carefully you design your layers.

The math backs this up. Topping et al. (2022) connected oversquashing to the graph's Ricci curvature: edges with strongly negative curvature (bridges between communities) are the bottleneck points.

Fixes:

- **Graph rewiring.** Modify the graph itself to remove bottlenecks before running message passing. Approaches include adding virtual nodes, random edges, or curvature-based rewiring (SDRF).
- **Graph transformers.** Abandon local message passing. Let every node attend to every other node. The downside: $O(n^2)$ attention scales badly, though there are efficient variants.
- **Diffusion-based models.** GRAND and similar models treat message passing as continuous diffusion, which can be designed to avoid bottleneck losses.

An important point: fixes that help oversmoothing (residual connections, normalization) don't help oversquashing at all. You can have perfectly preserved features at each node and still fail to move information across a bottleneck.

## Underreaching: you can't see what's too far away

This one is almost embarrassingly simple once you notice it. A $k$-layer GNN has a receptive field of $k$ hops. Any node more than $k$ hops away from a target node literally cannot influence its prediction. If your task requires information from nodes 10 hops away and your GNN is 4 layers deep, you can't solve the task. Not "you don't solve it well." You can't solve it, period.

This is called underreaching. It sounds trivial but it's not, because the "obvious" fix of adding more layers directly hits oversmoothing and oversquashing. You need depth to reach, but depth makes the other two problems worse. This is the fundamental tension of message-passing GNNs.

Many papers quietly sidestep this by benchmarking on graphs with small diameter. The Cora citation graph has diameter around 19, but most relevant information is within 2-3 hops, so 2-layer GCNs do fine. Try the same model on a task that genuinely requires 10-hop reasoning, and it doesn't matter how clever your architecture is if you only have 4 layers.

Fixes:

- **More layers.** Works only if you also fix the other two problems. Otherwise, you trade one failure mode for another.
- **Graph transformers.** Because every node can attend to every other node, the receptive field is the whole graph in one layer.
- **Multi-scale architectures.** Process the graph at multiple resolutions (coarsened versions) so information can flow globally in fewer steps. Like U-Nets for graphs.

## Why these are three problems, not one

The reason to separate them:

- Oversmoothing is about **what happens at each node as depth increases**: collapse to a common representation.
- Oversquashing is about **how much information can flow across the graph**: bounded by edge bandwidth.
- Underreaching is about **how far information can travel in $k$ layers**: bounded by receptive field.

You can be healthy on two dimensions and still fail on the third. A network with residual connections but no rewiring will avoid oversmoothing and still choke on oversquashing. A network with rewiring but only 2 layers will still underreach for long-range tasks. A network with 12 layers and no normalization will reach fine but produce identical representations at every node.

The mistake I see most often is assuming "I fixed oversmoothing, so I can go deeper." You can, but you'll hit oversquashing next, and then underreaching, and then you'll wonder why your model still isn't learning. The fixes are complementary, not substitutes.

## Where the field is going

The cleanest solution to all three problems is to drop message passing entirely. Graph transformers (Graphormer in particular) sidestep topology by letting every node talk to every other node. The information bottleneck disappears, oversmoothing becomes a non-issue (no repeated neighborhood averaging), and underreaching is impossible when the receptive field is the whole graph.

The cost is computational. Naive attention is $O(n^2)$, fine for small graphs but catastrophic for large ones. Most recent work tries to retain global context while avoiding full attention: efficient transformers with position encodings tailored to graph structure, hybrid models that combine local message passing with sparse global attention, and diffusion-based models that approximate global information flow.

The interesting long-term direction is a step further back: rethinking what "graph neural network" should even mean. The current message-passing template is one specific choice, not a fundamental constraint. When CNNs hit the depth wall, the field didn't keep stacking layers. It redesigned the architecture (ResNets, attention). The GNN equivalent is probably still being worked out, and most of the recent progress is about picking and combining from this menu of fixes rather than settling on one winner.

## What to actually do

If you're training a GNN and it's not working past 2-3 layers:

1. **Check homophily.** Low homophily often looks like oversmoothing but is a different problem. Use a heterophily-aware model (GPRGNN, H2GCN) instead.
2. **Add residual connections or use GCNII.** Handles oversmoothing, not the others.
3. **Diagnose whether you're bottlenecked.** If the task needs long-range reasoning, try a graph transformer or add rewiring.
4. **Check whether you're underreaching.** If the graph has large diameter and the task is global, no amount of local patching will help. Consider a different architecture.

Most "my GNN is bad" stories I've heard reduce to two of these three problems happening at once. Treat them separately and the fixes start making sense. Treat them as one big "depth problem" and you'll cycle through papers trying to find the right trick.

The deeper lesson is that message passing made a specific design choice: all information flows through local edges, one hop per layer. That choice has consequences, and the three failure modes are the shape of those consequences. Understanding which one you're actually hitting is most of the battle.
