I first learned about graph neural networks in undergrad at [NYU Abu Dhabi](/experience/). I read a couple of papers, watched a tutorial, ran through a PyTorch Geometric example on Cora, and immediately decided I needed to use a GNN for a small personal project I'd been poking at. The project had nothing to do with graphs. I constructed one anyway. Nodes were data points, edges were whatever similarity metric I could justify that afternoon. I trained the GNN, compared it to a random forest I'd already built, and the random forest won by a comfortable margin.

It took me longer than I want to admit to realize the lesson wasn't "I implemented the GNN wrong." The lesson was that I didn't have a graph problem. I'd forced a graph structure onto a tabular problem because GNNs were the new thing I'd learned and I wanted an excuse to use one.

I've watched variations of this happen a lot since then. Someone reads about GNNs, gets excited, and tries to graph-ify whatever they're working on. Graph neural networks have a marketing problem: they sound like a strictly more powerful tool because graphs are more general than tables. If you can represent anything as nodes and edges, you should, right? In practice, most problems that look like graphs don't actually need a GNN to solve them well. And when you reach for one anyway, you pay in training speed, debugging time, and often accuracy.

Here's the framework I wish I'd had back in undergrad.

## Question 1: Is your data actually a graph?

This sounds obvious but people get it wrong constantly. A graph is a set of entities connected by meaningful relationships. That word "meaningful" does a lot of work.

Take a typical recommendation dataset: users, items, and a history of user-item interactions. People call this a bipartite graph all the time. Technically correct. But matrix factorization, two-tower models, and plain old collaborative filtering all handle this structure fine without any graph machinery. I covered these approaches in my [post on recommendation systems](/blog/post.html?post=recommendation-systems). The "graph" framing doesn't buy you anything concrete unless structural patterns (triangles, community structure, multi-hop paths) actually affect predictions.

Real graph problems look like:

- Molecules, where atoms are connected by bonds and the bond structure determines chemical properties.
- Social networks where who-knows-whom patterns matter for influence.
- Citation networks where a paper's topic is partially determined by what it cites.
- Knowledge graphs where entity relationships encode semantic information.
- Physical systems where interactions between particles follow local rules.

Fake graph problems look like:

- Tabular data with edges you invented from a similarity metric (my undergrad mistake).
- Time series with some vague notion of connected events.
- Any setup where you can compute a node's features without looking at its neighbors.

If the structure is something you made up to justify a GNN, it probably won't help.

## Question 2: Does the graph structure carry signal?

Even if you have a legit graph, the bigger question is whether the structure matters for what you're predicting.

Strong homophily is a good sign. If connected nodes tend to share labels (friends have similar tastes, citing papers tend to be in the same field), then knowing a node's neighbors helps you predict it. Heterophily, where connected nodes tend to differ, is harder but sometimes still useful.

The clearest test is to compare three models:

- **Model A:** node features only, ignore structure.
- **Model B:** node features plus hand-engineered aggregates of neighbor features (mean of neighbor features, count of neighbors by type, degree, clustering coefficient).
- **Model C:** a GNN.

If B crushes A, structure matters. If C crushes B, GNN-specific patterns matter and the complexity is worth it. If A and B are within 1% of each other, you don't have a graph problem.

Run A and B before anyone writes a line of PyTorch Geometric code. They take a day. The GNN takes a week. The ordering matters.

## The baseline everyone skips

For most graph-ish problems with tabular-looking node features, the baseline should be:

1. For each node, compute aggregate features from its neighborhood: mean, max, and sum of neighbor features, counts of different node types nearby, structural features like degree and clustering coefficient.
2. Concatenate with the node's own features.
3. Train XGBoost or a small MLP.

This is "graph feature engineering." It captures most of what a 1-2 layer GNN captures, and it runs in minutes on datasets where a GNN would take hours. Working on [fraud detection at Binance](/experience/), I saw this approach beat our first GNN attempts by a clear margin until we tuned the GNNs specifically for that setting. The baseline is boring, which is why people skip it. That's a mistake.

