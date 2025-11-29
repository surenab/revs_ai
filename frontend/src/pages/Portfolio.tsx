import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  DollarSign,
  PieChart,
  X,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Loader,
  Play,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import type {
  Portfolio,
  PortfolioSummary,
  Stock,
  Order,
  OrderSummary,
} from "../lib/api";
import { portfolioAPI, stockAPI, orderAPI } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

const PortfolioPage: React.FC = () => {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState("");
  const [sellingHolding, setSellingHolding] = useState<Portfolio | null>(null);
  const [activeTab, setActiveTab] = useState<"holdings" | "orders">("holdings");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [buyForm, setBuyForm] = useState({
    stock_symbol: "",
    order_type: "market" as "market" | "target",
    quantity: "",
    target_price: "",
    notes: "",
  });
  const [sellForm, setSellForm] = useState({
    order_type: "market" as "market" | "target",
    quantity: "",
    target_price: "",
    notes: "",
  });

  useEffect(() => {
    fetchPortfolio();
    fetchSummary();
    fetchOrders();
    fetchOrderSummary();

    // Set up interval to check and execute orders every 30 seconds
    const interval = setInterval(() => {
      executeOrders();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchPortfolio = async () => {
    try {
      const response = await portfolioAPI.getPortfolio();
      setPortfolio(response.data.results);
    } catch (error) {
      console.error("Failed to load portfolio:", error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await orderAPI.getOrders();
      setOrders(response.data.results);
    } catch (error) {
      console.error("Failed to load orders:", error);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await portfolioAPI.getPortfolioSummary();
      setSummary(response.data);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load portfolio summary:", error);
      setIsLoading(false);
    }
  };

  const fetchOrderSummary = async () => {
    try {
      const response = await orderAPI.getOrderSummary();
      setOrderSummary(response.data);
    } catch (error) {
      console.error("Failed to load order summary:", error);
    }
  };

  const [showExecutionErrors, setShowExecutionErrors] = useState(false);
  const [executionErrors, setExecutionErrors] = useState<
    Array<{
      id: string;
      stock_symbol: string;
      transaction_type: "buy" | "sell";
      order_type: "market" | "target";
      quantity: number;
      status: string;
      error: string;
    }>
  >([]);

  const executeOrders = async () => {
    try {
      const response = await orderAPI.executeOrders();
      const { executed_count, failed_count, failed_orders } = response.data;

      // Refresh data if any orders were executed
      if (executed_count > 0) {
        fetchPortfolio();
        fetchOrders();
        fetchSummary();
      }

      // Show success message for executed orders
      if (executed_count > 0) {
        toast.success(`${executed_count} order(s) executed successfully!`);
      }

      // Show errors if any orders failed
      if (failed_count > 0) {
        setExecutionErrors(failed_orders);
        setShowExecutionErrors(true);
        toast.error(
          `${failed_count} order(s) failed to execute. Click to view details.`,
          {
            duration: 5000,
          }
        );
      } else if (executed_count === 0) {
        toast("No orders were executed.", {
          icon: "ℹ️",
        });
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.response?.data?.detail ||
        "Failed to execute orders";
      toast.error(errorMessage);
      console.error("Failed to execute orders:", error);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await stockAPI.searchStocks(query);
      setSearchResults(response.data.results.slice(0, 5));
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);

  const handleSelectStock = async (stock: Stock) => {
    setBuyForm({
      ...buyForm,
      stock_symbol: stock.symbol,
    });
    setSelectedStock(stock);
    setSearchQuery(stock.symbol);
    setSearchResults([]);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const quantity = parseFloat(buyForm.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        toast.error("Please enter a valid quantity");
        return;
      }

      // Validate cash balance for buy orders
      if (summary) {
        let totalCost = 0;
        let priceToUse = 0;

        if (buyForm.order_type === "market") {
          // For market orders, use current stock price
          if (selectedStock?.latest_price?.close_price) {
            priceToUse = selectedStock.latest_price.close_price;
          } else {
            toast.error("Unable to get current stock price. Please try again.");
            return;
          }
        } else {
          // For target orders, use target price
          if (!buyForm.target_price) {
            toast.error("Target price is required for target orders");
            return;
          }
          priceToUse = parseFloat(buyForm.target_price);
          if (isNaN(priceToUse) || priceToUse <= 0) {
            toast.error("Please enter a valid target price");
            return;
          }
        }

        totalCost = quantity * priceToUse;

        if (totalCost > summary.cash_balance) {
          toast.error(
            `Insufficient funds. You need $${totalCost.toFixed(
              2
            )} but only have $${summary.cash_balance.toFixed(2)} available.`
          );
          return;
        }
      }

      const orderData: any = {
        stock_symbol: buyForm.stock_symbol,
        transaction_type: "buy",
        order_type: buyForm.order_type,
        quantity: quantity,
        notes: buyForm.notes || undefined,
      };

      if (buyForm.order_type === "target") {
        orderData.target_price = parseFloat(buyForm.target_price);
      }

      const response = await orderAPI.createOrder(orderData);

      if (response.data.status === "done") {
        toast.success("Order executed immediately!");
      } else {
        toast.success("Order placed successfully!");
      }

      setShowBuyModal(false);
      setBuyForm({
        stock_symbol: "",
        order_type: "market",
        quantity: "",
        target_price: "",
        notes: "",
      });
      setSelectedStock(null);
      setSearchQuery("");
      fetchPortfolio();
      fetchOrders();
      fetchSummary();
      fetchOrderSummary();
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Failed to create order";
      toast.error(errorMessage);
    }
  };

  const handleCancelOrder = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) {
      return;
    }
    try {
      await orderAPI.cancelOrder(id);
      toast.success("Order cancelled successfully");
      fetchOrders();
      fetchOrderSummary();
    } catch (error) {
      toast.error("Failed to cancel order");
    }
  };

  const handleSellClick = (holding: Portfolio) => {
    setSellingHolding(holding);
    setSellForm({
      order_type: "market",
      quantity: holding.quantity.toString(),
      target_price: "",
      notes: "",
    });
    setShowSellModal(true);
  };

  const handleCreateSellOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellingHolding) return;

    try {
      const sellQuantity = parseFloat(sellForm.quantity);
      if (sellQuantity > sellingHolding.quantity) {
        toast.error("Cannot sell more shares than you own");
        return;
      }

      const orderData: any = {
        stock_symbol: sellingHolding.stock_symbol,
        transaction_type: "sell",
        order_type: sellForm.order_type,
        quantity: sellQuantity,
        notes: sellForm.notes || undefined,
      };

      if (sellForm.order_type === "target") {
        if (!sellForm.target_price) {
          toast.error("Target price is required for target orders");
          return;
        }
        orderData.target_price = parseFloat(sellForm.target_price);
      }

      const response = await orderAPI.createOrder(orderData);

      if (response.data.status === "done") {
        toast.success("Sell order executed immediately!");
      } else {
        toast.success("Sell order placed successfully!");
      }

      setShowSellModal(false);
      setSellingHolding(null);
      setSellForm({
        order_type: "market",
        quantity: "",
        target_price: "",
        notes: "",
      });
      fetchPortfolio();
      fetchOrders();
      fetchSummary();
      fetchOrderSummary();
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Failed to create sell order";
      toast.error(errorMessage);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatPercentage = (percent: number | null | undefined) => {
    // Handle null, undefined, or non-number values
    if (percent === null || percent === undefined) {
      return "N/A";
    }

    // Convert to number if it's a string
    const numPercent =
      typeof percent === "string" ? parseFloat(percent) : percent;

    // Check if it's a valid number
    if (isNaN(numPercent)) {
      return "N/A";
    }

    return `${numPercent >= 0 ? "+" : ""}${numPercent.toFixed(2)}%`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amount = parseFloat(addFundsAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error("Please enter a valid amount");
        return;
      }

      const response = await portfolioAPI.addFunds(amount);
      toast.success(
        `Successfully added ${formatPrice(amount)}. New balance: ${formatPrice(
          response.data.new_balance
        )}`
      );

      setShowAddFundsModal(false);
      setAddFundsAmount("");
      fetchSummary();
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Failed to add funds";
      toast.error(errorMessage);
    }
  };

  const exportPortfolioToPDF = () => {
    try {
      const doc = new jsPDF();

      // Add watermark
      doc.setTextColor(200, 200, 200);
      doc.setFontSize(60);
      doc.setFont("helvetica", "normal");
      doc.text("REVS LTD", 105, 150, {
        angle: 45,
        align: "center",
      });
      doc.setTextColor(0, 0, 0);

      let yPos = 20;

      // User Info
      if (user) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("User Information", 14, yPos);
        yPos += 7;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const fullName = `${user.first_name || ""} ${
          user.last_name || ""
        }`.trim();
        if (fullName) {
          doc.text(`Name: ${fullName}`, 14, yPos);
          yPos += 6;
        }
        doc.text(`Email: ${user.email}`, 14, yPos);
        yPos += 10;
      }

      // Title
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Portfolio Report", 14, yPos);
      yPos += 10;

      // Date
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, yPos);
      yPos += 15;

      // Revs LTD Stamp
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("© Revs LTD - Confidential Document", 14, 285);
      doc.setTextColor(0, 0, 0);

      // Summary Section
      if (summary) {
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text("Portfolio Summary", 14, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.text(
          `Cash Balance: ${formatPrice(summary.cash_balance || 0)}`,
          14,
          yPos
        );
        yPos += 6;
        doc.text(`Total Holdings: ${summary.total_holdings}`, 14, yPos);
        yPos += 6;
        doc.text(
          `Total Cost: ${formatPrice(summary.total_cost || 0)}`,
          14,
          yPos
        );
        yPos += 6;
        doc.text(
          `Total Current Value: ${formatPrice(
            summary.total_current_value || 0
          )}`,
          14,
          yPos
        );
        yPos += 6;
        doc.text(
          `Total Gain/Loss: ${formatPrice(summary.total_gain_loss || 0)} (${(
            summary.total_gain_loss_percent || 0
          ).toFixed(2)}%)`,
          14,
          yPos
        );
        yPos += 6;
        const totalPortfolioValue =
          summary.total_portfolio_value ||
          (summary.total_current_value || 0) + (summary.cash_balance || 0);
        doc.text(
          `Total Portfolio Value: ${formatPrice(totalPortfolioValue)}`,
          14,
          yPos
        );
        yPos += 15;
      }

      // Holdings Table
      if (portfolio.length > 0) {
        doc.setFontSize(14);
        doc.text("Holdings", 14, yPos);
        yPos += 8;

        // Table headers
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        let xPos = 14;
        doc.text("Stock", xPos, yPos);
        xPos += 40;
        doc.text("Quantity", xPos, yPos);
        xPos += 30;
        doc.text("Purchase", xPos, yPos);
        xPos += 30;
        doc.text("Current", xPos, yPos);
        xPos += 30;
        doc.text("Gain/Loss", xPos, yPos);
        yPos += 6;

        // Table rows
        doc.setFont("helvetica", "normal");
        portfolio.forEach((holding) => {
          if (yPos > 270) {
            doc.addPage();
            // Add watermark to new page
            doc.setTextColor(200, 200, 200);
            doc.setFontSize(60);
            doc.text("REVS LTD", 105, 150, {
              angle: 45,
              align: "center",
            });
            doc.setTextColor(0, 0, 0);
            // Add stamp to new page
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text("© Revs LTD - Confidential Document", 14, 285);
            doc.setTextColor(0, 0, 0);
            yPos = 20;
          }

          xPos = 14;
          doc.text(holding.stock_symbol || "N/A", xPos, yPos);
          xPos += 40;
          doc.text(holding.quantity.toString(), xPos, yPos);
          xPos += 30;
          doc.text(formatPrice(holding.purchase_price || 0), xPos, yPos);
          xPos += 30;
          const currentPrice =
            holding.current_price?.close_price ||
            (holding.quantity > 0
              ? holding.current_value / holding.quantity
              : 0);
          doc.text(formatPrice(currentPrice), xPos, yPos);
          xPos += 30;
          const gainLoss = holding.gain_loss >= 0 ? "+" : "";
          doc.setTextColor(
            holding.gain_loss >= 0 ? 0 : 255,
            holding.gain_loss >= 0 ? 150 : 0,
            0
          );
          doc.text(`${gainLoss}${formatPrice(holding.gain_loss)}`, xPos, yPos);
          doc.setTextColor(0, 0, 0);
          yPos += 6;
        });
      }

      // Add stamp on last page
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("© Revs LTD - Confidential Document", 14, 285);
      doc.setTextColor(0, 0, 0);

      // Save PDF
      doc.save(
        `portfolio-report-${new Date().toISOString().split("T")[0]}.pdf`
      );
      toast.success("Portfolio exported successfully!");
    } catch (error) {
      console.error("Error exporting portfolio:", error);
      toast.error("Failed to export portfolio");
    }
  };

  const exportOrdersToPDF = () => {
    try {
      const doc = new jsPDF();

      // Add watermark
      doc.setTextColor(200, 200, 200);
      doc.setFontSize(60);
      doc.setFont("helvetica", "normal");
      doc.text("REVS LTD", 105, 150, {
        angle: 45,
        align: "center",
      });
      doc.setTextColor(0, 0, 0);

      let yPos = 20;

      // User Info
      if (user) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("User Information", 14, yPos);
        yPos += 7;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const fullName = `${user.first_name || ""} ${
          user.last_name || ""
        }`.trim();
        if (fullName) {
          doc.text(`Name: ${fullName}`, 14, yPos);
          yPos += 6;
        }
        doc.text(`Email: ${user.email}`, 14, yPos);
        yPos += 10;
      }

      // Title
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Orders Report", 14, yPos);
      yPos += 10;

      // Date
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, yPos);
      yPos += 15;

      // Revs LTD Stamp
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("© Revs LTD - Confidential Document", 14, 285);
      doc.setTextColor(0, 0, 0);

      // Summary Section
      if (orderSummary) {
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text("Order Summary", 14, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.text(`Total Orders: ${orderSummary.total_orders}`, 14, yPos);
        yPos += 6;
        doc.text(`Waiting: ${orderSummary.status_counts.waiting}`, 14, yPos);
        yPos += 6;
        doc.text(
          `In Progress: ${orderSummary.status_counts.in_progress}`,
          14,
          yPos
        );
        yPos += 6;
        doc.text(`Done: ${orderSummary.status_counts.done}`, 14, yPos);
        yPos += 6;
        doc.text(
          `Cancelled: ${orderSummary.status_counts.cancelled}`,
          14,
          yPos
        );
        yPos += 6;
        doc.text(
          `Insufficient Funds: ${
            orderSummary.status_counts.insufficient_funds || 0
          }`,
          14,
          yPos
        );
        yPos += 6;
        doc.text(
          `Buy Orders: ${orderSummary.transaction_counts.buy}`,
          14,
          yPos
        );
        yPos += 6;
        doc.text(
          `Sell Orders: ${orderSummary.transaction_counts.sell}`,
          14,
          yPos
        );
        yPos += 15;
      }

      // Orders Table
      if (orders.length > 0) {
        doc.setFontSize(14);
        doc.text("Orders", 14, yPos);
        yPos += 8;

        // Table headers
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        let xPos = 14;
        doc.text("Stock", xPos, yPos);
        xPos += 25;
        doc.text("Type", xPos, yPos);
        xPos += 20;
        doc.text("Qty", xPos, yPos);
        xPos += 20;
        doc.text("Status", xPos, yPos);
        xPos += 30;
        doc.text("Price", xPos, yPos);
        xPos += 25;
        doc.text("Date", xPos, yPos);
        yPos += 6;

        // Table rows
        doc.setFont("helvetica", "normal");
        orders.forEach((order) => {
          if (yPos > 270) {
            doc.addPage();
            // Add watermark to new page
            doc.setTextColor(200, 200, 200);
            doc.setFontSize(60);
            doc.text("REVS LTD", 105, 150, {
              angle: 45,
              align: "center",
            });
            doc.setTextColor(0, 0, 0);
            // Add stamp to new page
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text("© Revs LTD - Confidential Document", 14, 285);
            doc.setTextColor(0, 0, 0);
            yPos = 20;
          }

          xPos = 14;
          doc.text(order.stock_symbol || "N/A", xPos, yPos);
          xPos += 25;
          doc.text(
            `${order.transaction_type || "N/A"}/${order.order_type || "N/A"}`,
            xPos,
            yPos
          );
          xPos += 20;
          doc.text((order.quantity || 0).toString(), xPos, yPos);
          xPos += 20;

          // Status color
          const statusColors: { [key: string]: [number, number, number] } = {
            done: [0, 150, 0],
            waiting: [255, 165, 0],
            in_progress: [0, 100, 255],
            cancelled: [150, 0, 0],
            insufficient_funds: [200, 0, 0],
          };
          const color = statusColors[order.status] || [0, 0, 0];
          doc.setTextColor(color[0], color[1], color[2]);
          doc.text((order.status || "unknown").replace("_", " "), xPos, yPos);
          doc.setTextColor(0, 0, 0);

          xPos += 30;
          const priceText = order.executed_price
            ? formatPrice(order.executed_price)
            : order.target_price
            ? formatPrice(order.target_price)
            : "N/A";
          doc.text(priceText, xPos, yPos);
          xPos += 25;
          doc.text(
            formatDate(order.created_at || new Date().toISOString()),
            xPos,
            yPos
          );
          yPos += 6;
        });
      }

      // Add stamp on last page
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("© Revs LTD - Confidential Document", 14, 285);
      doc.setTextColor(0, 0, 0);

      // Save PDF
      doc.save(`orders-report-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Orders exported successfully!");
    } catch (error) {
      console.error("Error exporting orders:", error);
      toast.error("Failed to export orders");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "waiting":
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case "in_progress":
        return <Loader className="w-4 h-4 text-blue-400 animate-spin" />;
      case "done":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "cancelled":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "insufficient_funds":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting":
        return "text-yellow-400 bg-yellow-400/10";
      case "in_progress":
        return "text-blue-400 bg-blue-400/10";
      case "done":
        return "text-green-400 bg-green-400/10";
      case "cancelled":
        return "text-red-400 bg-red-400/10";
      case "insufficient_funds":
        return "text-red-500 bg-red-500/10";
      default:
        return "text-white/60 bg-white/5";
    }
  };

  const pendingOrders = orders.filter(
    (o) => o.status === "waiting" || o.status === "in_progress"
  );

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">My Portfolio</h1>
            <p className="text-white/70 text-lg">
              Track your investments and manage orders
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {pendingOrders.length > 0 && (
              <button
                onClick={executeOrders}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg text-white font-medium hover:from-green-700 hover:to-emerald-700 transition-all"
              >
                <Play className="w-4 h-4" />
                <span>Execute Orders ({pendingOrders.length})</span>
              </button>
            )}
            {activeTab === "holdings" && portfolio.length > 0 && (
              <button
                onClick={exportPortfolioToPDF}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white font-medium hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Export Portfolio</span>
              </button>
            )}
            {activeTab === "orders" && orders.length > 0 && (
              <button
                onClick={exportOrdersToPDF}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white font-medium hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Export Orders</span>
              </button>
            )}
            <button
              onClick={() => setShowBuyModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white font-medium hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>Place Order</span>
            </button>
          </div>
        </motion.div>

        {/* Summary Cards */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8"
          >
            <div className="card hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-white/60 text-sm font-medium">
                    Cash Balance
                  </p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {formatPrice(summary.cash_balance || 0)}
                  </p>
                  <button
                    onClick={() => setShowAddFundsModal(true)}
                    className="mt-2 px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg text-white text-xs font-medium hover:from-green-700 hover:to-emerald-700 transition-all"
                  >
                    Add Funds
                  </button>
                </div>
                <div className="p-3 bg-gradient-to-r from-green-600/20 to-emerald-600/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="card hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm font-medium">
                    Stock Value
                  </p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {formatPrice(summary.total_current_value)}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg">
                  <PieChart className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="card hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm font-medium">
                    Total Portfolio
                  </p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {formatPrice(
                      summary.total_portfolio_value ||
                        summary.total_current_value +
                          (summary.cash_balance || 0)
                    )}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="card hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm font-medium">
                    Total Cost
                  </p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {formatPrice(summary.total_cost)}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-r from-green-600/20 to-emerald-600/20 rounded-lg">
                  <PieChart className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="card hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm font-medium">
                    Total Gain/Loss
                  </p>
                  <p
                    className={`text-2xl font-bold mt-1 ${
                      summary.total_gain_loss >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {formatPrice(summary.total_gain_loss)}
                  </p>
                  <div className="flex items-center mt-2">
                    {summary.total_gain_loss >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-400 mr-1" />
                    )}
                    <span
                      className={`text-sm font-medium ${
                        summary.total_gain_loss >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {formatPercentage(summary.total_gain_loss_percent)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm font-medium">Holdings</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {summary.total_holdings}
                  </p>
                  {orderSummary && (
                    <p className="text-sm text-white/60 mt-2">
                      {orderSummary.status_counts.waiting} pending orders
                    </p>
                  )}
                </div>
                <div className="p-3 bg-gradient-to-r from-orange-600/20 to-red-600/20 rounded-lg">
                  <PieChart className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab("holdings")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === "holdings"
                ? "bg-blue-600 text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            Holdings
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === "orders"
                ? "bg-blue-600 text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            Orders{" "}
            {orderSummary && orderSummary.status_counts.waiting > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">
                {orderSummary.status_counts.waiting}
              </span>
            )}
          </button>
        </div>

        {/* Holdings Tab */}
        {activeTab === "holdings" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <h3 className="text-xl font-semibold text-white mb-6">
              Your Holdings
            </h3>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-20 bg-white/5 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : portfolio.length === 0 ? (
              <div className="text-center py-12">
                <PieChart className="w-16 h-16 mx-auto mb-4 text-white/30" />
                <p className="text-white/60 text-lg mb-2">No holdings yet</p>
                <p className="text-white/40 text-sm mb-4">
                  Place an order to start building your portfolio
                </p>
                <button
                  onClick={() => setShowBuyModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white font-medium hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  Place Your First Order
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Stock
                      </th>
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Quantity
                      </th>
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Purchase Price
                      </th>
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Current Price
                      </th>
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Total Cost
                      </th>
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Current Value
                      </th>
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Gain/Loss
                      </th>
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Purchase Date
                      </th>
                      <th className="text-right py-4 px-4 text-white/60 font-medium text-sm">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.map((holding, index) => (
                      <motion.tr
                        key={holding.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + index * 0.05 }}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <Link
                            to={`/stocks/${holding.stock_symbol}`}
                            className="block"
                          >
                            <p className="font-semibold text-white">
                              {holding.stock_symbol}
                            </p>
                            <p className="text-sm text-white/60 line-clamp-1">
                              {holding.stock_details?.name || "N/A"}
                            </p>
                          </Link>
                        </td>
                        <td className="py-4 px-4 text-white">
                          {holding.quantity.toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-white">
                          {formatPrice(holding.purchase_price)}
                        </td>
                        <td className="py-4 px-4">
                          {holding.current_price ? (
                            <div>
                              <p className="text-white">
                                {formatPrice(holding.current_price.close_price)}
                              </p>
                              <p
                                className={`text-xs ${
                                  holding.current_price.price_change >= 0
                                    ? "text-green-400"
                                    : "text-red-400"
                                }`}
                              >
                                {formatPercentage(
                                  holding.current_price.price_change_percent
                                )}
                              </p>
                            </div>
                          ) : (
                            <span className="text-white/40">N/A</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-white">
                          {formatPrice(holding.total_cost)}
                        </td>
                        <td className="py-4 px-4 text-white">
                          {formatPrice(holding.current_value)}
                        </td>
                        <td className="py-4 px-4">
                          <div
                            className={`flex items-center space-x-1 ${
                              holding.gain_loss >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {holding.gain_loss >= 0 ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : (
                              <TrendingDown className="w-4 h-4" />
                            )}
                            <span className="font-medium">
                              {formatPrice(holding.gain_loss)}
                            </span>
                            <span className="text-sm">
                              ({formatPercentage(holding.gain_loss_percent)})
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-white/60 text-sm">
                          {formatDate(holding.purchase_date)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleSellClick(holding)}
                            className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg text-white text-sm font-medium hover:from-red-700 hover:to-orange-700 transition-all"
                          >
                            Sell
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <h3 className="text-xl font-semibold text-white mb-6">
              Your Orders
            </h3>

            {orders.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 mx-auto mb-4 text-white/30" />
                <p className="text-white/60 text-lg mb-2">No orders yet</p>
                <p className="text-white/40 text-sm mb-4">
                  Place an order to buy stocks
                </p>
                <button
                  onClick={() => setShowBuyModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white font-medium hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  Place Your First Order
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Stock
                      </th>
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Transaction
                      </th>
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Order Type
                      </th>
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Quantity
                      </th>
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Target Price
                      </th>
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Current Price
                      </th>
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Status
                      </th>
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Executed Price
                      </th>
                      <th className="text-left py-4 px-4 text-white/60 font-medium text-sm">
                        Created
                      </th>
                      <th className="text-right py-4 px-4 text-white/60 font-medium text-sm">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, index) => (
                      <motion.tr
                        key={order.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + index * 0.05 }}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <Link
                            to={`/stocks/${order.stock_symbol}`}
                            className="block"
                          >
                            <p className="font-semibold text-white">
                              {order.stock_symbol}
                            </p>
                            <p className="text-sm text-white/60 line-clamp-1">
                              {order.stock_details?.name || "N/A"}
                            </p>
                          </Link>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              order.transaction_type === "buy"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {order.transaction_type === "buy" ? "Buy" : "Sell"}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              order.order_type === "market"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-purple-500/20 text-purple-400"
                            }`}
                          >
                            {order.order_type === "market"
                              ? "Market"
                              : "Target"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-white">
                          {order.quantity.toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-white">
                          {order.target_price
                            ? formatPrice(order.target_price)
                            : "N/A"}
                        </td>
                        <td className="py-4 px-4">
                          {order.current_price ? (
                            <div>
                              <p className="text-white">
                                {formatPrice(order.current_price.close_price)}
                              </p>
                              {order.order_type === "target" &&
                                order.target_price && (
                                  <p className="text-xs text-white/60">
                                    {order.current_price.close_price <=
                                    order.target_price
                                      ? "✓ Ready"
                                      : `${formatPrice(
                                          order.target_price -
                                            order.current_price.close_price
                                        )} away`}
                                  </p>
                                )}
                            </div>
                          ) : (
                            <span className="text-white/40">N/A</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div
                            className={`flex items-center space-x-2 px-2 py-1 rounded ${getStatusColor(
                              order.status
                            )}`}
                          >
                            {getStatusIcon(order.status)}
                            <span className="text-sm font-medium capitalize">
                              {order.status.replace("_", " ")}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-white">
                          {order.executed_price
                            ? formatPrice(order.executed_price)
                            : "—"}
                        </td>
                        <td className="py-4 px-4 text-white/60 text-sm">
                          {formatDate(order.created_at)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {order.status === "waiting" && (
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              className="text-red-400 hover:text-red-300 text-sm font-medium"
                            >
                              Cancel
                            </button>
                          )}
                          {order.status === "done" && (
                            <span className="text-green-400 text-sm">
                              Completed
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Add Funds Modal */}
      {showAddFundsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-white/10"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Add Funds</h2>
              <button
                onClick={() => {
                  setShowAddFundsModal(false);
                  setAddFundsAmount("");
                }}
                className="text-white/60 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddFunds} className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Amount to Add
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={addFundsAmount}
                    onChange={(e) => setAddFundsAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                {summary && (
                  <p className="text-xs text-white/40 mt-1">
                    Current balance: {formatPrice(summary.cash_balance || 0)}
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddFundsModal(false);
                    setAddFundsAmount("");
                  }}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg text-white font-medium hover:from-green-700 hover:to-emerald-700 transition-all"
                >
                  Add Funds
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Execution Errors Modal */}
      {showExecutionErrors && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 max-w-2xl w-full border border-white/10 max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Order Execution Errors
                </h2>
                <p className="text-white/60 text-sm mt-1">
                  {executionErrors.length} order(s) failed to execute
                </p>
              </div>
              <button
                onClick={() => {
                  setShowExecutionErrors(false);
                  setExecutionErrors([]);
                }}
                className="text-white/60 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {executionErrors.map((error) => (
                <motion.div
                  key={error.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-lg p-4"
                >
                  <div className="flex items-start space-x-3">
                    <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-semibold text-white">
                          {error.stock_symbol}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/80">
                          {error.transaction_type.toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/80">
                          {error.order_type === "market" ? "Market" : "Target"}
                        </span>
                        <span className="text-white/60 text-sm">
                          Qty: {error.quantity}
                        </span>
                      </div>
                      <p className="text-red-400 text-sm">{error.error}</p>
                      {error.status === "insufficient_funds" && (
                        <p className="text-white/50 text-xs mt-2">
                          Status: {error.status.replace("_", " ").toUpperCase()}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-white/10">
              <button
                onClick={() => {
                  setShowExecutionErrors(false);
                  setExecutionErrors([]);
                }}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white font-medium transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Place Order Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-white/10"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Place Order</h2>
              <button
                onClick={() => setShowBuyModal(false)}
                className="text-white/60 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              {/* Order Type */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Order Type
                </label>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() =>
                      setBuyForm({ ...buyForm, order_type: "market" })
                    }
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      buyForm.order_type === "market"
                        ? "bg-blue-600 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    Market Order
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBuyForm({ ...buyForm, order_type: "target" })
                    }
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      buyForm.order_type === "target"
                        ? "bg-purple-600 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    Target Order
                  </button>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  {buyForm.order_type === "market"
                    ? "Buy immediately at current market price"
                    : "Buy when price reaches target price"}
                </p>
              </div>

              {/* Stock Search */}
              <div className="relative">
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Stock Symbol
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search for a stock (e.g., AAPL)"
                    className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-white/10 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((stock) => (
                      <button
                        key={stock.id}
                        type="button"
                        onClick={() => handleSelectStock(stock)}
                        className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                      >
                        <p className="text-white font-medium">{stock.symbol}</p>
                        <p className="text-sm text-white/60">{stock.name}</p>
                      </button>
                    ))}
                  </div>
                )}
                {buyForm.stock_symbol && (
                  <p className="mt-2 text-sm text-white/60">
                    Selected:{" "}
                    <span className="font-medium">{buyForm.stock_symbol}</span>
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={buyForm.quantity}
                  onChange={(e) =>
                    setBuyForm({ ...buyForm, quantity: e.target.value })
                  }
                  required
                  placeholder="0.0000"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {/* Estimated Cost Display */}
                {buyForm.quantity && selectedStock && (
                  <div className="mt-2 p-3 bg-white/5 rounded-lg">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-white/60">Estimated Cost:</span>
                      <span className="text-white font-medium">
                        {(() => {
                          const quantity = parseFloat(buyForm.quantity) || 0;
                          let price = 0;
                          if (buyForm.order_type === "market") {
                            price =
                              selectedStock.latest_price?.close_price || 0;
                          } else if (buyForm.target_price) {
                            price = parseFloat(buyForm.target_price) || 0;
                          }
                          const totalCost = quantity * price;
                          return totalCost > 0 ? formatPrice(totalCost) : "—";
                        })()}
                      </span>
                    </div>
                    {summary && buyForm.quantity && (
                      <div className="flex justify-between items-center text-xs mt-1">
                        <span className="text-white/60">Available Cash:</span>
                        <span
                          className={`font-medium ${(() => {
                            const quantity = parseFloat(buyForm.quantity) || 0;
                            let price = 0;
                            if (buyForm.order_type === "market") {
                              price =
                                selectedStock.latest_price?.close_price || 0;
                            } else if (buyForm.target_price) {
                              price = parseFloat(buyForm.target_price) || 0;
                            }
                            const totalCost = quantity * price;
                            return totalCost > summary.cash_balance
                              ? "text-red-400"
                              : "text-green-400";
                          })()}`}
                        >
                          {formatPrice(summary.cash_balance)}
                        </span>
                      </div>
                    )}
                    {summary &&
                      buyForm.quantity &&
                      (() => {
                        const quantity = parseFloat(buyForm.quantity) || 0;
                        let price = 0;
                        if (buyForm.order_type === "market") {
                          price = selectedStock.latest_price?.close_price || 0;
                        } else if (buyForm.target_price) {
                          price = parseFloat(buyForm.target_price) || 0;
                        }
                        const totalCost = quantity * price;
                        if (totalCost > 0 && totalCost > summary.cash_balance) {
                          return (
                            <p className="text-xs text-red-400 mt-1">
                              Insufficient funds. You need{" "}
                              {formatPrice(totalCost - summary.cash_balance)}{" "}
                              more.
                            </p>
                          );
                        }
                        return null;
                      })()}
                  </div>
                )}
              </div>

              {/* Target Price (only for target orders) */}
              {buyForm.order_type === "target" && (
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    Target Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={buyForm.target_price}
                    onChange={(e) =>
                      setBuyForm({ ...buyForm, target_price: e.target.value })
                    }
                    required
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-white/40 mt-1">
                    Order will execute when current price reaches or goes below
                    this price
                  </p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={buyForm.notes}
                  onChange={(e) =>
                    setBuyForm({ ...buyForm, notes: e.target.value })
                  }
                  placeholder="Add any notes about this order..."
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBuyModal(false)}
                  className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-medium hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white font-medium hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  Place Order
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Sell Order Modal */}
      {showSellModal && sellingHolding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-white/10"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Sell Stock</h2>
              <button
                onClick={() => {
                  setShowSellModal(false);
                  setSellingHolding(null);
                }}
                className="text-white/60 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-white/5 rounded-lg border border-white/10">
              <p className="text-white/60 text-sm mb-1">Stock</p>
              <p className="text-white font-semibold text-lg">
                {sellingHolding.stock_symbol}
              </p>
              <p className="text-white/60 text-sm mt-1">
                {sellingHolding.stock_details?.name || "N/A"}
              </p>
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Available:</span>
                  <span className="text-white font-medium">
                    {sellingHolding.quantity.toLocaleString()} shares
                  </span>
                </div>
                {sellingHolding.current_price && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-white/60">Current Price:</span>
                    <span className="text-white font-medium">
                      {formatPrice(sellingHolding.current_price.close_price)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleCreateSellOrder} className="space-y-4">
              {/* Order Type */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Order Type
                </label>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() =>
                      setSellForm({ ...sellForm, order_type: "market" })
                    }
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      sellForm.order_type === "market"
                        ? "bg-red-600 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    Market Order
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSellForm({ ...sellForm, order_type: "target" })
                    }
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      sellForm.order_type === "target"
                        ? "bg-orange-600 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    Target Order
                  </button>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  {sellForm.order_type === "market"
                    ? "Sell immediately at current market price"
                    : "Sell when price reaches target price"}
                </p>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  max={sellingHolding.quantity.toString()}
                  value={sellForm.quantity}
                  onChange={(e) =>
                    setSellForm({ ...sellForm, quantity: e.target.value })
                  }
                  required
                  placeholder="0.0000"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <p className="text-xs text-white/40 mt-1">
                  Maximum: {sellingHolding.quantity.toLocaleString()} shares
                </p>
              </div>

              {/* Target Price (only for target orders) */}
              {sellForm.order_type === "target" && (
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    Target Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={sellForm.target_price}
                    onChange={(e) =>
                      setSellForm({ ...sellForm, target_price: e.target.value })
                    }
                    required
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <p className="text-xs text-white/40 mt-1">
                    Order will execute when current price reaches or goes above
                    this price
                  </p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={sellForm.notes}
                  onChange={(e) =>
                    setSellForm({ ...sellForm, notes: e.target.value })
                  }
                  placeholder="Add any notes about this order..."
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSellModal(false);
                    setSellingHolding(null);
                  }}
                  className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-medium hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg text-white font-medium hover:from-red-700 hover:to-orange-700 transition-all"
                >
                  Place Sell Order
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PortfolioPage;
