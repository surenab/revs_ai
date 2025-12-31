import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Play,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Plus,
  RefreshCw,
  BarChart3,
  Edit,
} from "lucide-react";
import toast from "react-hot-toast";
import { simulationAPI, type BotSimulationRun } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";

const BotSimulationList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [simulations, setSimulations] = useState<BotSimulationRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    loadSimulations();
  }, []);

  const loadSimulations = async () => {
    try {
      setIsLoading(true);
      const response = await simulationAPI.getSimulations();
      // Handle paginated response (DRF ListAPIView returns paginated results)
      const data = response.data;
      // Check if response is paginated (has 'results' key) or direct array
      let simulationsList: BotSimulationRun[] = [];
      if (Array.isArray(data)) {
        simulationsList = data;
      } else if (data && typeof data === "object") {
        const paginatedData = data as { results?: BotSimulationRun[] };
        if (
          "results" in paginatedData &&
          Array.isArray(paginatedData.results)
        ) {
          simulationsList = paginatedData.results;
        }
      }
      setSimulations(simulationsList);
    } catch (error: unknown) {
      console.error("Error loading simulations:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { detail?: string } } })?.response
              ?.data?.detail || "Unknown error";
      toast.error(`Failed to load simulations: ${errorMessage}`);
      setSimulations([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "running":
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "cancelled":
        return <AlertCircle className="w-5 h-5 text-white/60" />;
      default:
        return <Clock className="w-5 h-5 text-white/60" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-300 border border-green-500/30";
      case "running":
        return "bg-blue-500/20 text-blue-300 border border-blue-500/30";
      case "failed":
        return "bg-red-500/20 text-red-300 border border-red-500/30";
      case "pending":
        return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30";
      case "cancelled":
        return "bg-white/20 text-white border border-white/20";
      default:
        return "bg-white/20 text-white border border-white/20";
    }
  };

  const filteredSimulations = Array.isArray(simulations)
    ? simulations.filter((sim) => {
        if (filterStatus === "all") return true;
        return sim.status === filterStatus;
      })
    : [];

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Bot Simulations
            </h1>
            <p className="text-white/70 mt-1 text-sm sm:text-base">
              Manage and monitor multi-bot trading simulations
            </p>
          </div>
          <button
            onClick={() => navigate("/simulations/create")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Simulation
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          {[
            "all",
            "pending",
            "running",
            "completed",
            "failed",
            "cancelled",
          ].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === status
                  ? "bg-blue-600 text-white"
                  : "bg-white/10 text-white/90 hover:bg-white/20 border border-white/20"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Simulations Table */}
        {isLoading ? (
          <div className="card p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-400" />
            <p className="mt-4 text-white/70">Loading simulations...</p>
          </div>
        ) : filteredSimulations.length === 0 ? (
          <div className="card p-8 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-white/50" />
            <p className="mt-4 text-white/70">
              {simulations.length === 0
                ? "No simulations found. Create your first simulation to get started."
                : `No simulations found with status "${filterStatus}". Try selecting a different filter.`}
            </p>
            {simulations.length === 0 && (
              <button
                onClick={() => navigate("/simulations/create")}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create First Simulation
              </button>
            )}
            {simulations.length > 0 && (
              <button
                onClick={() => setFilterStatus("all")}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Show All Simulations
              </button>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/10 border-b border-white/20">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                    Bots
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20">
                {filteredSimulations.map((sim) => (
                  <motion.tr
                    key={sim.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="hover:bg-white/10 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/simulations/${sim.id}`)}
                        className="text-sm font-medium text-white hover:text-blue-400 transition-colors text-left"
                      >
                        {sim.name}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(sim.status)}
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            sim.status
                          )}`}
                          title={
                            sim.status === "failed" && sim.error_message
                              ? sim.error_message
                              : undefined
                          }
                        >
                          {sim.status}
                        </span>
                        {sim.status === "failed" && sim.error_message && (
                          <span
                            className="text-red-400 cursor-help"
                            title={sim.error_message}
                          >
                            ⚠️
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-white/20 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{
                              width: `${
                                sim.progress != null ? Number(sim.progress) : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-sm text-white/70">
                          {sim.progress != null
                            ? Number(sim.progress).toFixed(1)
                            : "0.0"}
                          %
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                      {sim.bots_completed} / {sim.total_bots}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                      {new Date(sim.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/simulations/${sim.id}`)}
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View</span>
                        </button>
                        {(sim.status === "pending" ||
                          sim.status === "failed") && (
                          <button
                            onClick={() =>
                              navigate(`/simulations/${sim.id}/edit`)
                            }
                            className="text-green-400 hover:text-green-300 flex items-center gap-1 transition-colors"
                            title="Edit Simulation"
                          >
                            <Edit className="w-4 h-4" />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BotSimulationList;