GNNs only start to win when one of these is true:

- The graph is huge and sparse, so hand-engineering aggregates across many hops is painful.
- Multi-hop patterns matter (think "friends of friends of fraudsters").
- You have rich edge features that are hard to bake into tabular aggregates.
- The task itself is inherently structural, like link prediction or graph classification.

## When GNNs genuinely pay off

A few scenarios where I'd reach for a GNN first without apology:

**Molecules.** Atoms, bonds, bond types, stereochemistry. The whole point of the model is to learn how molecular substructures combine into properties. GNNs dominate this space for good reason.

**Physics simulations.** Particles interact through local rules and you want to learn those rules from data. My [UrbanTherm project](/blog/post.html?post=urbantherm) isn't a GNN, but it shares the same local-to-global philosophy: local physics, global effects. GNNs are a natural fit when you want that same inductive bias but with learned rather than hand-coded interactions.

**Knowledge graph embeddings.** You're explicitly trying to learn representations that respect relational structure between entities. TransE, ComplEx, and their neural extensions are graph-aware by design.

**Very large, very sparse, homophilous graphs.** Citation networks, protein interaction networks, Wikipedia. When hand-engineering 3-hop aggregates starts to feel cruel and unusual.

## When GNNs lose

**Small graphs.** If your graph has a few thousand nodes, a GNN is overkill. You can often compute exact graph statistics and feed them to a boosted tree model.

**Noisy or heuristic edges.** GNNs propagate signal along edges. If your edges are "these users happened to appear in the same session," you're propagating noise. The model will learn to trust the signal regardless, which is worse than never having it.

**Low homophily with simple structure.** If connected nodes aren't predictive of each other and the structure isn't rich, a GNN learns to mostly ignore its graph part. You're paying complexity cost for no benefit.

**When you need interpretability.** A boosted tree with graph aggregates gives you feature importances that auditors can read. A GNN gives you attention weights that everyone squints at and pretends to understand.

## The implementation tax

Even if a GNN is the right model, there's a real engineering cost worth factoring in.

Training batches on graphs are weird. You can't just grab 32 rows from a DataFrame. You need neighbor sampling, mini-batch construction, and careful memory management. PyTorch Geometric and DGL handle a lot of this, but the mental model is more complex than "call `model(X, y).loss.backward()`."

Inference at scale is also more annoying. Serving a GNN in production means either precomputing embeddings for every node (fast but stale) or running the full neighborhood at request time (accurate but slow). Neither is as clean as "feed features, get prediction." This ties into the broader [ML systems problems I've written about before](/blog/post.html?post=ml-systems-production): model complexity has infrastructure consequences.

## A short decision tree

Before you start:

1. Can the task be solved with tabular features? Run XGBoost on a flat dataset. Measure.
2. Does adding neighborhood aggregates help? Do the feature engineering manually for the 1-hop neighborhood. Measure again.
3. Still not good enough? Now consider a GNN. If the gap over hand-engineered features is small, think hard about whether the complexity is worth it.

This isn't a contrarian take. It's that GNN tutorials skip steps 1 and 2, so people assume those models are the right starting point. They're usually the wrong one. I learned that the hard way with a random forest that beat me in undergrad, and I've seen other people learn it the same way since.

GNNs are a real tool for a specific class of problems. If your data is genuinely relational and the structure carries signal, they earn their keep. If you're shoehorning a graph into your problem because it felt like the right framing, you're usually going to lose to a good baseline.

The question to ask first isn't "how do I implement a GNN for this?" It's "do I have a graph problem at all?" And if the answer is yes and you actually build one, the next surprise waiting is that stacking more layers doesn't make it better. I'll get into that in my next post on [the three failure modes of deep GNNs](/blog/post.html?post=gnn-failure-modes).
