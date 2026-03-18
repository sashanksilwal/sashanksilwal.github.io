During my first week at Binance, I learned that the data team was processing petabytes of transaction data daily. Coming from college where the biggest dataset I'd touched was maybe a few gigabytes in a Jupyter notebook, that number didn't even feel real. My onboarding included spinning up PySpark jobs, and suddenly all those "big data" buzzwords I'd heard in class had actual meaning. There's a threshold where single-machine tools stop working, and working at an exchange that handles millions of trades per second puts you way past that threshold on day one.

The honest answer for most people: you don't need distributed computing until you do, and it's later than you think.

## When You Actually Need It

Pandas can comfortably handle 1-10GB of data on a modern laptop. With some care (proper dtypes, chunked reading), you can push it to 30-50GB. Polars, which is Pandas but faster and written in Rust, pushes that ceiling higher. DuckDB lets you run SQL on files larger than memory.

If your data fits on one machine, use single-machine tools. They're faster to develop with, easier to debug, and have zero infrastructure overhead. The overhead of setting up and maintaining a Spark cluster only pays off when your data genuinely won't fit in memory on a single machine, or when your processing time is so long that parallelizing across machines makes a meaningful difference.

My rough threshold: if your data is under 50GB and your processing is simple aggregations and joins, try Polars or DuckDB first. If you're over 100GB, or your pipeline involves complex multi-stage transformations, Spark starts making sense.

## Hadoop: Where It All Started

Hadoop was the original answer to "I have more data than fits on one computer." The core idea had two parts:

**HDFS** (Hadoop Distributed File System) splits large files into blocks and stores copies across multiple machines. Your 1TB file becomes thousands of 128MB blocks spread across a cluster.

**MapReduce** processes data where it lives. Instead of pulling all data to one machine, you send your code to each machine. Each machine processes its local blocks (the "map" step), then results are shuffled and combined (the "reduce" step).

This was revolutionary in 2006. It's also painful to use. Writing MapReduce jobs means thinking in map and reduce functions, which is awkward for most data transformations. Something as simple as a join requires multiple MapReduce stages. And every intermediate result gets written to disk, which makes iterative algorithms (like anything in ML) brutally slow.

You'll still see HDFS in production at many large companies. But MapReduce as a programming model is effectively dead. Spark replaced it.

## Spark: What Hadoop Should Have Been

Spark fixed Hadoop's two biggest problems: it keeps data in memory between operations, and it provides an API that doesn't make you want to quit engineering.

The architecture is simple in concept:

**Driver**: your main program. It defines what transformations to apply and sends work to executors.

**Executors**: worker processes on cluster machines. They do the actual computation.

**Partitions**: your data split into chunks. Each executor processes some partitions in parallel.

**Lazy evaluation**: Spark doesn't actually do anything when you write a transformation. It builds a plan (a DAG of operations). Only when you trigger an "action" (like `.count()` or `.write()`) does it optimize the plan and execute it. This means Spark can look at your entire pipeline and optimize things like combining multiple filters, reordering joins, and pushing filters down to the data source.

## PySpark: The Practical Part

PySpark is the Python API for Spark. If you know Pandas, the concepts are similar but the syntax is different.

```python
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

spark = SparkSession.builder \
    .appName("feature_engineering") \
    .config("spark.sql.shuffle.partitions", "200") \
    .getOrCreate()

# Read data (lazy, doesn't load into memory yet)
transactions = spark.read.parquet("s3://bucket/transactions/")
users = spark.read.parquet("s3://bucket/users/")

# Transformations (lazy, nothing executes yet)
features = (
    transactions
    .filter(F.col("date") >= "2025-01-01")
    .groupBy("user_id")
    .agg(
        F.count("*").alias("transaction_count"),
        F.sum("amount").alias("total_spend"),
        F.avg("amount").alias("avg_spend"),
        F.max("amount").alias("max_spend"),
        F.countDistinct("merchant").alias("unique_merchants"),
    )
)

# Join with user features
enriched = features.join(users, on="user_id", how="left")

# THIS triggers execution
enriched.write.parquet("s3://bucket/features/output/")
```

