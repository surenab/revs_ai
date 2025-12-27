/**
 * Constants for Trading Bot Configuration
 * Tooltips, icons, descriptions, and metadata for all bot configuration options
 */

import React from "react";
import {
  Bot,
  Wallet,
  DollarSign,
  TrendingUp,
  Shield,
  AlertTriangle,
  Maximize,
  Activity,
  TrendingDown,
  ArrowDown,
  ArrowUp,
  Brain,
  Zap,
  MessageSquare,
  Twitter,
  BarChart,
  Target,
  Newspaper,
  Rss,
  Gauge,
  LineChart,
  Layers,
  Mountain,
  RotateCcw,
  ArrowRight,
  GitMerge,
  Settings,
  Users,
  Code,
  FileText,
  Clock,
  Database,
  CheckCircle,
  X,
  Info,
  Plus,
  Trash2,
  Edit,
  Search,
  Hash,
  Minimize,
} from "lucide-react";

export interface TooltipDefinition {
  title: string;
  description: string;
  details?: string;
  howItWorks?: string;
  howBotUsesIt?: string;
  example?: string;
  impact?: string;
}

export interface IndicatorDefinition {
  id: string;
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  calculation?: string;
  interpretation?: string;
  buySignal?: string;
  sellSignal?: string;
  typicalValues?: string;
  defaultPeriod?: number;
}

export interface PatternDefinition {
  id: string;
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  patternType: "reversal" | "continuation";
  formation?: string;
  reliability?: string;
  priceMovement?: string;
  confidence?: string;
}

export const TOOLTIPS: Record<string, TooltipDefinition> = {
  riskPerTrade: {
    title: "Risk Per Trade",
    description: "Percentage of capital to risk per trade (0.01-100%)",
    details:
      "This determines how much of your total capital the bot will risk on each individual trade. A lower percentage means more conservative trading.",
    howItWorks:
      "Formula: Risk Amount = Available Budget × (Risk Per Trade / 100). The bot uses this to calculate position size: Position Size = Risk Amount / (Entry Price - Stop Loss Price). This ensures you never risk more than this percentage on a single trade.",
    howBotUsesIt:
      "Before every buy signal, the bot calculates: 'If I enter at $100 and stop loss is at $95 (5% loss), and I want to risk $20 (2% of $1000), I can buy 4 shares ($20 / $5 per share)'. Higher percentage = larger positions but more risk. Lower percentage = smaller positions but safer trades.",
    example:
      "Budget: $10,000, Risk Per Trade: 2% → Risk Amount: $200 per trade. If stop loss is 5% away: Position size = $200 / 0.05 = $4,000 position",
    impact:
      "Directly affects position sizing. Higher values allow larger positions but increase risk per trade.",
  },
  maxPositionSize: {
    title: "Max Position Size",
    description: "Maximum shares or dollar value per position",
    howItWorks:
      "Hard limit applied AFTER risk-per-trade calculation. Formula: Final Position = min(Calculated Position, Max Position Size). Prevents over-concentration in a single stock.",
    howBotUsesIt:
      "Even if risk calculation suggests buying 100 shares, if max is 50, bot only buys 50. Protects against calculation errors or extreme market conditions.",
    example: "Calculated: 200 shares, Max: 100 shares → Bot buys: 100 shares (limited by max)",
    impact: "Prevents over-concentration. Acts as safety net for position sizing.",
  },
  maxDailyTrades: {
    title: "Max Daily Trades",
    description: "Maximum number of trades per day (0 = unlimited)",
    howItWorks:
      "Counts all executed trades (buy + sell) in a 24-hour period. Resets at midnight. Formula: Can Trade = (Today's Trade Count < Max Daily Trades)",
    howBotUsesIt:
      "Before executing any trade, bot checks daily count. Prevents overtrading and excessive transaction costs. Helps maintain discipline during volatile markets.",
    example:
      "Max: 5 trades. Bot has executed 4 today → Next signal executes (5th). After that, all signals ignored until tomorrow.",
    impact: "Controls trading frequency. Lower values prevent overtrading but may miss opportunities.",
  },
  maxDailyLoss: {
    title: "Max Daily Loss",
    description: "Maximum loss threshold per day (dollar amount or percentage)",
    howItWorks:
      "Tracks cumulative loss from all trades in 24 hours. Formula: Daily Loss = Sum of (Entry Price - Exit Price) × Quantity for all losing trades. When limit reached, bot stops trading.",
    howBotUsesIt:
      "After each losing trade, bot calculates daily loss. When limit reached, bot immediately stops and ignores all signals. Protects against catastrophic days or system failures.",
    example:
      "Max: $500. Trade 1 lost $200 (remaining: $300). Trade 2 lost $250 (remaining: $50). Trade 3 would lose $100 → Bot blocks trade (would exceed limit).",
    impact:
      "Circuit breaker for bad days. Prevents catastrophic losses but may stop trading prematurely.",
  },
  stopLossPercent: {
    title: "Stop Loss %",
    description: "Automatically sell if price drops by this percentage",
    howItWorks:
      "Sets automatic sell price below entry. Formula: Stop Loss Price = Entry Price × (1 - Stop Loss % / 100). When current price drops to or below stop loss, bot immediately sells.",
    howBotUsesIt:
      "On buy, bot calculates stop loss price and monitors continuously. Used in position sizing: Larger stop loss % = smaller position size (more room for movement). Smaller stop loss % = larger position size (tighter stop).",
    example:
      "Entry: $100, Stop Loss: 5% → Stop Loss Price: $95. If price drops to $95 or below → Automatic sell. Maximum loss: $5 per share (5%).",
    impact:
      "Limits downside risk. Tighter stops = less risk per trade but more frequent stops. Wider stops = more room but larger potential loss.",
  },
  takeProfitPercent: {
    title: "Take Profit %",
    description: "Automatically sell if price increases by this percentage",
    howItWorks:
      "Sets automatic sell price above entry. Formula: Take Profit Price = Entry Price × (1 + Take Profit % / 100). When current price rises to or above take profit, bot immediately sells.",
    howBotUsesIt:
      "On buy, bot calculates take profit price and monitors continuously. Helps secure profits and prevents giving back gains. Risk/Reward ratio: Take Profit / Stop Loss should ideally be 2:1 or better.",
    example:
      "Entry: $100, Take Profit: 10% → Take Profit Price: $110. If price rises to $110 or above → Automatic sell. Profit: $10 per share (10%).",
    impact:
      "Secures profits. Higher targets = more profit potential but may not be reached. Lower targets = quicker profits but may leave money on table.",
  },
  mlModels: {
    title: "Machine Learning Models",
    description: "ML models predict buy/sell/hold actions and potential gain/loss",
    details:
      "These models analyze historical price data, indicators, and patterns to make predictions. Multiple models can be combined with weighted voting for better accuracy.",
    example: "A model might predict: 70% confidence BUY with +5% potential gain",
  },
  socialAnalysis: {
    title: "Social Media Analysis",
    description: "Analyzes social media sentiment to gauge public opinion about stocks",
    details:
      "Scans Twitter, Reddit, and other platforms for mentions of the stock. Positive sentiment may indicate bullish signals, while negative sentiment suggests bearish trends.",
    example:
      "High positive sentiment (0.8) with high volume (10K mentions) = Strong buy signal",
  },
  newsAnalysis: {
    title: "News Analysis",
    description: "Analyzes financial news articles for sentiment and relevance",
    details:
      "Scans news sources for articles about the stock. Major news events can significantly impact stock prices. Sentiment analysis determines if news is positive, negative, or neutral.",
    example: "Breaking news: 'Company announces record earnings' → Strong positive signal",
  },
  signalAggregation: {
    title: "Signal Aggregation",
    description:
      "How multiple signals are combined into a final trading decision. Risk management parameters are integrated to adjust signal confidence and position sizing.",
    details:
      "Weighted average with risk adjustment is recommended for most use cases. Risk score can override signals if too high.",
  },
  riskScoreThreshold: {
    title: "Risk Score Threshold",
    description: "Maximum risk score to allow trading (0-100)",
    details:
      "If calculated risk score exceeds this, bot will hold regardless of signals. Lower = more conservative.",
  },
  riskAdjustmentFactor: {
    title: "Risk Adjustment Factor",
    description: "How much risk reduces signal confidence (0-1)",
    details:
      "0 = risk doesn't affect signals, 1 = high risk completely negates signals. Recommended: 0.3-0.5",
  },
  riskBasedPositionScaling: {
    title: "Risk-Based Position Scaling",
    description:
      "Automatically reduces position size when risk score is high",
    details:
      "When enabled, the bot calculates a scale factor based on risk score to reduce position size proportionally. This helps protect capital during high-risk scenarios.",
    howItWorks:
      "Formula: scale_factor = 1 - (risk_score / 100) × risk_adjustment_factor. Final Position Size = Calculated Position Size × scale_factor. Higher risk = smaller position size.",
    howBotUsesIt:
      "If risk score is 60 and adjustment factor is 0.4: scale_factor = 1 - (60/100) × 0.4 = 1 - 0.24 = 0.76. A $1000 position becomes $760. If risk score is 90: scale_factor = 1 - 0.36 = 0.64, position becomes $640.",
    example:
      "Calculated position: 100 shares at $50 = $5,000. Risk score: 70, Adjustment: 0.4 → Scale: 0.72 → Final: 72 shares = $3,600",
    impact:
      "Reduces position size automatically when risk is high, protecting capital while still allowing trades. Disabled = always use full calculated position size regardless of risk.",
  },
};

