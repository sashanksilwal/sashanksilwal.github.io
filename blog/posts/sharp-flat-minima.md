Here's a question that bothered me for a while: why does deep learning work at all? A neural network with millions of parameters can fit literally any function. It has more than enough capacity to memorize every training example, noise and all. So why does it generalize to new data instead of just memorizing?

Zhang et al. asked this exact question in 2017 and showed something that shook the field: neural networks can memorize completely random labels. Feed it images of cats and dogs, but scramble the labels so a cat might be labeled "7" and a dog labeled "3," and the network will eventually get 100% training accuracy. It will memorize the entire random mapping. But of course it can't generalize, because there's nothing to generalize. The "pattern" is pure noise.

So if the model can memorize anything, what makes it learn real patterns instead? The answer, based on a line of research I've been reading (Keskar et al., Dinh et al., Smith & Le), has to do with the geometry of the loss surface. Not just whether the model finds a low-loss point, but what the neighborhood around that point looks like.

## The Experiment: Real Labels vs. Random Labels

The setup was simple. A CNN with 2 convolutional layers and 3 fully connected layers, trained on MNIST with SGD.

**With real labels**: 98.7% training accuracy, 98.4% test accuracy. The model learned and generalized.

**With shuffled labels**: 27.7% training accuracy after 100 epochs. Test accuracy stayed at 9.75% (random chance for 10 classes).

The interesting part isn't that the model failed to memorize random labels (with enough epochs and a higher learning rate, it could). It's that SGD with standard hyperparameters didn't converge to a memorization solution. The optimization process itself resists fitting noise, at least with the inductive biases built into CNNs and the implicit regularization of SGD.

## The Loss Surface: Flat vs. Sharp

To understand why, I interpolated between the initial random parameters $\theta_0$ and the final trained parameters $\theta^*$. At each point along the line $\theta(\alpha) = (1-\alpha)\theta_0 + \alpha\theta^*$, I evaluated the training loss.

For the real-labels model: the loss dropped smoothly from 2.3 down to about 0.04 and stayed low even past $\alpha=1$. A broad, flat basin. You could perturb the parameters in any direction and the loss barely changes.

For the shuffled-labels model: the loss went from 2.3 to about 2.0 (barely a dip), then climbed right back up. A shallow, sharp minimum. The model found a marginally lower-loss point, but any small perturbation sends it back to high loss.

This matches a hypothesis that's been floating around the deep learning theory community for a while: flat minima tend to generalize better than sharp minima. The intuition is that a flat minimum means the function is stable under small parameter changes, which means it's likely stable under small input distribution changes too (like the difference between training and test data).

## Why Flat Minima Generalize: The Intuition

Think of it this way. The training loss and test loss are defined on different data, so they're slightly different functions of the parameters. A sharp minimum in the training loss might correspond to a high-loss region in the test loss, because even a small shift between the two loss surfaces moves you out of the narrow valley. A flat minimum is more forgiving. The training and test loss surfaces roughly agree in a broad region, so being approximately right in parameter space is good enough.

More formally, if the loss surface is flat (small Hessian eigenvalues), then the PAC-Bayes bound on generalization error is tighter. Flat regions correspond to large volumes in parameter space that all achieve similar loss, which means there are many "good" parameter settings nearby, which means you're less likely to have overfit to the specific training examples.

## The Scaling Symmetry Wrinkle

Here's where it gets more subtle. For a simple one-hidden-layer ReLU network $f(x; W_1, W_2) = \text{ReLU}(W_2^T \text{ReLU}(W_1^T x))$, there's a scaling symmetry: you can multiply $W_1$ by any $\alpha > 0$ and divide $W_2$ by $\alpha$, and the function doesn't change at all.

$$f(x; \alpha W_1, W_2/\alpha) = f(x; W_1, W_2) \quad \text{for all } \alpha > 0$$

