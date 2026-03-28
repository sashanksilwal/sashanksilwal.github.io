Say you build a car classifier. You train it on thousands of images of cars driving on roads, sunny highways, city streets, typical stuff from a self-driving dataset. It works great. 95% accuracy. Then a used car marketplace wants to use your model to classify cars in their listings. Except those photos are taken in garages, showrooms, driveways, and parking lots. Your model tanks. Not because it forgot what a car looks like, but because it learned "car on a road" as a single concept. Strip away the road and the model doesn't know what it's looking at.

This is domain shift. Your model trains on data from one distribution (the "source") and gets deployed in an environment where the data looks different (the "target"). A car is still a car whether it's on a highway or in a garage. The labels haven't changed. But the pixel statistics have, and that's enough to break most models.

The question is: how do you teach a model to learn features that transfer across these different settings? After reading Gretton et al.'s work on Maximum Mean Discrepancy and implementing it for my [deep learning course at Purdue](/experience/), I have a concrete answer.

## Why This Happens Everywhere

This isn't just an academic problem. It shows up constantly in real applications.

**Medical imaging.** A model trained on X-rays from Hospital A performs poorly at Hospital B because the equipment produces slightly different contrast and resolution. Pneumonia looks the same to a doctor. It looks different to the model.

**Autonomous driving.** A model trained on sunny California roads gets deployed in overcast Seattle. Same road signs, same lane markings, different lighting.

**E-commerce.** A product classifier trained on studio photos fails on user-uploaded images taken with phone cameras in messy bedrooms.

**Financial fraud.** Transaction patterns shift as user behavior evolves. I wrote about this in my [ML systems in production post](/blog/post.html?post=ml-systems-production). The underlying fraud patterns might be stable, but the input features look different quarter to quarter.

In all these cases, what changes is P(X), the distribution of inputs. What stays the same is P(Y|X), the relationship between inputs and correct outputs. A car is a car. Fraud is fraud. The model just can't see it because the surface-level statistics changed. This specific type of shift is called covariate shift.

## The Core Problem: Models Learn Shortcuts

A standard CNN doesn't know it should learn "the shape of a car" and ignore "whether there's a road in the background." During training, the model learns whatever features minimize the loss. If every car in the training set happens to be on a road, the model will happily learn "road-like background texture" as a predictive feature. That feature is useless (or actively misleading) when cars appear in garages.

The fix isn't to make the model better at recognizing cars on roads. The fix is to force the model to learn features that look the same regardless of the background. If the feature representation of road-cars and garage-cars are statistically indistinguishable, then a classifier trained on road-car features will work on garage-car features too.

That's where MMD comes in.

## Maximum Mean Discrepancy: Measuring Distribution Distance

MMD is a way to measure how different two distributions are by comparing their statistics in a high-dimensional space. The intuition: if two distributions are the same, then the average value of any function applied to samples from each distribution should also be the same. MMD finds the function that shows the biggest difference.

In practice, you use a kernel (usually Gaussian) to implicitly map samples into a high-dimensional space, then compare the means:

$$\text{MMD}^2(X, Y) = \frac{1}{n(n-1)} \sum_{i \neq j} k(x_i, x_j) + \frac{1}{m(m-1)} \sum_{i \neq j} k(y_i, y_j) - \frac{2}{nm} \sum_{i,j} k(x_i, y_j)$$

where $k$ is the Gaussian kernel: $k(x, x') = \exp(-\|x - x'\|^2 / 2\sigma^2)$.

