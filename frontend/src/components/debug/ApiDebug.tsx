import React, { useState } from "react";
import { getMediaUrl } from "../../lib/api";
import { Bug, X } from "lucide-react";

const ApiDebug: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development mode
  if (!import.meta.env.DEV) return null;

  const testUrl = "/media/avatars/test.jpg";
  const convertedUrl = getMediaUrl(testUrl);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg z-50 transition-colors"
        title="Show API Debug Info"
      >
        <Bug className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg text-xs max-w-sm z-50 border border-purple-500/50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-purple-400">API Debug Info</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-white/60 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-1">
        <div>
          <strong>API Base:</strong>{" "}
          <span className="text-blue-300">
            {import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1"}
          </span>
        </div>
        <div>
          <strong>Test Input:</strong>{" "}
          <span className="text-yellow-300">{testUrl}</span>
        </div>
        <div>
          <strong>Converted:</strong>{" "}
          <span className="text-green-300">{convertedUrl}</span>
        </div>
        <div className="mt-2 pt-2 border-t border-white/20">
          <div className="text-white/60 text-xs">
            Avatar URLs should now load from backend domain
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiDebug;