export const INDICATORS: IndicatorDefinition[] = [
  // Moving Averages
  {
    id: "sma",
    name: "Simple Moving Average (SMA)",
    category: "moving_average",
    icon: TrendingUp,
    description: "The average price over a specified period, giving equal weight to all prices.",
    calculation: "SMA = Sum of closing prices / Period",
    interpretation: "Price above SMA suggests uptrend; below suggests downtrend. Crossovers indicate potential trend changes.",
    buySignal: "Price crosses above SMA",
    sellSignal: "Price crosses below SMA",
    typicalValues: "Common periods: 20, 50, 200",
    defaultPeriod: 20,
  },
  {
    id: "ema",
    name: "Exponential Moving Average (EMA)",
    category: "moving_average",
    icon: TrendingUp,
    description: "Similar to SMA but gives more weight to recent prices, making it more responsive to price changes.",
    calculation: "EMA = (Price - Previous EMA) × Multiplier + Previous EMA",
    interpretation: "More sensitive than SMA. When price crosses above EMA, it's bullish; below is bearish.",
    buySignal: "Price crosses above EMA",
    sellSignal: "Price crosses below EMA",
    typicalValues: "Common periods: 12, 26, 50",
    defaultPeriod: 20,
  },
  {
    id: "wma",
    name: "Weighted Moving Average (WMA)",
    category: "moving_average",
    icon: TrendingUp,
    description: "Assigns more weight to recent prices using a linear weighting scheme.",
    calculation: "WMA = Σ(Price × Weight) / Σ(Weight) where Weight = Period - Index",
    interpretation: "More responsive than SMA but less than EMA. Useful for identifying short-term momentum.",
    buySignal: "Price crosses above WMA",
    sellSignal: "Price crosses below WMA",
    typicalValues: "Common periods: 20, 50",
    defaultPeriod: 20,
  },
  {
    id: "dema",
    name: "Double Exponential Moving Average (DEMA)",
    category: "moving_average",
    icon: TrendingUp,
    description: "A faster-reacting moving average that reduces lag by applying EMA twice.",
    calculation: "DEMA = 2 × EMA - EMA(EMA)",
    interpretation: "Reduces lag compared to standard EMA. Useful for catching trend changes early.",
    buySignal: "Price crosses above DEMA",
    sellSignal: "Price crosses below DEMA",
    typicalValues: "Common periods: 20, 50",
    defaultPeriod: 20,
  },
  {
    id: "tema",
    name: "Triple Exponential Moving Average (TEMA)",
    category: "moving_average",
    icon: TrendingUp,
    description: "Further reduces lag by applying EMA three times, making it very responsive to price changes.",
    calculation: "TEMA = 3 × EMA - 3 × EMA(EMA) + EMA(EMA(EMA))",
    interpretation: "Most responsive moving average. Best for short-term trading and catching quick reversals.",
    buySignal: "Price crosses above TEMA",
    sellSignal: "Price crosses below TEMA",
    typicalValues: "Common periods: 20, 50",
    defaultPeriod: 20,
  },
  {
    id: "tma",
    name: "Triangular Moving Average (TMA)",
    category: "moving_average",
    icon: TrendingUp,
    description: "A double-smoothed moving average that applies SMA twice for a smoother line.",
    calculation: "TMA = SMA(SMA(Price, Period/2), Period/2)",
    interpretation: "Smoother than SMA, reducing false signals. Good for identifying long-term trends.",
    buySignal: "Price crosses above TMA",
    sellSignal: "Price crosses below TMA",
    typicalValues: "Common periods: 20, 50",
    defaultPeriod: 20,
  },
  {
    id: "hma",
    name: "Hull Moving Average (HMA)",
    category: "moving_average",
    icon: TrendingUp,
    description: "A fast and smooth moving average that uses weighted moving averages to reduce lag while maintaining smoothness.",
    calculation: "HMA = WMA(2 × WMA(Price, Period/2) - WMA(Price, Period), √Period)",
    interpretation: "Combines speed and smoothness. Price above HMA indicates uptrend; below indicates downtrend.",
    buySignal: "Price crosses above HMA",
    sellSignal: "Price crosses below HMA",
    typicalValues: "Common periods: 20, 50",
    defaultPeriod: 20,
  },
  {
    id: "mcginley",
    name: "McGinley Dynamic Indicator",
    category: "moving_average",
    icon: TrendingUp,
    description: "A moving average that automatically adjusts to market speed, reducing whipsaws and false signals.",
    calculation: "MDI = Previous MDI + (Price - Previous MDI) / (Period × (Price / Previous MDI)^4)",
    interpretation: "Adapts to market volatility automatically. Fewer false signals than traditional moving averages.",
    buySignal: "Price crosses above MDI",
    sellSignal: "Price crosses below MDI",
    typicalValues: "Common periods: 14, 20",
    defaultPeriod: 14,
  },
  {
    id: "vwap_ma",
    name: "VWAP Moving Average",
    category: "moving_average",
    icon: BarChart,
    description: "A moving average of VWAP values, smoothing the VWAP line for trend analysis.",
    calculation: "VWAP MA = SMA(VWAP, Period)",
    interpretation: "Smoother than raw VWAP, reducing noise. Price above VWAP MA = bullish trend.",
    buySignal: "Price crosses above VWAP MA",
    sellSignal: "Price crosses below VWAP MA",
    typicalValues: "Common periods: 20, 50",
    defaultPeriod: 20,
  },
  // Bands & Channels
  {
    id: "bollinger",
    name: "Bollinger Bands",
    category: "bands",
    icon: Gauge,
    description: "A volatility indicator consisting of a middle band (SMA) and two standard deviation bands above and below.",
    calculation: "Upper = SMA + (2 × Std Dev), Lower = SMA - (2 × Std Dev)",
    interpretation: "Bands expand during high volatility and contract during low volatility.",
    buySignal: "Price touches lower band and bounces",
    sellSignal: "Price touches upper band and reverses",
    typicalValues: "Standard: 20 period, 2 standard deviations",
    defaultPeriod: 20,
  },
  {
    id: "bollinger_upper",
    name: "Bollinger Bands Upper (UBB)",
    category: "bands",
    icon: Gauge,
    description: "The upper band of Bollinger Bands, calculated as SMA plus two standard deviations.",
    calculation: "UBB = SMA + (2 × Std Dev)",
    interpretation: "Price touching or breaking above UBB may indicate overbought conditions.",
    buySignal: "Price bounces off UBB",
    sellSignal: "Price breaks above UBB",
    typicalValues: "Standard: 20 period, 2 standard deviations",
    defaultPeriod: 20,
  },
  {
    id: "bollinger_middle",
    name: "Bollinger Bands Middle (MBB)",
    category: "bands",
    icon: Gauge,
    description: "The middle band of Bollinger Bands, which is a Simple Moving Average.",
    calculation: "MBB = SMA",
    interpretation: "MBB acts as a dynamic support/resistance level.",
    buySignal: "Price crosses above MBB",
    sellSignal: "Price crosses below MBB",
    typicalValues: "Standard: 20 period",
    defaultPeriod: 20,
  },
  {
    id: "bollinger_lower",
    name: "Bollinger Bands Lower (LBB)",
    category: "bands",
    icon: Gauge,
    description: "The lower band of Bollinger Bands, calculated as SMA minus two standard deviations.",
    calculation: "LBB = SMA - (2 × Std Dev)",
    interpretation: "Price touching or breaking below LBB may indicate oversold conditions.",
    buySignal: "Price bounces off LBB",
    sellSignal: "Price breaks below LBB",
    typicalValues: "Standard: 20 period, 2 standard deviations",
    defaultPeriod: 20,
  },
  {
    id: "keltner",
    name: "Keltner Channel",
    category: "bands",
    icon: Gauge,
    description: "A volatility-based channel using EMA as the middle line and ATR for upper/lower bands.",
    calculation: "Upper = EMA + (ATR × Multiplier), Lower = EMA - (ATR × Multiplier)",
    interpretation: "Similar to Bollinger Bands but uses ATR instead of standard deviation.",
    buySignal: "Price touches lower band and bounces",
    sellSignal: "Price touches upper band and reverses",
    typicalValues: "Standard: 20 period, 2.0 multiplier",
    defaultPeriod: 20,
  },
  {
    id: "donchian",
    name: "Donchian Channel",
    category: "bands",
    icon: Gauge,
    description: "A channel indicator showing the highest high and lowest low over a specified period.",
    calculation: "Upper = Highest High, Lower = Lowest Low, Middle = (Upper + Lower) / 2",
    interpretation: "Upper band = highest high; lower band = lowest low. Channel width shows volatility.",
    buySignal: "Price breaks above upper band",
    sellSignal: "Price breaks below lower band",
    typicalValues: "Common periods: 20, 50",
    defaultPeriod: 20,
  },
  {
    id: "fractal",
    name: "Fractal Chaos Bands",
    category: "bands",
    icon: Gauge,
    description: "Bands based on fractal patterns that identify potential support and resistance levels.",
    calculation: "Based on fractal high/low patterns over period",
    interpretation: "Upper band shows resistance; lower band shows support.",
    buySignal: "Price bounces off lower band",
    sellSignal: "Price bounces off upper band",
    typicalValues: "Common periods: 5, 10",
    defaultPeriod: 5,
  },
  // Oscillators
  {
    id: "rsi",
    name: "Relative Strength Index (RSI)",
    category: "oscillator",
    icon: Activity,
    description: "A momentum oscillator that measures the speed and magnitude of price changes to identify overbought and oversold conditions.",
    calculation: "RSI = 100 - (100 / (1 + RS)) where RS = Average Gain / Average Loss",
    interpretation: "RSI above 70 typically indicates overbought conditions; below 30 indicates oversold.",
    buySignal: "RSI crosses above 30 from below (oversold recovery)",
    sellSignal: "RSI crosses below 70 from above (overbought reversal)",
    typicalValues: "Normal range: 30-70, Extreme: <20 or >80",
    defaultPeriod: 14,
  },
  {
    id: "adx",
    name: "Average Directional Index (ADX)",
    category: "oscillator",
    icon: TrendingUp,
    description: "Measures trend strength regardless of direction, helping identify when a trend is strong enough to trade.",
    calculation: "Complex calculation based on directional movement and true range",
    interpretation: "ADX above 25 indicates strong trend; below 20 suggests weak or ranging market.",
    buySignal: "ADX rising above 25 with +DI > -DI",
    sellSignal: "ADX rising above 25 with -DI > +DI",
    typicalValues: "Standard period: 14",
    defaultPeriod: 14,
  },
  {
    id: "cci",
    name: "Commodity Channel Index (CCI)",
    category: "oscillator",
    icon: Activity,
    description: "Measures the variation of price from its statistical mean, identifying cyclical trends and overbought/oversold conditions.",
    calculation: "CCI = (Typical Price - SMA) / (0.015 × Mean Deviation)",
    interpretation: "CCI above +100 indicates overbought conditions; below -100 indicates oversold.",
    buySignal: "CCI crosses above -100 from below",
    sellSignal: "CCI crosses below +100 from above",
    typicalValues: "Common period: 20",
    defaultPeriod: 20,
  },
  {
    id: "mfi",
    name: "Money Flow Index (MFI)",
    category: "oscillator",
    icon: Activity,
    description: "A volume-weighted RSI that combines price and volume to measure buying and selling pressure.",
    calculation: "MFI = 100 - (100 / (1 + Money Flow Ratio))",
    interpretation: "MFI above 80 indicates overbought conditions; below 20 indicates oversold.",
    buySignal: "MFI crosses above 20 from below",
    sellSignal: "MFI crosses below 80 from above",
    typicalValues: "Common period: 14",
    defaultPeriod: 14,
  },
  {
    id: "macd",
    name: "MACD (Moving Average Convergence Divergence)",
    category: "oscillator",
    icon: BarChart,
    description: "Shows the relationship between two moving averages and their signal line to identify momentum changes.",
    calculation: "MACD = 12-period EMA - 26-period EMA, Signal = EMA(MACD, 9)",
    interpretation: "MACD line crossing above signal line = bullish signal; crossing below = bearish signal.",
    buySignal: "MACD crosses above signal line",
    sellSignal: "MACD crosses below signal line",
    typicalValues: "Standard: 12, 26, 9",
    defaultPeriod: 12,
  },
  {
    id: "williams_r",
    name: "Williams %R",
    category: "oscillator",
    icon: Activity,
    description: "A momentum indicator that measures overbought and oversold levels, similar to Stochastic but inverted.",
    calculation: "%R = ((Highest High - Close) / (Highest High - Lowest Low)) × -100",
    interpretation: "Williams %R above -20 indicates overbought conditions; below -80 indicates oversold.",
    buySignal: "%R crosses above -80 from below",
    sellSignal: "%R crosses below -20 from above",
    typicalValues: "Standard period: 14",
    defaultPeriod: 14,
  },
  {
    id: "momentum",
    name: "Momentum Indicator (MOM)",
    category: "oscillator",
    icon: Activity,
    description: "Measures the rate of change in price by comparing current price to price N periods ago.",
    calculation: "MOM = Current Price - Price N periods ago",
    interpretation: "Momentum above zero indicates upward momentum; below zero indicates downward momentum.",
    buySignal: "Momentum crosses above zero",
    sellSignal: "Momentum crosses below zero",
    typicalValues: "Common periods: 10, 14",
    defaultPeriod: 10,
  },
  {
    id: "proc",
    name: "Price Rate Of Change (PROC)",
    category: "oscillator",
    icon: Activity,
    description: "Measures the percentage change in price over a specified period, showing momentum and rate of price change.",
    calculation: "PROC = ((Current Price - Price N periods ago) / Price N periods ago) × 100",
    interpretation: "PROC above zero indicates positive momentum; below zero indicates negative momentum.",
    buySignal: "PROC crosses above zero",
    sellSignal: "PROC crosses below zero",
    typicalValues: "Common periods: 12, 14",
    defaultPeriod: 12,
  },
  {
    id: "obv",
    name: "On Balance Volume (OBV)",
    category: "oscillator",
    icon: BarChart,
    description: "A cumulative volume indicator that adds volume on up days and subtracts volume on down days to show volume flow.",
    calculation: "OBV = Previous OBV + Volume (if price up) or - Volume (if price down)",
    interpretation: "OBV rising confirms uptrend; falling confirms downtrend.",
    buySignal: "OBV rising while price consolidates",
    sellSignal: "OBV falling while price rises (divergence)",
    typicalValues: "No period, cumulative",
  },
  {
    id: "stochastic",
    name: "Stochastic Oscillator",
    category: "oscillator",
    icon: Activity,
    description: "Compares closing price to price range over period",
    calculation: "%K = ((Close - Low) / (High - Low)) × 100, %D = SMA(%K, 3)",
    interpretation: "Above 80 = overbought, below 20 = oversold",
    buySignal: "%K crosses above 20",
    sellSignal: "%K crosses below 80",
    typicalValues: "Standard: 14, 3",
    defaultPeriod: 14,
  },
  // Other Indicators
  {
    id: "vwap",
    name: "Volume Weighted Average Price (VWAP)",
    category: "other",
    icon: BarChart,
    description: "The average price weighted by volume, showing the true average price at which a stock has traded.",
    calculation: "VWAP = Σ(Price × Volume) / Σ(Volume)",
    interpretation: "Price above VWAP = bullish; below = bearish.",
    buySignal: "Price crosses above VWAP",
    sellSignal: "Price crosses below VWAP",
    typicalValues: "Intraday calculation, resets daily",
  },
  {
    id: "atr",
    name: "Average True Range (ATR)",
    category: "other",
    icon: Gauge,
    description: "Measures market volatility",
    calculation: "ATR = Average of True Range over period, TR = max(High-Low, |High-PrevClose|, |Low-PrevClose|)",
    interpretation: "Higher ATR = more volatility, lower = less volatility",
    buySignal: "ATR decreasing (volatility contraction)",
    sellSignal: "ATR increasing (volatility expansion)",
    typicalValues: "Common period: 14",
    defaultPeriod: 14,
  },
  {
    id: "atr_trailing",
    name: "ATR Trailing Stop Loss",
    category: "other",
    icon: Shield,
    description: "A dynamic stop-loss indicator based on Average True Range that adjusts to market volatility.",
    calculation: "ATR Trailing = Price ± (ATR × Multiplier)",
    interpretation: "Line below price in uptrend; above price in downtrend.",
    buySignal: "Price crosses above ATR trailing stop",
    sellSignal: "Price crosses below ATR trailing stop",
    typicalValues: "Common period: 14, multiplier: 2.0",
    defaultPeriod: 14,
  },
  {
    id: "psar",
    name: "Parabolic SAR (PSAR)",
    category: "other",
    icon: TrendingUp,
    description: "A trend-following indicator that shows potential reversal points in price direction.",
    calculation: "SAR = Previous SAR + AF × (EP - Previous SAR)",
    interpretation: "Dots below price indicate uptrend; above price indicate downtrend.",
    buySignal: "SAR flips below price",
    sellSignal: "SAR flips above price",
    typicalValues: "Standard: 0.02 acceleration, 0.20 maximum",
  },
  {
    id: "supertrend",
    name: "Supertrend",
    category: "other",
    icon: TrendingUp,
    description: "A trend-following indicator that combines ATR with price action to identify trend direction.",
    calculation: "Supertrend = (High + Low) / 2 ± (ATR × Multiplier)",
    interpretation: "Green line indicates uptrend; red line indicates downtrend.",
    buySignal: "Supertrend flips from red to green",
    sellSignal: "Supertrend flips from green to red",
    typicalValues: "Common period: 10, multiplier: 3.0",
    defaultPeriod: 10,
  },
  {
    id: "alligator",
    name: "Alligator",
    category: "other",
    icon: TrendingUp,
    description: "Three smoothed moving averages (Jaw, Teeth, Lips) that represent the 'alligator's mouth' to identify trends.",
    calculation: "Jaw = SMMA(13), Teeth = SMMA(8), Lips = SMMA(5)",
    interpretation: "When lines are intertwined (alligator sleeping), market is ranging. When lines separate, trend is active.",
    buySignal: "Jaw > Teeth > Lips (alligator eating upward)",
    sellSignal: "Lips > Teeth > Jaw (alligator eating downward)",
    typicalValues: "Standard: 13, 8, 5",
  },
  {
    id: "ichimoku",
    name: "Ichimoku Cloud",
    category: "other",
    icon: TrendingUp,
    description: "A comprehensive indicator showing support/resistance, trend direction, momentum, and buy/sell signals.",
    calculation: "Multiple components: Tenkan, Kijun, Senkou A/B, Chikou",
    interpretation: "Price above cloud = bullish, below = bearish.",
    buySignal: "Price breaks above cloud",
    sellSignal: "Price breaks below cloud",
    typicalValues: "Standard: 9, 26, 52",
  },
  {
    id: "linear_regression",
    name: "Linear Regression Forecast",
    category: "other",
    icon: TrendingUp,
    description: "A statistical indicator that forecasts future price based on linear regression of past prices.",
    calculation: "Linear Regression = a + b × x where a and b are calculated from least squares",
    interpretation: "Shows expected price direction based on recent trend.",
    buySignal: "Price crosses above linear regression line",
    sellSignal: "Price crosses below linear regression line",
    typicalValues: "Common periods: 14, 20",
    defaultPeriod: 14,
  },
  {
    id: "pivot_points",
    name: "Pivot Points",
    category: "other",
    icon: Minimize,
    description: "Support and resistance levels based on previous day's price",
    calculation: "Pivot = (High + Low + Close) / 3",
    interpretation: "Price above pivot = bullish, below = bearish",
    buySignal: "Price bounces off support level",
    sellSignal: "Price rejects resistance level",
    typicalValues: "Daily calculation",
  },
];

