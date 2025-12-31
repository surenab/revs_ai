import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Info, Search, ChevronDown, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  simulationAPI,
  stockAPI,
  type Stock,
  type SimulationCreateRequest,
  type BotSimulationRun,
} from "../../lib/api";
import { InfoTooltip } from "../bots/InfoTooltip";

interface BotSimulationFormProps {
  mode: "create" | "edit";
  simulationId?: string;
  initialSimulation?: BotSimulationRun | null;
  onCancel?: () => void;
}

const BotSimulationForm: React.FC<BotSimulationFormProps> = ({
  mode,
  simulationId,
  initialSimulation,
  onCancel,
}) => {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSimulation, setIsLoadingSimulation] = useState(
    mode === "edit"
  );
  const [stockSearchTerm, setStockSearchTerm] = useState<string>("");

  // Testing period (execution dates)
  const [testingStartDate, setTestingStartDate] = useState<string>("");
  const [testingEndDate, setTestingEndDate] = useState<string>("");

  // Simulation type and initial state
  const [simulationType, setSimulationType] = useState<"fund" | "portfolio">(
    "fund"
  );
  const [initialFund, setInitialFund] = useState<string>("10000.00");
  const [initialPortfolio, setInitialPortfolio] = useState<
    Array<{ symbol: string; quantity: string }>
  >([]);
  const [newPortfolioSymbol, setNewPortfolioSymbol] = useState<string>("");
  const [newPortfolioQuantity, setNewPortfolioQuantity] = useState<string>("");

  const [enableMLWeights, setEnableMLWeights] = useState(false);
  const [enableSocialWeights, setEnableSocialWeights] = useState(false);
  const [enableNewsWeights, setEnableNewsWeights] = useState(false);

  // Store raw input values for signal weights to allow free typing
  const [indicatorWeightsInput, setIndicatorWeightsInput] =
    useState<string>("0.2, 0.3, 0.4");
  const [patternWeightsInput, setPatternWeightsInput] =
    useState<string>("0.1, 0.15, 0.2");

  // Store raw input values for persistence value to allow free typing
  const [persistenceValueInput, setPersistenceValueInput] =
    useState<string>("");

  // Persistence type dropdown state
  const [isPersistenceTypeOpen, setIsPersistenceTypeOpen] = useState(false);
  const persistenceTypeDropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<SimulationCreateRequest>({
    name: "",
    stock_ids: [],
    config_ranges: {
      // Signal weights
      signal_weights: {
        indicator: [0.2, 0.3, 0.4],
        pattern: [0.1, 0.15, 0.2],
      },
      // Risk parameters
      risk_score_threshold: [80],
      period_days: [14],
      stop_loss_percent: [3.0],
      take_profit_percent: [10.0],
      // Aggregation
      signal_aggregation_method: ["weighted_average"],
      // Signal persistence
      signal_persistence_type: ["tick_count", "time_duration"],
      signal_persistence_value: [3, 5, 10],
      // Stock assignment
      assigned_stocks_option: ["single_random"],
      // ML models (will be populated from available models)
      ml_model_ids: [[]],
    },
  });

  useEffect(() => {
    if (mode === "edit" && simulationId) {
      loadSimulation();
    } else if (mode === "create") {
      // Set default testing dates (last month)
      const today = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(today.getMonth() - 1);
      setTestingEndDate(today.toISOString().split("T")[0]);
      setTestingStartDate(oneMonthAgo.toISOString().split("T")[0]);
    }
    loadStocks();
  }, [mode, simulationId]);

  // Initialize form from initialSimulation if provided
  useEffect(() => {
    if (initialSimulation && mode === "edit") {
      populateFormFromSimulation(initialSimulation);
    }
  }, [initialSimulation, mode]);

  // Initialize persistence value input from formData on mount
  useEffect(() => {
    if (formData.config_ranges.signal_persistence_value) {
      const formatted = formData.config_ranges.signal_persistence_value
        .map((v) => (v === null ? "null" : v.toString()))
        .join(", ");
      setPersistenceValueInput(formatted);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle click outside for persistence type dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        persistenceTypeDropdownRef.current &&
        !persistenceTypeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsPersistenceTypeOpen(false);
      }
    };

    if (isPersistenceTypeOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPersistenceTypeOpen]);

  const populateFormFromSimulation = (sim: BotSimulationRun) => {
    // Only allow editing if simulation is pending or failed
    if (sim.status !== "pending" && sim.status !== "failed") {
      toast.error("Can only edit simulations that are pending or failed");
      if (simulationId) {
        navigate(`/simulations/${simulationId}`);
      } else {
        navigate("/simulations");
      }
      return;
    }

    // Populate form with existing data
    setFormData({
      name: sim.name,
      stock_ids: sim.stocks?.map((s: any) => s.id) || [],
      config_ranges: sim.config_ranges || formData.config_ranges,
    });

    setSelectedStocks(sim.stocks?.map((s: any) => s.id) || []);

    if (sim.execution_start_date) {
      setTestingStartDate(sim.execution_start_date);
    }
    if (sim.execution_end_date) {
      setTestingEndDate(sim.execution_end_date);
    }

    // Set simulation type and initial state
    if (sim.simulation_type) {
      setSimulationType(sim.simulation_type);
    }
    if (sim.initial_fund !== undefined) {
      setInitialFund(sim.initial_fund.toString());
    }
    if (sim.initial_portfolio) {
      const portfolioArray = Object.entries(sim.initial_portfolio).map(
        ([symbol, quantity]) => ({
          symbol,
          quantity: quantity.toString(),
        })
      );
      setInitialPortfolio(portfolioArray);
    }

    // Set feature flags based on config
    const config = sim.config_ranges || {};
    if (config.signal_weights?.ml) {
      setEnableMLWeights(true);
    }
    if (config.signal_weights?.social_media) {
      setEnableSocialWeights(true);
    }
    if (config.signal_weights?.news) {
      setEnableNewsWeights(true);
    }

    // Set indicator and pattern weights input
    if (config.signal_weights?.indicator) {
      setIndicatorWeightsInput(
        formatFloatArray(config.signal_weights.indicator)
      );
    }
    if (config.signal_weights?.pattern) {
      setPatternWeightsInput(formatFloatArray(config.signal_weights.pattern));
    }

    // Set persistence value input (type is handled by checkboxes)
    if (config.signal_persistence_value) {
      setPersistenceValueInput(
        config.signal_persistence_value
          .map((v) => (v === null ? "null" : v.toString()))
          .join(", ") || ""
      );
    }
  };

  const loadSimulation = async () => {
    if (!simulationId) return;
    try {
      setIsLoadingSimulation(true);
      const response = await simulationAPI.getSimulation(simulationId);
      populateFormFromSimulation(response.data);
    } catch (error) {
      toast.error("Failed to load simulation");
      navigate("/simulations");
    } finally {
      setIsLoadingSimulation(false);
    }
  };

  const loadStocks = async () => {
    try {
      const response = await stockAPI.getAllStocks();
      const stocksData = Array.isArray(response.data) ? response.data : [];
      setStocks(stocksData);
    } catch (error) {
      console.error("Error loading stocks:", error);
      toast.error("Failed to load stocks");
    }
  };

  const updateConfigRange = (path: string[], value: any) => {
    setFormData((prev) => {
      const newConfig = { ...prev.config_ranges };
      let current: any = newConfig;
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {};
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return { ...prev, config_ranges: newConfig };
    });
  };

  // Helper function to parse float values from comma-separated string
  const parseFloatArray = (value: string): number[] => {
    return value
      .split(",")
      .map((v) => {
        const trimmed = v.trim();
        if (trimmed === "") return NaN;
        const parsed = parseFloat(trimmed);
        return isNaN(parsed) ? NaN : parsed;
      })
      .filter((v) => !isNaN(v));
  };

  // Helper function to format float array for display
  const formatFloatArray = (arr: number[] | undefined): string => {
    if (!arr || arr.length === 0) return "";
    return arr
      .map((v) => (typeof v === "number" ? v.toString() : String(v)))
      .join(", ");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStocks.length === 0) {
      toast.error("Please select at least one stock");
      return;
    }
    if (!testingStartDate || !testingEndDate) {
      toast.error("Please select testing start and end dates");
      return;
    }
    if (testingStartDate > testingEndDate) {
      toast.error("Testing start date must be before testing end date");
      return;
    }

    // Validate signal weights - ensure at least one weight type is provided
    const signalWeights = formData.config_ranges.signal_weights || {};
    const hasSignalWeights =
      Object.keys(signalWeights).length > 0 &&
      Object.values(signalWeights).some(
        (weights: any) => Array.isArray(weights) && weights.length > 0
      );

    if (!hasSignalWeights) {
      toast.error(
        "Please provide at least one signal weight (ML, Indicator, or Pattern)"
      );
      return;
    }

    // Ensure signal weights have valid values and sync feature flags
    const cleanedConfigRanges = { ...formData.config_ranges };
    if (cleanedConfigRanges.signal_weights) {
      Object.keys(cleanedConfigRanges.signal_weights).forEach((key) => {
        const weights = cleanedConfigRanges.signal_weights[key];
        if (!Array.isArray(weights) || weights.length === 0) {
          delete cleanedConfigRanges.signal_weights[key];
        }
      });

      // Sync feature flags with weights - only include if weights exist
      if (!cleanedConfigRanges.signal_weights.social_media) {
        delete cleanedConfigRanges.use_social_analysis;
      } else if (!cleanedConfigRanges.use_social_analysis) {
        cleanedConfigRanges.use_social_analysis = [true];
      }

      if (!cleanedConfigRanges.signal_weights.news) {
        delete cleanedConfigRanges.use_news_analysis;
      } else if (!cleanedConfigRanges.use_news_analysis) {
        cleanedConfigRanges.use_news_analysis = [true];
      }
    } else {
      // If no signal weights, remove feature flags
      delete cleanedConfigRanges.use_social_analysis;
      delete cleanedConfigRanges.use_news_analysis;
    }

    // Prepare initial portfolio for portfolio-based simulations
    let initialPortfolioData: Record<string, number> = {};
    if (simulationType === "portfolio") {
      initialPortfolioData = initialPortfolio.reduce((acc, item) => {
        const quantity = parseFloat(item.quantity);
        if (item.symbol && !isNaN(quantity) && quantity > 0) {
          acc[item.symbol.toUpperCase()] = quantity;
        }
        return acc;
      }, {} as Record<string, number>);

      if (Object.keys(initialPortfolioData).length === 0) {
        toast.error(
          "Please add at least one stock position for portfolio-based simulation"
        );
        return;
      }
    }

    try {
      setIsLoading(true);
      if (mode === "create") {
        const response = await simulationAPI.createSimulation({
          ...formData,
          config_ranges: cleanedConfigRanges,
          stock_ids: selectedStocks,
          execution_start_date: testingStartDate,
          execution_end_date: testingEndDate,
          simulation_type: simulationType,
          initial_fund: parseFloat(initialFund) || 10000.0,
          initial_portfolio: initialPortfolioData,
        });
        toast.success("Simulation created successfully");
        navigate(`/simulations/${response.data.id}`);
      } else if (mode === "edit" && simulationId) {
        const response = await simulationAPI.updateSimulation(simulationId, {
          ...formData,
          config_ranges: cleanedConfigRanges,
          stock_ids: selectedStocks,
          execution_start_date: testingStartDate,
          execution_end_date: testingEndDate,
          simulation_type: simulationType,
          initial_fund: parseFloat(initialFund) || 10000.0,
          initial_portfolio: initialPortfolioData,
        });
        toast.success("Simulation updated successfully");
        navigate(`/simulations/${simulationId}`);
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          (mode === "create"
            ? "Failed to create simulation"
            : "Failed to update simulation")
      );
      console.error(
        `Error ${mode === "create" ? "creating" : "updating"} simulation:`,
        error
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize indicator and pattern weights input from formData
  useEffect(() => {
    if (formData.config_ranges.signal_weights?.indicator) {
      setIndicatorWeightsInput(
        formatFloatArray(formData.config_ranges.signal_weights.indicator)
      );
    }
    if (formData.config_ranges.signal_weights?.pattern) {
      setPatternWeightsInput(
        formatFloatArray(formData.config_ranges.signal_weights.pattern)
      );
    }
  }, []);

  if (isLoadingSimulation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading simulation...</div>
      </div>
    );
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else if (mode === "edit" && simulationId) {
      navigate(`/simulations/${simulationId}`);
    } else {
      navigate("/simulations");
    }
  };

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          {mode === "edit" ? "Back to Simulation" : "Back to Simulations"}
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card hover:bg-white/15 transition-all duration-300"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {mode === "edit" ? "Edit Simulation" : "Create Simulation"}
          </h1>
          <p className="text-white/70 mb-6 text-sm sm:text-base">
            {mode === "edit"
              ? "Update simulation configuration. Only pending or failed simulations can be edited."
              : "Configure parameters for multi-bot trading simulation. Specify the testing period when bots should execute trades, and configure bot parameter ranges."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                <span>Simulation Name</span>
                <InfoTooltip text="A descriptive name for this simulation run" />
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="input-field"
                placeholder="e.g., Q1 2024 Multi-Bot Test"
                required
              />
            </div>

            {/* Simulation Type */}
            <div className="border border-white/20 rounded-lg p-4 bg-white/10 backdrop-blur-sm/10">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                Simulation Type
                <InfoTooltip text="Choose between fund-based (starts with cash) or portfolio-based (starts with existing stock positions) simulation." />
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="radio"
                      name="simulationType"
                      value="fund"
                      checked={simulationType === "fund"}
                      onChange={(e) =>
                        setSimulationType(
                          e.target.value as "fund" | "portfolio"
                        )
                      }
                      className="w-4 h-4 text-blue-500"
                    />
                    <span className="text-sm font-medium text-white/90">
                      Fund Based
                    </span>
                    <InfoTooltip text="Simulation starts with a cash fund. Bot will buy stocks using available cash." />
                  </label>
                  {simulationType === "fund" && (
                    <div className="ml-6 mt-2">
                      <label className="block text-sm font-medium text-white/90 mb-1">
                        Initial Fund ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={initialFund}
                        onChange={(e) => setInitialFund(e.target.value)}
                        className="input-field"
                        placeholder="10000.00"
                      />
                      <p className="text-xs text-white/60 mt-1">
                        Starting cash amount for the simulation
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="radio"
                      name="simulationType"
                      value="portfolio"
                      checked={simulationType === "portfolio"}
                      onChange={(e) =>
                        setSimulationType(
                          e.target.value as "fund" | "portfolio"
                        )
                      }
                      className="w-4 h-4 text-blue-500"
                    />
                    <span className="text-sm font-medium text-white/90">
                      Portfolio Based
                    </span>
                    <InfoTooltip text="Simulation starts with existing stock positions. Bot will trade based on the initial portfolio." />
                  </label>
                  {simulationType === "portfolio" && (
                    <div className="ml-6 mt-2 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-white/90 mb-1">
                          Initial Portfolio Positions
                        </label>
                        <p className="text-xs text-white/70 mb-2">
                          Add stock symbols and quantities you already own
                        </p>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={newPortfolioSymbol}
                            onChange={(e) =>
                              setNewPortfolioSymbol(
                                e.target.value.toUpperCase()
                              )
                            }
                            className="input-field flex-1"
                            placeholder="Symbol (e.g., AAPL)"
                            maxLength={10}
                          />
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={newPortfolioQuantity}
                            onChange={(e) =>
                              setNewPortfolioQuantity(e.target.value)
                            }
                            className="input-field w-32"
                            placeholder="Quantity"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                newPortfolioSymbol &&
                                newPortfolioQuantity &&
                                parseFloat(newPortfolioQuantity) > 0
                              ) {
                                setInitialPortfolio([
                                  ...initialPortfolio,
                                  {
                                    symbol: newPortfolioSymbol,
                                    quantity: newPortfolioQuantity,
                                  },
                                ]);
                                setNewPortfolioSymbol("");
                                setNewPortfolioQuantity("");
                              }
                            }}
                            className="btn-secondary px-4"
                          >
                            Add
                          </button>
                        </div>
                        {initialPortfolio.length > 0 && (
                          <div className="border border-white/20 rounded-lg p-3 bg-white/5 max-h-40 overflow-y-auto">
                            {initialPortfolio.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between py-1"
                              >
                                <span className="text-sm text-white">
                                  {item.symbol}: {item.quantity} shares
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInitialPortfolio(
                                      initialPortfolio.filter(
                                        (_, i) => i !== idx
                                      )
                                    );
                                  }}
                                  className="text-red-400 hover:text-red-300 text-sm"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-white/60">
                          {initialPortfolio.length > 0
                            ? `${initialPortfolio.length} position(s) added`
                            : "No positions added yet"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Testing Period */}
            <div className="border border-white/20 rounded-lg p-4 bg-white/10 backdrop-blur-sm/10">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                Testing Period
                <InfoTooltip text="The period when the bot will execute trades. Bot will NOT run before testing_start_date. Each day in this period starts fresh with initial cash, and daily profit is calculated as (end of day total assets) - (start of day initial fund)." />
              </h3>
              <p className="text-xs text-white/70 mb-4">
                Specify when the bot should start and stop executing trades. The
                bot will use historical data before the testing period for
                analysis context, but will only execute trades during this
                period.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2 flex items-center gap-2">
                    Testing Start Date
                    <InfoTooltip text="The first date when the bot should start executing trades. Bot will NOT run before this date." />
                  </label>
                  <input
                    type="date"
                    value={testingStartDate}
                    onChange={(e) => setTestingStartDate(e.target.value)}
                    className="input-field"
                    required
                  />
                  <p className="text-xs text-white/60 mt-1">
                    Bot starts executing from this date
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2 flex items-center gap-2">
                    Testing End Date
                    <InfoTooltip text="The last date when the bot should execute trades." />
                  </label>
                  <input
                    type="date"
                    value={testingEndDate}
                    onChange={(e) => setTestingEndDate(e.target.value)}
                    min={testingStartDate}
                    className="input-field"
                    required
                  />
                  <p className="text-xs text-white/60 mt-1">
                    Bot stops executing after this date
                  </p>
                </div>
              </div>
            </div>

            {/* Stock Selection */}
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Select Stocks
                <InfoTooltip text="Choose stocks to include in the simulation. The system will create bot configurations for these stocks." />
              </label>

              <div className="mb-3 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
                <input
                  type="text"
                  placeholder="Search by symbol or company name..."
                  value={stockSearchTerm}
                  onChange={(e) => setStockSearchTerm(e.target.value)}
                  className="input-field pl-10"
                />
              </div>

              <div className="border border-white/20 rounded-lg p-4 max-h-64 overflow-y-auto bg-white/10 backdrop-blur-sm">
                {stocks.length === 0 ? (
                  <p className="text-white/60 text-sm">Loading stocks...</p>
                ) : (
                  (() => {
                    const filteredStocks = stocks.filter((stock) => {
                      if (!stockSearchTerm) return true;
                      const searchLower = stockSearchTerm.toLowerCase();
                      return (
                        stock.symbol.toLowerCase().includes(searchLower) ||
                        (stock.name &&
                          stock.name.toLowerCase().includes(searchLower))
                      );
                    });

                    if (filteredStocks.length === 0) {
                      return (
                        <p className="text-white/60 text-sm">
                          No stocks found matching "{stockSearchTerm}"
                        </p>
                      );
                    }

                    return filteredStocks.map((stock) => (
                      <label
                        key={stock.id}
                        className="flex items-center gap-3 p-2 hover:bg-white/10 backdrop-blur-sm/10 cursor-pointer rounded transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStocks.includes(stock.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStocks([...selectedStocks, stock.id]);
                            } else {
                              setSelectedStocks(
                                selectedStocks.filter((id) => id !== stock.id)
                              );
                            }
                          }}
                          className="w-4 h-4 text-blue-500 rounded border-white/30 focus:ring-blue-500 bg-white/10"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-white block">
                            {stock.symbol}
                          </span>
                          {stock.name && (
                            <span className="text-xs text-white/70 block">
                              {stock.name}
                            </span>
                          )}
                        </div>
                      </label>
                    ));
                  })()
                )}
              </div>
              <p className="text-xs text-white/60 mt-1">
                {selectedStocks.length} stock(s) selected
              </p>
            </div>

            {/* Information about indicators and patterns */}
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                How Indicators and Patterns Are Used
              </h4>
              <div className="text-xs text-white/80 space-y-2">
                <p>
                  <strong className="text-white">Indicators:</strong> The system
                  automatically generates bot configurations using combinations
                  of indicator groups:
                </p>
                <ul className="list-disc list-inside ml-2 space-y-1 text-white/70">
                  <li>
                    <strong>Moving Averages</strong> (SMA, EMA, WMA, DEMA, TEMA,
                    TMA, HMA, McGinley, VWAP MA)
                  </li>
                  <li>
                    <strong>Bands & Channels</strong> (Bollinger, Keltner,
                    Donchian, Fractal)
                  </li>
                  <li>
                    <strong>Oscillators</strong> (RSI, ADX, CCI, MFI, MACD,
                    Williams %R, Momentum, PROC, Stochastic)
                  </li>
                  <li>
                    <strong>Trend Indicators</strong> (PSAR, Supertrend,
                    Alligator, Ichimoku)
                  </li>
                  <li>
                    <strong>Volatility</strong> (ATR, ATR Trailing)
                  </li>
                  <li>
                    <strong>Volume</strong> (VWAP, OBV)
                  </li>
                  <li>
                    <strong>Others</strong> (Linear Regression, Pivot Points)
                  </li>
                </ul>
                <p className="mt-2">
                  <strong className="text-white">Patterns:</strong> The system
                  uses combinations of pattern groups:
                </p>
                <ul className="list-disc list-inside ml-2 space-y-1 text-white/70">
                  <li>
                    <strong>Candlestick Patterns</strong> (14 patterns: Three
                    White Soldiers, Morning Star, Engulfing, etc.)
                  </li>
                  <li>
                    <strong>Chart Patterns</strong> (8 patterns: Head and
                    Shoulders, Double Top/Bottom, Flag, Pennant, Wedge, etc.)
                  </li>
                  <li>
                    <strong>Regime Detection Patterns</strong> (4 patterns:
                    Trending, Ranging, Volatile, Transition)
                  </li>
                </ul>
                <p className="mt-2 text-blue-300">
                  <strong>Combination Strategy:</strong> The system generates
                  all possible combinations of indicator groups (from 1 group to
                  all 7 groups) and pattern groups (from 1 group to all 3
                  groups). This creates comprehensive bot configurations testing
                  different indicator/pattern combinations.
                </p>
              </div>
            </div>

            {/* Stock Assignment Option */}
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2 flex items-center gap-2">
                Stock Assignment Strategy
                <InfoTooltip text="How stocks should be assigned to individual bots. 'Single Random' assigns one random stock per bot. 'All Available' assigns all selected stocks to each bot. 'Multiple Random' assigns 2-5 random stocks per bot." />
              </label>
              <select
                value={
                  formData.config_ranges.assigned_stocks_option?.[0] ||
                  "single_random"
                }
                onChange={(e) =>
                  updateConfigRange(
                    ["assigned_stocks_option"],
                    [e.target.value]
                  )
                }
                className="input-field"
              >
                <option value="single_random">
                  Single Random Stock per Bot
                </option>
                <option value="all_available">
                  All Selected Stocks per Bot
                </option>
                <option value="multiple_random">
                  Multiple Random Stocks per Bot (2-5)
                </option>
              </select>
            </div>

            {/* Signal Weights */}
            <div className="border border-white/20 rounded-lg p-4 bg-white/10 backdrop-blur-sm/10">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                Signal Weights
                <InfoTooltip text="Weight ranges for different signal types. The system will test all combinations. At least one weight type must be provided." />
              </h3>
              <p className="text-xs text-white/70 mb-4">
                ⚠️ Required: Provide at least one weight type (ML, Indicator, or
                Pattern). Weights determine how much each signal type
                contributes to the final trading decision.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={enableMLWeights}
                      onChange={(e) => {
                        setEnableMLWeights(e.target.checked);
                        if (e.target.checked) {
                          updateConfigRange(
                            ["signal_weights", "ml"],
                            [0.3, 0.4, 0.5]
                          );
                        } else {
                          setFormData((prev) => {
                            const newConfig = { ...prev.config_ranges };
                            if (newConfig.signal_weights) {
                              delete newConfig.signal_weights.ml;
                            }
                            return { ...prev, config_ranges: newConfig };
                          });
                        }
                      }}
                      className="w-4 h-4 text-blue-500 rounded border-white/30 focus:ring-blue-500 bg-white/10"
                    />
                    <span className="text-sm font-medium text-white/90 flex items-center gap-2">
                      Enable ML Model Weights
                      <InfoTooltip text="Enable ML model signal weights. When enabled, ML model signals will be included in the simulation with the specified weights." />
                    </span>
                  </label>
                  {enableMLWeights && (
                    <>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          formatFloatArray(
                            formData.config_ranges.signal_weights?.ml
                          ) || "0.3, 0.4, 0.5"
                        }
                        onChange={(e) => {
                          const parsed = parseFloatArray(e.target.value);
                          if (parsed.length > 0 || e.target.value === "") {
                            updateConfigRange(["signal_weights", "ml"], parsed);
                          }
                        }}
                        placeholder="0.3, 0.4, 0.5"
                        className="input-field"
                      />
                      <p className="text-xs text-white/60 mt-1">
                        Comma-separated decimal values (e.g., 0.3, 0.4, 0.5)
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1 flex items-center gap-2">
                    Indicator Weights
                    <InfoTooltip text="Weight values for technical indicator signals (e.g., 0.2, 0.3, 0.4). Enter comma-separated values." />
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={indicatorWeightsInput}
                    onChange={(e) => {
                      setIndicatorWeightsInput(e.target.value);
                    }}
                    onBlur={(e) => {
                      const parsed = parseFloatArray(e.target.value);
                      if (parsed.length > 0 || e.target.value === "") {
                        updateConfigRange(
                          ["signal_weights", "indicator"],
                          parsed
                        );
                        setIndicatorWeightsInput(formatFloatArray(parsed));
                      } else {
                        setIndicatorWeightsInput(
                          formatFloatArray(
                            formData.config_ranges.signal_weights?.indicator
                          )
                        );
                      }
                    }}
                    placeholder="0.4, 0.5"
                    className="input-field"
                  />
                  <p className="text-xs text-white/60 mt-1">
                    Comma-separated decimal values (e.g., 0.4, 0.5)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1 flex items-center gap-2">
                    Pattern Weights
                    <InfoTooltip text="Weight values for pattern recognition signals (e.g., 0.1, 0.15, 0.2). Enter comma-separated values." />
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={patternWeightsInput}
                    onChange={(e) => {
                      setPatternWeightsInput(e.target.value);
                    }}
                    onBlur={(e) => {
                      const parsed = parseFloatArray(e.target.value);
                      if (parsed.length > 0 || e.target.value === "") {
                        updateConfigRange(
                          ["signal_weights", "pattern"],
                          parsed
                        );
                        setPatternWeightsInput(formatFloatArray(parsed));
                      } else {
                        setPatternWeightsInput(
                          formatFloatArray(
                            formData.config_ranges.signal_weights?.pattern
                          )
                        );
                      }
                    }}
                    placeholder="0.3"
                    className="input-field"
                  />
                  <p className="text-xs text-white/60 mt-1">
                    Comma-separated decimal values (e.g., 0.1, 0.15, 0.2)
                  </p>
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={enableSocialWeights}
                      onChange={(e) => {
                        setEnableSocialWeights(e.target.checked);
                        if (e.target.checked) {
                          updateConfigRange(
                            ["signal_weights", "social_media"],
                            [0.05, 0.1]
                          );
                          updateConfigRange(["use_social_analysis"], [true]);
                        } else {
                          setFormData((prev) => {
                            const newConfig = { ...prev.config_ranges };
                            if (newConfig.signal_weights) {
                              delete newConfig.signal_weights.social_media;
                            }
                            delete newConfig.use_social_analysis;
                            return { ...prev, config_ranges: newConfig };
                          });
                        }
                      }}
                      className="w-4 h-4 text-blue-500 rounded border-white/30 focus:ring-blue-500 bg-white/10"
                    />
                    <span className="text-sm font-medium text-white/90 flex items-center gap-2">
                      Enable Social Media Weights
                      <InfoTooltip text="Enable social media signal weights. When enabled, social media signals will be included in the simulation with the specified weights." />
                    </span>
                  </label>
                  {enableSocialWeights && (
                    <>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          formatFloatArray(
                            formData.config_ranges.signal_weights?.social_media
                          ) || "0.05, 0.1"
                        }
                        onChange={(e) => {
                          const parsed = parseFloatArray(e.target.value);
                          if (parsed.length > 0 || e.target.value === "") {
                            updateConfigRange(
                              ["signal_weights", "social_media"],
                              parsed
                            );
                          }
                        }}
                        placeholder="0.05, 0.1"
                        className="input-field"
                      />
                      <p className="text-xs text-white/60 mt-1">
                        Comma-separated decimal values (e.g., 0.05, 0.1)
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={enableNewsWeights}
                      onChange={(e) => {
                        setEnableNewsWeights(e.target.checked);
                        if (e.target.checked) {
                          updateConfigRange(
                            ["signal_weights", "news"],
                            [0.02, 0.05]
                          );
                          updateConfigRange(["use_news_analysis"], [true]);
                        } else {
                          setFormData((prev) => {
                            const newConfig = { ...prev.config_ranges };
                            if (newConfig.signal_weights) {
                              delete newConfig.signal_weights.news;
                            }
                            delete newConfig.use_news_analysis;
                            return { ...prev, config_ranges: newConfig };
                          });
                        }
                      }}
                      className="w-4 h-4 text-blue-500 rounded border-white/30 focus:ring-blue-500 bg-white/10"
                    />
                    <span className="text-sm font-medium text-white/90 flex items-center gap-2">
                      Enable News Weights
                      <InfoTooltip text="Enable news signal weights. When enabled, news signals will be included in the simulation with the specified weights." />
                    </span>
                  </label>
                  {enableNewsWeights && (
                    <>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          formatFloatArray(
                            formData.config_ranges.signal_weights?.news
                          ) || "0.02, 0.05"
                        }
                        onChange={(e) => {
                          const parsed = parseFloatArray(e.target.value);
                          if (parsed.length > 0 || e.target.value === "") {
                            updateConfigRange(
                              ["signal_weights", "news"],
                              parsed
                            );
                          }
                        }}
                        placeholder="0.02, 0.05"
                        className="input-field"
                      />
                      <p className="text-xs text-white/60 mt-1">
                        Comma-separated decimal values (e.g., 0.02, 0.05)
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Risk Parameters */}
            <div className="border border-white/20 rounded-lg p-4 bg-white/10 backdrop-blur-sm/10">
              <h3 className="text-lg font-semibold text-white mb-4">
                Risk Parameters
              </h3>
              <p className="text-xs text-white/70 mb-4">
                Optional: If not provided, default values will be used
                (risk_score_threshold: 80, period_days: 14).
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1 flex items-center gap-2">
                    Risk Score Threshold
                    <InfoTooltip text="Minimum risk score (0-100) required for trade execution. Enter comma-separated values to test multiple thresholds. If empty, default value of 80 will be used." />
                  </label>
                  <input
                    type="text"
                    value={
                      formData.config_ranges.risk_score_threshold?.join(", ") ||
                      ""
                    }
                    onChange={(e) =>
                      updateConfigRange(
                        ["risk_score_threshold"],
                        e.target.value
                          .split(",")
                          .map((v) => parseFloat(v.trim()))
                          .filter((v) => !isNaN(v))
                      )
                    }
                    placeholder="70, 80, 90"
                    className="input-field"
                  />
                  <p className="text-xs text-white/60 mt-1">
                    Default: 80 if empty
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1 flex items-center gap-2">
                    Period Days (Bot Configuration)
                    <InfoTooltip text="Number of days to look back for technical analysis. This is a period range for bot configurations - different bots will use different period values. Enter comma-separated values to test different periods (e.g., 14, 21, 30). If empty, default value of 14 days will be used." />
                  </label>
                  <input
                    type="text"
                    value={formData.config_ranges.period_days?.join(", ") || ""}
                    onChange={(e) =>
                      updateConfigRange(
                        ["period_days"],
                        e.target.value
                          .split(",")
                          .map((v) => parseInt(v.trim()))
                          .filter((v) => !isNaN(v))
                      )
                    }
                    placeholder="14, 21, 30"
                    className="input-field"
                  />
                  <p className="text-xs text-white/60 mt-1">
                    Period ranges for bot configurations. Default: 14 if empty
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1 flex items-center gap-2">
                    Stop Loss (%)
                    <InfoTooltip text="Stop loss percentage to limit losses. Enter comma-separated values (e.g., 1.0, 2.0). If empty, no stop loss will be set." />
                  </label>
                  <input
                    type="text"
                    value={
                      formData.config_ranges.stop_loss_percent?.join(", ") || ""
                    }
                    onChange={(e) =>
                      updateConfigRange(
                        ["stop_loss_percent"],
                        e.target.value
                          .split(",")
                          .map((v) => parseFloat(v.trim()))
                          .filter((v) => !isNaN(v))
                      )
                    }
                    placeholder="1.0, 2.0"
                    className="input-field"
                  />
                  <p className="text-xs text-white/60 mt-1">
                    Optional: Leave empty for no stop loss
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1 flex items-center gap-2">
                    Take Profit (%)
                    <InfoTooltip text="Take profit percentage to lock in gains. Enter comma-separated values (e.g., 3.0, 5.0). If empty, no take profit will be set." />
                  </label>
                  <input
                    type="text"
                    value={
                      formData.config_ranges.take_profit_percent?.join(", ") ||
                      ""
                    }
                    onChange={(e) =>
                      updateConfigRange(
                        ["take_profit_percent"],
                        e.target.value
                          .split(",")
                          .map((v) => parseFloat(v.trim()))
                          .filter((v) => !isNaN(v))
                      )
                    }
                    placeholder="3.0, 5.0"
                    className="input-field"
                  />
                  <p className="text-xs text-white/60 mt-1">
                    Optional: Leave empty for no take profit
                  </p>
                </div>
              </div>
            </div>

            {/* Signal Persistence Parameters */}
            <div className="border border-white/20 rounded-lg p-4 bg-white/10 backdrop-blur-sm/10">
              <h3 className="text-lg font-semibold text-white mb-4">
                Signal Persistence
              </h3>
              <p className="text-xs text-white/70 mb-4">
                Configure signal persistence: require N consecutive ticks or M
                minutes of consistent signals before execution.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1 flex items-center gap-2">
                    Persistence Type
                    <InfoTooltip text="Select one or more persistence types to test: 'tick_count' (N ticks), 'time_duration' (M minutes), or 'None' (disabled). The system will test all selected combinations." />
                  </label>
                  <div
                    className="relative w-full"
                    ref={persistenceTypeDropdownRef}
                  >
                    {/* Dropdown Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setIsPersistenceTypeOpen(!isPersistenceTypeOpen)
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between min-h-[50px]"
                    >
                      <div className="flex flex-wrap gap-1 flex-1 text-left">
                        {formData.config_ranges.signal_persistence_type &&
                        formData.config_ranges.signal_persistence_type.length >
                          0 ? (
                          formData.config_ranges.signal_persistence_type.map(
                            (v: string | null) => {
                              const label =
                                v === null
                                  ? "None"
                                  : v === "tick_count"
                                  ? "Tick Count"
                                  : "Time Duration";
                              return (
                                <span
                                  key={v === null ? "null" : v}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded"
                                >
                                  {label}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const currentTypes =
                                        formData.config_ranges
                                          .signal_persistence_type || [];
                                      const newTypes = currentTypes.filter(
                                        (t: string | null) => t !== v
                                      );
                                      updateConfigRange(
                                        ["signal_persistence_type"],
                                        newTypes
                                      );
                                    }}
                                    className="hover:bg-blue-700 rounded-full p-0.5"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              );
                            }
                          )
                        ) : (
                          <span className="text-gray-400">
                            Select persistence types...
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 ml-2 transition-transform ${
                          isPersistenceTypeOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                      {isPersistenceTypeOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto"
                        >
                          <div className="p-2 space-y-1">
                            {[
                              {
                                value: null,
                                label: "None (Disabled)",
                                description: "No persistence required",
                              },
                              {
                                value: "tick_count",
                                label: "Tick Count (N ticks)",
                                description: "Require N consecutive ticks",
                              },
                              {
                                value: "time_duration",
                                label: "Time Duration (M minutes)",
                                description:
                                  "Require M minutes of consistent signal",
                              },
                            ].map((option) => {
                              const currentTypes =
                                formData.config_ranges
                                  .signal_persistence_type || [];
                              const isChecked = currentTypes.includes(
                                option.value
                              );
                              return (
                                <label
                                  key={
                                    option.value === null
                                      ? "null"
                                      : option.value
                                  }
                                  className="flex items-start gap-2 p-2 hover:bg-gray-700 rounded cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const currentTypes =
                                        formData.config_ranges
                                          .signal_persistence_type || [];
                                      let newTypes: (string | null)[];
                                      if (e.target.checked) {
                                        newTypes = [
                                          ...currentTypes,
                                          option.value,
                                        ];
                                      } else {
                                        newTypes = currentTypes.filter(
                                          (t: string | null) =>
                                            t !== option.value
                                        );
                                      }
                                      updateConfigRange(
                                        ["signal_persistence_type"],
                                        newTypes
                                      );
                                    }}
                                    className="mt-1 w-4 h-4 text-blue-500 rounded border-white/30 focus:ring-blue-500 bg-white/10"
                                  />
                                  <div className="flex-1">
                                    <span className="text-sm font-medium text-white/90 block">
                                      {option.label}
                                    </span>
                                    <span className="text-xs text-white/60 block mt-0.5">
                                      {option.description}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <p className="text-xs text-white/60 mt-1">
                    Select one or more options. All combinations will be tested
                    in the simulation.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1 flex items-center gap-2">
                    Persistence Value
                    <InfoTooltip text="Persistence value: N for tick count or M for minutes. Enter comma-separated values (e.g., 3, 5, 10). If empty, persistence will be disabled." />
                  </label>
                  <input
                    type="text"
                    value={persistenceValueInput}
                    onChange={(e) => {
                      setPersistenceValueInput(e.target.value);
                    }}
                    onBlur={(e) => {
                      const parsed = e.target.value
                        .split(",")
                        .map((v) => {
                          const trimmed = v.trim();
                          if (trimmed === "null" || trimmed === "") {
                            return null;
                          }
                          const parsed = parseInt(trimmed, 10);
                          return isNaN(parsed) ? null : parsed;
                        })
                        .filter(
                          (v) => v === null || (typeof v === "number" && v > 0)
                        );
                      updateConfigRange(["signal_persistence_value"], parsed);
                      // Update input to show formatted value
                      setPersistenceValueInput(
                        parsed
                          .map((v) => (v === null ? "null" : v.toString()))
                          .join(", ") || ""
                      );
                    }}
                    placeholder="null, 3, 5, 10"
                    className="input-field"
                  />
                  <p className="text-xs text-white/60 mt-1">
                    N ticks or M minutes. Default: null (disabled) if empty
                  </p>
                </div>
              </div>
            </div>

            {/* Aggregation Method */}
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2 flex items-center gap-2">
                Signal Aggregation Method
                <InfoTooltip text="Method used to combine signals from different sources. Select one or both methods to test. If empty, default 'weighted_average' will be used." />
              </label>
              <p className="text-xs text-white/70 mb-2">
                Optional: If none selected, 'weighted_average' will be used by
                default.
              </p>
              <div className="space-y-2">
                {["weighted_average", "ensemble_voting"].map((method) => (
                  <label
                    key={method}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={
                        formData.config_ranges.signal_aggregation_method?.includes(
                          method
                        ) || false
                      }
                      onChange={(e) => {
                        const current =
                          formData.config_ranges.signal_aggregation_method ||
                          [];
                        if (e.target.checked) {
                          updateConfigRange(
                            ["signal_aggregation_method"],
                            [...current, method]
                          );
                        } else {
                          updateConfigRange(
                            ["signal_aggregation_method"],
                            current.filter((m: string) => m !== method)
                          );
                        }
                      }}
                      className="w-4 h-4 text-white/90"
                    />
                    <span className="text-sm capitalize text-white font-medium">
                      {method.replace("_", " ")}
                    </span>
                    <span className="text-xs text-white/70">
                      {method === "weighted_average"
                        ? "(combines signals by weighted sum)"
                        : "(uses voting mechanism)"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-4 pt-4 border-t border-white/20">
              <button
                type="button"
                onClick={handleCancel}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isLoading ||
                  selectedStocks.length === 0 ||
                  !testingStartDate ||
                  !testingEndDate
                }
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading
                  ? mode === "create"
                    ? "Creating..."
                    : "Updating..."
                  : mode === "create"
                  ? "Create Simulation"
                  : "Update Simulation"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default BotSimulationForm;
