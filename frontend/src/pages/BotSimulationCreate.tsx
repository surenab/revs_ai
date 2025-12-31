import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, HelpCircle, Info } from "lucide-react";
import toast from "react-hot-toast";
import { simulationAPI, stockAPI, type Stock, type SimulationCreateRequest } from "../lib/api";
import { InfoTooltip } from "../components/bots/InfoTooltip";

const BotSimulationCreate: React.FC = () => {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<SimulationCreateRequest>({
    name: "",
    stocks: [],
    data_split_ratio: 0.8,
    config_ranges: {
      signal_weights: {
        ml: [0.3, 0.4, 0.5],
        indicator: [0.2, 0.3, 0.4],
        pattern: [0.1, 0.15, 0.2],
      },
      risk_params: {
        risk_score_threshold: [70, 80, 90],
      },
      aggregation_methods: ["weighted_average"],
      period_days: [14, 21],
      use_social_analysis: false,
      use_news_analysis: false,
    },
  });

  useEffect(() => {
    loadStocks();
  }, []);

  const loadStocks = async () => {
    try {
      const response = await stockAPI.getAllStocks();
      setStocks(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error("Failed to load stocks");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStocks.length === 0) {
      toast.error("Please select at least one stock");
      return;
    }

    try {
      setIsLoading(true);
      const response = await simulationAPI.createSimulation({
        ...formData,
        stocks: selectedStocks,
      });
      toast.success("Simulation created successfully");
      navigate(`/admin/simulations/${response.data.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create simulation");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate("/admin/simulations")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Simulations
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Simulation</h1>
          <p className="text-gray-600 mb-6">
            Configure parameters for multi-bot trading simulation
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Simulation Name
                <InfoTooltip text="A descriptive name for this simulation run" />
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Stock Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Stocks
                <InfoTooltip text="Choose stocks to include in the simulation. You can select single or multiple stocks per bot." />
              </label>
              <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto">
                {stocks.map((stock) => (
                  <label
                    key={stock.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStocks.includes(stock.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStocks([...selectedStocks, stock.id]);
                        } else {
                          setSelectedStocks(selectedStocks.filter((id) => id !== stock.id));
                        }
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">
                      {stock.symbol} - {stock.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Data Split Ratio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Split Ratio
                <InfoTooltip text="80% of data is used for training/simulation, 20% for validation. This ratio determines how data is split chronologically." />
              </label>
              <input
                type="number"
                min="0.1"
                max="0.9"
                step="0.05"
                value={formData.data_split_ratio}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    data_split_ratio: parseFloat(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Training: {(formData.data_split_ratio! * 100).toFixed(0)}% | Validation:{" "}
                {((1 - formData.data_split_ratio!) * 100).toFixed(0)}%
              </p>
            </div>

            {/* Parameter Ranges Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Parameter Ranges (Grid Search)
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    The system will test all combinations of the parameter ranges you configure.
                    Default ranges are set for signal weights, risk parameters, and aggregation
                    methods.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => navigate("/admin/simulations")}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || selectedStocks.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Creating..." : "Create Simulation"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default BotSimulationCreate;
