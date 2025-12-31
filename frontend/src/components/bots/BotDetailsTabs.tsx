import React from "react";
import {
  Activity,
  Clock,
  BarChart3,
  History,
  FileText,
  Package,
} from "lucide-react";

interface BotDetailsTabsProps {
  activeTab:
    | "overview"
    | "executions"
    | "performance"
    | "signals"
    | "orders"
    | "portfolio";
  setActiveTab: (
    tab:
      | "overview"
      | "executions"
      | "performance"
      | "signals"
      | "orders"
      | "portfolio"
  ) => void;
  variant?: "modal" | "page";
  onTabChange?: (
    tab:
      | "overview"
      | "executions"
      | "performance"
      | "signals"
      | "orders"
      | "portfolio"
  ) => void;
}

const BotDetailsTabs: React.FC<BotDetailsTabsProps> = ({
  activeTab,
  setActiveTab,
  variant = "page",
  onTabChange,
}) => {
  const tabs = [
    "overview",
    "executions",
    "performance",
    "signals",
    "orders",
    "portfolio",
  ] as const;

  const tabIcons = {
    overview: Activity,
    executions: Clock,
    performance: BarChart3,
    signals: History,
    orders: FileText,
    portfolio: Package,
  };

  const isModal = variant === "modal";

  const handleTabClick = (
    tab:
      | "overview"
      | "executions"
      | "performance"
      | "signals"
      | "orders"
      | "portfolio"
  ) => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  return (
    <div
      className={`border-b border-gray-700 ${
        isModal ? "bg-gray-800 px-3 sm:px-6 pt-3 pb-0" : "mb-4 sm:mb-6"
      } overflow-x-auto`}
    >
      <div
        className={`flex ${
          isModal ? "gap-1 sm:gap-2" : "gap-2 sm:gap-4"
        } min-w-max sm:min-w-0`}
      >
        {tabs.map((tab) => {
          const Icon = tabIcons[tab];
          return (
            <button
              key={tab}
              onClick={() => handleTabClick(tab)}
              className={`${
                isModal
                  ? "flex-1 sm:flex-none px-3 sm:px-6 py-3 sm:py-3.5 border-b-2 transition-all capitalize font-semibold text-sm sm:text-base whitespace-nowrap flex items-center gap-2 justify-center"
                  : "px-3 sm:px-4 py-2 sm:py-3 border-b-2 transition-colors capitalize font-medium text-sm sm:text-base whitespace-nowrap flex items-center gap-2"
              } ${
                activeTab === tab
                  ? isModal
                    ? "border-blue-500 text-blue-400 bg-blue-500/20 shadow-sm"
                    : "border-blue-500 text-blue-400"
                  : isModal
                  ? "border-transparent text-gray-300 hover:text-white hover:bg-gray-700/50 hover:border-gray-600"
                  : "border-transparent text-gray-300 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BotDetailsTabs;
