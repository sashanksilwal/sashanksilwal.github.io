Financial institutions face a fundamental tension: **rule-based fraud detection systems** are interpretable and auditable but fail to catch complex fraud patterns, while **machine learning models** (especially deep learning) capture complex patterns but are black boxes that regulators and compliance teams cannot audit.

No automated pipeline exists to take a high-accuracy deep learning model, understand *why* it makes predictions via explainability methods, and **automatically generate human-readable rules** that can be deployed, audited, and explained to regulators. This post surveys the landscape of approaches and outlines a concrete path forward.

---

## The Scale of the Problem

- **$12.5 billion** in reported U.S. fraud losses in 2024 (25% increase YoY)  - FTC
- **$10 billion** in card-not-present fraud in the U.S. alone (2024)
- **$404 billion** projected global card fraud losses over the next decade  - Nilson Report
- Fraud detection market valued at **$33-53 billion** (2024), growing at **18-24% CAGR**

---

## Why Rule-Based Systems Fall Short

Rule-based systems are the most widely deployed approach in production today. Nearly every bank and payment processor uses a rule engine as their first line of defense. But they have fundamental problems:

| Problem | Details |
|---|---|
| Low Detection Rate | Rule-based systems catch only **37%** of first-party and **42%** of third-party fraud |
| Massive False Positives | Up to **95%** of AML alerts are false positives; only 1 in 5 blocked transactions is actually fraud |
| False Positives Cost More Than Fraud | False positive losses = **19%** of total fraud cost vs. actual fraud losses = **7%** (J.P. Morgan) |
| Static & Brittle | Once fraudsters learn the rules, they evade them. Rules can't adapt without manual intervention |
| Rule Sprawl | Banks accumulate 1,000+ rules over years. Rules conflict, overlap, and nobody fully understands the interactions |

### Types of Rules in Production

Rules range from simple to complex:

**Threshold rules** (stateless):
```
IF transaction_amount > 5000 THEN flag
IF country != home_country THEN flag
```

**Velocity rules** (time-window based)  - the primary way rule systems handle temporal patterns:
```
IF count(transactions) > 5 within 10 minutes THEN flag
IF count(distinct_countries) > 2 within 1 hour THEN flag
```

**Aggregation rules**:
```
IF sum(transaction_amount) > 10000 within 24 hours THEN flag
IF avg(transaction_amount) last 7 days > 3x historical_avg THEN flag
```

**Sequential / pattern rules**  - the most complex and hardest to write by hand:
```
IF small_transaction(<$1) THEN large_transaction(>$500)
   within 5 minutes on same card THEN flag  (card testing)
IF password_reset THEN wire_transfer within 30 min THEN flag
```

Even with all these rule types, manual rules have fundamental limitations with temporal data: fixed time windows that fraudsters can evade, inability to capture complex multi-step sequences, arbitrary thresholds based on analyst intuition rather than data, and rule explosion as the system grows.

---

## The Landscape of Approaches

### A. Pure Rule-Based (Status Quo)

Fraud analysts manually write conditional rules deployed in a rule engine (FICO Blaze Advisor, SAS, Unit21). Each transaction is evaluated against hundreds of rules in real time. Interpretable but low recall and high false positive rate.

### B. Pure ML/DL (Black Box)

Neural networks, gradient boosting (XGBoost, LightGBM), random forests. High accuracy and adapts to new fraud patterns. But not interpretable  - regulators require explainability and compliance teams can't audit.

### C. Hybrid (Rules + ML Side-by-Side)

ML model generates a risk score; separate rule engine flags based on thresholds. Most modern fintechs use this approach. But the two systems don't inform each other  - rules are still manually written and become stale.

### D. Our Idea: ML → Explainability → Auto-Generated Rules

Train a powerful model (LSTM on transaction sequences), then **automatically extract interpretable rules** from what the model has learned. Rules are data-driven (not gut-feel), update when the model retrains, and are traceable back to model explanations for regulatory compliance.

---

## Explainability Methods for Rule Generation

### Model-Agnostic Methods

**SHAP (SHapley Additive exPlanations)**  - Game-theoretic approach. Computes each feature's contribution to a prediction using Shapley values. Variants for deep learning include `DeepExplainer` (DeepLIFT-based) and `GradientExplainer`. Gives per-feature attribution scores but needs an additional step (thresholding, SHAP-Rule) to convert to rules. (Lundberg & Lee, NeurIPS 2017)

**LIME**  - Perturbs input around a single prediction, fits a local linear model. Gives local feature weights for individual predictions but less suitable as the primary rule-generation method. (Ribeiro et al., KDD 2016)

**Anchors**  - Finds sufficient IF-THEN conditions that "anchor" a prediction, using reinforcement learning + beam search for minimal conditions. **Natively produces rules** with a precision guarantee  - the rule holds with $\geq \tau$ probability in its coverage region. E.g., `IF amount > 3000 AND merchant_category = "electronics" THEN fraud`. (Ribeiro, Singh & Guestrin, AAAI 2018)

