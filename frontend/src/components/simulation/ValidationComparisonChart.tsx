import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ValidationComparisonChartProps {
  trainingMetrics: {
    total_profit: number;
    win_rate: number;
    total_trades: number;
  };
  validationMetrics: {
    accuracy: number;
    correct_predictions: number;
    total_predictions: number;
  };
}

const ValidationComparisonChart: React.FC<ValidationComparisonChartProps> = ({
  trainingMetrics,
  validationMetrics,
}) => {
  const data = [
    {
      metric: "Profit",
      training: trainingMetrics.total_profit,
      validation: 0, // Validation doesn't have profit, it's accuracy
    },
    {
      metric: "Win Rate",
      training: trainingMetrics.win_rate,
      validation: validationMetrics.accuracy,
    },
    {
      metric: "Trades",
      training: trainingMetrics.total_trades,
      validation: validationMetrics.total_predictions,
    },
  ];

  return (
    <div className="bg-white rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">80% vs 20% Comparison</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="metric" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="training" fill="#3b82f6" name="Training (80%)" />
          <Bar dataKey="validation" fill="#10b981" name="Validation (20%)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ValidationComparisonChart;
