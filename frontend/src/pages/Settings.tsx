import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Settings as SettingsIcon,
  Bell,
  TrendingUp,
  DollarSign,
  BarChart3,
  Globe,
  Moon,
  Sun,
  Shield,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
  Zap,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

const settingsSchema = z.object({
  // Trading Preferences
  default_order_type: z.enum(["market", "target"]),
  auto_execute_market_orders: z.boolean(),
  default_transaction_type: z.enum(["buy", "sell"]),
  max_order_amount: z.number().min(0).optional(),
  enable_stop_loss: z.boolean(),
  default_stop_loss_percent: z.number().min(0).max(100).optional(),

  // Notifications
  email_notifications: z.boolean(),
  price_alerts: z.boolean(),
  order_execution_alerts: z.boolean(),
  portfolio_alerts: z.boolean(),
  news_alerts: z.boolean(),
  alert_frequency: z.enum(["realtime", "daily", "weekly"]),

  // Display Preferences
  currency: z.enum(["USD", "EUR", "GBP", "JPY"]),
  date_format: z.enum(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]),
  time_format: z.enum(["12h", "24h"]),
  theme: z.enum(["light", "dark", "auto"]),
  chart_type: z.enum(["candlestick", "line", "bar"]),
  show_grid_lines: z.boolean(),
  show_volume: z.boolean(),

  // Data & Refresh
  data_refresh_interval: z.number().min(5).max(300),
  auto_refresh_charts: z.boolean(),
  cache_duration: z.number().min(0).max(3600),

  // Risk Management
  max_position_size: z.number().min(0).optional(),
  risk_tolerance: z.enum(["conservative", "moderate", "aggressive"]),
  enable_position_sizing: z.boolean(),
  max_daily_loss_limit: z.number().min(0).optional(),

  // API & Integration
  enable_api_access: z.boolean(),
  api_key_name: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("trading");

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      // Trading Preferences
      default_order_type: "market",
      auto_execute_market_orders: true,
      default_transaction_type: "buy",
      max_order_amount: undefined,
      enable_stop_loss: false,
      default_stop_loss_percent: 5,

      // Notifications
      email_notifications: true,
      price_alerts: true,
      order_execution_alerts: true,
      portfolio_alerts: true,
      news_alerts: false,
      alert_frequency: "realtime",

      // Display Preferences
      currency: "USD",
      date_format: "MM/DD/YYYY",
      time_format: "24h",
      theme: "dark",
      chart_type: "candlestick",
      show_grid_lines: true,
      show_volume: true,

      // Data & Refresh
      data_refresh_interval: 30,
      auto_refresh_charts: true,
      cache_duration: 300,

      // Risk Management
      max_position_size: undefined,
      risk_tolerance: "moderate",
      enable_position_sizing: false,
      max_daily_loss_limit: undefined,

      // API & Integration
      enable_api_access: false,
      api_key_name: undefined,
    },
  });

  const onSubmit = async (data: SettingsFormData) => {
    setIsSaving(true);
    try {
      // TODO: Implement API call to save settings
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Settings saved successfully!");
      reset(data);
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: "trading", label: "Trading", icon: TrendingUp },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "display", label: "Display", icon: BarChart3 },
    { id: "data", label: "Data & Refresh", icon: RefreshCw },
    { id: "risk", label: "Risk Management", icon: Shield },
    { id: "api", label: "API & Integration", icon: Zap },
  ];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
              <p className="text-white/70">
                Configure your trading preferences and platform settings
              </p>
            </div>
            {isDirty && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center space-x-2 text-yellow-400"
              >
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">You have unsaved changes</span>
              </motion.div>
            )}
          </div>
        </motion.div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar Tabs */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-1"
            >
              <div className="card sticky top-24">
                <nav className="space-y-2">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                          activeTab === tab.id
                            ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                            : "text-white/60 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </motion.div>

            {/* Settings Content */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-3 space-y-6"
            >
              {/* Trading Preferences */}
              {activeTab === "trading" && (
                <div className="card">
                  <div className="flex items-center space-x-3 mb-6">
                    <TrendingUp className="w-6 h-6 text-blue-400" />
                    <h2 className="text-2xl font-semibold text-white">
                      Trading Preferences
                    </h2>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Default Order Type
                      </label>
                      <select
                        {...register("default_order_type")}
                        className="input-field"
                      >
                        <option value="market">Market Order</option>
                        <option value="target">Target Price Order</option>
                      </select>
                      <p className="text-white/50 text-xs mt-1">
                        Default order type when placing new orders
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-white/80">
                          Auto-Execute Market Orders
                        </label>
                        <p className="text-white/50 text-xs mt-1">
                          Automatically execute market orders immediately
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          {...register("auto_execute_market_orders")}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Default Transaction Type
                      </label>
                      <select
                        {...register("default_transaction_type")}
                        className="input-field"
                      >
                        <option value="buy">Buy</option>
                        <option value="sell">Sell</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Maximum Order Amount (Optional)
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                        <input
                          type="number"
                          {...register("max_order_amount", {
                            valueAsNumber: true,
                          })}
                          className="input-field pl-12"
                          placeholder="No limit"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-white/80">
                          Enable Stop Loss
                        </label>
                        <p className="text-white/50 text-xs mt-1">
                          Automatically set stop loss orders
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          {...register("enable_stop_loss")}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {watch("enable_stop_loss") && (
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Default Stop Loss Percentage
                        </label>
                        <div className="relative">
                          <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                          <input
                            type="number"
                            {...register("default_stop_loss_percent", {
                              valueAsNumber: true,
                            })}
                            className="input-field pl-12"
                            placeholder="5"
                          />
                          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60">
                            %
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notifications */}
              {activeTab === "notifications" && (
                <div className="card">
                  <div className="flex items-center space-x-3 mb-6">
                    <Bell className="w-6 h-6 text-blue-400" />
                    <h2 className="text-2xl font-semibold text-white">
                      Notifications
                    </h2>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-white/80">
                          Email Notifications
                        </label>
                        <p className="text-white/50 text-xs mt-1">
                          Receive notifications via email
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          {...register("email_notifications")}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-white/80">
                          Price Alerts
                        </label>
                        <p className="text-white/50 text-xs mt-1">
                          Get notified when stocks reach target prices
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          {...register("price_alerts")}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-white/80">
                          Order Execution Alerts
                        </label>
                        <p className="text-white/50 text-xs mt-1">
                          Notify when orders are executed
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          {...register("order_execution_alerts")}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-white/80">
                          Portfolio Alerts
                        </label>
                        <p className="text-white/50 text-xs mt-1">
                          Get alerts about portfolio changes
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          {...register("portfolio_alerts")}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-white/80">
                          News Alerts
                        </label>
                        <p className="text-white/50 text-xs mt-1">
                          Receive market news and updates
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          {...register("news_alerts")}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Alert Frequency
                      </label>
                      <select
                        {...register("alert_frequency")}
                        className="input-field"
                      >
                        <option value="realtime">Real-time</option>
                        <option value="daily">Daily Digest</option>
                        <option value="weekly">Weekly Summary</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Display Preferences */}
              {activeTab === "display" && (
                <div className="card">
                  <div className="flex items-center space-x-3 mb-6">
                    <BarChart3 className="w-6 h-6 text-blue-400" />
                    <h2 className="text-2xl font-semibold text-white">
                      Display Preferences
                    </h2>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Currency
                        </label>
                        <select
                          {...register("currency")}
                          className="input-field"
                        >
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                          <option value="JPY">JPY (¥)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Date Format
                        </label>
                        <select
                          {...register("date_format")}
                          className="input-field"
                        >
                          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Time Format
                        </label>
                        <select
                          {...register("time_format")}
                          className="input-field"
                        >
                          <option value="12h">12-hour</option>
                          <option value="24h">24-hour</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Theme
                        </label>
                        <select {...register("theme")} className="input-field">
                          <option value="dark">Dark</option>
                          <option value="light">Light</option>
                          <option value="auto">Auto</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Chart Type
                      </label>
                      <select
                        {...register("chart_type")}
                        className="input-field"
                      >
                        <option value="candlestick">Candlestick</option>
                        <option value="line">Line</option>
                        <option value="bar">Bar</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-white/80">
                          Show Grid Lines
                        </label>
                        <p className="text-white/50 text-xs mt-1">
                          Display grid lines on charts
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          {...register("show_grid_lines")}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-white/80">
                          Show Volume
                        </label>
                        <p className="text-white/50 text-xs mt-1">
                          Display volume bars on charts
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          {...register("show_volume")}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Data & Refresh */}
              {activeTab === "data" && (
                <div className="card">
                  <div className="flex items-center space-x-3 mb-6">
                    <RefreshCw className="w-6 h-6 text-blue-400" />
                    <h2 className="text-2xl font-semibold text-white">
                      Data & Refresh
                    </h2>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Data Refresh Interval (seconds)
                      </label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                        <input
                          type="number"
                          {...register("data_refresh_interval", {
                            valueAsNumber: true,
                          })}
                          className="input-field pl-12"
                          min={5}
                          max={300}
                        />
                      </div>
                      <p className="text-white/50 text-xs mt-1">
                        How often to refresh stock data (5-300 seconds)
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-white/80">
                          Auto-Refresh Charts
                        </label>
                        <p className="text-white/50 text-xs mt-1">
                          Automatically refresh chart data
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          {...register("auto_refresh_charts")}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Cache Duration (seconds)
                      </label>
                      <div className="relative">
                        <RefreshCw className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                        <input
                          type="number"
                          {...register("cache_duration", {
                            valueAsNumber: true,
                          })}
                          className="input-field pl-12"
                          min={0}
                          max={3600}
                        />
                      </div>
                      <p className="text-white/50 text-xs mt-1">
                        How long to cache data (0-3600 seconds)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Management */}
              {activeTab === "risk" && (
                <div className="card">
                  <div className="flex items-center space-x-3 mb-6">
                    <Shield className="w-6 h-6 text-blue-400" />
                    <h2 className="text-2xl font-semibold text-white">
                      Risk Management
                    </h2>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Risk Tolerance
                      </label>
                      <select
                        {...register("risk_tolerance")}
                        className="input-field"
                      >
                        <option value="conservative">Conservative</option>
                        <option value="moderate">Moderate</option>
                        <option value="aggressive">Aggressive</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Maximum Position Size (Optional)
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                        <input
                          type="number"
                          {...register("max_position_size", {
                            valueAsNumber: true,
                          })}
                          className="input-field pl-12"
                          placeholder="No limit"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-white/80">
                          Enable Position Sizing
                        </label>
                        <p className="text-white/50 text-xs mt-1">
                          Automatically calculate position sizes based on risk
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          {...register("enable_position_sizing")}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">
                        Maximum Daily Loss Limit (Optional)
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                        <input
                          type="number"
                          {...register("max_daily_loss_limit", {
                            valueAsNumber: true,
                          })}
                          className="input-field pl-12"
                          placeholder="No limit"
                        />
                      </div>
                      <p className="text-white/50 text-xs mt-1">
                        Stop trading if daily loss exceeds this amount
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* API & Integration */}
              {activeTab === "api" && (
                <div className="card">
                  <div className="flex items-center space-x-3 mb-6">
                    <Zap className="w-6 h-6 text-blue-400" />
                    <h2 className="text-2xl font-semibold text-white">
                      API & Integration
                    </h2>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-white/80">
                          Enable API Access
                        </label>
                        <p className="text-white/50 text-xs mt-1">
                          Allow external applications to access your data
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          {...register("enable_api_access")}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {watch("enable_api_access") && (
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          API Key Name
                        </label>
                        <input
                          type="text"
                          {...register("api_key_name")}
                          className="input-field"
                          placeholder="My API Key"
                        />
                        <p className="text-white/50 text-xs mt-1">
                          A descriptive name for your API key
                        </p>
                      </div>
                    )}

                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                        <div>
                          <p className="text-sm text-yellow-400 font-medium">
                            API Security Notice
                          </p>
                          <p className="text-white/60 text-xs mt-1">
                            Keep your API keys secure. Never share them publicly
                            or commit them to version control.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/60 text-sm">
                      {isDirty
                        ? "You have unsaved changes"
                        : "All changes saved"}
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={!isDirty || isSaving}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Settings</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
