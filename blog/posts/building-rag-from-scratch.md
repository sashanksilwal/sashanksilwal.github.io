Last week I watched a friend spend three hours trying to get ChatGPT to answer questions about his company's internal docs. He kept pasting chunks of text into the chat window, hitting the token limit, and starting over. That's basically what RAG does, except it automates the whole process and does it well.

RAG stands for Retrieval-Augmented Generation. The idea is simple: instead of hoping a language model memorized the answer to your question during training, you find the relevant information first, then hand it to the model along with your question. That's it. The model reads your documents and gives you an answer grounded in actual data.

I'm going to walk you through building one from scratch in Python. No frameworks, no magic abstractions. Just the core pieces so you understand what's actually happening.

## The four pieces

Every RAG system has four parts:

1. **Chunking** - breaking your documents into smaller pieces
2. **Embedding** - turning those pieces into numbers (vectors) that capture meaning
3. **Retrieval** - finding the most relevant pieces for a given question
4. **Generation** - feeding those pieces to an LLM to get an answer

Let's build each one.

## Step 1: Chunk your documents

You can't just throw an entire PDF at a language model. Context windows are limited, and even when they're large, stuffing in irrelevant text makes the model worse at answering. So you split your documents into chunks.

```python
def chunk_text(text, chunk_size=500, overlap=50):
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap
    return chunks

# Example usage
with open("my_document.txt", "r") as f:
    raw_text = f.read()

chunks = chunk_text(raw_text)
print(f"Created {len(chunks)} chunks")
```

The overlap matters. Without it, you'll split sentences in half and lose context at the boundaries. 50 characters of overlap is minimal. In practice, you'd want to split on sentence boundaries or paragraphs instead of raw character counts. But this gets the idea across.

## Step 2: Turn text into vectors

Here's where embeddings come in. An embedding model takes a piece of text and outputs a list of numbers (a vector) that represents its meaning. Similar texts end up with similar vectors. This is what makes search possible.

You can use OpenAI's embedding API or an open-source model. I'll show both.

**Option A: OpenAI embeddings**

```python
from openai import OpenAI

client = OpenAI()  # uses OPENAI_API_KEY env variable

def get_embeddings(texts):
    """Get embeddings for a list of texts using OpenAI."""
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )
    return [item.embedding for item in response.data]

chunk_embeddings = get_embeddings(chunks)
print(f"Each embedding has {len(chunk_embeddings[0])} dimensions")
```

**Option B: Open-source with sentence-transformers (free, runs locally)**

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")

chunk_embeddings = model.encode(chunks).tolist()
print(f"Each embedding has {len(chunk_embeddings[0])} dimensions")
```

The open-source option is great for getting started. No API key needed, runs on your laptop, and the quality is surprisingly good for most use cases.

## Step 3: Build a vector store and retrieve

Now you need somewhere to store these vectors and a way to search them. A vector database does this, but for learning purposes, we can use plain NumPy. The search works by computing cosine similarity between your question's embedding and every chunk's embedding, then returning the top matches.

```python
import numpy as np

class SimpleVectorStore:
    def __init__(self):
        self.embeddings = []
        self.texts = []

    def add(self, texts, embeddings):
        self.texts.extend(texts)
        self.embeddings.extend(embeddings)

    def search(self, query_embedding, top_k=3):
        """Find the top_k most similar chunks to the query."""
        query = np.array(query_embedding)
        scores = []
        for emb in self.embeddings:
            emb = np.array(emb)
            # Cosine similarity
            score = np.dot(query, emb) / (
                np.linalg.norm(query) * np.linalg.norm(emb)
            )
            scores.append(score)

        # Get indices of top_k highest scores
        top_indices = np.argsort(scores)[-top_k:][::-1]
        results = []
        for i in top_indices:
            results.append({
                "text": self.texts[i],
                "score": scores[i]
            })
        return results

# Build the store
store = SimpleVectorStore()
store.add(chunks, chunk_embeddings)
```

This is intentionally naive. With 10,000 chunks it works fine. With 10 million, you'd want a proper vector database like ChromaDB, Pinecone, or pgvector. Those use approximate nearest neighbor algorithms (like HNSW) that trade a tiny bit of accuracy for massive speed gains.

Here's how you'd swap in ChromaDB if you want something more production-ready:

```python
import chromadb

