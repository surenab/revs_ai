# Transformer Models for Trading Bot

## Table of Contents

1. [Overview and Architecture](#overview-and-architecture)
2. [Step-by-Step How It Works](#step-by-step-how-it-works)
3. [System Integration](#system-integration)
4. [Usage Guide](#usage-guide)
5. [Training Guide](#training-guide)

---

## Overview and Architecture

### What are Transformer Models?

Transformer models are a type of neural network architecture originally designed for natural language processing. They have been successfully adapted for time-series forecasting and financial prediction because of their ability to:

- **Capture long-range dependencies**: Unlike traditional models that process data sequentially, transformers can attend to all previous time steps simultaneously
- **Learn complex patterns**: Multi-head attention mechanisms allow models to focus on different aspects of the data simultaneously
- **Handle variable-length sequences**: Transformers can process sequences of different lengths efficiently
- **Parallel processing**: Unlike RNNs/LSTMs, transformers can process sequences in parallel, making them faster

### Why Use Transformers for Trading?

Traditional trading models (moving averages, RSI, etc.) have limitations:
- They only look at recent data (limited memory)
- They can't capture complex multi-scale patterns
- They struggle with long-term dependencies

Transformer models address these by:
- **Long-range forecasting**: Can predict further into the future by understanding long-term patterns
- **Multi-scale patterns**: Can identify patterns at different time scales simultaneously
- **Context awareness**: Understands how current price relates to historical context
- **Adaptive learning**: Learns which historical periods are most relevant for prediction

### Architecture Overview

```
Input Price Data
    ↓
Preprocessing (Normalization, Feature Engineering)
    ↓
Sequence Preparation (Create time windows)
    ↓
Transformer Encoder
    ├── Input Embedding
    ├── Positional Encoding
    ├── Multi-Head Attention
    ├── Feed-Forward Networks
    └── Layer Normalization
    ↓
Encoded Representations
    ↓
Prediction Head
    ├── Future Price Prediction
    ├── Confidence Estimation
    └── Action Recommendation
    ↓
Output: Buy/Sell/Hold Signal with Confidence
```

### How Transformers Differ from Traditional ML Models

| Feature | Traditional Models | Transformer Models |
|---------|-------------------|-------------------|
| Memory | Limited (e.g., 14-50 periods) | Long-range (60-200+ periods) |
| Pattern Recognition | Simple (trends, momentum) | Complex (multi-scale, contextual) |
| Prediction Horizon | Short (1-5 days) | Long (5-24+ days) |
| Training | Rule-based or simple ML | Deep learning with attention |
| Interpretability | High (clear rules) | Medium (attention weights) |
| Computational Cost | Low | Medium-High |

---

## Step-by-Step How It Works

### Data Flow

The complete data flow from price data to trading signal:

```
1. Price Data Collection
   └──> OHLCV data (Open, High, Low, Close, Volume)

2. Data Preprocessing
   ├──> Normalization (scale to similar ranges)
   ├──> Feature extraction (price changes, volatility)
   └──> Sequence creation (sliding windows)

3. Transformer Encoding
   ├──> Input embedding (convert features to vectors)
   ├──> Positional encoding (add time information)
   ├──> Multi-head attention (learn relationships)
   └──> Feed-forward processing (non-linear transformations)

4. Prediction Generation
   ├──> Future price prediction
   ├──> Confidence calculation
   └──> Action recommendation (buy/sell/hold)

5. Signal Formatting
   ├──> Convert to standard format
   ├──> Add metadata (model info, parameters)
   └──> Return to bot engine
```

### Transformer Components Explained

#### 1. Input Embedding

**Purpose**: Convert raw price/indicator values into dense vector representations

**How it works**:
- Each time step's features (price, volume, indicators) are converted to a vector
- Example: `[close_price, volume, RSI]` → `[0.5, 0.3, 0.7]` (normalized) → `[128-dim vector]`

**In our implementation**:
```python
# BaseTransformerModel._preprocess_data()
# Extracts features and normalizes them
features = {
    "close": close_price,
    "price_change_pct": (current - previous) / previous,
    "volatility": calculated_volatility,
    ...
}
```

#### 2. Positional Encoding

**Purpose**: Add information about the position/time of each data point in the sequence

**Why needed**: Transformers don't inherently understand order, so we add positional information

**How it works**:
- Each position gets a unique encoding vector
- Added to input embeddings: `embedding + positional_encoding`
- Allows model to understand "this happened 10 days ago" vs "this happened yesterday"

**In our implementation**:
- Positional encoding is conceptually handled in the sequence structure
- Real implementation would use sinusoidal or learned positional encodings

#### 3. Multi-Head Attention

**Purpose**: Learn which past time steps are most relevant for prediction

**How it works**:
1. **Query (Q)**: "What am I looking for?" (current time step)
2. **Key (K)**: "What do I have?" (all past time steps)
3. **Value (V)**: "What information do I provide?" (actual data)

4. Attention score = `Q × K^T` (how relevant is each past step?)
5. Weighted sum = `softmax(scores) × V` (combine relevant information)

**Multi-head**: Multiple attention mechanisms run in parallel, each learning different relationships

**Example**:
- Head 1 might focus on short-term patterns (last 5 days)
- Head 2 might focus on medium-term trends (last 20 days)
- Head 3 might focus on long-term cycles (last 60 days)

**In our implementation**:
```python
# BaseTransformerModel._encode_sequence()
# Conceptually simulates attention by identifying important time steps
important_indices = [i for i in range(len(sequence)) if significant_change(i)]
```

#### 4. Feed-Forward Networks

**Purpose**: Apply non-linear transformations to learn complex patterns

**How it works**:
- After attention, data passes through feed-forward networks
- These networks learn non-linear relationships
- Example: "If price increased 5% AND volume increased 50%, then..."

**In our implementation**:
- Simplified to feature aggregation
- Real implementation would use multi-layer neural networks

#### 5. Output Projection

**Purpose**: Convert encoded representations into predictions

**How it works**:
- Takes final encoded representation
- Projects to prediction space (future prices, actions)
- Generates confidence scores

**In our implementation**:
```python
# BaseTransformerModel._predict_from_embeddings()
# Uses encoded features to predict action and confidence
if trend > threshold:
    action = "buy"
    confidence = calculate_confidence(trend, volatility)
```

### Prediction Process

1. **Sequence Encoding**:
   - Input: 60 days of price data
   - Output: Encoded representation capturing patterns

2. **Pattern Recognition**:
   - Model identifies: trends, cycles, volatility patterns
   - Attention weights show which periods are most important

3. **Future Prediction**:
   - Model predicts: future price movements
   - Generates: confidence intervals, probabilities

4. **Action Recommendation**:
   - Based on predictions: buy, sell, or hold
   - Includes: position sizing, risk assessment

### Signal Generation

How predictions convert to buy/sell/hold signals:

```
Predicted Price Change: +3.5%
Confidence: 0.75
    ↓
Action Decision:
- If predicted_change > threshold AND confidence > min_confidence:
    → Action: "buy"
- If predicted_change < -threshold AND confidence > min_confidence:
    → Action: "sell"
- Otherwise:
    → Action: "hold"
    ↓
Signal Format:
{
    "action": "buy",
    "confidence": 0.75,
    "predicted_gain": 0.035,
    "predicted_loss": 0.015,
    "gain_probability": 0.60,
    "loss_probability": 0.15,
    ...
}
```

---

## System Integration

### Integration with BaseMLModel Interface

All transformer models inherit from `BaseMLModel`, which provides:

```python
class BaseMLModel(ABC):
    @abstractmethod
    def predict(stock, price_data, indicators) -> dict:
        # Returns standard prediction format
        pass
```

**Transformer models implement this interface**:
- `PatchTSTModel.predict()` → Uses patch-based encoding
- `InformerModel.predict()` → Uses ProbSparse attention
- `AutoformerModel.predict()` → Uses decomposition
- `TransformerRLModel.predict()` → Uses RL agent

### Integration with bot_engine.py

The bot engine integrates transformer models in `_get_ml_predictions()`:

```python
# bot_engine.py
def _get_ml_predictions(self, stock, price_data, indicators_data):
    # ...
    for model_id in enabled_ml_models:
        db_model = MLModel.objects.get(id=model_id)

        # Load transformer model based on name/framework
        if "patchtst" in db_model.name.lower():
            model = PatchTSTModel(...)
        elif "informer" in db_model.name.lower():
            model = InformerModel(...)
        # ...

        prediction = model.predict(stock, price_data, indicators_data)
        ml_signals.append(prediction)
```

**Flow**:
1. Bot engine gets enabled ML models from config
2. For each model, loads appropriate transformer model
3. Calls `predict()` with price data and indicators
4. Collects predictions into `ml_signals` list
5. Passes to signal aggregator

### Model Loading and Registration

**Model Registration**:
- Models are stored in `MLModel` database table
- Each model has: `id`, `name`, `framework`, `metadata`
- `metadata` stores model-specific parameters (sequence_length, etc.)

**Model Loading**:
```python
# bot_engine.py loads models dynamically
if "patchtst" in db_model.name.lower():
    metadata = db_model.metadata or {}
    model = PatchTSTModel(
        sequence_length=metadata.get("sequence_length", 60),
        prediction_horizon=metadata.get("prediction_horizon", 5),
        use_dummy=True,  # Until trained model is available
    )
```

**Dummy Mode**:
- All models work in dummy mode by default
- Dummy mode uses simplified logic instead of trained models
- Allows testing and integration before training
- Can be replaced with actual trained models

### Signal Aggregation

Transformer predictions are aggregated with other signals:

```python
# SignalAggregator.aggregate_signals()
aggregated_result = aggregator.aggregate_signals(
    ml_signals=[transformer_predictions, ...],  # Transformer predictions here
    indicator_signals=[...],
    pattern_signals=[...],
    social_signals={...},
    news_signals={...},
)
```

**Aggregation Process**:
1. Each signal type gets a weight (configurable)
2. Transformer predictions contribute to final decision
3. Confidence scores are combined
4. Final action: buy/sell/hold based on aggregated signals

### Storage in BotSignalHistory and TradingBotExecution

**BotSignalHistory**:
- Stores all signals for transparency
- Includes: `ml_signals` with transformer predictions
- Format:
```json
{
    "ml_signals": {
        "predictions": [
            {
                "model_name": "PatchTST Model",
                "action": "buy",
                "confidence": 0.75,
                "metadata": {
                    "sequence_length": 60,
                    "prediction_horizon": 5,
                    ...
                }
            }
        ],
        "count": 1
    }
}
```

**TradingBotExecution**:
- Stores execution details when trade is made
- Includes: `indicators_data`, `patterns_detected`, `risk_score`
- Transformer predictions are included in analysis that led to execution

---

## Usage Guide

### Basic Usage

#### 1. Enable Transformer Model in Bot Configuration

**Via API**:
```python
# Create or update MLModel
ml_model = MLModel.objects.create(
    name="PatchTST Model",
    framework="custom",
    model_type="regression",
    is_active=True,
    metadata={
        "sequence_length": 60,
        "prediction_horizon": 5,
        "patch_length": 8,
        "n_patches": 8,
    }
)

# Add to bot config
bot_config.enabled_ml_models.append(str(ml_model.id))
bot_config.save()
```

**Via Frontend**:
1. Go to Bot Configuration
2. Navigate to ML Models section
3. Select transformer model (PatchTST, Informer, Autoformer, or Transformer+RL)
4. Configure parameters (sequence length, prediction horizon, etc.)
5. Save configuration

#### 2. Model Configuration Parameters

**Common Parameters** (all transformer models):
- `sequence_length`: Number of time steps to use as input (default: 60)
  - Longer = more context, but slower
  - Recommended: 60-96 for daily data
- `prediction_horizon`: Number of steps to predict ahead (default: 5)
  - Longer = further predictions, but less accurate
  - Recommended: 5-24 days
- `d_model`: Dimension of embeddings (default: 128)
  - Higher = more capacity, but slower
  - Recommended: 128-512
- `n_heads`: Number of attention heads (default: 8)
  - More heads = more patterns, but slower
  - Recommended: 8

**PatchTST-Specific**:
- `patch_length`: Length of each patch (default: 8)
- `n_patches`: Number of patches (default: 8)

**Informer-Specific**:
- `distil_layers`: Number of distilling layers (default: 2)

**Autoformer-Specific**:
- `moving_avg_window`: Window for trend extraction (default: 25)

**Transformer+RL-Specific**:
- `rl_algorithm`: "dqn" or "ppo" (default: "dqn")
- `reward_type`: "simple", "sharpe", "risk_adjusted", "drawdown" (default: "simple")

#### 3. Model Selection Guide

**Choose PatchTST when**:
- You want efficient long-range forecasting
- You have limited computational resources
- You need fast inference
- You're working with daily/hourly data

**Choose Informer when**:
- You need very long sequence modeling (100+ time steps)
- You want to predict longer horizons (20+ days)
- You have sufficient computational resources
- You're working with minute-level or tick data

**Choose Autoformer when**:
- Your data has seasonal/cyclical patterns
- You want to separate trend from noise
- You need interpretable predictions (trend vs seasonal)
- You're working with daily/weekly data

**Choose Transformer+RL when**:
- You want to learn optimal trading policies
- You have historical trading data
- You want to consider portfolio state and risk
- You're willing to invest in training

#### 4. Interpreting Results

**Prediction Dictionary**:
```python
{
    "action": "buy",  # "buy", "sell", or "hold"
    "confidence": 0.75,  # 0.0 to 1.0
    "predicted_gain": 0.035,  # 3.5% potential gain
    "predicted_loss": 0.015,  # 1.5% potential loss
    "gain_probability": 0.60,  # 60% chance of gain
    "loss_probability": 0.15,  # 15% chance of loss
    "timeframe_prediction": {
        "min_timeframe": "5d",
        "max_timeframe": "10d",
        "expected_timeframe": "5d",
        "timeframe_confidence": 0.60
    },
    "consequences": {
        "best_case": {"gain": 0.052, "probability": 0.48, "timeframe": "5d"},
        "base_case": {"gain": 0.035, "probability": 0.60, "timeframe": "5d"},
        "worst_case": {"loss": 0.015, "probability": 0.15, "timeframe": "10d"}
    },
    "metadata": {
        "model_name": "PatchTST Model",
        "sequence_length": 60,
        "prediction_horizon": 5,
        "use_dummy": true
    }
}
```

**Understanding Confidence**:
- **0.7-1.0**: High confidence, strong signal
- **0.5-0.7**: Moderate confidence, consider other signals
- **0.0-0.5**: Low confidence, weak signal

**Understanding Probabilities**:
- `gain_probability`: Likelihood that predicted gain will occur
- `loss_probability`: Likelihood that predicted loss will occur
- These are independent (both can be low if confidence is low)

**Understanding Timeframes**:
- `min_timeframe`: Earliest expected outcome
- `max_timeframe`: Latest expected outcome
- `expected_timeframe`: Most likely timeframe

#### 5. Best Practices

**When to Use Transformers**:
- ✅ You have sufficient historical data (100+ days)
- ✅ You want longer-term predictions (5+ days)
- ✅ You need to capture complex patterns
- ✅ You have computational resources

**When NOT to Use Transformers**:
- ❌ Very short-term trading (intraday, < 1 day)
- ❌ Limited historical data (< 50 days)
- ❌ Need immediate decisions (transformers are slower)
- ❌ Simple strategies work well (don't overcomplicate)

**Combining with Other Signals**:
- Use transformers as one input among many
- Don't rely solely on transformer predictions
- Combine with indicators, patterns, and risk management
- Use transformer confidence to weight its contribution

**Risk Management**:
- Always use stop-loss and take-profit
- Don't ignore risk scores even if transformer is confident
- Consider position sizing based on confidence
- Monitor transformer performance over time

---

## Training Guide

### Overview

**Why Training is Needed**:
- Dummy implementations use simplified logic
- Real transformer models need to learn from data
- Training adapts models to your specific market/data
- Trained models significantly outperform dummy models

**When to Train**:
- ✅ You have 1+ years of historical data
- ✅ You want better prediction accuracy
- ✅ You're ready to invest time in training
- ✅ You have computational resources (GPU recommended)

**When NOT to Train**:
- ❌ Just starting out (use dummy models first)
- ❌ Limited data (< 6 months)
- ❌ No computational resources
- ❌ Need immediate deployment

### Data Preparation

#### 1. Collecting Historical Price Data

**Requirements**:
- Minimum: 6 months of daily data
- Recommended: 2+ years of daily data
- For minute-level: 3+ months of minute data

**Data Format**:
```python
price_data = [
    {
        "open_price": 100.0,
        "high_price": 102.0,
        "low_price": 99.0,
        "close_price": 101.0,
        "volume": 1000000,
        "date": "2024-01-01"
    },
    # ... more data points
]
```

**Data Quality**:
- ✅ Clean data (no missing values, no outliers)
- ✅ Consistent time intervals
- ✅ Sufficient volume (avoid illiquid stocks)
- ✅ No data gaps

#### 2. Feature Engineering

**Price Features**:
- Raw prices (open, high, low, close)
- Price changes (absolute and percentage)
- Returns (daily, weekly)
- Volatility measures

**Indicator Features**:
- Technical indicators (RSI, MACD, Bollinger Bands, etc.)
- Moving averages (SMA, EMA, etc.)
- Momentum indicators
- Volume indicators

**Pattern Features**:
- Detected chart patterns
- Regime detection (trending, ranging, volatile)
- Pattern confidence scores

**Example Feature Extraction**:
```python
def extract_features(price_data, indicators):
    features = []
    for i, data in enumerate(price_data):
        feature_vector = {
            "close": data["close_price"],
            "price_change_pct": calculate_change(data, price_data[i-1]),
            "rsi": indicators["rsi_14"][i] if i < len(indicators["rsi_14"]) else None,
            "macd": indicators["macd"][i] if i < len(indicators["macd"]) else None,
            # ... more features
        }
        features.append(feature_vector)
    return features
```

#### 3. Data Normalization

**Why Normalize**:
- Different features have different scales (price: 100-200, RSI: 0-100)
- Transformers work better with normalized data
- Prevents some features from dominating

**Normalization Methods**:
- **Min-Max Scaling**: Scale to [0, 1] range
- **Z-Score Normalization**: Scale to mean=0, std=1
- **Robust Scaling**: Use median and IQR (handles outliers)

**Example**:
```python
from sklearn.preprocessing import MinMaxScaler

scaler = MinMaxScaler()
normalized_data = scaler.fit_transform(features)
```

#### 4. Creating Sequences

**Sequence Structure**:
- Input: `sequence_length` consecutive time steps
- Output: `prediction_horizon` future time steps

**Example** (sequence_length=60, prediction_horizon=5):
```python
# Input sequence: days 0-59
input_sequence = price_data[0:60]

# Target: days 60-64 (5 days ahead)
target_sequence = price_data[60:65]
```

**Sliding Windows**:
- Create multiple sequences by sliding window
- Example: sequences from [0:60], [1:61], [2:62], ...
- More sequences = more training data

**Train/Validation/Test Split**:
- **Train**: 70% of data (for training)
- **Validation**: 15% of data (for hyperparameter tuning)
- **Test**: 15% of data (for final evaluation)

### Training Setup

#### 1. Environment Setup

**Install Dependencies**:
```bash
# PyTorch (recommended for transformers)
pip install torch torchvision torchaudio

# Or TensorFlow
pip install tensorflow

# Additional libraries
pip install numpy pandas scikit-learn
pip install transformers  # Hugging Face transformers (optional, for pre-trained models)
```

**GPU Setup** (recommended):
- Install CUDA for GPU acceleration
- PyTorch: `pip install torch --index-url https://download.pytorch.org/whl/cu118`
- TensorFlow: `pip install tensorflow-gpu`

#### 2. Installing Dependencies

**Required**:
- Python 3.8+
- PyTorch 1.12+ or TensorFlow 2.8+
- NumPy, Pandas
- scikit-learn

**Optional**:
- Transformers (Hugging Face) for pre-trained models
- Stable-Baselines3 for RL (Transformer+RL model)
- Ray RLlib for advanced RL

#### 3. Configuring Training Parameters

**Common Parameters**:
```python
training_config = {
    "batch_size": 32,  # Number of sequences per batch
    "learning_rate": 0.0001,  # Learning rate
    "epochs": 100,  # Number of training epochs
    "validation_split": 0.15,  # Validation set size
    "early_stopping": True,  # Stop if validation loss doesn't improve
    "patience": 10,  # Epochs to wait before early stopping
}
```

**Model-Specific Parameters**:
- See model documentation for specific hyperparameters
- Start with defaults, then tune based on validation performance

### Training Process for Each Model

#### PatchTST Training

**Step 1: Prepare Data**
```python
# Load and preprocess data
price_data = load_price_data("AAPL", start_date="2020-01-01")
features = extract_features(price_data, indicators)
sequences = create_sequences(features, sequence_length=60, horizon=5)
```

**Step 2: Initialize Model**
```python
from stocks.ml_models.models.patchtst_model import PatchTSTModel

model = PatchTSTModel(
    sequence_length=60,
    prediction_horizon=5,
    patch_length=8,
    n_patches=8,
    use_dummy=False  # Use actual model
)
```

**Step 3: Training Loop**
```python
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

# Create data loader
train_loader = DataLoader(train_sequences, batch_size=32, shuffle=True)

# Define loss function
criterion = nn.MSELoss()  # For price prediction
optimizer = torch.optim.Adam(model.parameters(), lr=0.0001)

# Training loop
for epoch in range(100):
    for batch in train_loader:
        # Forward pass
        predictions = model(batch["input"])
        loss = criterion(predictions, batch["target"])

        # Backward pass
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

    # Validate
    val_loss = validate(model, val_loader)
    if val_loss < best_val_loss:
        save_model(model, "best_patchtst.pth")
```

**Step 4: Save Model**
```python
torch.save({
    "model_state_dict": model.state_dict(),
    "optimizer_state_dict": optimizer.state_dict(),
    "config": model_config,
}, "patchtst_model.pth")
```

#### Informer Training

**Similar to PatchTST, but with ProbSparse attention**:

```python
# Informer-specific: ProbSparse attention
# Reduces computational complexity for long sequences

model = InformerModel(
    sequence_length=96,  # Longer sequences
    prediction_horizon=24,  # Longer horizons
    distil_layers=2,
    use_dummy=False
)

# Training is similar, but handles longer sequences more efficiently
```

#### Autoformer Training

**Autoformer-specific: Decomposition**:

```python
# Autoformer decomposes into trend and seasonal
# Train on both components separately

model = AutoformerModel(
    sequence_length=96,
    prediction_horizon=24,
    moving_avg_window=25,
    use_dummy=False
)

# Training includes:
# 1. Trend component prediction
# 2. Seasonal component prediction (using auto-correlation)
# 3. Recombination for final prediction
```

#### Transformer+RL Training

**Step 1: Create Trading Environment**
```python
from stocks.ml_models.rl.trading_env import TradingEnvironment

env = TradingEnvironment(
    initial_cash=10000,
    price_data=price_data,
    indicators=indicators
)
```

**Step 2: Collect Experiences (Offline RL)**
```python
from stocks.ml_models.rl.replay_buffer import ReplayBuffer

buffer = ReplayBuffer(max_size=10000)

# Run episodes to collect experiences
for episode in range(1000):
    state = env.reset()
    done = False
    while not done:
        action = select_action(state)  # Random or simple policy
        next_state, reward, done, info = env.step(action)
        buffer.add(state, action, reward, next_state, done)
        state = next_state
```

**Step 3: Train RL Agent**
```python
# Using DQN (Deep Q-Network)
from stable_baselines3 import DQN

# Create RL agent
agent = DQN(
    "MlpPolicy",
    env,
    learning_rate=0.0001,
    buffer_size=10000,
    learning_starts=1000,
)

# Train on collected experiences
agent.learn(total_timesteps=100000)
```

**Step 4: Integrate with Transformer**
```python
# Use transformer to encode states
# Use RL agent to select actions based on encoded states

model = TransformerRLModel(
    sequence_length=60,
    prediction_horizon=5,
    rl_algorithm="dqn",
    use_dummy=False
)

# Training combines:
# 1. Transformer encoding of market states
# 2. RL agent learning optimal actions
# 3. Reward-based learning from trading outcomes
```

### Model Variations

#### Different Sequence Lengths

**Short Sequences (30-40)**:
- Faster training and inference
- Less context, but good for short-term predictions
- Use for: intraday trading, quick decisions

**Medium Sequences (60-80)**:
- Balanced context and speed
- Good for daily trading
- Recommended for most use cases

**Long Sequences (96-200)**:
- More context, better for long-term patterns
- Slower but more accurate for longer horizons
- Use for: swing trading, weekly predictions

**How to Choose**:
- Start with 60, then experiment
- Longer if you have more data and computational resources
- Shorter if you need faster inference

#### Different Prediction Horizons

**Short Horizon (1-3 days)**:
- More accurate
- Good for active trading
- Use with shorter sequences

**Medium Horizon (5-10 days)**:
- Balanced accuracy and usefulness
- Good for swing trading
- Recommended for most use cases

**Long Horizon (20-30 days)**:
- Less accurate but useful for planning
- Good for position trading
- Use with longer sequences

**How to Choose**:
- Match to your trading style
- Longer horizons need longer sequences
- Test different horizons and compare

#### Different Attention Mechanisms

**Standard Attention**:
- Full attention to all time steps
- Most accurate but slowest
- Use for: shorter sequences (< 60)

**ProbSparse Attention** (Informer):
- Only attends to top-k most important time steps
- Faster for long sequences
- Use for: longer sequences (> 96)

**Patch-based Attention** (PatchTST):
- Attention between patches, not individual time steps
- Efficient for any sequence length
- Use for: balanced performance

**Auto-correlation** (Autoformer):
- Finds periodic patterns automatically
- Good for seasonal data
- Use for: data with cycles

#### Different Architectures

**Encoder-Only** (PatchTST, Informer, Autoformer):
- Only encodes input sequence
- Predicts directly from encoding
- Simpler, faster

**Encoder-Decoder**:
- Encoder processes input
- Decoder generates output sequence
- More complex, better for sequence generation

**Decision Transformer** (Transformer+RL):
- Models trading as sequence-to-sequence
- Predicts actions from state sequences
- Good for policy learning

### Hyperparameter Tuning Strategies

**Grid Search**:
```python
from sklearn.model_selection import ParameterGrid

param_grid = {
    "sequence_length": [60, 96],
    "prediction_horizon": [5, 10],
    "learning_rate": [0.0001, 0.001],
    "batch_size": [16, 32],
}

for params in ParameterGrid(param_grid):
    model = train_model(params)
    score = evaluate(model, test_data)
    # Track best parameters
```

**Random Search**:
- More efficient than grid search
- Sample random combinations
- Good for many hyperparameters

**Bayesian Optimization**:
- Uses previous results to guide search
- More efficient than random search
- Use libraries like `optuna` or `hyperopt`

**Key Hyperparameters to Tune**:
1. `sequence_length`: 30, 60, 96, 128
2. `prediction_horizon`: 1, 5, 10, 20
3. `learning_rate`: 0.0001, 0.001, 0.01
4. `batch_size`: 16, 32, 64
5. `d_model`: 64, 128, 256, 512
6. `n_heads`: 4, 8, 16

### Evaluation and Validation

#### Backtesting Framework

**Simple Backtesting**:
```python
def backtest(model, test_data):
    portfolio_value = 10000
    position = 0

    for i in range(len(test_data) - sequence_length):
        # Get prediction
        sequence = test_data[i:i+sequence_length]
        prediction = model.predict(sequence)

        # Execute action
        if prediction["action"] == "buy" and position == 0:
            position = portfolio_value / test_data[i+sequence_length]["close"]
            portfolio_value = 0
        elif prediction["action"] == "sell" and position > 0:
            portfolio_value = position * test_data[i+sequence_length]["close"]
            position = 0

    # Calculate final return
    if position > 0:
        portfolio_value = position * test_data[-1]["close"]

    return (portfolio_value - 10000) / 10000
```

**Advanced Backtesting**:
- Include transaction costs
- Consider slippage
- Use walk-forward analysis
- Test on multiple time periods

#### Performance Metrics

**Returns**:
- Total return: `(final_value - initial_value) / initial_value`
- Annualized return: `(1 + total_return)^(365/days) - 1`

**Sharpe Ratio**:
- Risk-adjusted return: `(return - risk_free_rate) / volatility`
- Higher is better (typically > 1.0 is good)

**Maximum Drawdown**:
- Largest peak-to-trough decline
- Lower is better (shows risk)

**Win Rate**:
- Percentage of profitable trades
- Higher is better (but not everything)

**Example Evaluation**:
```python
results = {
    "total_return": 0.15,  # 15% return
    "sharpe_ratio": 1.2,  # Good risk-adjusted return
    "max_drawdown": -0.08,  # 8% max loss
    "win_rate": 0.55,  # 55% winning trades
}
```

#### Overfitting Detection

**Signs of Overfitting**:
- Training loss << validation loss
- Performance on test data much worse than validation
- Model memorizes training data

**Prevention**:
- Use validation set for early stopping
- Regularization (dropout, weight decay)
- Cross-validation
- Simpler models if overfitting occurs

**Cross-Validation**:
```python
from sklearn.model_selection import TimeSeriesSplit

tscv = TimeSeriesSplit(n_splits=5)
for train_idx, val_idx in tscv.split(data):
    train_data = data[train_idx]
    val_data = data[val_idx]
    # Train and evaluate
```

### Model Deployment

#### Saving Trained Models

**PyTorch**:
```python
torch.save({
    "model_state_dict": model.state_dict(),
    "optimizer_state_dict": optimizer.state_dict(),
    "config": {
        "sequence_length": 60,
        "prediction_horizon": 5,
        # ... other config
    },
    "scaler": scaler,  # Save normalization scaler
}, "model.pth")
```

**TensorFlow**:
```python
model.save("model.h5")
# Or
model.save_weights("model_weights.h5")
```

#### Loading Models in Production

**Update Model Loading**:
```python
# In bot_engine.py or model class
def load_model(self, model_path):
    checkpoint = torch.load(model_path)
    self.model.load_state_dict(checkpoint["model_state_dict"])
    self.config = checkpoint["config"]
    self.scaler = checkpoint["scaler"]
    self.use_dummy = False  # Now using real model
```

**Database Integration**:
```python
# Store model path in MLModel.metadata
ml_model.metadata = {
    "model_path": "/path/to/model.pth",
    "sequence_length": 60,
    # ... other config
}
ml_model.save()
```

#### Version Management

**Model Versioning**:
- Store multiple versions of models
- Track performance of each version
- A/B test different versions
- Roll back if new version performs worse

**Example**:
```python
models = {
    "v1.0": {"path": "model_v1.pth", "performance": 0.15},
    "v1.1": {"path": "model_v1.1.pth", "performance": 0.18},
    "v2.0": {"path": "model_v2.pth", "performance": 0.20},
}
```

#### A/B Testing

**Compare Models**:
```python
# Run both models on same data
results_v1 = test_model(model_v1, test_data)
results_v2 = test_model(model_v2, test_data)

# Compare performance
if results_v2["sharpe_ratio"] > results_v1["sharpe_ratio"]:
    deploy_model_v2()
else:
    keep_model_v1()
```

### Advanced Topics

#### Transfer Learning from Pre-trained Models

**Using Pre-trained Transformers**:
```python
from transformers import AutoModel

# Load pre-trained transformer
base_model = AutoModel.from_pretrained("bert-base-uncased")

# Fine-tune for time-series
# Replace input layer to accept time-series features
# Keep most of the transformer layers
# Train only final layers on your data
```

**Benefits**:
- Faster training (less data needed)
- Better performance (pre-trained knowledge)
- Good starting point

#### Fine-tuning with LoRA

**LoRA (Low-Rank Adaptation)**:
- Efficient fine-tuning method
- Only trains small adapter layers
- Keeps original model weights frozen

**Example**:
```python
from peft import LoraConfig, get_peft_model

# Configure LoRA
lora_config = LoraConfig(
    r=16,  # Rank
    lora_alpha=32,
    target_modules=["query", "value"],
    lora_dropout=0.1,
)

# Apply LoRA to model
model = get_peft_model(base_model, lora_config)

# Train only LoRA parameters (much faster)
```

#### Ensemble Methods

**Combine Multiple Models**:
```python
def ensemble_predict(models, data):
    predictions = [model.predict(data) for model in models]

    # Average predictions
    avg_confidence = sum(p["confidence"] for p in predictions) / len(predictions)
    avg_gain = sum(p["predicted_gain"] for p in predictions) / len(predictions)

    # Weighted average (by confidence)
    weighted_action = weighted_vote(predictions)

    return {
        "action": weighted_action,
        "confidence": avg_confidence,
        "predicted_gain": avg_gain,
    }
```

**Benefits**:
- More robust predictions
- Reduces overfitting
- Better generalization

#### Online Learning and Model Updates

**Continuous Learning**:
```python
# Periodically retrain on new data
def update_model(model, new_data):
    # Add new data to training set
    training_data.append(new_data)

    # Retrain on recent data (last 6 months)
    recent_data = training_data[-180:]
    model.fine_tune(recent_data)

    # Evaluate and deploy if better
    if evaluate(model) > current_performance:
        deploy_model(model)
```

**Incremental Updates**:
- Update model weights with new data
- Don't retrain from scratch
- Faster than full retraining

---

## Summary

Transformer models provide powerful capabilities for trading:
- **Long-range forecasting**: Predict further into the future
- **Complex pattern recognition**: Identify multi-scale patterns
- **Adaptive learning**: Learn from historical data
- **Policy learning**: RL models learn optimal trading strategies

Start with dummy implementations to understand the system, then train actual models when ready. The comprehensive documentation above provides all the details needed to understand, use, and train transformer models for your trading bot.
