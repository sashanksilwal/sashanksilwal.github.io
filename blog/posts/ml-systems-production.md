In college, every ML project ended the same way: train a model in a notebook, check the accuracy, submit the assignment. Then I joined Binance, and within my first month a fraud detection model started approving transactions it should have flagged. Not a lot. Just enough to notice. The model hadn't changed. The code hadn't changed. The world had changed, and the model didn't keep up.

That was the first time I realized that training a model is maybe 20% of the work. Keeping it working in production is the other 80%.

## Why Models Break

A model learns patterns from historical data. It assumes the future looks like the past. Sometimes that assumption holds for years. Sometimes it breaks in a week.

There are two main ways it breaks, and they require different responses.

## Covariate Shift: The Inputs Change

Covariate shift means the distribution of your input features changes, but the relationship between inputs and outputs stays the same. The model is still "right" in theory, it just never sees inputs like these during training.

Example: you train a credit scoring model on data from 2023. In 2024, a new "buy now, pay later" product launches and suddenly you're seeing transaction patterns the model has never encountered. The model's logic for scoring risk hasn't become wrong. It's just being asked to score things it's never seen.

Detection is relatively simple. You compare feature distributions between your training data and recent production data.

```python
from scipy import stats
import numpy as np

def detect_drift(reference_data, production_data, threshold=0.05):
    """KS test for each feature. Returns features with significant drift."""
    drifted = []
    for feature in reference_data.columns:
        stat, p_value = stats.ks_2samp(
            reference_data[feature].dropna(),
            production_data[feature].dropna()
        )
        if p_value < threshold:
            drifted.append({
                "feature": feature,
                "ks_stat": stat,
                "p_value": p_value
            })
    return drifted

# Run weekly against your training distribution
drifted_features = detect_drift(train_df, last_week_df)
if drifted_features:
    print(f"Drift detected in {len(drifted_features)} features")
```

The Kolmogorov-Smirnov test works well for continuous features. For categorical features, Population Stability Index (PSI) is more standard. A PSI above 0.2 usually means something meaningful has shifted.

```python
def psi(reference, production, bins=10):
    """Population Stability Index for a single feature."""
    breakpoints = np.linspace(0, 100, bins + 1)
    ref_percents = np.percentile(reference, breakpoints)

    ref_counts = np.histogram(reference, bins=ref_percents)[0] / len(reference)
    prod_counts = np.histogram(production, bins=ref_percents)[0] / len(production)

    # Avoid division by zero
    ref_counts = np.clip(ref_counts, 0.001, None)
    prod_counts = np.clip(prod_counts, 0.001, None)

    return np.sum((prod_counts - ref_counts) * np.log(prod_counts / ref_counts))
```

## Concept Drift: The Rules Change

This one is harder. Concept drift (sometimes called target shift) means the relationship between inputs and outputs changes. The same input that used to mean "approve" now means "reject."

Going back to fraud: attackers adapt. The transaction patterns that signaled fraud six months ago might be different from today's patterns because fraudsters learned what gets flagged. The inputs might look similar, but what counts as fraud has shifted.

The tricky part is you often can't detect concept drift without labels. With covariate shift, you just compare input distributions. With concept drift, you need to know what the correct output *should* have been, and that information often arrives with a delay (sometimes weeks for fraud chargebacks).

The practical approach is to monitor proxy metrics. If your model's precision on recent labeled data drops below a threshold, something has probably shifted. Set up a feedback loop where human reviewers label a sample of recent predictions, and track accuracy on that sample over time.

## Retraining: Scheduled vs. Triggered

So the model is drifting. When do you retrain?

**Scheduled retraining** is the simplest approach. Retrain every week, every month, whatever cadence makes sense. Most teams start here because it's predictable and easy to automate. The downside is waste (retraining when nothing has changed) and risk (not retraining fast enough when something has).

**Triggered retraining** means you retrain when your monitoring detects that performance has degraded. This is more efficient but requires good monitoring, which is its own project.

In practice, most production teams I've seen use a hybrid. Scheduled retraining on a regular cadence (weekly or monthly) as a baseline, with triggered retraining as a safety net for sudden shifts.

```python
# Simplified retraining trigger logic
def should_retrain(metrics, thresholds):
    """Check if any monitored metric has crossed its threshold."""
    triggers = []
    if metrics["accuracy_7d"] < thresholds["min_accuracy"]:
        triggers.append("accuracy_drop")
    if metrics["max_psi"] > thresholds["max_psi"]:
        triggers.append("input_drift")
    if metrics["prediction_distribution_shift"] > thresholds["max_pred_shift"]:
        triggers.append("output_drift")
    return triggers

triggers = should_retrain(
    metrics=get_recent_metrics(),
    thresholds={"min_accuracy": 0.92, "max_psi": 0.2, "max_pred_shift": 0.15}
)

if triggers:
    print(f"Retraining triggered by: {triggers}")
    launch_training_pipeline()
```

## Online vs. Offline Models

This distinction matters more than people realize.

**Offline models** (also called batch models) run predictions on a schedule. You collect a batch of data, run inference, store the results, and serve them from a database. Think recommendation systems that update nightly or risk scores that refresh every morning.

**Online models** make predictions in real time, on demand. A user does something, you call the model, you get a prediction back in milliseconds. Think fraud detection at checkout, content moderation, or autocomplete.

The tradeoff is freshness vs. simplicity. Offline models are easier to build, debug, and monitor. You can inspect every prediction after the fact. But the predictions are stale by the time they're served. Online models give you up-to-the-second predictions but add latency requirements, scaling concerns, and a whole category of failure modes (what happens when the model service is down?).

A common pattern is to combine both. Use an offline model to pre-compute features and baseline scores, then use an online model that takes those pre-computed features plus real-time signals to make the final decision. This way the online model is fast (fewer features to compute in real time) and the system degrades gracefully (if the online model fails, you fall back to the offline scores).

## What to Monitor

Here's what I actually track for production models:

1. **Input distributions** (PSI or KS test per feature, weekly)
2. **Prediction distribution** (are we predicting the same class balance as usual?)
3. **Latency** (p50 and p99, because a slow model is a broken model)
4. **Error rate** (model service errors, not prediction errors)
5. **Accuracy on labeled samples** (delayed, but the most important signal)
6. **Feature freshness** (are upstream data pipelines actually delivering?)

The last one catches more incidents than you'd expect. Half the time the model isn't broken. The data feeding it is.

## The Unglamorous Truth

The difference between a model that works in a notebook and a model that works in production is mostly plumbing. Data pipelines that run reliably. Monitoring that catches problems before users do. Retraining loops that don't require a human to click buttons at 2 AM. None of this is exciting work. All of it matters.

The teams that do ML well in production aren't the ones with the fanciest models. They're the ones with the best infrastructure around their models. If you're building an ML system and spending more than 30% of your time on the model itself, you're probably underinvesting in everything else. If you want to see how these monitoring concepts connect to orchestrating actual pipelines, I wrote about that in my [Airflow and DAGs post](/blog/post.html?post=airflow-dag-basics).