// Default indicator thresholds (matching backend DEFAULT_INDICATOR_THRESHOLDS)
export const DEFAULT_INDICATOR_THRESHOLDS: Record<
  string,
  Record<string, number>
> = {
  rsi: {
    oversold: 30.0,
    overbought: 70.0,
    neutral_low: 40.0,
    neutral_high: 60.0,
  },
  macd: {
    bullish_threshold: 0.0,
    bearish_threshold: 0.0,
    signal_cross_threshold: 0.0,
  },
  adx: {
    weak_trend: 25.0,
    strong_trend: 50.0,
    moderate_trend: 25.0,
  },
  cci: {
    oversold: -100.0,
    overbought: 100.0,
    neutral_low: -100.0,
    neutral_high: 100.0,
  },
  williams_r: {
    oversold: -80.0,
    overbought: -20.0,
    neutral_low: -80.0,
    neutral_high: -20.0,
  },
  stochastic: {
    oversold: 20.0,
    overbought: 80.0,
    neutral_low: 20.0,
    neutral_high: 80.0,
  },
  mfi: {
    oversold: 20.0,
    overbought: 80.0,
    neutral_low: 20.0,
    neutral_high: 80.0,
  },
  bollinger: {
    lower_band_touch: 0.0,
    upper_band_touch: 0.0,
    band_width_expansion: 0.0,
  },
  moving_average: {
    crossover_threshold: 0.005, // 0.5% threshold for crossover detection (industry standard)
    price_above_multiplier: 1.0,
    price_below_multiplier: 1.0,
  },
  atr: {
    high_volatility_multiplier: 2.0,
    low_volatility_multiplier: 0.5,
  },
  psar: {
    trend_reversal_threshold: 0.0,
  },
  ichimoku: {
    price_above_cloud: 0.0,
    price_below_cloud: 0.0,
    tenkan_kijun_cross: 0.0,
  },
  keltner: {
    upper_band_touch: 0.0,
    lower_band_touch: 0.0,
  },
  donchian: {
    upper_breakout: 0.0,
    lower_breakdown: 0.0,
  },
  vwap: {
    price_above_vwap: 0.0,
    price_below_vwap: 0.0,
  },
  obv: {
    trend_confirmation: 0.0,
    divergence_threshold: 0.0,
  },
  momentum: {
    positive_threshold: 0.0,
    negative_threshold: 0.0,
  },
  proc: {
    positive_threshold: 0.0,
    negative_threshold: 0.0,
  },
  atr_trailing_stop: {
    stop_triggered: 0.0,
  },
  supertrend: {
    trend_reversal: 0.0,
  },
  alligator: {
    jaw_teeth_lips_order: 0.0,
  },
  linear_regression: {
    slope_positive: 0.0,
    slope_negative: 0.0,
  },
  pivot: {
    resistance_break: 0.0,
    support_break: 0.0,
  },
};