client = chromadb.Client()
collection = client.create_collection("my_docs")

collection.add(
    documents=chunks,
    ids=[f"chunk_{i}" for i in range(len(chunks))],
    embeddings=chunk_embeddings
)

results = collection.query(
    query_embeddings=[query_embedding],
    n_results=3
)
```

## Step 4: Generate an answer

This is the fun part. Take your retrieved chunks, stuff them into a prompt with the user's question, and let the LLM do its thing.

```python
def ask(question, store, embed_fn):
    """Full RAG pipeline: embed question, retrieve, generate."""
    # 1. Embed the question
    query_embedding = embed_fn([question])[0]

    # 2. Retrieve relevant chunks
    results = store.search(query_embedding, top_k=3)
    context = "\n\n---\n\n".join([r["text"] for r in results])

    # 3. Generate answer
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Answer the user's question based on the provided context. "
                    "If the context doesn't contain the answer, say so. "
                    "Do not make up information."
                )
            },
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {question}"
            }
        ]
    )
    return response.choices[0].message.content

# Ask a question
answer = ask(
    "What is the refund policy?",
    store,
    get_embeddings
)
print(answer)
```

That system prompt is doing important work. Telling the model to only use the provided context and admit when it doesn't know prevents hallucination. Without those instructions, the model will happily make things up.

## Putting it all together

Here's the complete pipeline in one script:

```python
from openai import OpenAI
import numpy as np

client = OpenAI()

# 1. Load and chunk
with open("my_document.txt", "r") as f:
    raw_text = f.read()

chunks = chunk_text(raw_text)

# 2. Embed
chunk_embeddings = get_embeddings(chunks)

# 3. Store
store = SimpleVectorStore()
store.add(chunks, chunk_embeddings)

# 4. Ask questions
while True:
    question = input("\nAsk a question (or 'quit'): ")
    if question.lower() == "quit":
        break
    answer = ask(question, store, get_embeddings)
    print(f"\n{answer}")
```

That's a working RAG system in under 100 lines of real code.

## Things I'd do differently in production

The version above works for learning, but there are gaps you'd want to fill before putting this in front of real users.

**Better chunking.** Split on paragraphs or sentences instead of character counts. Libraries like LangChain have recursive text splitters that handle this well. Even better, if your documents have structure (headers, sections), chunk by section.

**Hybrid search.** Vector similarity search is great at finding semantically similar content, but it sometimes misses exact keyword matches. Combining vector search with traditional keyword search (BM25) catches both cases.

**Reranking.** Your initial retrieval might return 20 candidates. A reranker (like Cohere's rerank API or a cross-encoder model) can re-score those candidates with much higher accuracy, since it looks at the query and document together rather than comparing pre-computed vectors.

**Chunk metadata.** Store which document, page, and section each chunk came from. This lets you cite sources in your answers, which builds trust and lets users verify the information.

## What actually matters

I've seen people obsess over which embedding model to use or which vector database is fastest. Those things matter eventually, but they're not where most RAG systems fail.

Most RAG systems fail because of bad chunking. If your chunks split a paragraph about refund policies across two pieces, neither piece has the full answer, and the model gives a confused response. Spend your time on chunking strategy and you'll get 80% of the way there.

The second biggest failure mode is not evaluating. Build a set of 20-30 question/answer pairs from your documents. Run your pipeline on those questions. Check if the right chunks are being retrieved. Check if the answers are correct. Do this before tweaking anything else.

If you're building RAG for production, you should also think about what happens when someone poisons your documents. I wrote about that in my post on [context poisoning](/blog/post.html?post=context-poisoning). And if you want a more comprehensive reference covering evaluation, reranking, and other production concerns, I have a [longer guide on production RAG](/blog/post.html?post=rag-guide) as well.

The best RAG system is the one where you actually understand every piece. That's why I'd encourage you to build it from scratch at least once before reaching for a framework. Once you know what each component does, the frameworks make a lot more sense, and you'll know exactly where to look when something goes wrong.
