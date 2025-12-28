import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
// Import performance fix to handle large data in React DevTools
import "./utils/performanceFix";

// Global error handler for unhandled errors
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    // Silently handle DataCloneError from performance measurement
    if (
      event.error instanceof DOMException &&
      event.error.name === "DataCloneError" &&
      event.message?.includes("Performance")
    ) {
      event.preventDefault();
      console.warn(
        "Performance measurement error suppressed:",
        event.error.message
      );
      return false;
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    // Handle promise rejections related to performance
    if (
      event.reason instanceof DOMException &&
      event.reason.name === "DataCloneError" &&
      event.reason.message?.includes("Performance")
    ) {
      event.preventDefault();
      console.warn(
        "Performance measurement promise rejection suppressed:",
        event.reason.message
      );
      return false;
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