// Map indicator ID to threshold type
export const getIndicatorThresholdType = (
  indicatorId: string
): string | null => {
  const idLower = indicatorId.toLowerCase();
  if (idLower.includes("rsi")) return "rsi";
  if (idLower.includes("macd")) return "macd";
  if (idLower.includes("adx")) return "adx";
  if (idLower.includes("cci")) return "cci";
  if (idLower.includes("williams") || idLower.includes("_wr") || idLower.includes("wr_"))
    return "williams_r";
  if (idLower.includes("stochastic") || idLower.includes("stoch"))
    return "stochastic";
  if (idLower.includes("mfi")) return "mfi";
  if (idLower.includes("bollinger") || idLower.includes("bb")) return "bollinger";
  if (
    idLower.includes("sma") ||
    idLower.includes("ema") ||
    idLower.includes("wma") ||
    idLower.includes("dema") ||
    idLower.includes("tema") ||
    idLower.includes("tma") ||
    idLower.includes("hma") ||
    idLower.includes("mcginley")
  )
    return "moving_average";
  if (idLower.includes("atr")) return "atr";
  if (idLower.includes("psar") || idLower.includes("parabolic"))
    return "psar";
  if (idLower.includes("ichimoku")) return "ichimoku";
  if (idLower.includes("keltner")) return "keltner";
  if (idLower.includes("donchian")) return "donchian";
  if (idLower.includes("vwap")) return "vwap";
  if (idLower.includes("obv")) return "obv";
  if (idLower.includes("momentum")) return "momentum";
  if (idLower.includes("proc") || idLower.includes("roc"))
    return "proc";
  if (idLower.includes("supertrend")) return "supertrend";
  if (idLower.includes("alligator")) return "alligator";
  if (idLower.includes("linear") || idLower.includes("regression"))
    return "linear_regression";
  if (idLower.includes("pivot")) return "pivot";
  return null;
};

