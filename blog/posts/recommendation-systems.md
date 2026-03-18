Netflix's recommendation engine is worth about a billion dollars a year to the company. Not because the algorithm is particularly clever (it's not, compared to what's in the research papers), but because it sits between 230 million users and a catalog they'd never browse on their own. Recommendations are one of those problems where good enough at scale beats perfect in a lab.

I've been studying these systems in my coursework and building small versions of them, and the thing that surprised me most is how much of the real-world performance comes from unglamorous feature engineering rather than fancy architectures. But you need to understand the architectures to know where the features plug in.

## Collaborative Filtering: The Original Idea

Collaborative filtering is based on one assumption: people who agreed in the past will agree in the future. If you and I both liked the same 20 movies, and you liked a 21st movie I haven't seen, I'd probably like it too.

**User-based CF** finds users similar to you and recommends what they liked. **Item-based CF** finds items similar to ones you liked and recommends those. Item-based tends to work better in practice because item relationships are more stable than user preferences (a movie's "vibe" doesn't change, but your mood does).

The classic implementation uses matrix factorization. You have a big sparse matrix of users x items, where each entry is a rating (or implicit signal like a click). Factor it into two smaller matrices, and the dot product of a user vector and an item vector gives you a predicted score.

```python
import torch
import torch.nn as nn

class MatrixFactorization(nn.Module):
    def __init__(self, n_users, n_items, n_factors=50):
        super().__init__()
        self.user_embedding = nn.Embedding(n_users, n_factors)
        self.item_embedding = nn.Embedding(n_items, n_factors)
        self.user_bias = nn.Embedding(n_users, 1)
        self.item_bias = nn.Embedding(n_items, 1)

    def forward(self, user_ids, item_ids):
        user_vec = self.user_embedding(user_ids)
        item_vec = self.item_embedding(item_ids)
        dot = (user_vec * item_vec).sum(dim=1, keepdim=True)
        return dot + self.user_bias(user_ids) + self.item_bias(item_ids)
```

This is essentially what Alternating Least Squares (ALS) does, just with a different optimization method. ALS alternates between fixing user factors and solving for item factors, then fixing item factors and solving for user factors. It's embarrassingly parallel, which is why Spark's MLlib has a built-in ALS implementation that scales to billions of interactions.

The problem with pure collaborative filtering: cold start. New users have no history. New items have no ratings. The system can't recommend anything.

## Content-Based Filtering: Using What You Know

Content-based filtering sidesteps the cold start problem by using features of the items themselves. If you liked action movies with Chris Evans, recommend other action movies (or other Chris Evans movies). You don't need other users' behavior at all.

The simplest version uses TF-IDF on item descriptions and computes cosine similarity. More modern versions use learned embeddings from item metadata (genre, description, images, etc.).

Content-based works well when you have rich item metadata and poorly when items are hard to describe with features. It also tends to over-specialize. If you watched three cooking videos, you'll get nothing but cooking videos forever. There's no serendipity.

Most real systems combine collaborative and content-based signals. That's where two-tower models come in.

## Two-Tower Architecture: The Industry Standard

This is what most large-scale recommendation systems actually use in production. The idea: build two separate neural networks (towers), one that processes user features and one that processes item features. Each tower outputs an embedding vector. The score for a user-item pair is the dot product (or cosine similarity) of their two vectors.

```python
class TwoTowerModel(nn.Module):
    def __init__(self, user_features_dim, item_features_dim, embed_dim=64):
        super().__init__()
        self.user_tower = nn.Sequential(
            nn.Linear(user_features_dim, 128),
            nn.ReLU(),
            nn.Linear(128, embed_dim)
        )
        self.item_tower = nn.Sequential(
            nn.Linear(item_features_dim, 128),
            nn.ReLU(),
            nn.Linear(128, embed_dim)
        )

    def forward(self, user_features, item_features):
        user_embed = self.user_tower(user_features)
        item_embed = self.item_tower(item_features)
        # Normalize for cosine similarity
        user_embed = user_embed / user_embed.norm(dim=1, keepdim=True)
        item_embed = item_embed / item_embed.norm(dim=1, keepdim=True)
        return (user_embed * item_embed).sum(dim=1)
```

