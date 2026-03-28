Rotate a photo of a "7" by 90 degrees and show it to a person. They'll still say it's a seven. Show it to a standard CNN and there's a decent chance it'll say something completely different. This feels like a bug, but it's actually a design limitation. CNNs were built to recognize patterns at specific orientations, and rotating the input produces entirely different activations.

This matters beyond handwritten digits. Satellite images can be taken from any angle. Molecules don't have a "right side up." Medical scans get rotated depending on how the patient was positioned. Any time your data doesn't have a fixed orientation, a standard model is learning something fragile.

There's a family of architectures that solve this problem by building symmetry directly into the network's structure, not through data augmentation or clever training tricks, but through the math of the weights themselves. After reading Cohen & Welling's work on group equivariant CNNs and implementing these ideas across two assignments in my [deep learning course at Purdue](/experience/), I think this is one of the most elegant ideas in modern deep learning.

## The Problem: Convolution Doesn't Commute With Rotation

The standard convolution of a kernel $K$ with an image $X$ is:

$$(K * X)[i,j] = \sum_{m,n} K[m,n] \cdot X[i-m, j-n]$$

For this to play nicely with rotation, you'd need $K * R_{90}(X) = R_{90}(K * X)$. Work through the index math and you'll find this only holds when $K = R_{90}(K)$, meaning the kernel itself must be rotationally symmetric. But learned kernels pick up oriented features: edges in specific directions, corners at specific angles. They're almost never symmetric.

So rotating the input produces a completely different feature map, not a rotated version of the original. Stack a few conv layers with max-pooling and the problem compounds at every layer.

Data augmentation (training on rotated copies) helps but doesn't guarantee anything. The model sees more orientations, but nothing in the architecture prevents it from learning orientation-specific features. You're hoping the model learns rotation invariance from examples rather than enforcing it structurally.

## Invariance vs. Equivariance: Two Different Goals

These terms get used interchangeably but they mean different things, and the distinction matters for architecture design.

**Invariance** means the output doesn't change when you transform the input: $f(g \cdot x) = f(x)$. A "7" rotated 90 degrees should still be classified as a "7." This is what you want at the output layer of a classifier.

**Equivariance** means the output transforms the same way the input does: $f(g \cdot x) = g \cdot f(x)$. If you rotate the input image, the feature map should rotate in exactly the same way. This is what you want in the intermediate layers.

Here's why the distinction matters. If you make the intermediate layers invariant (output doesn't change under rotation), you throw away spatial information that downstream layers need. The network can't tell where features are relative to each other. But if you make them equivariant (output rotates with the input), you preserve all the spatial information while guaranteeing that the representation behaves predictably under rotation.

The typical design: equivariant layers in the middle (features track transformations), invariant pooling at the end (final prediction is stable).

## The Reynolds Operator: An Elegant Projection

The mathematical tool that makes this work is the Reynolds operator. For a finite group of transformations $G$ (say, the four 90-degree rotations $C_4 = \{0°, 90°, 180°, 270°\}$), it's defined as:

$$\bar{T} = \frac{1}{|G|} \sum_{g \in G} \rho_{\text{out}}(g) \otimes \rho_{\text{in}}(g^{-1})^T$$

where $\rho_{\text{in}}$ and $\rho_{\text{out}}$ are the matrix representations of how the group acts on inputs and outputs.

What this does is elegant: it projects any linear map into the subspace of maps that respect the symmetry. Compute the eigendecomposition of $\bar{T}$, keep the eigenvectors with eigenvalue 1, and you have a complete basis for all equivariant linear maps. Any weight matrix built from linear combinations of these eigenvectors will automatically satisfy the equivariance constraint.

Instead of learning $n \times m$ free parameters, you learn $k$ coefficients (one per basis vector), where $k$ is usually much smaller. The symmetry constraint dramatically reduces the parameter count.

There's a clean theoretical result here too: if the Reynolds operator has rank 0, the only invariant neuron is a constant. The invariant subspace is trivial. The network literally can't learn anything orientation-dependent if you demand full invariance at the neuron level. This is why equivariance (not invariance) is the right constraint for intermediate layers.

## Building Equivariant Layers in Practice

For the convolutional version, you need to think about patch-to-patch maps. A standard CNN maps each input patch to a scalar. An equivariant CNN maps each input patch to an output patch, so rotation can act on both sides.

The implementation uses `unfold` to extract patches, applies the equivariant linear map, then `fold`s the results back:

```python
def get_equivariant_basis(in_channels, k_in, k_out):
    """Compute equivariant basis via Reynolds operator eigendecomposition."""
    reynolds = torch.zeros(k_out**2 * in_channels * k_in**2,
                           k_out**2 * in_channels * k_in**2)

    for degree in [0, 90, 180, 270]:
        rho_in = rotation_matrix(in_channels * k_in, degree)
        rho_out = rotation_matrix(k_out, degree)
        inv_degree = (360 - degree) % 360
        rho_in_inv = rotation_matrix(in_channels * k_in, inv_degree)
        reynolds += torch.kron(rho_out, rho_in_inv.T)

    reynolds /= 4  # average over group

    # Eigenvectors with eigenvalue ≈ 1 form the equivariant basis
    eigenvalues, eigenvectors = torch.linalg.eig(reynolds)
    mask = (eigenvalues.real - 1.0).abs() < 1e-6
    basis = eigenvectors[:, mask].real
    return basis
```

