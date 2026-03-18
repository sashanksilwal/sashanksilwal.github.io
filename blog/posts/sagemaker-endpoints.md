Getting a model to work in a Jupyter notebook takes an afternoon. Getting that same model to serve 10,000 requests per second with 99.9% uptime takes weeks. This gap between "it works on my machine" and "it works in production" is where most ML projects stall, and it's where SageMaker earns its money.

I want to be upfront: SageMaker isn't always the right choice. It's expensive, opinionated, and ties you to AWS. But if you're already on AWS and need to go from trained model to production endpoint without building a serving stack from scratch, it removes a lot of the grunt work.

## What SageMaker Actually Gives You

SageMaker is a collection of services, not a single tool. The main pieces:

**Training**: managed compute for training jobs. You define the code, the data location, and the instance type. SageMaker spins up machines, runs training, saves the model artifact to S3, and shuts everything down.

**Hosting**: model endpoints for real-time inference. This is what most people mean when they say "SageMaker."

**Batch Transform**: offline inference on large datasets.

**Model Monitor**: drift detection and data quality checks (relevant if you've read my post on [ML systems in production](/blog/post.html?post=ml-systems-production)).

I'm going to focus on hosting and endpoints since that's where the deployment complexity lives.

## Deploying a Real-Time Endpoint

The basic flow: you have a trained model artifact (a `.tar.gz` file in S3 containing your model weights and any preprocessing code), and you want to create an HTTPS endpoint that accepts input, runs inference, and returns predictions.

```python
import sagemaker
from sagemaker.sklearn import SKLearnModel

role = "arn:aws:iam::123456789:role/SageMakerRole"
model_data = "s3://my-bucket/models/fraud-model/model.tar.gz"

# Define the model
model = SKLearnModel(
    model_data=model_data,
    role=role,
    framework_version="1.2-1",
    entry_point="inference.py",  # your custom inference code
)

# Deploy to an endpoint
predictor = model.deploy(
    initial_instance_count=1,
    instance_type="ml.m5.xlarge",
)

# Now you can call it
result = predictor.predict({"features": [1.2, 3.4, 5.6, 7.8]})
```

The `inference.py` file defines how your model loads and how it processes requests. At minimum, you need a `model_fn` (load the model) and `predict_fn` (run inference):

```python
import joblib
import numpy as np

def model_fn(model_dir):
    """Load model from the model directory."""
    return joblib.load(f"{model_dir}/model.pkl")

def input_fn(request_body, content_type):
    """Parse the incoming request."""
    import json
    data = json.loads(request_body)
    return np.array(data["features"]).reshape(1, -1)

def predict_fn(input_data, model):
    """Run inference."""
    return model.predict_proba(input_data).tolist()
```

This is the simplest version. For PyTorch or TensorFlow models, SageMaker has framework-specific containers that handle most of this automatically.

## Serverless Endpoints

Real-time endpoints run 24/7 on dedicated instances. That's great for steady traffic but wasteful for bursty workloads. If your model gets 100 requests at 9 AM and nothing until the next day, you're paying for an idle instance 23 hours a day.

Serverless endpoints fix this. They scale to zero when idle and spin up on demand.

```python
from sagemaker.serverless import ServerlessInferenceConfig

serverless_config = ServerlessInferenceConfig(
    memory_size_in_mb=4096,
    max_concurrency=10,
)

predictor = model.deploy(
    serverless_inference_config=serverless_config,
)
```

The catch: cold starts. When an endpoint scales from zero, the first request takes 10-30 seconds while the container loads and the model initializes. For a 500MB model, you might see 15-20 seconds of cold start latency. That's unacceptable for user-facing applications but fine for internal tools, async processing, or low-traffic services.

My rule of thumb: if you get fewer than 100 requests per hour and can tolerate occasional latency spikes, serverless saves you a lot of money. Otherwise, use a real-time endpoint.

## Batch Transform

Not every prediction needs to happen in real time. If you need to score a million records overnight (like generating recommendations or risk scores for all active users), batch transform is simpler and cheaper.

```python
transformer = model.transformer(
    instance_count=4,
    instance_type="ml.m5.4xlarge",
    output_path="s3://my-bucket/predictions/output/",
    strategy="MultiRecord",  # batch records together for efficiency
    max_payload=6,  # MB per batch
)

transformer.transform(
    data="s3://my-bucket/predictions/input/",
    content_type="text/csv",
    split_type="Line",
)
```

SageMaker spins up 4 instances, distributes the input data across them, runs inference in parallel, writes results to S3, and tears everything down. You pay only for the compute time.

## Auto-Scaling

For real-time endpoints, auto-scaling is how you handle traffic spikes without over-provisioning.

```python
import boto3

client = boto3.client("application-autoscaling")

# Register the endpoint as a scalable target
client.register_scalable_target(
    ServiceNamespace="sagemaker",
    ResourceId=f"endpoint/{endpoint_name}/variant/AllTraffic",
    ScalableDimension="sagemaker:variant:DesiredInstanceCount",
    MinCapacity=1,
    MaxCapacity=10,
)

# Scale based on invocations per instance
client.put_scaling_policy(
    PolicyName="invocation-scaling",
    ServiceNamespace="sagemaker",
    ResourceId=f"endpoint/{endpoint_name}/variant/AllTraffic",
    ScalableDimension="sagemaker:variant:DesiredInstanceCount",
    PolicyType="TargetTrackingScaling",
    TargetTrackingScalingPolicyConfiguration={
        "TargetValue": 100,  # target invocations per instance per minute
        "PredefinedMetricSpecification": {
            "PredefinedMetricType": "SageMakerVariantInvocationsPerInstance"
        },
        "ScaleInCooldown": 300,
        "ScaleOutCooldown": 60,
    },
)
```

The `TargetValue` of 100 means: if each instance is handling more than 100 invocations per minute, add more instances. If they're handling fewer, remove instances (after a 5-minute cooldown to avoid thrashing).

Set `ScaleOutCooldown` shorter than `ScaleInCooldown`. You want to scale up fast and scale down slowly. Scaling up too slow means dropped requests. Scaling down too fast means you'll bounce between instance counts.

## Load Balancing and A/B Testing

SageMaker distributes traffic across instances automatically. For A/B testing models, you can deploy multiple "production variants" behind the same endpoint:

```python
from sagemaker.model import Model

model_v1 = Model(model_data="s3://bucket/model-v1.tar.gz", ...)
model_v2 = Model(model_data="s3://bucket/model-v2.tar.gz", ...)

endpoint_config = sagemaker.session.production_variant(
    model_name="model-v1",
    instance_type="ml.m5.xlarge",
    initial_instance_count=1,
    initial_weight=90,  # 90% of traffic
    variant_name="ControlVariant",
)

endpoint_config_challenger = sagemaker.session.production_variant(
    model_name="model-v2",
    instance_type="ml.m5.xlarge",
    initial_instance_count=1,
    initial_weight=10,  # 10% of traffic
    variant_name="ChallengerVariant",
)
```

Start with 90/10 split. Monitor the challenger variant's metrics. If it's better, gradually shift traffic. This is how you safely roll out model updates without risking your entire user base.

## Cost Optimization

SageMaker is not cheap. Here are the things that actually save money:

**Right-size your instances.** Most models don't need GPU for inference. A `ml.m5.xlarge` (4 vCPUs, 16GB RAM) handles surprisingly high throughput for sklearn, XGBoost, and small PyTorch models. Only use GPU instances (`ml.g5.xlarge`) for models that genuinely need them (large neural networks, models with batch inference optimizations on GPU).

**Use spot instances for training.** Spot instances are 60-90% cheaper. Training jobs can be interrupted, but SageMaker handles checkpointing and resumption automatically. I use spot for almost all training.

**Multi-model endpoints** let you serve hundreds of models behind a single endpoint. SageMaker loads and unloads models from memory as requests arrive. Great if you have many low-traffic models (per-customer models, for example).

**Turn off dev endpoints.** This sounds obvious but it's the number one cost surprise. A single `ml.g5.xlarge` running 24/7 costs about $1,000/month. Put auto-shutdown on anything that isn't serving production traffic.

## When NOT to Use SageMaker

SageMaker solves real problems, but it's not always the right tool.

**For simple models with low traffic**: a FastAPI server on a single EC2 instance (or even a Lambda function with a container image) is simpler, cheaper, and easier to debug. You can deploy a sklearn model behind FastAPI in 20 minutes.

**For maximum flexibility**: SageMaker's inference containers have opinions about directory structure, serialization formats, and request handling. If your model has complex preprocessing or unusual serving requirements, you might fight the framework more than it helps.

**For non-AWS environments**: if you're on GCP, use Vertex AI. If you're multi-cloud, consider Seldon, BentoML, or Ray Serve. SageMaker locks you into AWS.

**For LLM serving**: vLLM, TGI (Text Generation Inference), or a managed service like Bedrock or Replicate are usually better choices than raw SageMaker endpoints for serving large language models. I wrote about running [large models on small hardware](/blog/post.html?post=fitting-big-models-small-gpus) separately, and most of those approaches work better outside SageMaker's container constraints.

## The Bottom Line

Model deployment is its own discipline. You can learn it piece by piece (Docker, load balancers, auto-scaling, monitoring) or you can use a managed service that bundles it all together. SageMaker is the most complete bundle on AWS. It's not the cheapest option, and it's not the most flexible. But it gets you from "model in S3" to "model serving production traffic" faster than building everything yourself.

The teams I've seen use SageMaker most successfully are the ones who use it for what it's good at (endpoint management, auto-scaling, A/B testing) and build their own solutions for everything else (feature engineering with [Spark](/blog/post.html?post=distributed-computing-basics), pipeline orchestration with [Airflow](/blog/post.html?post=airflow-dag-basics), monitoring with custom dashboards). Don't try to do everything inside SageMaker. Use it for the serving layer, and keep everything else flexible.