If MMD is zero, the two distributions are identical (in the sense that no function in the kernel's reproducing kernel Hilbert space can tell them apart). If it's large, the distributions are different.

The implementation is clean:

```python
def gaussian_kernel(x, y, sigma=1.0):
    """Compute Gaussian kernel matrix between all pairs."""
    dist = torch.cdist(x, y, p=2) ** 2
    return torch.exp(-dist / (2 * sigma ** 2))

def mmd_loss(source_features, target_features, sigma=20.0):
    """Unbiased estimate of MMD^2 between source and target features."""
    n = source_features.size(0)
    m = target_features.size(0)

    K_ss = gaussian_kernel(source_features, source_features, sigma)
    K_tt = gaussian_kernel(target_features, target_features, sigma)
    K_st = gaussian_kernel(source_features, target_features, sigma)

    # Zero out diagonals for unbiased estimate
    K_ss.fill_diagonal_(0)
    K_tt.fill_diagonal_(0)

    mmd = K_ss.sum() / (n * (n - 1)) + K_tt.sum() / (m * (m - 1)) - 2 * K_st.sum() / (n * m)
    return mmd
```

## The Training Trick: Domain-Invariant Representations

Here's the key idea. You have a feature extractor (the convolutional layers) and a classifier (the fully connected layers). During training, you minimize two losses:

1. **Classification loss** on labeled source data (standard cross-entropy)
2. **MMD loss** between source and target features (from the feature extractor)

```python
# During each training step
source_features = feature_extractor(source_images)
target_features = feature_extractor(target_images)

classification_loss = cross_entropy(classifier(source_features), source_labels)
domain_loss = mmd_loss(source_features, target_features, sigma=20.0)

total_loss = classification_loss + lambda_mmd * domain_loss
total_loss.backward()
```

The `lambda_mmd` controls the tradeoff. Too low and the model ignores domain alignment. Too high and the model learns features so generic that they can't discriminate between classes. I used `lambda_mmd = 10` with kernel bandwidth `sigma = 20`.

The target images don't need labels. This is the beauty of the approach. You only need labeled data from the source domain and unlabeled data from the target domain. The MMD term just needs features from both, no labels required.

## What I Found: Testing on Color-Shifted Images

To see this in action, I implemented MMD-based domain adaptation on CIFAR-10. The source domain was standard CIFAR-10 (50,000 training images, 10 classes). The target domain was the same images with a hue shift of ±0.25 in HSV color space, simulating exactly the kind of color variation you'd see between different cameras or lighting conditions.

| Setup | Source Accuracy | Target Accuracy | Gap |
|---|---|---|---|
| Baseline (no MMD) | 64.8% | 50.2% | 14.6% |
| With MMD (λ=10, σ=20) | 64.9% | 56.9% | 8.0% |

The MMD regularization recovered almost half the lost accuracy on the target domain (+6.7 percentage points) without hurting source performance at all. The source accuracy actually went up by 0.1%, which makes sense: forcing the model to learn features that generalize across domains also acts as a regularizer.

Looking at the training curves, the most interesting thing was how early the source and target accuracies diverge without MMD. By epoch 50, there's already a clear gap. With MMD, the two curves stay much closer throughout training.

## When This Matters in Practice

Domain adaptation isn't just an academic exercise. A few real scenarios where this exact problem shows up:

**Medical imaging.** A model trained on X-rays from Hospital A performs poorly at Hospital B because the imaging equipment produces slightly different contrast and resolution. The labels are the same (pneumonia is pneumonia), but the pixel distributions differ.

**Autonomous driving.** A model trained on sunny California driving data gets deployed in overcast Seattle. Same road signs, same lane markings, different lighting distribution.

**Financial fraud.** This connects to what I wrote about [models degrading in production](/blog/post.html?post=ml-systems-production). Transaction patterns shift as user behavior evolves, new products launch, or markets change. The underlying fraud patterns might be stable, but the input features look different.

In all these cases, you have labeled data from the source environment and (often) unlabeled data from the target environment. MMD-based adaptation fits naturally.

## Beyond MMD

MMD is one of the simpler approaches. The broader field of domain adaptation includes:

**DANN (Domain Adversarial Neural Networks)**: instead of MMD, use a discriminator network that tries to tell source features from target features. The feature extractor learns to fool the discriminator, which forces domain-invariant features. Think of it as a GAN applied to feature distributions.

**CORAL (Correlation Alignment)**: align the second-order statistics (covariances) of source and target features. Simpler than MMD and sometimes works just as well.

**Self-training / pseudo-labels**: use the model's predictions on target data as pseudo-labels, then retrain. This can work surprisingly well when the initial model is decent, but it can also amplify errors if the model is confidently wrong.

## What I Took Away

The experiment that stuck with me is how a tiny visual change (a color shift that's barely noticeable to a human) can drop a model's accuracy by 15 points. It makes you realize how fragile learned representations can be. The model didn't learn "what a truck looks like." It learned "what a truck looks like in this specific color distribution." Those are different things, and the difference only becomes apparent when the distribution shifts.

MMD forces the model to learn the first thing instead of the second. It's not perfect (the gap wasn't fully closed), but the principle is powerful: if you know what might change between training and deployment, you can explicitly regularize against it. And if you think about it, this is what good feature engineering has always been about. Choosing features that capture the signal and ignore the noise. MMD just automates that intuition for learned representations.
