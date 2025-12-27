import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Brain,
  MessageSquare,
  Newspaper,
  LineChart,
  Layers,
  GitMerge,
  Shield,
  Settings,
  Code,
  BarChart,
  Users,
  Target,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Activity,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle,
  Play,
} from "lucide-react";

const BotSystemDocumentation: React.FC = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [activeStep, setActiveStep] = useState<number>(0);
  const [hoveredSignalNode, setHoveredSignalNode] = useState<string | null>(
    null
  );
  const [hoveredWorkflowNode, setHoveredWorkflowNode] = useState<string | null>(
    null
  );

  const sections = [
    { id: "overview", title: "Overview", icon: BookOpen },
    { id: "ml_models", title: "ML Models", icon: Brain },
    { id: "signal_sources", title: "Signal Sources", icon: BarChart },
    { id: "aggregation", title: "Signal Aggregation", icon: GitMerge },
    { id: "risk_management", title: "Risk Management", icon: Shield },
    { id: "configuration", title: "Bot Configuration", icon: Settings },
  ];

  const workflowSteps = [
    {
      id: "workflow_trigger",
      title: "Trigger Event",
      description: "New price data arrives (tick or daily)",
      icon: Zap,
      color: "blue",
    },
    {
      id: "workflow_data",
      title: "Fetch Price Data",
      description: "Get historical and latest price data",
      icon: Database,
      color: "purple",
    },
    {
      id: "workflow_indicators",
      title: "Calculate Indicators",
      description: "SMA, EMA, RSI, MACD, Bollinger Bands, etc.",
      icon: LineChart,
      color: "green",
    },
    {
      id: "workflow_patterns",
      title: "Detect Patterns",
      description: "Candlestick patterns, chart formations",
      icon: Layers,
      color: "purple",
    },
    {
      id: "workflow_ml",
      title: "ML Predictions",
      description: "Run enabled ML models for predictions",
      icon: Brain,
      color: "blue",
    },
    {
      id: "workflow_social",
      title: "Social Analysis",
      description: "Analyze social media sentiment",
      icon: MessageSquare,
      color: "green",
    },
    {
      id: "workflow_news",
      title: "News Analysis",
      description: "Analyze news sentiment and impact",
      icon: Newspaper,
      color: "orange",
    },
    {
      id: "workflow_risk",
      title: "Calculate Risk",
      description: "Compute risk score (0-100)",
      icon: Shield,
      color: "yellow",
    },
    {
      id: "workflow_aggregate",
      title: "Aggregate Signals",
      description: "Combine all signals using selected method",
      icon: GitMerge,
      color: "purple",
    },
    {
      id: "workflow_decision",
      title: "Final Decision",
      description: "BUY, SELL, or HOLD with confidence",
      icon: Target,
      color: "blue",
    },
    {
      id: "workflow_execute",
      title: "Execute Trade",
      description: "Create order if decision is BUY/SELL",
      icon: Activity,
      color: "green",
    },
    {
      id: "workflow_log",
      title: "Log History",
      description: "Save all signals and decision to history",
      icon: Database,
      color: "gray",
    },
  ];

  const getColorClasses = (color: string, isActive: boolean) => {
    const colorMap: Record<
      string,
      { bg: string; border: string; shadow: string }
    > = {
      blue: {
        bg: isActive ? "bg-blue-500" : "bg-blue-500/30",
        border: isActive ? "border-blue-400" : "border-blue-500/50",
        shadow: isActive ? "shadow-lg shadow-blue-500/50" : "",
      },
      purple: {
        bg: isActive ? "bg-purple-500" : "bg-purple-500/30",
        border: isActive ? "border-purple-400" : "border-purple-500/50",
        shadow: isActive ? "shadow-lg shadow-purple-500/50" : "",
      },
      green: {
        bg: isActive ? "bg-green-500" : "bg-green-500/30",
        border: isActive ? "border-green-400" : "border-green-500/50",
        shadow: isActive ? "shadow-lg shadow-green-500/50" : "",
      },
      orange: {
        bg: isActive ? "bg-orange-500" : "bg-orange-500/30",
        border: isActive ? "border-orange-400" : "border-orange-500/50",
        shadow: isActive ? "shadow-lg shadow-orange-500/50" : "",
      },
      yellow: {
        bg: isActive ? "bg-yellow-500" : "bg-yellow-500/30",
        border: isActive ? "border-yellow-400" : "border-yellow-500/50",
        shadow: isActive ? "shadow-lg shadow-yellow-500/50" : "",
      },
      gray: {
        bg: isActive ? "bg-gray-500" : "bg-gray-500/30",
        border: isActive ? "border-gray-400" : "border-gray-500/50",
        shadow: isActive ? "shadow-lg shadow-gray-500/50" : "",
      },
    };
    return colorMap[color] || colorMap.blue;
  };

  const Node: React.FC<{
    step: (typeof workflowSteps)[0];
    index: number;
    isActive: boolean;
    isHovered: boolean;
    onHover: (id: string | null) => void;
    totalSteps: number;
  }> = ({ step, index, isActive, isHovered, onHover, totalSteps }) => {
    const Icon = step.icon;
    const colors = getColorClasses(step.color, isActive);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: isActive ? 1 : 0.6,
          scale: isActive ? 1 : 0.95,
        }}
        whileHover={{ scale: 1.05 }}
        onHoverStart={() => onHover(step.id)}
        onHoverEnd={() => onHover(null)}
        className={`relative flex flex-col items-center cursor-pointer transition-all flex-shrink-0 ${
          isActive ? "z-10" : ""
        }`}
        onClick={() => setActiveStep(index)}
        style={{ minWidth: "calc(100% / 18)", maxWidth: "calc(100% / 18)" }}
      >
        <div
          className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0 ${
            colors.bg
          } ${colors.border} ${colors.shadow} ${
            isHovered ? "ring-2 ring-blue-400/50" : ""
          }`}
        >
          <Icon
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 ${
              isActive ? "text-white" : "text-gray-400"
            }`}
          />
        </div>
        <div
          className={`mt-0.5 text-center w-full px-0.5 ${
            isActive ? "text-white" : "text-gray-400"
          }`}
        >
          <p className="text-[7px] sm:text-[8px] md:text-[9px] font-semibold leading-tight break-words">
            {step.title}
          </p>
        </div>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`absolute top-full mt-2 bg-gray-800 border border-gray-700 rounded-lg p-2 sm:p-3 shadow-xl z-20 w-[160px] sm:w-[200px] md:w-[240px] ${
              index === 0
                ? "left-0"
                : index === totalSteps - 1
                ? "right-0"
                : "left-1/2 -translate-x-1/2"
            }`}
            style={{
              maxWidth: "calc(100vw - 2rem)",
            }}
          >
            <p className="text-[10px] sm:text-xs md:text-sm text-gray-300 leading-tight">
              {step.description}
            </p>
          </motion.div>
        )}
      </motion.div>
    );
  };

  const SignalFlowDiagram: React.FC<{
    hoveredNode: string | null;
    setHoveredNode: (id: string | null) => void;
  }> = ({ hoveredNode, setHoveredNode }) => {
    // This uses its own hover state, separate from workflow
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-xl font-semibold text-white mb-6 text-center">
          Signal Flow Architecture
        </h3>
        <div className="relative space-y-6">
          {/* Step 1: Price Data Entry */}
          <div className="flex justify-center">
            <motion.div
              animate={{
                scale: hoveredNode === "price_data" ? 1.05 : 1,
              }}
              onHoverStart={() => setHoveredNode("price_data")}
              onHoverEnd={() => setHoveredNode(null)}
              className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-4 border-2 border-blue-400"
            >
              <Database className="w-10 h-10 text-white mb-2" />
              <h4 className="text-white font-bold text-base">Price Data</h4>
              <p className="text-blue-200 text-xs mt-1">OHLCV Data</p>
            </motion.div>
          </div>

          {/* Arrow down */}
          <div className="flex justify-center">
            <div className="text-gray-500 text-2xl">↓</div>
          </div>

          {/* Step 2: Indicators & Patterns (from price data) */}
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            <motion.div
              animate={{
                scale: hoveredNode === "indicators" ? 1.05 : 1,
              }}
              onHoverStart={() => setHoveredNode("indicators")}
              onHoverEnd={() => setHoveredNode(null)}
              className="bg-cyan-600/20 border-2 border-cyan-500 rounded-lg p-4 text-center"
            >
              <LineChart className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <h5 className="text-white font-semibold text-sm">Indicators</h5>
              <p className="text-cyan-300 text-xs mt-1">SMA, RSI, MACD...</p>
            </motion.div>

            <motion.div
              animate={{
                scale: hoveredNode === "patterns" ? 1.05 : 1,
              }}
              onHoverStart={() => setHoveredNode("patterns")}
              onHoverEnd={() => setHoveredNode(null)}
              className="bg-pink-600/20 border-2 border-pink-500 rounded-lg p-4 text-center"
            >
              <Layers className="w-8 h-8 text-pink-400 mx-auto mb-2" />
              <h5 className="text-white font-semibold text-sm">Patterns</h5>
              <p className="text-pink-300 text-xs mt-1">Chart Formations</p>
            </motion.div>
          </div>

          {/* Arrow down */}
          <div className="flex justify-center">
            <div className="text-gray-500 text-2xl">↓</div>
          </div>

          {/* Step 3: ML Models (using indicators & patterns as features) */}
          <div className="flex justify-center">
            <motion.div
              animate={{
                scale: hoveredNode === "ml" ? 1.05 : 1,
              }}
              onHoverStart={() => setHoveredNode("ml")}
              onHoverEnd={() => setHoveredNode(null)}
              className="bg-blue-600/20 border-2 border-blue-500 rounded-lg p-4"
            >
              <div className="flex items-center gap-3">
                <Brain className="w-8 h-8 text-blue-400" />
                <div>
                  <h5 className="text-white font-semibold">ML Models</h5>
                  <p className="text-blue-300 text-xs">
                    Uses price, indicators, patterns
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Arrow down */}
          <div className="flex justify-center">
            <div className="text-gray-500 text-2xl">↓</div>
          </div>

          {/* Step 4: Parallel Signal Sources */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            {/* ML Signals */}
            <motion.div
              animate={{
                scale: hoveredNode === "ml_signals" ? 1.05 : 1,
              }}
              onHoverStart={() => setHoveredNode("ml_signals")}
              onHoverEnd={() => setHoveredNode(null)}
              className="bg-blue-600/20 border-2 border-blue-500 rounded-lg p-3 text-center"
            >
              <Brain className="w-6 h-6 text-blue-400 mx-auto mb-1" />
              <h5 className="text-white font-semibold text-xs">ML Signals</h5>
              <p className="text-blue-300 text-[10px] mt-1">Predictions</p>
            </motion.div>

            {/* Social Media */}
            <motion.div
              animate={{
                scale: hoveredNode === "social" ? 1.05 : 1,
              }}
              onHoverStart={() => setHoveredNode("social")}
              onHoverEnd={() => setHoveredNode(null)}
              className="bg-green-600/20 border-2 border-green-500 rounded-lg p-3 text-center"
            >
              <MessageSquare className="w-6 h-6 text-green-400 mx-auto mb-1" />
              <h5 className="text-white font-semibold text-xs">Social Media</h5>
              <p className="text-green-300 text-[10px] mt-1">Sentiment</p>
            </motion.div>

            {/* News */}
            <motion.div
              animate={{
                scale: hoveredNode === "news" ? 1.05 : 1,
              }}
              onHoverStart={() => setHoveredNode("news")}
              onHoverEnd={() => setHoveredNode(null)}
              className="bg-orange-600/20 border-2 border-orange-500 rounded-lg p-3 text-center"
            >
              <Newspaper className="w-6 h-6 text-orange-400 mx-auto mb-1" />
              <h5 className="text-white font-semibold text-xs">News</h5>
              <p className="text-orange-300 text-[10px] mt-1">Analysis</p>
            </motion.div>
          </div>

          {/* Step 5: Risk Calculation (parallel) */}
          <div className="flex justify-center">
            <motion.div
              animate={{
                scale: hoveredNode === "risk_calc" ? 1.05 : 1,
              }}
              onHoverStart={() => setHoveredNode("risk_calc")}
              onHoverEnd={() => setHoveredNode(null)}
              className="bg-yellow-600/20 border-2 border-yellow-500 rounded-lg p-3"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-yellow-400" />
                <div>
                  <h5 className="text-white font-semibold text-sm">
                    Risk Score
                  </h5>
                  <p className="text-yellow-300 text-xs">0-100</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Arrow down */}
          <div className="flex justify-center">
            <div className="text-gray-500 text-2xl">↓</div>
          </div>

          {/* Step 6: Signal Aggregator (combines all signals + risk) */}
          <div className="flex justify-center">
            <motion.div
              animate={{
                scale: hoveredNode === "aggregator" ? 1.1 : 1,
                boxShadow:
                  hoveredNode === "aggregator"
                    ? "0 0 30px rgba(139, 92, 246, 0.5)"
                    : "0 0 10px rgba(139, 92, 246, 0.2)",
              }}
              onHoverStart={() => setHoveredNode("aggregator")}
              onHoverEnd={() => setHoveredNode(null)}
              className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-6 border-2 border-purple-400"
            >
              <GitMerge className="w-12 h-12 text-white mb-2" />
              <h4 className="text-white font-bold text-lg">
                Signal Aggregator
              </h4>
              <p className="text-purple-200 text-sm mt-1">
                Combines all signals with risk adjustment
              </p>
            </motion.div>
          </div>

          {/* Arrow down */}
          <div className="flex justify-center">
            <div className="text-gray-500 text-2xl">↓</div>
          </div>

          {/* Step 7: Risk-Based Decision Modifier */}
          <div className="flex justify-center">
            <motion.div
              animate={{
                scale: hoveredNode === "risk_modifier" ? 1.05 : 1,
              }}
              onHoverStart={() => setHoveredNode("risk_modifier")}
              onHoverEnd={() => setHoveredNode(null)}
              className="bg-yellow-600/20 border-2 border-yellow-500 rounded-lg p-4"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-yellow-400" />
                <div>
                  <h5 className="text-white font-semibold">
                    Risk Override Check
                  </h5>
                  <p className="text-yellow-300 text-xs">
                    Force HOLD if risk too high
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Arrow down */}
          <div className="flex justify-center">
            <div className="text-gray-500 text-2xl">↓</div>
          </div>

          {/* Step 8: Final Decision */}
          <div className="flex justify-center">
            <motion.div
              animate={{
                scale: hoveredNode === "decision" ? 1.1 : 1,
                boxShadow:
                  hoveredNode === "decision"
                    ? "0 0 30px rgba(34, 197, 94, 0.5)"
                    : "0 0 10px rgba(34, 197, 94, 0.2)",
              }}
              onHoverStart={() => setHoveredNode("decision")}
              onHoverEnd={() => setHoveredNode(null)}
              className="bg-gradient-to-br from-green-600 to-green-800 rounded-xl p-6 border-2 border-green-400"
            >
              <Target className="w-12 h-12 text-white mb-2" />
              <h4 className="text-white font-bold text-lg">Final Decision</h4>
              <p className="text-green-200 text-sm mt-1">BUY / SELL / HOLD</p>
            </motion.div>
          </div>
        </div>
      </div>
    );
  };

  const WorkflowDiagram: React.FC<{
    workflowSteps: typeof workflowSteps;
    activeStep: number;
    setActiveStep: React.Dispatch<React.SetStateAction<number>>;
    hoveredNode: string | null;
    setHoveredNode: (id: string | null) => void;
    getStepDetails: (stepId: string) => React.ReactNode;
  }> = ({
    workflowSteps,
    activeStep,
    setActiveStep,
    hoveredNode,
    setHoveredNode,
    getStepDetails,
  }) => {
    // This uses its own hover state, separate from signal flow
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h3 className="text-lg sm:text-xl font-semibold text-white">
            Bot Analysis Workflow
          </h3>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
              disabled={activeStep === 0}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm"
            >
              Previous
            </button>
            <button
              onClick={() =>
                setActiveStep(
                  Math.min(workflowSteps.length - 1, activeStep + 1)
                )
              }
              disabled={activeStep === workflowSteps.length - 1}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm"
            >
              Next
            </button>
            <button
              onClick={() => {
                const interval = setInterval(() => {
                  setActiveStep((prev: number) => {
                    if (prev >= workflowSteps.length - 1) {
                      clearInterval(interval);
                      return prev;
                    }
                    return prev + 1;
                  });
                }, 1500);
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Auto Play
            </button>
          </div>
        </div>

        <div className="relative pb-20">
          <div className="flex justify-center items-center gap-0 sm:gap-0.5 md:gap-1 lg:gap-2 px-1 w-full">
            {workflowSteps.map((step, index) => (
              <React.Fragment key={step.id}>
                <Node
                  step={step}
                  index={index}
                  isActive={index === activeStep}
                  isHovered={hoveredNode === step.id}
                  onHover={setHoveredNode}
                  totalSteps={workflowSteps.length}
                />
                {index < workflowSteps.length - 1 && (
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{
                      scaleX: index < activeStep ? 1 : 0.9,
                    }}
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      alignSelf: "flex-start",
                      paddingTop: "1rem",
                    }}
                  >
                    <ArrowRight className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 text-gray-600" />
                  </motion.div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Details */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-8 bg-gray-700/50 rounded-lg p-6 border border-gray-600"
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                  workflowSteps[activeStep].color === "blue"
                    ? "bg-blue-500/20 border-blue-500"
                    : workflowSteps[activeStep].color === "purple"
                    ? "bg-purple-500/20 border-purple-500"
                    : workflowSteps[activeStep].color === "green"
                    ? "bg-green-500/20 border-green-500"
                    : workflowSteps[activeStep].color === "orange"
                    ? "bg-orange-500/20 border-orange-500"
                    : workflowSteps[activeStep].color === "yellow"
                    ? "bg-yellow-500/20 border-yellow-500"
                    : "bg-gray-500/20 border-gray-500"
                }`}
              >
                {React.createElement(workflowSteps[activeStep].icon, {
                  className: `w-6 h-6 ${
                    workflowSteps[activeStep].color === "blue"
                      ? "text-blue-400"
                      : workflowSteps[activeStep].color === "purple"
                      ? "text-purple-400"
                      : workflowSteps[activeStep].color === "green"
                      ? "text-green-400"
                      : workflowSteps[activeStep].color === "orange"
                      ? "text-orange-400"
                      : workflowSteps[activeStep].color === "yellow"
                      ? "text-yellow-400"
                      : "text-gray-400"
                  }`,
                })}
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-bold text-white mb-2">
                  Step {activeStep + 1}: {workflowSteps[activeStep].title}
                </h4>
                <p className="text-gray-300 mb-4">
                  {workflowSteps[activeStep].description}
                </p>
                {getStepDetails(workflowSteps[activeStep].id)}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  };

  const getStepDetails = (stepId: string) => {
    switch (stepId) {
      case "workflow_trigger":
        return (
          <div className="space-y-2 text-gray-300 text-sm">
            <p>
              • Bot monitors for new price data (real-time ticks or daily
              closes)
            </p>
            <p>• Triggered automatically when new data arrives</p>
            <p>• Can also be manually executed via API</p>
          </div>
        );
      case "workflow_data":
        return (
          <div className="space-y-2 text-gray-300 text-sm">
            <p>• Fetches historical price data (OHLCV)</p>
            <p>• Retrieves latest price point</p>
            <p>• Minimum data required: 50+ data points for indicators</p>
          </div>
        );
      case "workflow_indicators":
        return (
          <div className="space-y-2 text-gray-300 text-sm">
            <p>• Calculates all enabled technical indicators</p>
            <p>• Examples: SMA(20, 50), RSI(14), MACD, Bollinger Bands</p>
            <p>• Each indicator generates buy/sell/hold signals</p>
            <p>• Signals include strength/confidence scores</p>
          </div>
        );
      case "workflow_patterns":
        return (
          <div className="space-y-2 text-gray-300 text-sm">
            <p>• Scans price chart for candlestick patterns</p>
            <p>
              • Detects chart formations (Head & Shoulders, Double Tops, etc.)
            </p>
            <p>• Each pattern has reliability score</p>
            <p>• Patterns indicate reversal or continuation</p>
          </div>
        );
      case "workflow_ml":
        return (
          <div className="space-y-2 text-gray-300 text-sm">
            <p>• Runs all enabled ML models</p>
            <p>
              • Each model predicts: action (buy/sell/hold) and potential
              gain/loss
            </p>
            <p>• Models use price data, indicators, and patterns as features</p>
            <p>• Returns confidence scores and predictions</p>
          </div>
        );
      case "workflow_social":
        return (
          <div className="space-y-2 text-gray-300 text-sm">
            <p>• Analyzes social media mentions (Twitter, Reddit, etc.)</p>
            <p>• Calculates sentiment score (-1 to +1)</p>
            <p>• Considers volume and recency of mentions</p>
            <p>• Generates signal based on sentiment strength</p>
          </div>
        );
      case "workflow_news":
        return (
          <div className="space-y-2 text-gray-300 text-sm">
            <p>• Scans financial news sources</p>
            <p>• Analyzes sentiment and relevance</p>
            <p>• Calculates impact score</p>
            <p>• Considers news recency and source credibility</p>
          </div>
        );
      case "workflow_risk":
        return (
          <div className="space-y-2 text-gray-300 text-sm">
            <p>• Calculates comprehensive risk score (0-100)</p>
            <p>
              • Factors: Volatility (30%), Concentration (20%), Drawdown (25%),
              Position Size (25%)
            </p>
            <p>• Higher score = higher risk</p>
            <p>• Used to adjust signals and position sizing</p>
          </div>
        );
      case "workflow_aggregate":
        return (
          <div className="space-y-2 text-gray-300 text-sm">
            <p>• Combines all signals using selected method:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>
                Weighted Average: Σ(signal × weight × risk_adj) / Σ(weight)
              </li>
              <li>Ensemble Voting: Majority vote with risk override</li>
              <li>Threshold Based: All signals must exceed thresholds</li>
              <li>Custom Rules: User-defined JSON logic</li>
            </ul>
            <p>• Applies risk adjustment to signal confidence</p>
          </div>
        );
      case "workflow_decision":
        return (
          <div className="space-y-2 text-gray-300 text-sm">
            <p>• Final decision: BUY, SELL, or HOLD</p>
            <p>• Includes confidence score (0-1)</p>
            <p>• Risk override: If risk &gt; threshold, force HOLD</p>
            <p>• Decision based on aggregated signal strength</p>
          </div>
        );
      case "workflow_execute":
        return (
          <div className="space-y-2 text-gray-300 text-sm">
            <p>• If decision is BUY/SELL:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Calculate position size based on risk per trade</li>
              <li>Apply risk-based position scaling if enabled</li>
              <li>Check trading rules (buy_rules/sell_rules)</li>
              <li>Create order if all conditions met</li>
            </ul>
          </div>
        );
      case "workflow_log":
        return (
          <div className="space-y-2 text-gray-300 text-sm">
            <p>• Saves complete signal history to database</p>
            <p>• Records all signals, decisions, and metadata</p>
            <p>• Provides transparent audit trail</p>
            <p>• Used for performance analysis and debugging</p>
          </div>
        );
      default:
        return null;
    }
  };

  const RiskScoreDiagram: React.FC = () => {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-xl font-semibold text-white mb-6 text-center">
          Risk Score Calculation
        </h3>
        <div className="space-y-6">
          {/* Risk Components */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-red-400" />
                <span className="text-white font-semibold">Volatility</span>
              </div>
              <div className="text-2xl font-bold text-red-400 mb-1">30%</div>
              <p className="text-xs text-gray-400">Price volatility measure</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <BarChart className="w-5 h-5 text-orange-400" />
                <span className="text-white font-semibold">Concentration</span>
              </div>
              <div className="text-2xl font-bold text-orange-400 mb-1">20%</div>
              <p className="text-xs text-gray-400">Portfolio concentration</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-yellow-400" />
                <span className="text-white font-semibold">Drawdown</span>
              </div>
              <div className="text-2xl font-bold text-yellow-400 mb-1">25%</div>
              <p className="text-xs text-gray-400">Maximum drawdown</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-blue-400" />
                <span className="text-white font-semibold">Position Size</span>
              </div>
              <div className="text-2xl font-bold text-blue-400 mb-1">25%</div>
              <p className="text-xs text-gray-400">Position size impact</p>
            </div>
          </div>

          {/* Risk Formula */}
          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <h4 className="text-white font-semibold mb-3">
              Risk Score Formula
            </h4>
            <div className="bg-gray-900 rounded p-3 font-mono text-sm text-green-400">
              Risk Score = (Volatility × 0.30) + (Concentration × 0.20) +
              (Drawdown × 0.25) + (Position Size × 0.25)
            </div>
          </div>

          {/* Risk Levels */}
          <div className="space-y-3">
            <h4 className="text-white font-semibold">Risk-Based Actions</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <div className="flex-1">
                  <span className="text-white font-semibold">
                    Risk &gt; 80:
                  </span>
                  <span className="text-gray-300 ml-2">
                    Force HOLD (Safety Override)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-yellow-900/20 border border-yellow-500/50 rounded-lg">
                <Shield className="w-5 h-5 text-yellow-400" />
                <div className="flex-1">
                  <span className="text-white font-semibold">Risk 60-80:</span>
                  <span className="text-gray-300 ml-2">
                    Reduce position size by 50%
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-500/50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <div className="flex-1">
                  <span className="text-white font-semibold">
                    Risk &lt; 30:
                  </span>
                  <span className="text-gray-300 ml-2">
                    Can increase position size by up to 20%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AggregationMethodsDiagram: React.FC = () => {
    return (
      <div className="space-y-6">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="text-xl font-semibold text-white mb-6">
            Aggregation Methods Explained
          </h3>

          {/* Weighted Average */}
          <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/50 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <BarChart className="w-6 h-6 text-blue-400" />
              <h4 className="text-lg font-semibold text-white">
                Weighted Average
              </h4>
            </div>
            <p className="text-gray-300 mb-3">
              Combines signals using weighted average with risk adjustment
            </p>
            <div className="bg-gray-900 rounded p-3 font-mono text-sm text-green-400 mb-3">
              Final Signal = Σ(signal_i × weight_i × risk_adjustment) /
              Σ(weight_i)
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              <p>• Each signal source has a configurable weight</p>
              <p>
                • Risk adjustment factor reduces confidence when risk is high
              </p>
              <p>• Best for: Balanced approach with multiple signal sources</p>
            </div>
          </div>

          {/* Ensemble Voting */}
          <div className="mb-6 p-4 bg-purple-900/20 border border-purple-500/50 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-6 h-6 text-purple-400" />
              <h4 className="text-lg font-semibold text-white">
                Ensemble Voting
              </h4>
            </div>
            <p className="text-gray-300 mb-3">
              Majority vote from all signals, but risk can override
            </p>
            <div className="bg-gray-900 rounded p-3 font-mono text-sm text-green-400 mb-3">
              Decision = Majority Vote, Risk Override if risk_score &gt; 80
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              <p>• Each signal source votes (BUY, SELL, or HOLD)</p>
              <p>• Majority vote wins</p>
              <p>• If risk score exceeds threshold, force HOLD</p>
              <p>• Best for: When you want democratic decision-making</p>
            </div>
          </div>

          {/* Threshold Based */}
          <div className="mb-6 p-4 bg-orange-900/20 border border-orange-500/50 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <Target className="w-6 h-6 text-orange-400" />
              <h4 className="text-lg font-semibold text-white">
                Threshold Based
              </h4>
            </div>
            <p className="text-gray-300 mb-3">
              All signals must exceed thresholds AND risk must be below
              threshold
            </p>
            <div className="bg-gray-900 rounded p-3 font-mono text-sm text-green-400 mb-3">
              Decision = All signals &gt; threshold AND risk_score &lt;
              risk_threshold
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              <p>• Conservative approach - requires strong signals</p>
              <p>• All signal sources must agree (exceed thresholds)</p>
              <p>• Risk must be below configured threshold</p>
              <p>
                • Best for: Conservative trading with high confidence
                requirements
              </p>
            </div>
          </div>

          {/* Custom Rules */}
          <div className="p-4 bg-gray-900/20 border border-gray-500/50 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <Code className="w-6 h-6 text-gray-400" />
              <h4 className="text-lg font-semibold text-white">Custom Rules</h4>
            </div>
            <p className="text-gray-300 mb-3">
              Define custom JSON rules with risk parameters
            </p>
            <div className="bg-gray-900 rounded p-3 font-mono text-xs text-green-400 mb-3">
              {`{
  "operator": "AND",
  "conditions": [
    {"signal": "ml", "operator": ">", "value": 0.7},
    {"signal": "risk", "operator": "<", "value": 50}
  ]
}`}
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              <p>• Full control over decision logic</p>
              <p>• Define complex conditions with AND/OR operators</p>
              <p>• Can combine multiple signal sources with custom logic</p>
              <p>• Best for: Advanced users with specific trading strategies</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 p-4">
        <h2 className="text-xl font-bold text-white mb-4">Documentation</h2>
        <nav className="space-y-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeSection === section.id
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{section.title}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <button
          onClick={() => navigate("/trading-bots")}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Trading Bots
        </button>

        {activeSection === "overview" && (
          <div className="max-w-6xl space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-4">
                Trading Bot System Overview
              </h1>
              <p className="text-gray-400 text-lg">
                Complete guide to understanding how the trading bot system works
              </p>
            </div>

            {/* System Architecture Diagram */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-2xl font-semibold text-white mb-6">
                System Architecture
              </h2>
              <SignalFlowDiagram
                hoveredNode={hoveredSignalNode}
                setHoveredNode={setHoveredSignalNode}
              />
            </div>

            {/* Workflow Diagram */}
            <WorkflowDiagram
              workflowSteps={workflowSteps}
              activeStep={activeStep}
              setActiveStep={setActiveStep}
              hoveredNode={hoveredWorkflowNode}
              setHoveredNode={setHoveredWorkflowNode}
              getStepDetails={getStepDetails}
            />

            {/* Key Concepts */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-2xl font-semibold text-white mb-6">
                Key Concepts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    Real-Time Analysis
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Bot analyzes every new price entry (tick or daily data) to
                    make timely trading decisions.
                  </p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <GitMerge className="w-5 h-5 text-purple-400" />
                    Signal Aggregation
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Multiple signal sources are intelligently combined using
                    configurable aggregation methods.
                  </p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-yellow-400" />
                    Risk Management
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Comprehensive risk scoring adjusts signals and position
                    sizes to protect capital.
                  </p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-400" />
                    Transparency
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Every signal and decision is logged for complete audit trail
                    and performance analysis.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === "ml_models" && (
          <div className="max-w-4xl space-y-6">
            <h1 className="text-3xl font-bold text-white mb-4">
              Machine Learning Models
            </h1>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 space-y-4">
              <h2 className="text-xl font-semibold text-white">
                What are ML Models?
              </h2>
              <p className="text-gray-300">
                ML models analyze historical price data, indicators, and
                patterns to predict future stock movements. They can predict:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-400" />
                    Classification Models
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Predict discrete actions: <strong>BUY</strong>,{" "}
                    <strong>SELL</strong>, or <strong>HOLD</strong>
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    Output: Action + Confidence Score (0-1)
                  </p>
                </div>
                <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    Regression Models
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Predict continuous values: Potential <strong>gain</strong>{" "}
                    or <strong>loss</strong> amounts
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    Output: Expected P&L + Confidence Interval
                  </p>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mt-6">
                Model Registration
              </h3>
              <p className="text-gray-300 text-sm">
                Models are registered in the system with metadata:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4 text-sm">
                <li>Name, description, and version</li>
                <li>Model type (classification or regression)</li>
                <li>Framework (sklearn, PyTorch, TensorFlow, custom)</li>
                <li>Parameters and configuration</li>
                <li>Required input features</li>
              </ul>
              <h3 className="text-lg font-semibold text-white mt-4">
                Supported Frameworks
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["scikit-learn", "PyTorch", "TensorFlow", "Custom"].map(
                  (framework) => (
                    <div
                      key={framework}
                      className="bg-gray-700/50 rounded-lg p-3 text-center border border-gray-600"
                    >
                      <p className="text-white font-semibold text-sm">
                        {framework}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === "signal_sources" && (
          <div className="max-w-4xl space-y-6">
            <h1 className="text-3xl font-bold text-white mb-4">
              Signal Sources
            </h1>
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Brain className="w-6 h-6 text-blue-400" />
                  <h2 className="text-xl font-semibold text-white">
                    ML Models
                  </h2>
                </div>
                <p className="text-gray-300 mb-3">
                  ML models provide predictions with confidence scores and
                  potential gain/loss estimates.
                </p>
                <div className="bg-gray-700/50 rounded-lg p-3 text-sm text-gray-300">
                  <strong>Output:</strong> Action (buy/sell/hold), Confidence
                  (0-1), Expected Gain/Loss
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <MessageSquare className="w-6 h-6 text-green-400" />
                  <h2 className="text-xl font-semibold text-white">
                    Social Media
                  </h2>
                </div>
                <p className="text-gray-300 mb-3">
                  Analyzes sentiment from social platforms to gauge public
                  opinion about stocks.
                </p>
                <div className="bg-gray-700/50 rounded-lg p-3 text-sm text-gray-300">
                  <strong>Output:</strong> Sentiment Score (-1 to +1), Volume,
                  Recency
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Newspaper className="w-6 h-6 text-orange-400" />
                  <h2 className="text-xl font-semibold text-white">News</h2>
                </div>
                <p className="text-gray-300 mb-3">
                  Analyzes financial news for sentiment, relevance, and impact
                  on stock prices.
                </p>
                <div className="bg-gray-700/50 rounded-lg p-3 text-sm text-gray-300">
                  <strong>Output:</strong> Sentiment Score, Impact Score,
                  Relevance
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <LineChart className="w-6 h-6 text-cyan-400" />
                  <h2 className="text-xl font-semibold text-white">
                    Technical Indicators
                  </h2>
                </div>
                <p className="text-gray-300 mb-3">
                  Calculates various technical indicators (SMA, RSI, MACD, etc.)
                  to identify trends and momentum.
                </p>
                <div className="bg-gray-700/50 rounded-lg p-3 text-sm text-gray-300">
                  <strong>Output:</strong> Indicator values, Buy/Sell signals,
                  Signal strength
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Layers className="w-6 h-6 text-pink-400" />
                  <h2 className="text-xl font-semibold text-white">
                    Chart Patterns
                  </h2>
                </div>
                <p className="text-gray-300 mb-3">
                  Detects chart patterns (Head & Shoulders, Double Tops, Flags,
                  etc.) that historically indicate price movements.
                </p>
                <div className="bg-gray-700/50 rounded-lg p-3 text-sm text-gray-300">
                  <strong>Output:</strong> Pattern detected, Reliability score,
                  Expected direction
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === "aggregation" && (
          <div className="max-w-6xl space-y-6">
            <h1 className="text-3xl font-bold text-white mb-4">
              Signal Aggregation
            </h1>
            <AggregationMethodsDiagram />
          </div>
        )}

        {activeSection === "risk_management" && (
          <div className="max-w-6xl space-y-6">
            <h1 className="text-3xl font-bold text-white mb-4">
              Risk Management
            </h1>
            <RiskScoreDiagram />
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                Risk Adjustment Process
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-blue-400 font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">
                      Calculate Preliminary Risk Score
                    </h4>
                    <p className="text-gray-300 text-sm">
                      Risk score is calculated before position sizing based on
                      volatility, concentration, drawdown, and current position
                      size.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 border-2 border-purple-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-purple-400 font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">
                      Apply Risk Adjustment to Signals
                    </h4>
                    <p className="text-gray-300 text-sm">
                      Signal confidence is reduced by risk adjustment factor
                      when risk is high. Formula: adjusted_confidence =
                      confidence × (1 - risk_score × risk_adjustment_factor /
                      100)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-green-400 font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">
                      Check Risk Override Conditions
                    </h4>
                    <p className="text-gray-300 text-sm">
                      If risk score exceeds threshold (default 80), force HOLD
                      decision regardless of signal strength.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 border-2 border-yellow-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-yellow-400 font-bold">4</span>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">
                      Apply Risk-Based Position Scaling
                    </h4>
                    <p className="text-gray-300 text-sm">
                      If enabled, position size is automatically reduced when
                      risk is high (60-80: 50% reduction, &gt;80: no trade).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === "configuration" && (
          <div className="max-w-4xl space-y-6">
            <h1 className="text-3xl font-bold text-white mb-4">
              Bot Configuration Guide
            </h1>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 space-y-4">
              <h2 className="text-xl font-semibold text-white">
                Step-by-Step Configuration
              </h2>
              <ol className="list-decimal list-inside space-y-4 text-gray-300 ml-4">
                <li>
                  <strong className="text-white">Set Basic Information:</strong>{" "}
                  Name, budget type (cash or portfolio), assigned stocks
                </li>
                <li>
                  <strong className="text-white">
                    Configure Risk Management:
                  </strong>{" "}
                  Risk per trade, stop loss, take profit, max position size, max
                  daily trades, max daily loss
                </li>
                <li>
                  <strong className="text-white">Select ML Models:</strong>{" "}
                  Choose enabled models and assign weights to each model
                </li>
                <li>
                  <strong className="text-white">Enable Signal Sources:</strong>{" "}
                  Toggle social media and news analysis, configure signal
                  weights
                </li>
                <li>
                  <strong className="text-white">
                    Select Indicators & Patterns:
                  </strong>{" "}
                  Choose which technical indicators and chart patterns to use
                </li>
                <li>
                  <strong className="text-white">Configure Aggregation:</strong>{" "}
                  Select aggregation method and configure signal weights for
                  each source
                </li>
                <li>
                  <strong className="text-white">Set Trading Rules:</strong>{" "}
                  Define buy/sell conditions using JSON rules (optional,
                  advanced)
                </li>
                <li>
                  <strong className="text-white">
                    Configure Enhanced Risk:
                  </strong>{" "}
                  Set risk score threshold, risk adjustment factor, enable
                  risk-based position scaling
                </li>
              </ol>
              <h3 className="text-lg font-semibold text-white mt-6">
                Configuration Templates
              </h3>
              <p className="text-gray-300">
                Use pre-configured templates (Conservative, Aggressive,
                Balanced) as starting points for your bot configuration. These
                templates provide sensible defaults that you can customize.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BotSystemDocumentation;