// Get thresholds for an indicator (from bot config or defaults)
// If thresholds parameter is provided, use it (from context); otherwise fall back to hardcoded defaults
export const getIndicatorThresholds = (
  indicatorId: string,
  botThresholds?: Record<string, Record<string, number>>,
  defaultThresholds?: Record<string, Record<string, number>>
): Record<string, number> | null => {
  const thresholdType = getIndicatorThresholdType(indicatorId);
  if (!thresholdType) return null;

  // Use provided default thresholds (from context) or fall back to hardcoded
  const defaults = defaultThresholds || DEFAULT_INDICATOR_THRESHOLDS;

  // Check if bot has custom thresholds
  if (botThresholds && botThresholds[thresholdType]) {
    // Merge with defaults to ensure all keys exist
    const defaultForType = defaults[thresholdType] || {};
    return { ...defaultForType, ...botThresholds[thresholdType] };
  }

  // Return defaults
  return defaults[thresholdType] || null;
};

// Format threshold value for display
export const formatThresholdValue = (
  key: string,
  value: number
): string => {
  // Format based on threshold type
  if (key.includes("percent") || key.includes("multiplier")) {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (value === 0.0 && (key.includes("threshold") || key.includes("touch"))) {
    return "Auto-detect";
  }
  return value.toFixed(2);
};

// Get threshold display label
export const getThresholdLabel = (key: string): string => {
  const labels: Record<string, string> = {
    oversold: "Oversold (Buy)",
    overbought: "Overbought (Sell)",
    neutral_low: "Neutral Low",
    neutral_high: "Neutral High",
    bullish_threshold: "Bullish",
    bearish_threshold: "Bearish",
    signal_cross_threshold: "Signal Cross",
    weak_trend: "Weak Trend",
    strong_trend: "Strong Trend",
    moderate_trend: "Moderate Trend",
    crossover_threshold: "Crossover Threshold",
    price_above_multiplier: "Price Above Multiplier",
    price_below_multiplier: "Price Below Multiplier",
    lower_band_touch: "Lower Band Touch",
    upper_band_touch: "Upper Band Touch",
    band_width_expansion: "Band Width Expansion",
    high_volatility_multiplier: "High Volatility",
    low_volatility_multiplier: "Low Volatility",
    trend_reversal_threshold: "Trend Reversal",
    price_above_cloud: "Price Above Cloud",
    price_below_cloud: "Price Below Cloud",
    tenkan_kijun_cross: "Tenkan/Kijun Cross",
    upper_breakout: "Upper Breakout",
    lower_breakdown: "Lower Breakdown",
    price_above_vwap: "Price Above VWAP",
    price_below_vwap: "Price Below VWAP",
    trend_confirmation: "Trend Confirmation",
    divergence_threshold: "Divergence",
    positive_threshold: "Positive",
    negative_threshold: "Negative",
    stop_triggered: "Stop Triggered",
    jaw_teeth_lips_order: "Alligator Order",
    slope_positive: "Positive Slope",
    slope_negative: "Negative Slope",
    resistance_break: "Resistance Break",
    support_break: "Support Break",
  };

  return (
    labels[key] ||
    key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
  );
};

export const PATTERNS: PatternDefinition[] = [
  // Candlestick Patterns - Bullish
  {
    id: "three_white_soldiers",
    name: "Three White Soldiers",
    category: "candlestick",
    icon: TrendingUp,
    description: "Strong bullish reversal pattern consisting of three consecutive bullish candles.",
    patternType: "reversal",
    formation: "Each candle closes higher than the previous, with small wicks. Indicates strong buying pressure.",
    reliability: "~75% accuracy when confirmed with volume",
    priceMovement: "Potential upward trend continuation",
    confidence: "Based on candle strength and volume confirmation",
  },
  {
    id: "morning_doji_star",
    name: "Morning Doji Star",
    category: "candlestick",
    icon: TrendingUp,
    description: "Bullish reversal pattern with a bearish candle, doji, and bullish candle.",
    patternType: "reversal",
    formation: "The doji represents indecision after a downtrend. When followed by a bullish candle closing above the first candle's midpoint, it signals a potential reversal.",
    reliability: "~80% accuracy",
    priceMovement: "Price typically reverses upward",
    confidence: "High reliability pattern, especially with volume confirmation",
  },
  {
    id: "abandoned_baby",
    name: "Abandoned Baby",
    category: "candlestick",
    icon: TrendingUp,
    description: "Strong bullish reversal pattern with gaps on both sides of a doji.",
    patternType: "reversal",
    formation: "Rare but highly reliable pattern. The gaps indicate strong momentum shift.",
    reliability: "~85% accuracy",
    priceMovement: "Strong upward reversal",
    confidence: "Rare but highly reliable, requires confirmation with volume",
  },
  {
    id: "conceal_baby_swallow",
    name: "Conceal Baby Swallow",
    category: "candlestick",
    icon: TrendingUp,
    description: "Bullish continuation pattern with four candles showing bearish exhaustion.",
    patternType: "continuation",
    formation: "Rare pattern indicating bearish exhaustion. The small fourth candle suggests sellers are losing control.",
    reliability: "~70% accuracy",
    priceMovement: "Price typically continues upward",
    confidence: "Rare pattern, look for bullish confirmation in the next candle",
  },
  {
    id: "stick_sandwich",
    name: "Stick Sandwich",
    category: "candlestick",
    icon: TrendingUp,
    description: "Bullish reversal pattern with two bearish candles sandwiching a bullish one.",
    patternType: "reversal",
    formation: "The bullish candle in the middle suggests buyers are stepping in. When the third candle closes above both previous candles, it confirms the reversal.",
    reliability: "~70% accuracy",
    priceMovement: "Price typically reverses upward",
    confidence: "Based on candle confirmation and volume",
  },
  {
    id: "morning_star",
    name: "Morning Star",
    category: "candlestick",
    icon: TrendingUp,
    description: "Bullish reversal pattern with a bearish candle, small body, and bullish candle.",
    patternType: "reversal",
    formation: "Classic reversal pattern. The small middle candle represents indecision. When the third candle closes above the first candle's midpoint, it confirms the reversal.",
    reliability: "~75% accuracy",
    priceMovement: "Price typically reverses upward",
    confidence: "Classic pattern with high reliability",
  },
  {
    id: "kicking",
    name: "Kicking",
    category: "candlestick",
    icon: TrendingUp,
    description: "Strong bullish reversal pattern with two marubozu candles and a gap.",
    patternType: "reversal",
    formation: "Very strong reversal signal. The gap between marubozu candles indicates a significant momentum shift.",
    reliability: "~85% accuracy",
    priceMovement: "Strong upward reversal",
    confidence: "High reliability pattern, especially in downtrends",
  },
  {
    id: "engulfing",
    name: "Engulfing",
    category: "candlestick",
    icon: TrendingUp,
    description: "Reversal pattern where one candle completely engulfs the previous candle.",
    patternType: "reversal",
    formation: "Can be bullish or bearish depending on the direction. The engulfing candle shows strong momentum in the opposite direction.",
    reliability: "~70% accuracy",
    priceMovement: "Price typically reverses in engulfing direction",
    confidence: "More reliable when it occurs after a strong trend",
  },
  {
    id: "homing_pigeon",
    name: "Homing Pigeon",
    category: "candlestick",
    icon: TrendingUp,
    description: "Bullish reversal pattern with two bearish candles where the second is contained within the first.",
    patternType: "reversal",
    formation: "The second candle being smaller and contained suggests weakening bearish momentum. Often precedes a reversal, especially when it appears after a downtrend.",
    reliability: "~65% accuracy",
    priceMovement: "Price typically reverses upward",
    confidence: "Based on pattern formation and trend context",
  },
  // Candlestick Patterns - Bearish
  {
    id: "advance_block",
    name: "Advance Block",
    category: "candlestick",
    icon: TrendingDown,
    description: "Bearish reversal pattern showing weakening upward momentum.",
    patternType: "reversal",
    formation: "Three bullish candles with decreasing body sizes and increasing wicks indicate buyers are losing strength. Often precedes a reversal or pullback.",
    reliability: "~70% accuracy",
    priceMovement: "Price typically reverses or pulls back",
    confidence: "Based on weakening momentum signals",
  },
  // Candlestick Patterns - Neutral
  {
    id: "tri_star",
    name: "Tri Star",
    category: "candlestick",
    icon: Activity,
    description: "Reversal pattern with three consecutive doji candles with gaps.",
    patternType: "reversal",
    formation: "Indicates extreme indecision in the market. The direction of the reversal depends on the overall trend.",
    reliability: "~60% accuracy",
    priceMovement: "Watch for breakouts after this pattern forms",
    confidence: "Based on overall trend and subsequent price action",
  },
  {
    id: "spinning_top",
    name: "Spinning Top",
    category: "candlestick",
    icon: Activity,
    description: "Indecision pattern with a small body and long wicks on both sides.",
    patternType: "reversal",
    formation: "Indicates market uncertainty. The small body shows neither buyers nor sellers are in control. Often appears at potential reversal points.",
    reliability: "~55% accuracy",
    priceMovement: "Wait for confirmation",
    confidence: "Requires confirmation from subsequent candles",
  },
  // Chart Patterns - Reversal
  {
    id: "head_and_shoulders",
    name: "Head and Shoulders",
    category: "reversal",
    icon: Mountain,
    description: "Reversal pattern indicating trend change from bullish to bearish. Consists of three peaks: left shoulder, higher head, and right shoulder at similar level.",
    patternType: "reversal",
    formation:
      "Three peaks: left shoulder, higher head, right shoulder at similar level. Neckline connects the two troughs. When price breaks below the neckline with volume, it confirms the bearish reversal.",
    reliability: "~75% accuracy when confirmed with volume",
    priceMovement: "Typically results in price decline equal to head height",
    confidence: "Based on pattern symmetry, volume confirmation, and neckline break",
  },
  {
    id: "double_top",
    name: "Double Top",
    category: "reversal",
    icon: Maximize,
    description: "Bearish reversal pattern with two peaks at similar levels, separated by a trough.",
    patternType: "reversal",
    formation: "Two peaks at similar price levels with a trough between them. The trough between them is called the neckline. When price breaks below the neckline with volume, it confirms the bearish reversal.",
    reliability: "~70% accuracy",
    priceMovement: "Price typically declines after second peak, target is typically equal to the distance from the peaks to the neckline",
    confidence: "Based on peak similarity, volume confirmation, and neckline break",
  },
  {
    id: "double_bottom",
    name: "Double Bottom",
    category: "reversal",
    icon: Minimize,
    description: "Bullish reversal pattern with two troughs at similar levels, separated by a peak.",
    patternType: "reversal",
    formation: "Two troughs at similar price levels with a peak between them. The peak between them is called the neckline. When price breaks above the neckline with volume, it confirms the bullish reversal.",
    reliability: "~70% accuracy",
    priceMovement: "Price typically rises after second trough, target is typically equal to the distance from the troughs to the neckline",
    confidence: "Based on trough similarity, volume confirmation, and neckline break",
  },
  {
    id: "rising_wedge",
    name: "Rising Wedge",
    category: "reversal",
    icon: TrendingUp,
    description: "Bearish reversal pattern with both support and resistance lines sloping upward and converging, forming a wedge shape.",
    patternType: "reversal",
    formation: "Both the support and resistance lines slope upward, but they converge, indicating weakening momentum. The pattern shows that each new high is less significant than the previous one, and each pullback is shallower.",
    reliability: "~65% accuracy",
    priceMovement: "Price typically breaks down after wedge, target is typically measured by projecting the height of the wedge from the breakdown point",
    confidence: "Based on convergence, volume decline, and breakdown confirmation",
  },
  {
    id: "falling_wedge",
    name: "Falling Wedge",
    category: "reversal",
    icon: TrendingDown,
    description: "Bullish reversal pattern with both support and resistance lines sloping downward and converging, forming a wedge shape.",
    patternType: "reversal",
    formation: "Both the support and resistance lines slope downward, but they converge, indicating weakening selling pressure. The pattern shows that each new low is less significant than the previous one, and each bounce is stronger.",
    reliability: "~65% accuracy",
    priceMovement: "Price typically breaks up after wedge, target is typically measured by projecting the height of the wedge from the breakout point",
    confidence: "Based on convergence, volume pattern, and breakout confirmation",
  },
  // Chart Patterns - Continuation
  {
    id: "flag",
    name: "Flag",
    category: "continuation",
    icon: ArrowRight,
    description: "Continuation pattern that occurs after a sharp price movement. Consists of a flagpole (sharp move) followed by a flag (consolidation).",
    patternType: "continuation",
    formation: "Sharp move (flagpole) followed by a rectangular consolidation area (the flag) that slopes against the trend. In a bullish flag, the flag slopes downward. The pattern is confirmed when price breaks out of the flag in the direction of the original move (flagpole).",
    reliability: "~65% accuracy",
    priceMovement: "Price typically continues in flagpole direction, target is typically measured by projecting the flagpole length from the breakout point",
    confidence: "Based on flagpole strength, flag consolidation, and volume pattern",
  },
  {
    id: "pennant",
    name: "Pennant",
    category: "continuation",
    icon: ArrowRight,
    description: "Continuation pattern with converging trend lines forming a small symmetrical triangle after a sharp price movement.",
    patternType: "continuation",
    formation: "Similar to a flag but with converging trend lines instead of parallel ones. The pennant forms after a sharp price move (the pole) and consists of a small symmetrical triangle. Volume should decrease during pennant formation and increase significantly on the breakout.",
    reliability: "~70% accuracy",
    priceMovement: "Price typically continues in original direction, target is typically measured by projecting the pole length from the breakout point",
    confidence: "Based on convergence, volume pattern, and breakout confirmation",
  },
];

export const ICON_MAPPING: Record<string, React.ComponentType<{ className?: string }>> = {
  bot: Bot,
  wallet: Wallet,
  dollarSign: DollarSign,
  trendingUp: TrendingUp,
  shield: Shield,
  alertTriangle: AlertTriangle,
  maximize: Maximize,
  activity: Activity,
  trendingDown: TrendingDown,
  arrowDown: ArrowDown,
  arrowUp: ArrowUp,
  brain: Brain,
  zap: Zap,
  messageSquare: MessageSquare,
  twitter: Twitter,
  barChart: BarChart,
  target: Target,
  newspaper: Newspaper,
  rss: Rss,
  gauge: Gauge,
  lineChart: LineChart,
  layers: Layers,
  mountain: Mountain,
  rotateCcw: RotateCcw,
  arrowRight: ArrowRight,
  gitMerge: GitMerge,
  settings: Settings,
  users: Users,
  code: Code,
  fileText: FileText,
  clock: Clock,
  database: Database,
  checkCircle: CheckCircle,
  x: X,
  info: Info,
  plus: Plus,
  trash2: Trash2,
  edit: Edit,
  search: Search,
  hash: Hash,
  candle: BarChart,
  minimize: Minimize,
};

export const AGGREGATION_METHODS = [
  {
    id: "weighted_average",
    name: "Weighted Average",
    icon: BarChart,
    description: "Combine signals using weighted average with risk adjustment",
    formula: "Σ(signal_i × weight_i × risk_adjustment) / Σ(weight_i)",
  },
  {
    id: "ensemble_voting",
    name: "Ensemble Voting",
    icon: Users,
    description: "Majority vote from all signals, but risk can override",
    formula: "Majority vote, risk override if risk_score > 80",
  },
  {
    id: "threshold_based",
    name: "Threshold Based",
    icon: Target,
    description: "All signals must exceed thresholds AND risk must be below threshold",
    formula: "All signals > threshold AND risk_score < risk_threshold",
  },
  {
    id: "custom_rule",
    name: "Custom Rules",
    icon: Code,
    description: "Define custom JSON rules with risk parameters",
    formula: "User-defined JSON logic",
  },
];

export const SIGNAL_SOURCE_WEIGHTS = {
  ml: { default: 0.4, icon: Brain, name: "ML Models" },
  indicators: { default: 0.3, icon: LineChart, name: "Technical Indicators" },
  patterns: { default: 0.15, icon: Layers, name: "Chart Patterns" },
  social: { default: 0.1, icon: MessageSquare, name: "Social Media" },
  news: { default: 0.05, icon: Newspaper, name: "News" },
};