Key difference from Pandas: everything is lazy until you call an action. `filter`, `groupBy`, `join` don't execute immediately. `write`, `count`, `show`, `collect` trigger execution. This matters because it means Spark can optimize the entire pipeline before running it.

## Common PySpark Patterns for ML

**Window functions** are incredibly useful for time-series features:

```python
from pyspark.sql.window import Window

# Rolling 7-day spend per user
window_7d = Window.partitionBy("user_id").orderBy("date").rangeBetween(-7, 0)

transactions = transactions.withColumn(
    "spend_7d",
    F.sum("amount").over(window_7d)
)
```

**Handling skewed joins** (when one key has millions of rows):

```python
# Salting: add random prefix to break up hot keys
skewed_df = skewed_df.withColumn(
    "salted_key",
    F.concat(F.col("join_key"), F.lit("_"), (F.rand() * 10).cast("int"))
)
```

**Caching** when you reuse a DataFrame:

```python
# If you'll use this DataFrame multiple times, cache it
features = features.cache()
features.count()  # Triggers caching

# Now subsequent operations on 'features' read from memory
train_features = features.filter(F.col("date") < "2026-01-01")
test_features = features.filter(F.col("date") >= "2026-01-01")
```

## Performance Tips That Actually Matter

Most PySpark performance problems come from three things:

**1. Too many shuffles.** A shuffle happens when data needs to move between machines (joins, groupBy, distinct). Shuffles are expensive because they involve network transfer and disk I/O. Minimize them by filtering early, using broadcast joins for small tables, and avoiding unnecessary `repartition()` calls.

```python
from pyspark.sql.functions import broadcast

# If one table is small (< 100MB), broadcast it to avoid shuffle
result = big_table.join(broadcast(small_lookup_table), on="key")
```

**2. Wrong partition count.** Too few partitions means some executors sit idle while others are overloaded. Too many means excessive overhead from scheduling tiny tasks. Rule of thumb: 2-4 partitions per CPU core in your cluster.

**3. Reading too much data.** Parquet is columnar, so Spark only reads the columns you actually use. But only if you select them early in your pipeline. Don't `select("*")` at the beginning and filter columns later.

## Spark on Cloud

You don't need to manage your own cluster anymore. Every major cloud has a managed Spark service.

**AWS EMR** (Elastic MapReduce) is the oldest option. It works, it's flexible, and it integrates with S3 and the rest of AWS. The downside is that you're still managing cluster configurations, instance types, and autoscaling policies.

**Databricks** is Spark-as-a-service from the people who created Spark. It adds notebooks, job scheduling, Delta Lake (a storage layer that adds ACID transactions to your data lake), and Unity Catalog for governance. It's the most polished experience but also the most expensive.

**Google Dataproc** is GCP's equivalent of EMR. If you're already on GCP, it's the obvious choice.

My take: if you're doing one-off analysis, use Databricks (or even just Colab with a small Spark setup). If you're building production pipelines, EMR or Dataproc with infrastructure-as-code gives you more control.

## The Honest Take

Distributed computing is a tool. Like any tool, using it when you don't need it makes things worse, not better. The debugging experience in Spark is significantly harder than Pandas. Error messages are verbose and often unhelpful. Local development requires a JVM installation that somehow breaks every other update.

But when you hit the data size where single-machine tools fall over, Spark is the standard for good reason. It scales linearly, the API is reasonable, and the ecosystem (Delta Lake, MLflow, Structured Streaming) covers most of what you need.

Start with the simplest tool that handles your data size. Move to Spark when you have to, not when it seems cool. And when you do move to Spark, invest time in understanding partitions and shuffles. Those two concepts explain 90% of Spark performance behavior. If you're building production pipelines on top of Spark, you'll want an orchestration layer like [Airflow](/blog/post.html?post=airflow-dag-basics) to manage scheduling, retries, and dependencies between your Spark jobs.
