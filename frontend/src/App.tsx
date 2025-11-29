import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";
import { WatchlistProvider } from "./contexts/WatchlistContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/layout/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import ContactSupport from "./pages/ContactSupport";
import Stocks from "./pages/Stocks";
import StockDetail from "./pages/StockDetail";
import IndicatorDetail from "./pages/IndicatorDetail";
import Indicators from "./pages/Indicators";
import PatternDetail from "./pages/PatternDetail";
import Patterns from "./pages/Patterns";
import PortfolioPage from "./pages/Portfolio";

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <WatchlistProvider>
                    <Layout />
                  </WatchlistProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
              <Route path="contact-support" element={<ContactSupport />} />

              {/* Stock routes */}
              <Route path="stocks" element={<Stocks />} />
              <Route path="stocks/:symbol" element={<StockDetail />} />

              {/* Indicator routes */}
              <Route path="indicators" element={<Indicators />} />
              <Route path="indicators/:id" element={<IndicatorDetail />} />

              {/* Pattern routes */}
              <Route path="patterns" element={<Patterns />} />
              <Route path="patterns/:id" element={<PatternDetail />} />

              {/* Portfolio route */}
              <Route path="portfolio" element={<PortfolioPage />} />
            </Route>

            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>

          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(10px)",
                color: "#fff",
                border: "1px solid rgba(255, 255, 255, 0.2)",
              },
              success: {
                iconTheme: {
                  primary: "#10b981",
                  secondary: "#fff",
                },
              },
              error: {
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#fff",
                },
              },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
