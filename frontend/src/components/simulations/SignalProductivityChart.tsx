import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface SignalProductivityChartProps {
  signalProductivity: Record<string, any>;
}

const SignalProductivityChart: React.FC<SignalProductivityChartProps> = ({
  signalProductivity,
}) => {
  const data = Object.entries(signalProductivity).map(([signal, stats]: [string, any]) => ({
    signal: signal.replace("_", " ").toUpperCase(),
    accuracy: stats.accuracy || 0,
    contributions: stats.total_contributions || 0,
    correct: stats.correct_decisions || 0,
  }));

  return (
    <div className="bg-white rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Signal Productivity</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="signal" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="accuracy" fill="#3b82f6" name="Accuracy %" />
          <Bar dataKey="contributions" fill="#10b981" name="Total Contributions" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SignalProductivityChart;