The sanity check: before any training, feed in an image and its 90-degree rotation. The outputs should be related by exactly a 90-degree rotation: `||f(rot90(x)) - rot90(f(x))|| < 1e-5`. If that holds, your equivariance is exact.

## Attention Pooling: Learning What to Focus On

Once you have equivariant features, you need to create invariant outputs for the final prediction. The simplest way is to average over all group transformations (that's literally what the Reynolds operator does). But averaging treats all orientations equally, which throws away information.

A smarter approach: learned attention pooling over the group orbit. Given equivariant features $\mathbf{h}$, compute all transformed versions $\{\rho(g_i)\mathbf{h}\}$ and take a learned weighted average:

$$\mathbf{g} = \sum_{i} \alpha_i \cdot \rho(g_i)\mathbf{h}, \quad \alpha_i = \text{softmax}(\mathbf{q}^T \rho(g_i)\mathbf{h})$$

This is provably $G$-invariant (the proof uses the rearrangement property of groups), but unlike flat averaging, the model can learn which orientations are more informative per input. For the digit "7," the model concentrated weight on 180° and 270° rotations. For "0" (nearly rotationally symmetric), weights were distributed evenly. The model learned that orientation matters more for asymmetric digits.

## The Experiment That Made It Click

Here's where the theory produces real numbers. Take MNIST digits, create four copies rotated by 0°, 90°, 180°, 270°. The task: predict which rotation was applied. The twist: the training set is deliberately imbalanced. 2,000 examples each for 0°, 90°, and 270°, but only 20 examples for 180°.

| Model | Parameters | Overall | 0° | 90° | 180° | 270° |
|---|---|---|---|---|---|---|
| Standard CNN | 454,148 | 90.2% | 99.4% | 99.4% | 62.6% | 99.4% |
| G-Equivariant CNN | 1,807 | 97.8% | 97.8% | 97.8% | 97.8% | 97.8% |

The standard CNN does exactly what you'd expect with 100x less data for one class: it collapses on 180° (62.6%). It has 250x more parameters and still loses badly overall.

The equivariant CNN hits 97.8% uniformly across all four orientations. What the network learns for 0° automatically transfers to 90°, 180°, and 270° because the equivariance constraint forces weight sharing across rotations. Those 20 training examples for 180° effectively become 2,000. All four orientations get identical accuracy, which is a direct consequence of exact equivariance.

I also tested this on autoencoders (trained on upright MNIST, tested on rotated):

| Model | In-Distribution Loss | Rotated (OOD) Loss |
|---|---|---|
| Standard AE | 0.000071 | 0.000175 |
| G-Equivariant AE | 0.000102 | 0.000102 |

The standard AE's loss jumps 2.5x on rotated inputs. The equivariant AE has identical performance on both. Equivariance is free insurance for out-of-distribution robustness.

## Where This Applies Beyond MNIST

The $C_4$ rotation group is the simplest case, but the framework extends to any symmetry group.

**Molecular property prediction.** Molecules don't have a canonical orientation. Models like SchNet and DimeNet use SE(3)-equivariance (3D rotations and translations) so predictions don't depend on how you happen to orient the molecule in 3D space.

**Particle physics.** The laws of physics are Lorentz-invariant. Networks like LorentzNet build this symmetry in so they don't waste capacity learning something that's guaranteed by physics.

**Satellite imagery.** There's no "up" in aerial photos. Rotation-equivariant models avoid the need for aggressive data augmentation across all angles.

**Medical imaging.** Cell microscopy images, histopathology slides, and certain radiology views have no preferred orientation. Equivariant architectures handle this naturally.

## The Honest Limitation

You need to know your symmetry group in advance. $C_4$ rotations are clean and finite. 3D rotations (SO(3)) are well-studied. But real-world transformations like lighting changes, perspective distortion, or non-rigid deformation don't form neat groups. There's active research on approximate equivariance and learning the symmetry group from data, but that's still early.

## What Stuck With Me

Three things from implementing all of this.

First, the parameter efficiency is striking. Not just as an academic metric, but practically. When you bake the right structure into the model, every parameter does useful work. The 1,807-parameter equivariant network isn't just "smaller." It's more sample-efficient, more robust to distribution shift, and easier to train.

Second, equivariance is strictly better than data augmentation for known symmetries. Augmentation adds transformed copies of your data and hopes the model picks up on it. Equivariance enforces the symmetry in the weight space itself, so it holds exactly for all inputs, including ones the model has never seen.

Third, this connects to a broader principle I keep seeing across ML: the best way to improve a model isn't more data or more parameters. It's encoding the right structure. Convolutions encode translation equivariance. Attention encodes permutation equivariance. Group-equivariant layers encode whatever symmetry your problem has. In each case, the structural constraint is what makes the model work, not the raw capacity.