**SHAP-Rule**  - Automatically converts numeric SHAP values into fuzzy linguistic IF-THEN rules with quantified activation strength. E.g., `IF amount IS high AND frequency IS very_high THEN fraud (strength: 0.87)`. Runs at 1-2 ms per instance, and domain experts preferred these over raw SHAP vectors. (Mathematics, 2024)

**RuleFit**  - Two-step: grow an ensemble of decision trees, extract rules from all tree paths, fit a sparse linear model (Lasso) using original features + rule features. Produces weighted, sparse rule sets. Can be used as a surrogate  - fit RuleFit on the LSTM's predictions to distill knowledge into rules. (Friedman & Popescu, 2008)

### Deep Learning-Specific Methods

**Attention Mechanisms**  - Attention weights indicate which time steps (transactions) the model focused on. Tells us *when* things matter, complementing SHAP which tells us *which features* matter. Combined: "Transaction 3 was important *because* the amount was high and the location was unusual."

**Integrated Gradients**  - Computes attribution by integrating gradients along the path from a baseline to the actual input. Satisfies the completeness axiom (attributions sum to the output difference). Faster than KernelSHAP. (Sundararajan et al., ICML 2017)

### Knowledge Distillation Methods

Instead of explaining the model and converting explanations to rules, these methods **directly distill** the model into a simpler, inherently interpretable model.

**LSTM → Soft Decision Tree**  - Train a "soft" decision tree to mimic the LSTM's predictions (Frosst & Hinton, 2017). At each internal node, a learned filter produces a probability of going left vs. right. The soft tree generalizes better than a hard tree trained directly on data because it learns from the LSTM's soft predictions. Each tree path becomes a rule.

**Automatic Rule Extraction from LSTMs**  - Tracks importance of specific inputs to LSTM output by decomposing the cell state (Murdoch & Szlam, 2017). Identifies consistently important input patterns and constructs a rule-based classifier from them. Originally applied to NLP, but the methodology transfers to sequential transaction data  - instead of "important phrases," we find "important transaction patterns."

**KDDT (Knowledge Distillation Decision Tree)**  - The simplest approach: use the LSTM's soft predictions as training labels for a standard scikit-learn decision tree. The tree learns to mimic the LSTM, and its splits become interpretable rules.

---

## The Core Technical Challenge: Temporal Rules

The LSTM processes sequences of transactions, but most explainability methods produce flat feature attributions. A deployable fraud rule needs to say `IF count(transactions) > 5 in 10 min AND amount > 3x average THEN flag`, not just "feature X at timestep T was important."

### Strategies to Bridge the Gap

**Strategy A: Engineered temporal features → SHAP → Rules.** Pre-compute temporal features before the explainability step:

```
velocity_1h        = count(transactions in last 1 hour)
sum_1h             = sum(amounts in last 1 hour)
amount_ratio       = current_amount / avg_amount_30d
distinct_countries = count(distinct countries in 24h)
time_since_last    = seconds since previous transaction
```

Now SHAP operates on these features, and rules are directly interpretable:
```
IF velocity_1h > 8 AND amount_ratio > 3.5 THEN fraud
```

This is probably the most practical approach. The LSTM still sees the raw sequence for maximum accuracy, but SHAP/rules operate on the engineered feature layer.

Other promising strategies include using **attention weights** to identify which timesteps matter and combining that with SHAP for feature-level explanations, **LSTM cell state decomposition** to directly identify which sub-sequences of transactions drive predictions, and **distilling the LSTM into a decision tree** over temporal features so that tree paths become rules with data-driven thresholds.

---

## References

1. Lundberg & Lee. "A Unified Approach to Interpreting Model Predictions" (SHAP). NeurIPS 2017.
2. Ribeiro et al. "Anchors: High-Precision Model-Agnostic Explanations." AAAI 2018.
3. Frosst & Hinton. "Distilling a Neural Network Into a Soft Decision Tree." 2017.
4. Murdoch & Szlam. "Automatic Rule Extraction from Long Short Term Memory Networks." 2017.
5. Zilke et al. "DeepRED  - Rule Extraction from Deep Neural Networks." 2016.
6. Friedman & Popescu. "Predictive Learning via Rule Ensembles" (RuleFit). 2008.
7. "SHAP-Rule: Fuzzy Linguistic Explanations from SHAP Values." Mathematics, 2024.
8. "RuleSHAP: SHAP vs Rule Extraction vs RuleSHAP." arXiv, 2025.
9. "Knowledge Distillation Decision Tree." arXiv, 2022.
10. "Enhanced credit card fraud detection based on attention mechanism and LSTM." Journal of Big Data, 2021.
11. "Rule Learning from Time-Dependent Data Applied to Fraud Detection." CEUR-WS, 2023.
12. "MINT: Detecting Fraudulent Behaviors from Time-Series Relational Data." VLDB, 2023.
13. Christoph Molnar. "Interpretable Machine Learning" (Book).
