import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Activity,
  XCircle,
  CheckCircle,
  Clock,
  Info,
  Play,
  Pause,
  Search,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  Edit,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  simulationAPI,
  type BotSimulationRun,
  type BotSimulationResult,
  type SimulationProgress,
} from "../../lib/api";
import { InfoTooltip } from "../../components/bots/InfoTooltip";
import SimulationFlowDiagram from "../../components/simulations/SimulationFlowDiagram";
import SimulationProgressComponent from "../../components/simulations/SimulationProgress";

const BotSimulationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [simulation, setSimulation] = useState<BotSimulationRun | null>(null);
  const [progress, setProgress] = useState<SimulationProgress | null>(null);
  const [results, setResults] = useState<BotSimulationResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "progress" | "results"
  >("overview");

  // Table state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<
    keyof BotSimulationResult | "bot_index"
  >("total_profit");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [profitFilter, setProfitFilter] = useState<{
    min: string;
    max: string;
  }>({ min: "", max: "" });
  const [winRateFilter, setWinRateFilter] = useState<{
    min: string;
    max: string;
  }>({ min: "", max: "" });
  const [tradesFilter, setTradesFilter] = useState<{
    min: string;
    max: string;
  }>({ min: "", max: "" });

  useEffect(() => {
    if (id) {
      loadSimulation();
    }
  }, [id]);

  // Load progress when simulation is running and poll every 5 seconds
  useEffect(() => {
    if (id && simulation?.status === "running") {
      loadProgress(); // Load immediately
      const interval = setInterval(loadProgress, 5000);
      return () => clearInterval(interval);
    }
  }, [id, simulation?.status]);

  // Load progress when switching to progress tab
  useEffect(() => {
    if (activeTab === "progress" && id) {
      loadProgress();
    }
  }, [activeTab, id]);

  // Load results when switching to results tab
  useEffect(() => {
    if (activeTab === "results" && id) {
      loadResults();
    }
  }, [activeTab, id]);

  const loadSimulation = async () => {
    if (!id) return;
    try {
      const response = await simulationAPI.getSimulation(id);
      setSimulation(response.data);
    } catch (error) {
      toast.error("Failed to load simulation");
    } finally {
      setIsLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!id) return;
    try {
      const response = await simulationAPI.getSimulationProgress(id);
      setProgress(response.data);
    } catch (error: any) {
      console.error("Failed to load progress:", error);
      // Set progress to null to show error state
      setProgress(null);
      // Only show toast if it's not a 404 (simulation might not have progress yet)
      if (error?.response?.status !== 404) {
        toast.error("Failed to load progress data");
      }
    }
  };

  const loadResults = async () => {
    if (!id) return;
    try {
      setIsLoadingResults(true);
      const response = await simulationAPI.getSimulationResults(id);
      // Handle response structure: { results: [...], simulation: {...}, ... }
      const resultsData: BotSimulationResult[] = response.data?.results || [];

      console.log(`Loaded ${resultsData.length} results for simulation ${id}`, {
        responseData: response.data,
        resultsCount: resultsData.length,
        resultsData: resultsData.slice(0, 3), // Log first 3 for debugging
      });
      setResults(resultsData);

      if (resultsData.length === 0) {
        console.warn(
          `No results found for simulation ${id}. Response:`,
          response.data
        );
      }
    } catch (error: any) {
      console.error("Failed to load results:", error);
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to load results";
      toast.error(errorMessage);
      setResults([]); // Set empty array on error
    } finally {
      setIsLoadingResults(false);
    }
  };

  // Filter and sort results
  const filteredAndSortedResults = useMemo(() => {
    let filtered = results;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((r) =>
        String(r.simulation_config.bot_index)
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      );
    }

    // Profit filter
    if (profitFilter.min || profitFilter.max) {
      filtered = filtered.filter((r) => {
        const profit = Number(r.total_profit) || 0;
        const min = profitFilter.min ? Number(profitFilter.min) : -Infinity;
        const max = profitFilter.max ? Number(profitFilter.max) : Infinity;
        return profit >= min && profit <= max;
      });
    }

    // Win rate filter
    if (winRateFilter.min || winRateFilter.max) {
      filtered = filtered.filter((r) => {
        const winRate = Number(r.win_rate) || 0;
        const min = winRateFilter.min ? Number(winRateFilter.min) : -Infinity;
        const max = winRateFilter.max ? Number(winRateFilter.max) : Infinity;
        return winRate >= min && winRate <= max;
      });
    }

    // Trades filter
    if (tradesFilter.min || tradesFilter.max) {
      filtered = filtered.filter((r) => {
        const trades = Number(r.total_trades) || 0;
        const min = tradesFilter.min ? Number(tradesFilter.min) : -Infinity;
        const max = tradesFilter.max ? Number(tradesFilter.max) : Infinity;
        return trades >= min && trades <= max;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      if (sortColumn === "bot_index") {
        aVal = a.simulation_config.bot_index;
        bVal = b.simulation_config.bot_index;
      } else {
        aVal = a[sortColumn as keyof BotSimulationResult] as number | string;
        bVal = b[sortColumn as keyof BotSimulationResult] as number | string;
      }

      // Handle null/undefined
      if (aVal == null) aVal = sortColumn === "bot_index" ? 0 : -Infinity;
      if (bVal == null) bVal = sortColumn === "bot_index" ? 0 : -Infinity;

      // Convert to numbers for comparison
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;

      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    });

    return filtered;
  }, [
    results,
    searchQuery,
    profitFilter,
    winRateFilter,
    tradesFilter,
    sortColumn,
    sortDirection,
  ]);

  useEffect(() => {
    // Load results and analysis when simulation is completed
    if (simulation?.status === "completed") {
      loadResults();
      loadAnalysis();
    } else if (simulation?.status && simulation.status !== "pending") {
      // Also load results for running/paused/failed simulations if they have results
      loadResults();
    }
  }, [simulation?.status]);

  const loadAnalysis = async () => {
    if (!id || simulation?.status !== "completed") return;
    setIsLoadingAnalysis(true);
    try {
      const response = await simulationAPI.getSimulationAnalysis(id);
      setAnalysis(response.data);
    } catch (error) {
      console.error("Failed to load analysis:", error);
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    try {
      await simulationAPI.cancelSimulation(id);
      toast.success("Simulation cancelled");
      loadSimulation();
    } catch (error) {
      toast.error("Failed to cancel simulation");
    }
  };

  const handlePause = async () => {
    if (!id) return;
    try {
      await simulationAPI.pauseSimulation(id);
      toast.success("Simulation paused");
      loadSimulation();
    } catch (error) {
      toast.error("Failed to pause simulation");
    }
  };

  const handleResume = async () => {
    if (!id) return;
    try {
      const response = await simulationAPI.resumeSimulation(id);
      const message =
        simulation?.status === "pending"
          ? "Simulation started"
          : response.data?.message || "Simulation resumed";
      toast.success(message);
      loadSimulation();
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Failed to start simulation";
      toast.error(errorMessage);
    }
  };

  const handleRerun = async () => {
    if (!id) return;
    try {
      const response = await simulationAPI.rerunSimulation(id);
      toast.success("Simulation rerun started");
      // Navigate to the new simulation
      if (response.data?.simulation?.id) {
        navigate(`/simulations/${response.data.simulation.id}`);
      } else {
        // Reload current page if navigation fails
        loadSimulation();
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Failed to rerun simulation";
      toast.error(errorMessage);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!simulation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/70">Simulation not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate("/simulations")}
          className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Simulations
        </button>

        {/* Header */}
        <div className="card mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {simulation.name}
              </h1>
              <p className="text-white/70 mt-1 text-sm">
                Simulation ID: {simulation.id}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(simulation.status === "pending" ||
                simulation.status === "failed") && (
                <button
                  onClick={() => navigate(`/simulations/${id}/edit`)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              )}
              {simulation.status === "pending" && (
                <button
                  onClick={handleResume}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Start
                </button>
              )}
              {simulation.status === "running" && (
                <>
                  <button
                    onClick={handlePause}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Stop
                  </button>
                </>
              )}
              {simulation.status === "paused" && (
                <>
                  <button
                    onClick={handleResume}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Resume
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Stop
                  </button>
                </>
              )}
              {(simulation.status === "completed" ||
                simulation.status === "failed") && (
                <button
                  onClick={handleRerun}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Rerun
                </button>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div className="mt-4 flex items-center gap-4">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                simulation.status === "completed"
                  ? "bg-green-500/20 text-green-300 border border-green-500/30"
                  : simulation.status === "running"
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  : simulation.status === "paused"
                  ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                  : simulation.status === "failed"
                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                  : "bg-white/20 text-white border border-white/20"
              }`}
            >
              {simulation.status}
            </span>
            <span className="text-sm text-white/70">
              Progress:{" "}
              {simulation.progress != null
                ? Number(simulation.progress).toFixed(1)
                : "0.0"}
              %
            </span>
            <span className="text-sm text-white/70">
              Bots: {simulation.bots_completed} / {simulation.total_bots}
            </span>
          </div>

          {/* Error Message Display */}
          {simulation.status === "failed" && simulation.error_message && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-300 mb-1">
                    Simulation Failed
                  </h3>
                  <p className="text-sm text-white/90 whitespace-pre-wrap">
                    {simulation.error_message}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="card mb-6">
          <div className="border-b border-white/20">
            <nav className="flex -mb-px">
              {["overview", "progress", "results"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-white/60 hover:text-white/80"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Flow Diagram */}
                <div>
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    Simulation Flow
                    <InfoTooltip text="Visual representation of how the simulation processes data: loads historical tick data for analysis context, executes trades during the testing period day-by-day, and calculates daily profit/loss" />
                  </h2>
                  <SimulationFlowDiagram
                    simulation={simulation}
                    hasResults={results.length > 0}
                  />
                </div>

                {/* Simulation Type and Initial State */}
                <div className="mb-6">
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 backdrop-blur-sm">
                    <h3 className="font-medium text-blue-300 mb-3 flex items-center gap-2">
                      Simulation Configuration
                      <InfoTooltip text="Initial state for the simulation: fund-based starts with cash, portfolio-based starts with existing stock positions." />
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/70">Type:</span>
                        <span className="text-sm font-semibold text-white capitalize">
                          {simulation.simulation_type === "portfolio"
                            ? "Portfolio Based"
                            : "Fund Based"}
                        </span>
                      </div>
                      {simulation.simulation_type === "fund" &&
                        simulation.initial_fund !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white/70">
                              Initial Fund:
                            </span>
                            <span className="text-sm font-semibold text-white">
                              $
                              {simulation.initial_fund.toLocaleString(
                                undefined,
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )}
                            </span>
                          </div>
                        )}
                      {simulation.simulation_type === "portfolio" &&
                        simulation.initial_portfolio && (
                          <div>
                            <span className="text-sm text-white/70 block mb-2">
                              Initial Portfolio:
                            </span>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {Object.entries(simulation.initial_portfolio).map(
                                ([symbol, quantity]) => (
                                  <div
                                    key={symbol}
                                    className="bg-white/5 rounded p-2"
                                  >
                                    <span className="text-sm font-semibold text-white">
                                      {symbol}:
                                    </span>
                                    <span className="text-sm text-white/80 ml-1">
                                      {quantity} shares
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                {/* Execution Period */}
                {(simulation.execution_start_date ||
                  simulation.execution_end_date) && (
                  <div className="mb-6">
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 backdrop-blur-sm">
                      <h3 className="font-medium text-purple-300 mb-2 flex items-center gap-2">
                        Bot Execution Period
                        <InfoTooltip text="The period when the bot actually executes trades. Bot does NOT run before execution_start_date. Each day starts fresh with initial cash, and daily profit is calculated as (end of day total assets) - (start of day initial fund)." />
                      </h3>
                      <p className="text-sm text-white/80">
                        Bot executes trades from{" "}
                        <span className="font-semibold">
                          {simulation.execution_start_date || "N/A"}
                        </span>{" "}
                        to{" "}
                        <span className="font-semibold">
                          {simulation.execution_end_date || "N/A"}
                        </span>
                      </p>
                      <p className="text-xs text-white/60 mt-2">
                        Daily execution mode: Each day starts with initial cash
                        and calculates daily profit/loss independently
                      </p>
                    </div>
                  </div>
                )}

                {/* Complete Simulation Details */}
                <div>
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    Simulation Details
                    <InfoTooltip text="Complete information about this simulation run including configuration, progress, and metadata" />
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Basic Information */}
                    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                      <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">
                        Basic Information
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/60">Simulation ID:</span>
                          <span className="text-white font-mono text-xs">
                            {simulation.id}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Name:</span>
                          <span className="text-white">{simulation.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Status:</span>
                          <span className="text-white capitalize">
                            {simulation.status}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">User:</span>
                          <span className="text-white">
                            {simulation.user_details?.email ||
                              simulation.user ||
                              "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Configuration */}
                    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                      <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">
                        Configuration
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/60">Total Bots:</span>
                          <span className="text-white">
                            {simulation.total_bots}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Stocks Count:</span>
                          <span className="text-white">
                            {simulation.stocks?.length || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">
                            Total Data Points:
                          </span>
                          <span className="text-white">
                            {simulation.total_data_points.toLocaleString()}
                          </span>
                        </div>
                        {simulation.training_data_points !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-white/60">
                              Training Data Points:
                            </span>
                            <span className="text-white">
                              {simulation.training_data_points?.toLocaleString() ||
                                0}
                            </span>
                          </div>
                        )}
                        {simulation.validation_data_points !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-white/60">
                              Validation Data Points:
                            </span>
                            <span className="text-white">
                              {simulation.validation_data_points?.toLocaleString() ||
                                0}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Information */}
                    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                      <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">
                        Progress
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/60">Progress:</span>
                          <span className="text-white">
                            {simulation.progress != null
                              ? Number(simulation.progress).toFixed(1)
                              : "0.0"}
                            %
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Bots Completed:</span>
                          <span className="text-white">
                            {simulation.bots_completed} /{" "}
                            {simulation.total_bots}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Current Day:</span>
                          <span className="text-white">
                            {simulation.current_day || "N/A"}
                          </span>
                        </div>
                        {simulation.bot_execution_times &&
                          Array.isArray(simulation.bot_execution_times) &&
                          simulation.bot_execution_times.length > 0 && (
                            <div className="flex justify-between">
                              <span className="text-white/60">
                                Avg Bot Time:
                              </span>
                              <span className="text-white">
                                {(
                                  simulation.bot_execution_times.reduce(
                                    (a: number, b: number) => a + b,
                                    0
                                  ) / simulation.bot_execution_times.length
                                ).toFixed(1)}{" "}
                                sec
                              </span>
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                      <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">
                        Timestamps
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/60">Created:</span>
                          <span className="text-white">
                            {simulation.created_at
                              ? new Date(simulation.created_at).toLocaleString()
                              : "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Started:</span>
                          <span className="text-white">
                            {simulation.started_at
                              ? new Date(simulation.started_at).toLocaleString()
                              : "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Completed:</span>
                          <span className="text-white">
                            {simulation.completed_at
                              ? new Date(
                                  simulation.completed_at
                                ).toLocaleString()
                              : "N/A"}
                          </span>
                        </div>
                        {simulation.started_at && simulation.completed_at && (
                          <div className="flex justify-between">
                            <span className="text-white/60">Duration:</span>
                            <span className="text-white">
                              {Math.round(
                                (new Date(simulation.completed_at).getTime() -
                                  new Date(simulation.started_at).getTime()) /
                                  1000 /
                                  60
                              )}{" "}
                              minutes
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stocks List */}
                    {simulation.stocks && simulation.stocks.length > 0 && (
                      <div className="bg-white/5 border border-white/20 rounded-lg p-4 md:col-span-2">
                        <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">
                          Stocks ({simulation.stocks.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {simulation.stocks.map((stock, idx) => {
                            // Handle both string (symbol) and object (with symbol/name) formats
                            let stockSymbol: string;
                            if (typeof stock === "string") {
                              stockSymbol = stock;
                            } else if (stock && typeof stock === "object") {
                              stockSymbol =
                                (stock as { symbol?: string }).symbol ||
                                (stock as { name?: string }).name ||
                                String(stock);
                            } else {
                              stockSymbol = String(stock);
                            }
                            return (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-300"
                              >
                                {stockSymbol}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Detailed Configuration Breakdown */}
                    {simulation.config_ranges &&
                      Object.keys(simulation.config_ranges).length > 0 && (
                        <div className="bg-white/5 border border-white/20 rounded-lg p-4 md:col-span-2">
                          <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">
                            Configuration Ranges
                          </h3>
                          <div className="space-y-4">
                            {/* Signal Weights */}
                            {simulation.config_ranges.signal_weights && (
                              <div>
                                <h4 className="text-xs font-semibold text-white/80 mb-2 uppercase">
                                  Signal Weights
                                </h4>
                                <div className="bg-black/20 p-3 rounded text-xs space-y-1">
                                  {Object.entries(
                                    simulation.config_ranges.signal_weights
                                  ).map(([key, value]) => (
                                    <div
                                      key={key}
                                      className="flex justify-between text-white/70"
                                    >
                                      <span className="capitalize">
                                        {key.replace(/_/g, " ")}:
                                      </span>
                                      <span className="text-white">
                                        {Array.isArray(value)
                                          ? value.join(", ")
                                          : String(value)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Risk Parameters */}
                            {(simulation.config_ranges.risk_score_threshold ||
                              simulation.config_ranges.risk_adjustment_factor ||
                              simulation.config_ranges
                                .risk_based_position_scaling !== undefined) && (
                              <div>
                                <h4 className="text-xs font-semibold text-white/80 mb-2 uppercase">
                                  Risk Parameters
                                </h4>
                                <div className="bg-black/20 p-3 rounded text-xs space-y-1">
                                  {simulation.config_ranges
                                    .risk_score_threshold && (
                                    <div className="flex justify-between text-white/70">
                                      <span>Risk Score Threshold:</span>
                                      <span className="text-white">
                                        {Array.isArray(
                                          simulation.config_ranges
                                            .risk_score_threshold
                                        )
                                          ? simulation.config_ranges.risk_score_threshold.join(
                                              ", "
                                            )
                                          : simulation.config_ranges
                                              .risk_score_threshold}
                                      </span>
                                    </div>
                                  )}
                                  {simulation.config_ranges
                                    .risk_adjustment_factor && (
                                    <div className="flex justify-between text-white/70">
                                      <span>Risk Adjustment Factor:</span>
                                      <span className="text-white">
                                        {Array.isArray(
                                          simulation.config_ranges
                                            .risk_adjustment_factor
                                        )
                                          ? simulation.config_ranges.risk_adjustment_factor.join(
                                              ", "
                                            )
                                          : simulation.config_ranges
                                              .risk_adjustment_factor}
                                      </span>
                                    </div>
                                  )}
                                  {simulation.config_ranges
                                    .risk_based_position_scaling !==
                                    undefined && (
                                    <div className="flex justify-between text-white/70">
                                      <span>Risk-Based Position Scaling:</span>
                                      <span className="text-white">
                                        {Array.isArray(
                                          simulation.config_ranges
                                            .risk_based_position_scaling
                                        )
                                          ? simulation.config_ranges.risk_based_position_scaling.join(
                                              ", "
                                            )
                                          : String(
                                              simulation.config_ranges
                                                .risk_based_position_scaling
                                            )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Signal Persistence */}
                            {(simulation.config_ranges
                              .signal_persistence_type ||
                              simulation.config_ranges
                                .signal_persistence_value) && (
                              <div>
                                <h4 className="text-xs font-semibold text-white/80 mb-2 uppercase">
                                  Signal Persistence
                                </h4>
                                <div className="bg-black/20 p-3 rounded text-xs space-y-1">
                                  {simulation.config_ranges
                                    .signal_persistence_type && (
                                    <div className="flex justify-between text-white/70">
                                      <span>Persistence Type:</span>
                                      <span className="text-white">
                                        {Array.isArray(
                                          simulation.config_ranges
                                            .signal_persistence_type
                                        )
                                          ? simulation.config_ranges.signal_persistence_type
                                              .map((v: any) =>
                                                v === null
                                                  ? "None"
                                                  : v === "tick_count"
                                                  ? "Tick Count"
                                                  : "Time Duration"
                                              )
                                              .join(", ")
                                          : simulation.config_ranges
                                              .signal_persistence_type === null
                                          ? "None"
                                          : simulation.config_ranges
                                              .signal_persistence_type ===
                                            "tick_count"
                                          ? "Tick Count"
                                          : "Time Duration"}
                                      </span>
                                    </div>
                                  )}
                                  {simulation.config_ranges
                                    .signal_persistence_value && (
                                    <div className="flex justify-between text-white/70">
                                      <span>Persistence Value:</span>
                                      <span className="text-white">
                                        {Array.isArray(
                                          simulation.config_ranges
                                            .signal_persistence_value
                                        )
                                          ? simulation.config_ranges.signal_persistence_value
                                              .map((v: any) =>
                                                v === null ? "None" : String(v)
                                              )
                                              .join(", ")
                                          : simulation.config_ranges
                                              .signal_persistence_value === null
                                          ? "None"
                                          : String(
                                              simulation.config_ranges
                                                .signal_persistence_value
                                            )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Other Parameters */}
                            <div>
                              <h4 className="text-xs font-semibold text-white/80 mb-2 uppercase">
                                Other Parameters
                              </h4>
                              <div className="bg-black/20 p-3 rounded text-xs space-y-1 max-h-60 overflow-y-auto">
                                {Object.entries(simulation.config_ranges)
                                  .filter(
                                    ([key]) =>
                                      ![
                                        "signal_weights",
                                        "risk_score_threshold",
                                        "risk_adjustment_factor",
                                        "risk_based_position_scaling",
                                        "signal_persistence_type",
                                        "signal_persistence_value",
                                      ].includes(key)
                                  )
                                  .map(([key, value]) => (
                                    <div
                                      key={key}
                                      className="flex justify-between text-white/70"
                                    >
                                      <span className="capitalize">
                                        {key.replace(/_/g, " ")}:
                                      </span>
                                      <span className="text-white text-right max-w-xs truncate">
                                        {Array.isArray(value)
                                          ? value.join(", ")
                                          : typeof value === "object" &&
                                            value !== null
                                          ? JSON.stringify(value)
                                          : String(value)}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>

                            {/* Full JSON (Collapsible) */}
                            <details className="mt-4">
                              <summary className="text-xs text-white/60 cursor-pointer hover:text-white/80 mb-2">
                                View Full JSON Configuration
                              </summary>
                              <div className="text-xs font-mono bg-black/20 p-3 rounded overflow-x-auto">
                                <pre className="text-white/80">
                                  {JSON.stringify(
                                    simulation.config_ranges,
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                            </details>
                          </div>
                        </div>
                      )}

                    {/* Top Performers */}
                    {simulation.top_performers &&
                      Array.isArray(simulation.top_performers) &&
                      simulation.top_performers.length > 0 && (
                        <div className="bg-white/5 border border-white/20 rounded-lg p-4 md:col-span-2">
                          <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide">
                            Top Performers
                          </h3>
                          <div className="text-xs font-mono bg-black/20 p-3 rounded overflow-x-auto">
                            <pre className="text-white/80">
                              {JSON.stringify(
                                simulation.top_performers,
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        </div>
                      )}

                    {/* Error Message */}
                    {simulation.error_message && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 md:col-span-2">
                        <h3 className="font-semibold text-red-300 mb-2 text-sm uppercase tracking-wide">
                          Error Message
                        </h3>
                        <p className="text-sm text-red-200 whitespace-pre-wrap">
                          {simulation.error_message}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "progress" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">
                    Real-time Progress
                  </h2>
                  <button
                    onClick={() => {
                      loadProgress();
                      loadSimulation();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                </div>
                {progress ? (
                  <SimulationProgressComponent progress={progress} />
                ) : (
                  <div className="card p-6 text-center">
                    <p className="text-white/70">
                      {simulation?.status === "pending"
                        ? "Simulation not started yet"
                        : simulation?.status === "completed" ||
                          simulation?.status === "failed"
                        ? "No progress data available"
                        : "Loading progress data..."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "results" && (
              <div>
                {/* Comprehensive Analysis Section */}
                {simulation?.status === "completed" && (
                  <div className="mb-6 space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Comprehensive Analysis
                    </h2>

                    {isLoadingAnalysis ? (
                      <div className="card p-8 text-center">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="text-white/70">Loading analysis...</p>
                      </div>
                    ) : analysis ? (
                      <>
                        {/* Signal Impact Analysis */}
                        {analysis.signal_impact &&
                          Object.keys(analysis.signal_impact).length > 0 && (
                            <div className="card">
                              <h3 className="text-lg font-semibold text-white mb-4">
                                Signal Productivity Analysis
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(analysis.signal_impact)
                                  .sort(
                                    (a: any, b: any) =>
                                      b[1].average_profit_impact -
                                      a[1].average_profit_impact
                                  )
                                  .map(([signalType, stats]: [string, any]) => (
                                    <div
                                      key={signalType}
                                      className="bg-white/5 border border-white/20 rounded-lg p-4"
                                    >
                                      <h4 className="font-medium text-white mb-2 capitalize">
                                        {signalType.replace(/_/g, " ")}
                                      </h4>
                                      <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-white/60">
                                            Avg Profit Impact:
                                          </span>
                                          <span
                                            className={`font-medium ${
                                              Number(
                                                stats.average_profit_impact
                                              ) >= 0
                                                ? "text-green-400"
                                                : "text-red-400"
                                            }`}
                                          >
                                            $
                                            {Number(
                                              stats.average_profit_impact
                                            ).toFixed(2)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-white/60">
                                            Avg Win Rate:
                                          </span>
                                          <span className="text-white">
                                            {Number(
                                              stats.average_win_rate
                                            ).toFixed(1)}
                                            %
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-white/60">
                                            Contributions:
                                          </span>
                                          <span className="text-white">
                                            {stats.total_contributions}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                        {/* Indicator & Pattern Impact */}
                        {(analysis.indicator_impact ||
                          analysis.pattern_impact) && (
                          <div className="card">
                            <h3 className="text-lg font-semibold text-white mb-4">
                              Indicator & Pattern Impact
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {analysis.indicator_impact &&
                                Object.keys(analysis.indicator_impact).length >
                                  0 && (
                                  <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                                    <h4 className="font-medium text-white mb-3">
                                      Indicators
                                    </h4>
                                    {Object.entries(
                                      analysis.indicator_impact
                                    ).map(
                                      ([indicator, stats]: [string, any]) => (
                                        <div
                                          key={indicator}
                                          className="mb-2 text-sm"
                                        >
                                          <div className="flex justify-between">
                                            <span className="text-white/60">
                                              {indicator}:
                                            </span>
                                            <span className="text-white">
                                              Avg Impact: $
                                              {Number(
                                                stats.average_impact_score
                                              ).toFixed(2)}
                                            </span>
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}
                              {analysis.pattern_impact &&
                                Object.keys(analysis.pattern_impact).length >
                                  0 && (
                                  <div className="bg-white/5 border border-white/20 rounded-lg p-4">
                                    <h4 className="font-medium text-white mb-3">
                                      Patterns
                                    </h4>
                                    {Object.entries(
                                      analysis.pattern_impact
                                    ).map(([pattern, stats]: [string, any]) => (
                                      <div
                                        key={pattern}
                                        className="mb-2 text-sm"
                                      >
                                        <div className="flex justify-between">
                                          <span className="text-white/60">
                                            {pattern}:
                                          </span>
                                          <span className="text-white">
                                            Avg Impact: $
                                            {stats.average_impact_score.toFixed(
                                              2
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                            </div>
                          </div>
                        )}

                        {/* Signal Productivity from Results */}
                        {results.length > 0 && (
                          <div className="card">
                            <h3 className="text-lg font-semibold text-white mb-4">
                              Signal Productivity by Bot
                            </h3>
                            <div className="space-y-4">
                              {results
                                .filter(
                                  (r) =>
                                    r.signal_productivity &&
                                    Object.keys(r.signal_productivity).length >
                                      0
                                )
                                .slice(0, 5)
                                .map((result) => (
                                  <div
                                    key={result.id}
                                    className="bg-white/5 border border-white/20 rounded-lg p-4"
                                  >
                                    <div className="flex justify-between items-center mb-3">
                                      <button
                                        onClick={() =>
                                          navigate(
                                            `/simulations/${id}/results/${result.simulation_config.id}`
                                          )
                                        }
                                        className="font-medium text-white hover:text-blue-400 transition-colors hover:underline"
                                        title="View bot details"
                                      >
                                        Bot {result.simulation_config.bot_index}
                                      </button>
                                      <span
                                        className={`text-sm font-medium ${
                                          Number(result.total_profit) >= 0
                                            ? "text-green-400"
                                            : "text-red-400"
                                        }`}
                                      >
                                        Profit: $
                                        {Number(result.total_profit).toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                      {Object.entries(
                                        result.signal_productivity
                                      ).map(
                                        ([signal, stats]: [string, any]) => (
                                          <div key={signal}>
                                            <div className="text-white/60 text-xs mb-1 capitalize">
                                              {signal.replace(/_/g, " ")}
                                            </div>
                                            <div className="text-white">
                                              Accuracy:{" "}
                                              {stats.accuracy
                                                ? Number(
                                                    stats.accuracy
                                                  ).toFixed(1)
                                                : 0}
                                              %
                                            </div>
                                            <div className="text-white/60 text-xs">
                                              Contributions:{" "}
                                              {stats.total_contributions || 0}
                                            </div>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="card p-4 text-center">
                        <p className="text-white/70">
                          Analysis not available yet
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">
                    Results (
                    {filteredAndSortedResults.length !== results.length
                      ? `${filteredAndSortedResults.length} of ${results.length}`
                      : results.length}
                    )
                  </h2>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg transition-colors"
                  >
                    <Filter className="w-4 h-4" />
                    Filters
                  </button>
                </div>

                {/* Search and Filters */}
                <div className="mb-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
                    <input
                      type="text"
                      placeholder="Search by bot index..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>

                  {showFilters && (
                    <div className="bg-white/5 border border-white/20 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-white">
                          Filters
                        </h3>
                        <button
                          onClick={() => {
                            setProfitFilter({ min: "", max: "" });
                            setWinRateFilter({ min: "", max: "" });
                            setTradesFilter({ min: "", max: "" });
                          }}
                          className="text-xs text-white/60 hover:text-white/80"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-white/60 mb-1 block">
                            Profit Range
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Min"
                              value={profitFilter.min}
                              onChange={(e) =>
                                setProfitFilter({
                                  ...profitFilter,
                                  min: e.target.value,
                                })
                              }
                              className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm placeholder-white/30"
                            />
                            <input
                              type="number"
                              placeholder="Max"
                              value={profitFilter.max}
                              onChange={(e) =>
                                setProfitFilter({
                                  ...profitFilter,
                                  max: e.target.value,
                                })
                              }
                              className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm placeholder-white/30"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-white/60 mb-1 block">
                            Win Rate Range (%)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Min"
                              value={winRateFilter.min}
                              onChange={(e) =>
                                setWinRateFilter({
                                  ...winRateFilter,
                                  min: e.target.value,
                                })
                              }
                              className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm placeholder-white/30"
                            />
                            <input
                              type="number"
                              placeholder="Max"
                              value={winRateFilter.max}
                              onChange={(e) =>
                                setWinRateFilter({
                                  ...winRateFilter,
                                  max: e.target.value,
                                })
                              }
                              className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm placeholder-white/30"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-white/60 mb-1 block">
                            Total Trades Range
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Min"
                              value={tradesFilter.min}
                              onChange={(e) =>
                                setTradesFilter({
                                  ...tradesFilter,
                                  min: e.target.value,
                                })
                              }
                              className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm placeholder-white/30"
                            />
                            <input
                              type="number"
                              placeholder="Max"
                              value={tradesFilter.max}
                              onChange={(e) =>
                                setTradesFilter({
                                  ...tradesFilter,
                                  max: e.target.value,
                                })
                              }
                              className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm placeholder-white/30"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Data Table */}
                {isLoadingResults && results.length === 0 ? (
                  <div className="card p-8 text-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                    <p className="text-white/70">Loading results...</p>
                  </div>
                ) : results.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px]">
                      <thead>
                        <tr className="border-b border-white/10">
                          {[
                            { key: "bot_index", label: "Bot Index" },
                            { key: "total_profit", label: "Total Profit" },
                            { key: "win_rate", label: "Win Rate" },
                            { key: "total_trades", label: "Total Trades" },
                            { key: "winning_trades", label: "Winning" },
                            { key: "losing_trades", label: "Losing" },
                            { key: "average_profit", label: "Avg Profit" },
                            { key: "average_loss", label: "Avg Loss" },
                            { key: "sharpe_ratio", label: "Sharpe Ratio" },
                            { key: "max_drawdown", label: "Max Drawdown" },
                            {
                              key: "final_portfolio_value",
                              label: "Final Value",
                            },
                          ].map((col) => (
                            <th
                              key={col.key}
                              className="text-left py-3 px-4 text-white/60 font-medium text-sm cursor-pointer hover:text-white/80 transition-colors"
                              onClick={() => {
                                if (sortColumn === col.key) {
                                  setSortDirection(
                                    sortDirection === "asc" ? "desc" : "asc"
                                  );
                                } else {
                                  setSortColumn(col.key as any);
                                  setSortDirection("desc");
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                {col.label}
                                {sortColumn === col.key &&
                                  (sortDirection === "asc" ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  ))}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAndSortedResults.map((result) => {
                          const profit = Number(result.total_profit) || 0;
                          const winRate = Number(result.win_rate) || 0;
                          return (
                            <tr
                              key={result.id}
                              className="border-b border-white/5 hover:bg-white/5 transition-colors"
                            >
                              <td className="py-3 px-4 text-white font-medium">
                                <button
                                  onClick={() =>
                                    navigate(
                                      `/simulations/${id}/results/${result.simulation_config.id}`
                                    )
                                  }
                                  className="text-blue-400 hover:text-blue-300 transition-colors hover:underline"
                                  title="View bot details"
                                >
                                  Bot {result.simulation_config.bot_index}
                                </button>
                              </td>
                              <td
                                className={`py-3 px-4 text-sm ${
                                  profit >= 0
                                    ? "text-green-400"
                                    : "text-red-400"
                                }`}
                              >
                                ${profit.toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-sm text-white/80">
                                {winRate.toFixed(1)}%
                              </td>
                              <td className="py-3 px-4 text-sm text-white/80">
                                {result.total_trades}
                              </td>
                              <td className="py-3 px-4 text-sm text-green-400">
                                {result.winning_trades}
                              </td>
                              <td className="py-3 px-4 text-sm text-red-400">
                                {result.losing_trades}
                              </td>
                              <td className="py-3 px-4 text-sm text-green-400">
                                $
                                {(Number(result.average_profit) || 0).toFixed(
                                  2
                                )}
                              </td>
                              <td className="py-3 px-4 text-sm text-red-400">
                                ${(Number(result.average_loss) || 0).toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-sm text-white/80">
                                {result.sharpe_ratio != null
                                  ? Number(result.sharpe_ratio).toFixed(2)
                                  : "N/A"}
                              </td>
                              <td className="py-3 px-4 text-sm text-red-400">
                                {result.max_drawdown != null
                                  ? `${Number(result.max_drawdown).toFixed(2)}%`
                                  : "N/A"}
                              </td>
                              <td className="py-3 px-4 text-sm text-white/80">
                                $
                                {(
                                  Number(result.final_portfolio_value) || 0
                                ).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-white/70 text-center py-8">
                    No results available yet
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BotSimulationDetail;