This follows directly from the positive homogeneity of ReLU: $\text{ReLU}(\alpha z) = \alpha \cdot \text{ReLU}(z)$ for $\alpha > 0$.

The consequence: if $(W_1^*, W_2^*)$ is a critical point (gradient is zero), then $(\alpha W_1^*, W_2^*/\alpha)$ is also a critical point for every positive $\alpha$. Same function, same loss, different parameterization. But the sharpness of the loss surface at these different parameterizations is wildly different.

The Hessian with respect to $W_1$ scales as $1/\alpha^2$, and with respect to $W_2$ as $\alpha^2$. Push $\alpha$ away from 1 in either direction and the sharpness (Frobenius norm of the Hessian) increases. The same function, implementing the same input-output mapping, can appear to sit in an arbitrarily sharp or arbitrarily flat region depending on how you parameterize it.

This is a real problem for "flat minima = good generalization" as a theory. Dinh et al. (2017) pointed this out explicitly: you can take any minimum and make it arbitrarily sharp by reparameterization without changing the function. So sharpness can't be the whole story.

## What I Think Is Actually Going On

After reading the papers and running these experiments, here's where I landed.

Flatness alone doesn't explain generalization. But flatness as found by SGD might. The key is that SGD doesn't find just any flat minimum. It finds flat minima that are reachable from a random initialization via gradient steps with a particular learning rate and batch size. That path through parameter space matters.

Several things support this view:

**Larger batch sizes find sharper minima.** Keskar et al. (2017) showed that training with large batches tends to converge to sharp minima, and these models generalize worse. Smaller batches introduce noise that helps SGD escape narrow valleys and settle in flatter regions. The noise isn't a bug. It's a feature.

**Learning rate matters.** Higher learning rates are noisier and tend to find flatter regions. There's a whole line of work (Smith & Le, 2018) connecting learning rate schedules to the implicit regularization of SGD.

**The label shuffling experiment is the clearest evidence.** When the labels are real, there exist flat minima that capture the actual structure in the data, and SGD finds them. When the labels are random, there's no structure to capture. Any minimum that fits the data must be sharp because it's memorizing rather than generalizing. SGD with standard hyperparameters struggles to even reach these sharp solutions.

## A Practical Example: Why This Matters

Say you're training two models for fraud detection. Model A converges quickly to 99% training accuracy with a large batch size. Model B takes longer, uses a smaller batch size, and also reaches 99% training accuracy.

Based on the flatness hypothesis, Model B is more likely to generalize to new fraud patterns because SGD with smaller batches probably found a flatter minimum. Model A might be sitting in a sharp valley, perfectly fitting the training data but fragile to any distribution change.

This connects directly to what I wrote about [model degradation in production](/blog/post.html?post=ml-systems-production). A model in a sharp minimum is more vulnerable to covariate shift, because even small changes in the input distribution can push the effective parameters out of the narrow good region.

## What to Do With This

A few practical implications:

**Don't use the largest batch size you can fit in memory.** There's a sweet spot. Larger batches are faster per epoch but may converge to worse solutions. A common heuristic is to scale the learning rate linearly with batch size (Goyal et al., 2017) to maintain the noise characteristics of smaller batches.

**Learning rate warmup helps.** Starting with a high learning rate and decaying it lets the model explore broadly first (finding a general region of parameter space) and then refine (settling into a specific minimum within that region).

**Stochastic Weight Averaging (SWA)** averages the weights over the final epochs of training, which tends to find flatter minima. It's cheap to implement and consistently helps generalization.

**If your model generalizes poorly despite low training loss, think about the loss surface.** Are you using a very large batch size? A very high or very low learning rate? Is early stopping happening too early or too late? The optimization choices affect where you end up, and where you end up affects generalization.

The loss surface is not just a theoretical curiosity. It's the terrain your optimizer walks through, and the landscape it settles in determines whether your model works on real data or just on the data it memorized.