Why two towers instead of one big model? Scale. Once trained, you pre-compute all item embeddings and store them in an approximate nearest neighbor index (like FAISS or ScaNN). At serving time, you only run the user tower (once per request), then do a fast vector search to find the top-K items. This lets you score millions of items in milliseconds.

The typical production pipeline has two stages:

1. **Retrieval** (two-tower model): quickly find ~1000 candidates from millions of items
2. **Ranking** (heavier model): re-score those 1000 candidates with a more complex model that can use cross-features (features that depend on both the user and item together)

The retrieval model is simple and fast. The ranking model is complex and slow, but it only sees 1000 items instead of millions. This split is everywhere: YouTube, TikTok, Amazon, Spotify.

## GNN-Based Recommendations

Graph Neural Networks add something that collaborative filtering and two-tower models miss: the structure of relationships. Users and items form a bipartite graph (users connect to items they've interacted with). Friends form a social graph. Items connect to categories, brands, creators.

**LightGCN** (He et al., 2020) showed that for recommendation, you don't even need the nonlinear transformations that typical GNNs use. Just propagate embeddings through the graph and average across layers:

$$e_u^{(k+1)} = \sum_{i \in N(u)} \frac{1}{\sqrt{|N(u)||N(i)|}} e_i^{(k)}$$

Each layer aggregates information from neighbors. After K layers, a user's embedding incorporates signals from items they interacted with, other users who interacted with the same items, and items those users liked. It's collaborative filtering on steroids, with multi-hop reasoning built in.

**PinSage** (Pinterest, 2018) scaled this to billions of nodes by sampling neighborhoods instead of using the full graph. It's still one of the most cited industry papers in this space.

Where GNNs really shine is cold start. A new item with no interactions but connected to a known brand, category, and creator still gets a meaningful embedding through its graph neighbors. Pure collaborative filtering can't do that.

## The Popularity Problem

Here's something that breaks recommendation systems in subtle ways. Popular items get recommended more. More recommendations mean more clicks. More clicks make the item look even more popular. The rich get richer.

This feedback loop means your recommendation system converges toward showing the same popular items to everyone. Long-tail items (which are often the most relevant for individual users) get buried.

**Inverse Propensity Scoring (IPS)** is one fix. The idea: weight each training example inversely by the probability that the user saw that item. Items that were shown to everyone get downweighted. Items that were shown rarely (but clicked when shown) get upweighted.

```python
# Simplified IPS-weighted loss
def ips_weighted_loss(predictions, labels, propensities):
    """
    propensities: P(item was shown to user), estimated from logs
    """
    weights = 1.0 / propensities.clamp(min=0.01)  # clip to avoid explosion
    weights = weights / weights.mean()  # normalize
    loss = nn.functional.binary_cross_entropy(predictions, labels, reduction='none')
    return (loss * weights).mean()
```

Other approaches include causal inference methods that try to separate "the user liked this because it's good" from "the user clicked this because we put it at the top of the page." This is hard. It's also increasingly important as regulators start asking questions about filter bubbles and algorithmic bias.

## What Actually Matters in Production

After studying these systems and talking to people who build them at scale, here's what I've taken away.

**Features matter more than architecture.** The difference between matrix factorization and a state-of-the-art GNN might be 2-3% in offline metrics. The difference between "just user-item interactions" and "user-item interactions plus time-of-day, device type, session length, and recency-weighted history" can be 10-15%. Most recommendation teams spend 80% of their time on feature engineering and 20% on model architecture.

**Real-time features are a multiplier.** What a user did in the last 5 minutes is far more predictive than what they did last month. This is why companies invest heavily in real-time feature infrastructure (I'll write more about [feature stores and Redis](/blog/post.html?post=feature-stores) separately).

**Evaluation is harder than training.** Offline metrics (AUC, NDCG, recall@K) don't always correlate with online metrics (click-through rate, session time, revenue). The only way to know if your model is actually better is to A/B test it with real users. This means your recommendation system needs to be built for experimentation from day one.

The best recommendation system isn't the one with the cleverest architecture. It's the one that can be retrained daily, A/B tested continuously, and debugged when something goes wrong. Which is, honestly, most of the advice for [ML in production](/blog/post.html?post=ml-systems-production) in general.
