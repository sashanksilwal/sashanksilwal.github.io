At some point in every data team's life, someone writes a Python script, puts it in a cron job, and calls it a pipeline. It works fine until the script depends on another script that depends on a database export that runs on a different server on a different schedule. Then one job fails silently, the downstream job runs on stale data, and you spend your Friday figuring out what broke and when.

Airflow exists because cron jobs don't scale.

## What Airflow Actually Is

Apache Airflow is a workflow orchestrator. You define tasks and the dependencies between them, and Airflow handles scheduling, execution, retries, monitoring, and alerting. It doesn't process your data (that's what your tasks do). It makes sure your tasks run in the right order at the right time.

Think of it like a project manager for your scripts. It doesn't write the code, but it knows what needs to happen before what, and it yells at you when something goes wrong.

## DAGs: The Core Concept

Everything in Airflow is organized into DAGs (Directed Acyclic Graphs). A DAG is just a collection of tasks with dependencies between them.

**Directed** means the edges have direction. Task A runs before Task B, not the other way around.

**Acyclic** means no loops. You can't have Task A depend on Task B which depends on Task A. If you think about it, that would be an infinite loop, and Airflow won't let you create one.

**Graph** means it's a network of nodes (tasks) connected by edges (dependencies).

Here's what a simple DAG looks like:

```
Extract Data → Transform Data → Train Model → Evaluate Model
```

Each arrow is a dependency. "Transform Data" won't start until "Extract Data" succeeds. If "Extract Data" fails, nothing downstream runs. That's the whole point.

## Your First DAG

Here's a real, working Airflow DAG that runs a basic ML pipeline. This pulls data, transforms it, trains a model, and evaluates it.

```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta

default_args = {
    "owner": "sashank",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["your-email@example.com"],
}

def extract_data(**kwargs):
    """Pull raw data from source."""
    import pandas as pd
    df = pd.read_sql("SELECT * FROM transactions WHERE date > '2026-01-01'", conn)
    df.to_parquet("/tmp/raw_data.parquet")
    return len(df)

def transform_data(**kwargs):
    """Clean and feature engineer."""
    import pandas as pd
    df = pd.read_parquet("/tmp/raw_data.parquet")
    df = df.dropna(subset=["amount", "category"])
    df["amount_log"] = df["amount"].apply(lambda x: np.log1p(x))
    df.to_parquet("/tmp/features.parquet")

def train_model(**kwargs):
    """Train a simple model."""
    import pandas as pd
    from sklearn.ensemble import GradientBoostedClassifier
    df = pd.read_parquet("/tmp/features.parquet")
    X, y = df.drop("label", axis=1), df["label"]
    model = GradientBoostedClassifier().fit(X, y)
    joblib.dump(model, "/tmp/model.pkl")

def evaluate_model(**kwargs):
    """Score model on held-out data and log metrics."""
    model = joblib.load("/tmp/model.pkl")
    accuracy = model.score(X_test, y_test)
    print(f"Model accuracy: {accuracy}")
    if accuracy < 0.85:
        raise ValueError(f"Accuracy {accuracy} below threshold 0.85")

with DAG(
    dag_id="ml_training_pipeline",
    default_args=default_args,
    description="Weekly model retraining pipeline",
    schedule_interval="@weekly",
    start_date=datetime(2026, 1, 1),
    catchup=False,
) as dag:

    extract = PythonOperator(task_id="extract_data", python_callable=extract_data)
    transform = PythonOperator(task_id="transform_data", python_callable=transform_data)
    train = PythonOperator(task_id="train_model", python_callable=train_model)
    evaluate = PythonOperator(task_id="evaluate_model", python_callable=evaluate_model)

    extract >> transform >> train >> evaluate
```

That last line (`>>`) defines the dependency chain. Airflow reads it as "extract runs first, then transform, then train, then evaluate." You can also do parallel branches:

```python
# transform and validate run in parallel after extract
extract >> [transform, validate]
[transform, validate] >> train
```

## Key Concepts

**Operators** are the building blocks. `PythonOperator` runs a Python function. `BashOperator` runs a shell command. There are operators for BigQuery, S3, Spark, Snowflake, and basically every data tool you've heard of.

**Tasks** are instances of operators within a DAG. The operator is the template, the task is the specific instance with specific arguments.

**XComs** (cross-communications) let tasks pass small pieces of data to each other. The `extract_data` function above returns `len(df)`, which downstream tasks can read. Don't use XComs for large data. Use files, databases, or object storage instead.

**The Scheduler** checks your DAGs on an interval and kicks off runs when they're due. **The Executor** actually runs the tasks. The default `SequentialExecutor` runs one task at a time (fine for local dev). In production you'd use the `CeleryExecutor` or `KubernetesExecutor` for parallelism.

## Error Handling

Airflow's retry logic is one of its best features. The `default_args` above specify 2 retries with a 5-minute delay. If a task fails (raises an exception), Airflow waits 5 minutes and tries again. If it fails twice more, it marks the task as failed and sends you an email.

You can also set up more specific behavior:

```python
PythonOperator(
    task_id="flaky_api_call",
    python_callable=call_external_api,
    retries=5,
    retry_delay=timedelta(minutes=2),
    retry_exponential_backoff=True,  # 2min, 4min, 8min, 16min, 32min
    max_retry_delay=timedelta(minutes=30),
)
```

For conditional logic, use branching:

```python
from airflow.operators.python import BranchPythonOperator

def decide_path(**kwargs):
    accuracy = kwargs["ti"].xcom_pull(task_ids="evaluate_model")
    if accuracy > 0.90:
        return "deploy_model"
    return "notify_team"

branch = BranchPythonOperator(
    task_id="check_quality",
    python_callable=decide_path,
)
```

## When NOT to Use Airflow

Airflow is great for batch workflows that run on a schedule. It's not great for everything.

**Real-time streaming**: If you need sub-second latency, use Kafka, Flink, or Spark Streaming. Airflow's minimum scheduling interval is effectively about a minute, and it's not designed for continuous processing.

**Simple cron jobs**: If you have one script that runs once a day with no dependencies, a cron job is fine. Airflow adds overhead (a web server, a scheduler, a database, workers) that isn't worth it for simple cases.

**Event-driven workflows**: Airflow can be triggered by events using sensors, but it's clunky compared to tools designed for it. If most of your workflows are "run this when that file appears" or "run this when that API fires a webhook," look at something else.

## Alternatives Worth Knowing

**Prefect** is basically "Airflow but modern." It uses Python-native decorators, has better error messages, and doesn't require you to deploy a separate web server. If I were starting fresh today, I'd seriously consider it.

**Dagster** focuses on data assets rather than tasks. Instead of "run this function, then that function," you think in terms of "this dataset depends on that dataset." The mental model is different and arguably better for data pipelines.

**Luigi** (from Spotify) is simpler than Airflow and fine for smaller teams. It's showing its age though.

Airflow's advantage is ecosystem. It has operators for everything, massive community support, and it's what most job postings ask for. If you're learning one orchestration tool, it should probably still be Airflow. But know that there are alternatives and they're getting better.

## The Practical Takeaway

The real value of Airflow isn't fancy features. It's that when something breaks at 3 AM, you can open the web UI, see exactly which task failed, read the logs, fix the issue, and re-run just the failed task and everything downstream. Compare that to debugging a chain of cron jobs by grepping through log files on different servers.

If you're building ML systems that need to [retrain on a schedule, monitor for drift, and redeploy automatically](/blog/post.html?post=ml-systems-production), Airflow is usually where that automation lives. It's not glamorous software. It's plumbing. But good plumbing is the difference between a system that runs itself and a system that runs you.
