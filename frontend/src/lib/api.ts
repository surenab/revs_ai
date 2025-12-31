import axios, { type AxiosResponse } from 'axios';
import toast from 'react-hot-toast';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
const BACKEND_BASE_URL = API_BASE_URL.replace('/api/v1', ''); // Remove /api/v1 to get base backend URL

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      toast.error('Request timed out. Please check your connection and try again.');
      return Promise.reject(error);
    }

    // Handle network errors (no response from server)
    if (!error.response) {
      toast.error('Network error. Please check your connection and try again.');
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Only redirect if not already on login/register/forgot-password pages
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/login') &&
          !currentPath.startsWith('/register') &&
          !currentPath.startsWith('/forgot-password')) {
        window.location.href = '/login';
        toast.error('Session expired. Please login again.');
      }
    } else if (error.response?.status === 400) {
      // Handle validation errors - show detailed error messages
      const errorData = error.response.data;
      const requestUrl = error.config?.url || 'Unknown endpoint';

      let errorMessage = 'Invalid request. Please check your input.';

      if (errorData) {
        // Handle different error response formats
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (typeof errorData === 'object') {
          // Handle field-specific validation errors
          const fieldErrors = Object.entries(errorData)
            .map(([field, errors]: [string, any]) => {
              if (Array.isArray(errors)) {
                return `${field}: ${errors.join(', ')}`;
              }
              return `${field}: ${errors}`;
            })
            .join('; ');
          if (fieldErrors) {
            errorMessage = fieldErrors;
          }
        }
      }

      // Log for debugging
      console.error('400 Bad Request:', {
        url: requestUrl,
        method: error.config?.method?.toUpperCase(),
        data: errorData,
        requestData: error.config?.data
      });

      toast.error(errorMessage);
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    }
    return Promise.reject(error);
  }
);

// Types
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone_number?: string;
  date_of_birth?: string;
  bio?: string;
  avatar?: string;
  is_verified: boolean;
  is_active: boolean;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
  profile?: UserProfile;
}

export interface UserProfile {
  company?: string;
  job_title?: string;
  website?: string;
  linkedin_url?: string;
  twitter_url?: string;
  github_url?: string;
  timezone?: string;
  language?: string;
  receive_notifications: boolean;
  receive_marketing_emails: boolean;
  profile_visibility: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  date_of_birth?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  message: string;
}

export interface PasswordChangeRequest {
  old_password: string;
  new_password: string;
  new_password_confirm: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  new_password: string;
  new_password_confirm: string;
}

// Stock-related types
export interface Stock {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  sector?: string;
  industry?: string;
  market_cap?: number;
  market_cap_formatted?: string;
  description?: string;
  is_active: boolean;
  latest_price?: {
    close_price: number;
    date: string;
    price_change: number;
    price_change_percent: number;
  };
  created_at: string;
  updated_at: string;
}

export interface StockPrice {
  id: string;
  stock: string;
  stock_symbol: string;
  stock_name?: string;
  date: string;
  timestamp?: string;
  interval: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  adjusted_close?: number;
  volume: number;
  price_change: number;
  price_change_percent: number;
  created_at: string;
  updated_at: string;
}

export interface IntradayPrice {
  id: string;
  stock_symbol: string;
  stock_name?: string;
  timestamp: string;
  interval: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  vwap?: number;
  trade_count?: number;
  session_type: string;
  price_change: number;
  price_change_percent: number;
}

export interface StockTick {
  id: string;
  stock_symbol: string;
  price: number;
  volume: number;
  bid_price?: number;
  ask_price?: number;
  bid_size?: number;
  ask_size?: number;
  spread?: number;
  spread_percentage?: number;
  trade_type?: string;
  timestamp: string;
  is_market_hours: boolean;
}

export interface Watchlist {
  id: string;
  stock: string;
  stock_symbol: string;
  stock_details: Stock;
  notes?: string;
  target_price?: number;
  created_at: string;
  updated_at: string;
}

export interface StockAlert {
  id: string;
  stock: string;
  stock_symbol: string;
  stock_details: Stock;
  alert_type: string;
  threshold_value: number;
  is_active: boolean;
  is_triggered: boolean;
  triggered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MarketSummary {
  date: string;
  top_gainers: StockPrice[];
  top_losers: StockPrice[];
  most_active: StockPrice[];
}

export interface UserDashboard {
  watchlist: Array<{
    id: string;
    stock: {
      symbol: string;
      name: string;
    };
    target_price?: number;
    latest_price?: {
      close_price: number;
      date: string;
      price_change: number;
      price_change_percent: number;
    };
  }>;
  alerts_summary: {
    active_alerts: number;
    recent_triggered: number;
  };
}

export interface RealTimeQuote {
  stock: {
    symbol: string;
    name: string;
    exchange: string;
  };
  latest_tick?: StockTick;
  latest_intraday?: IntradayPrice;
}

export interface MarketDepth {
  stock: {
    symbol: string;
    name: string;
    exchange: string;
  };
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  spread?: number;
}

// API Functions
export const authAPI = {
  // Register new user
  register: (data: RegisterRequest): Promise<AxiosResponse<AuthResponse>> =>
    api.post('/auth/register/', data),

  // Login user
  login: (data: LoginRequest): Promise<AxiosResponse<AuthResponse>> =>
    api.post('/auth/login/', data),

  // Logout user
  logout: (): Promise<AxiosResponse<{ message: string }>> =>
    api.post('/auth/logout/'),

  // Request password reset
  requestPasswordReset: (data: PasswordResetRequest): Promise<AxiosResponse<{ message: string }>> =>
    api.post('/auth/password-reset/', data),

  // Confirm password reset
  confirmPasswordReset: (
    uid: string,
    token: string,
    data: PasswordResetConfirmRequest
  ): Promise<AxiosResponse<{ message: string }>> =>
    api.post(`/auth/password-reset-confirm/${uid}/${token}/`, data),
};

export const userAPI = {
  // Get current user profile
  getProfile: (): Promise<AxiosResponse<User>> =>
    api.get('/users/me/'),

  // Update current user profile
  updateProfile: (data: Partial<User>): Promise<AxiosResponse<{ user: User; message: string }>> =>
    api.patch('/users/me/', data),

  // Change password
  changePassword: (data: PasswordChangeRequest): Promise<AxiosResponse<{ message: string }>> =>
    api.post('/users/change_password/', data),

  // Get user list (admin only)
  getUsers: (): Promise<AxiosResponse<User[]>> =>
    api.get('/users/'),
};

export const stockAPI = {
  // Get all stocks
  getStocks: (params?: {
    search?: string;
    exchange?: string;
    sector?: string;
    page?: number;
    page_size?: number;
  }): Promise<AxiosResponse<{ count: number; results: Stock[] }>> =>
    api.get('/stocks/stocks/', { params }),

  // Get all stocks (lightweight - id, symbol, name only) for dropdowns
  getAllStocks: (): Promise<AxiosResponse<Stock[]>> =>
    api.get('/stocks/stocks/all/'),

  // Get stock details
  getStock: (symbol: string): Promise<AxiosResponse<Stock>> =>
    api.get(`/stocks/stocks/${symbol}/`),

  // Get stock time series data
  getTimeSeries: (symbol: string, params?: {
    interval?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }): Promise<AxiosResponse<{
    stock: { symbol: string; name: string; exchange: string };
    interval: string;
    count: number;
    prices: StockPrice[];
  }>> =>
    api.get(`/stocks/stocks/${symbol}/timeseries/`, { params }),

  // Get intraday data
  getIntradayData: (symbol: string, params?: {
    interval?: string;
    start_time?: string;
    end_time?: string;
    limit?: number;
    session_type?: string;
  }): Promise<AxiosResponse<{
    stock: { symbol: string; name: string; exchange: string };
    interval: string;
    session_type: string;
    count: number;
    prices: IntradayPrice[];
  }>> =>
    api.get(`/stocks/stocks/${symbol}/intraday/`, { params }),

  // Get tick data
  getTickData: (symbol: string, params?: {
    start_time?: string;
    end_time?: string;
    limit?: number;
    trade_type?: string;
    market_hours_only?: boolean;
  }): Promise<AxiosResponse<{
    stock: { symbol: string; name: string; exchange: string };
    filters: { trade_type: string; market_hours_only: boolean };
    count: number;
    ticks: StockTick[];
  }>> =>
    api.get(`/stocks/stocks/${symbol}/ticks/`, { params }),

  // Get real-time quote
  getRealTimeQuote: (symbol: string): Promise<AxiosResponse<RealTimeQuote>> =>
    api.get(`/stocks/stocks/${symbol}/quote/`),

  // Get market depth
  getMarketDepth: (symbol: string): Promise<AxiosResponse<MarketDepth>> =>
    api.get(`/stocks/stocks/${symbol}/depth/`),

  // Search stocks
  searchStocks: (query: string): Promise<AxiosResponse<{
    query: string;
    count: number;
    results: Stock[];
  }>> =>
    api.get('/stocks/search/', { params: { q: query } }),

  // Get market summary
  getMarketSummary: (): Promise<AxiosResponse<MarketSummary>> =>
    api.get('/stocks/market-summary/'),

  // Get user dashboard
  getUserDashboard: (): Promise<AxiosResponse<UserDashboard>> =>
    api.get('/stocks/dashboard/'),
};

export const watchlistAPI = {
  // Get user's watchlist
  getWatchlist: (): Promise<AxiosResponse<{ count: number; results: Watchlist[] }>> =>
    api.get('/stocks/watchlist/'),

  // Add stock to watchlist
  addToWatchlist: (data: {
    stock_symbol: string;
    target_price?: number;
    notes?: string;
  }): Promise<AxiosResponse<Watchlist>> =>
    api.post('/stocks/watchlist/', data),

  // Update watchlist entry
  updateWatchlist: (id: string, data: {
    target_price?: number;
    notes?: string;
  }): Promise<AxiosResponse<Watchlist>> =>
    api.patch(`/stocks/watchlist/${id}/`, data),

  // Remove from watchlist
  removeFromWatchlist: (id: string): Promise<AxiosResponse<void>> =>
    api.delete(`/stocks/watchlist/${id}/`),
};

export const alertAPI = {
  // Get user's alerts
  getAlerts: (params?: {
    is_active?: boolean;
    is_triggered?: boolean;
  }): Promise<AxiosResponse<{ count: number; results: StockAlert[] }>> =>
    api.get('/stocks/alerts/', { params }),

  // Create alert
  createAlert: (data: {
    stock_symbol: string;
    alert_type: string;
    threshold_value: number;
  }): Promise<AxiosResponse<StockAlert>> =>
    api.post('/stocks/alerts/', data),

  // Update alert
  updateAlert: (id: string, data: {
    alert_type?: string;
    threshold_value?: number;
    is_active?: boolean;
  }): Promise<AxiosResponse<StockAlert>> =>
    api.patch(`/stocks/alerts/${id}/`, data),

  // Delete alert
  deleteAlert: (id: string): Promise<AxiosResponse<void>> =>
    api.delete(`/stocks/alerts/${id}/`),
};

// Portfolio-related types
export interface Portfolio {
  id: string;
  stock: string;
  stock_symbol: string;
  stock_details: Stock;
  quantity: number;
  purchase_price: number;
  purchase_date: string;
  notes?: string;
  total_cost: number;
  current_value: number;
  gain_loss: number;
  gain_loss_percent: number;
  current_price?: {
    close_price: number;
    date: string;
    price_change: number;
    price_change_percent: number;
  };
  created_at: string;
  updated_at: string;
}

export interface PortfolioSummary {
  cash_balance: number;
  total_holdings: number;
  total_cost: number;
  total_current_value: number;
  total_gain_loss: number;
  total_gain_loss_percent: number;
  total_portfolio_value: number;
  holdings: Array<{
    id: string;
    stock: {
      symbol: string;
      name: string;
    };
    quantity: number;
    purchase_price: number;
    purchase_date: string;
    total_cost: number;
    current_value: number;
    gain_loss: number;
    gain_loss_percent: number;
    current_price?: number;
  }>;
}

export interface PortfolioCreateRequest {
  stock_symbol: string;
  quantity: number;
  purchase_price: number;
  purchase_date: string;
  notes?: string;
}

// Order-related types
export interface Order {
  id: string;
  stock: string;
  stock_symbol: string;
  stock_details: Stock;
  transaction_type: 'buy' | 'sell';
  order_type: 'market' | 'target';
  quantity: number;
  target_price?: number;
  status: 'waiting' | 'in_progress' | 'done' | 'cancelled' | 'insufficient_funds';
  executed_price?: number;
  executed_at?: string;
  notes?: string;
  can_execute: boolean;
  current_price?: {
    close_price: number;
    date: string;
    price_change: number;
    price_change_percent: number;
  };
  created_at: string;
  updated_at: string;
}

export interface OrderCreateRequest {
  stock_symbol: string;
  transaction_type: 'buy' | 'sell';
  order_type: 'market' | 'target';
  quantity: number;
  target_price?: number;
  notes?: string;
}

export interface OrderSummary {
  status_counts: {
    waiting: number;
    in_progress: number;
    done: number;
    cancelled: number;
    insufficient_funds: number;
  };
  type_counts: {
    market: number;
    target: number;
  };
  transaction_counts: {
    buy: number;
    sell: number;
  };
  total_orders: number;
  waiting_orders: Order[];
}

export const portfolioAPI = {
  // Get user's portfolio
  getPortfolio: (): Promise<AxiosResponse<{ count: number; results: Portfolio[] }>> =>
    api.get('/stocks/portfolio/'),

  // Update portfolio entry
  updatePortfolio: (id: string, data: {
    quantity?: number;
    purchase_price?: number;
    purchase_date?: string;
    notes?: string;
  }): Promise<AxiosResponse<Portfolio>> =>
    api.patch(`/stocks/portfolio/${id}/`, data),

  // Remove from portfolio (sell)
  removeFromPortfolio: (id: string): Promise<AxiosResponse<void>> =>
    api.delete(`/stocks/portfolio/${id}/`),

  // Get portfolio summary
  getPortfolioSummary: (): Promise<AxiosResponse<PortfolioSummary>> =>
    api.get('/stocks/portfolio/summary/'),

  // Add funds to cash balance
  addFunds: (amount: number): Promise<AxiosResponse<{
    message: string;
    new_balance: number;
    amount_added: number;
  }>> =>
    api.post('/stocks/portfolio/add-funds/', { amount }),
};

export const orderAPI = {
  // Get user's orders
  getOrders: (params?: {
    status?: string;
    order_type?: string;
    transaction_type?: string;
  }): Promise<AxiosResponse<{ count: number; results: Order[] }>> =>
    api.get('/stocks/orders/', { params }),

  // Create order (buy stock)
  createOrder: (data: OrderCreateRequest): Promise<AxiosResponse<Order>> =>
    api.post('/stocks/orders/', data),

  // Get order details
  getOrder: (id: string): Promise<AxiosResponse<Order>> =>
    api.get(`/stocks/orders/${id}/`),

  // Cancel order
  cancelOrder: (id: string): Promise<AxiosResponse<Order>> =>
    api.patch(`/stocks/orders/${id}/`, { status: 'cancelled' }),

  // Execute pending orders
  executeOrders: (): Promise<AxiosResponse<{
    executed_count: number;
    executed_orders: Array<{ id: string; stock_symbol: string; executed_price: number }>;
    failed_count: number;
    failed_orders: Array<{
      id: string;
      stock_symbol: string;
      transaction_type: 'buy' | 'sell';
      order_type: 'market' | 'target';
      quantity: number;
      status: string;
      error: string;
    }>;
    message: string;
  }>> =>
    api.post('/stocks/orders/execute/'),

  // Get order summary
  getOrderSummary: (): Promise<AxiosResponse<OrderSummary>> =>
    api.get('/stocks/orders/summary/'),
};

// Trading Bot Types

// Bot Portfolio Types (defined first to avoid forward reference issues)
export interface BotPortfolioLot {
  id: string;
  bot_portfolio: string;
  order?: string;
  quantity: number;
  purchase_price: number;
  purchase_date: string;
  remaining_quantity: number;
  stock_symbol: string;
  stock_name: string;
  created_at: string;
  updated_at: string;
}

export interface BotPortfolio {
  id: string;
  bot_config: string;
  stock: string;
  stock_symbol: string;
  stock_name: string;
  quantity: number;
  average_purchase_price: number;
  total_cost_basis: number;
  first_purchase_date?: string;
  last_purchase_date?: string;
  current_value: number;
  gain_loss: number;
  gain_loss_percent: number;
  lots?: BotPortfolioLot[];
  created_at: string;
  updated_at: string;
}

export interface TradingBotConfig {
  id: string;
  user: string;
  user_details?: {
    id: number;
    email: string;
    full_name: string;
    first_name?: string;
    last_name?: string;
  };
  name: string;
  is_active: boolean;
  budget_type: 'cash' | 'portfolio';
  budget_cash?: number;
  budget_portfolio?: string[];
  assigned_stocks: string[];
  max_position_size?: number;
  max_daily_trades?: number;
  max_daily_loss?: number;
  risk_per_trade: number;
  stop_loss_percent?: number;
  take_profit_percent?: number;
  period_days?: number;
  enabled_indicators: Record<string, any>;
  indicator_thresholds?: Record<string, Record<string, number>>;
  enabled_patterns: Record<string, any>;
  buy_rules: Record<string, any>;
  sell_rules: Record<string, any>;
  enabled_ml_models?: string[];
  ml_model_weights?: Record<string, number>;
  enable_social_analysis?: boolean;
  enable_news_analysis?: boolean;
  signal_aggregation_method?: string;
  signal_weights?: Record<string, number>;
  signal_thresholds?: Record<string, any>;
  risk_score_threshold?: number;
  risk_adjustment_factor?: number;
  risk_based_position_scaling?: boolean;
  signal_persistence_type?: 'tick_count' | 'time_duration' | null;
  signal_persistence_value?: number | null;
  cash_balance?: number;
  initial_cash?: number;
  initial_portfolio_value?: number;
  bot_portfolio_holdings?: BotPortfolio[];
  total_equity?: number;
  portfolio_value?: number;
  created_at: string;
  updated_at: string;
}

export interface TradingBotExecution {
  id: string;
  bot_config: string;
  bot_config_name: string;
  stock: string;
  stock_symbol: string;
  action: 'buy' | 'sell' | 'skip';
  reason: string;
  indicators_data: Record<string, any>;
  patterns_detected: Record<string, any>;
  risk_score?: number;
  persistence_met?: boolean | null;
  persistence_count?: number | null;
  persistence_signal_history?: Array<Record<string, any>>;
  executed_order?: Order;
  bot_config_settings?: {
    enable_social_analysis?: boolean;
    enable_news_analysis?: boolean;
    enabled_indicators?: string[];
    enabled_patterns?: string[];
    indicator_thresholds?: Record<string, Record<string, number>>;
  };
  signal_history?: {
    id: string;
    ml_signals?: any;
    social_signals?: any;
    news_signals?: any;
    indicator_signals?: any;
    pattern_signals?: any;
    aggregated_signal?: any;
    final_decision?: string;
    decision_confidence?: number;
    risk_score?: number;
    timestamp?: string;
    price_data_snapshot?: any;
  };
  timestamp: string;
}

export interface BotPerformance {
  bot_id: string;
  bot_name: string;
  total_trades: number;
  successful_trades: number;
  total_profit_loss: number;
  win_rate: number;
  average_profit: number;
  average_loss: number;
}

export interface BotCreateRequest {
  name: string;
  budget_type: 'cash' | 'portfolio';
  budget_cash?: number;
  budget_portfolio?: string[];
  assigned_stocks: string[];
  max_position_size?: number;
  max_daily_trades?: number;
  max_daily_loss?: number;
  risk_per_trade: number;
  stop_loss_percent?: number;
  take_profit_percent?: number;
  period_days?: number;
  enabled_indicators?: Record<string, any>;
  enabled_patterns?: Record<string, any>;
  buy_rules?: Record<string, any>;
  sell_rules?: Record<string, any>;
  enabled_ml_models?: string[];
  ml_model_weights?: Record<string, number>;
  enable_social_analysis?: boolean;
  enable_news_analysis?: boolean;
  signal_aggregation_method?: string;
  signal_weights?: Record<string, number>;
  signal_thresholds?: Record<string, any>;
  risk_score_threshold?: number;
  risk_adjustment_factor?: number;
  risk_based_position_scaling?: boolean;
  signal_persistence_type?: 'tick_count' | 'time_duration' | null;
  signal_persistence_value?: number | null;
}

// Notification Types
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  related_object_type?: string;
  related_object_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  read_at?: string;
}

export const notificationAPI = {
  getNotifications: async (params?: { page?: number; page_size?: number; is_read?: boolean }): Promise<AxiosResponse<{ count: number; results: Notification[] } | Notification[]>> => {
    return api.get('/notifications/', { params });
  },
  getUnreadCount: async (): Promise<AxiosResponse<{ count: number }>> => {
    return api.get('/notifications/unread_count/');
  },
  markAsRead: async (id: string): Promise<AxiosResponse<{ message: string }>> => {
    return api.post(`/notifications/${id}/mark_read/`);
  },
  markAllAsRead: async (): Promise<AxiosResponse<{ message: string; updated: number }>> => {
    return api.post('/notifications/mark_all_read/');
  },
  deleteNotification: async (id: string): Promise<AxiosResponse<void>> => {
    return api.delete(`/notifications/${id}/`);
  },
};

export const botAPI = {
  // Get user's trading bots
  getBots: (params?: { page?: number; page_size?: number }): Promise<AxiosResponse<{ count: number; next: string | null; previous: string | null; results: TradingBotConfig[] } | TradingBotConfig[]>> =>
    api.get('/stocks/bots/', { params }),

  // Create trading bot
  createBot: (data: BotCreateRequest): Promise<AxiosResponse<TradingBotConfig>> =>
    api.post('/stocks/bots/', data),

  // Get bot details
  getBot: (id: string): Promise<AxiosResponse<TradingBotConfig>> =>
    api.get(`/stocks/bots/${id}/`),

  // Update bot
  updateBot: (id: string, data: Partial<BotCreateRequest>): Promise<AxiosResponse<TradingBotConfig>> =>
    api.put(`/stocks/bots/${id}/`, data),

  // Delete bot
  deleteBot: (id: string): Promise<AxiosResponse<void>> =>
    api.delete(`/stocks/bots/${id}/`),

  // Activate bot
  activateBot: (id: string): Promise<AxiosResponse<TradingBotConfig>> =>
    api.post(`/stocks/bots/${id}/activate/`),

  // Deactivate bot
  deactivateBot: (id: string): Promise<AxiosResponse<TradingBotConfig>> =>
    api.post(`/stocks/bots/${id}/deactivate/`),

  // Manually execute bot
  executeBot: (id: string): Promise<AxiosResponse<{
    bot_id: string;
    bot_name: string;
    timestamp: string;
    stocks_analyzed: string[];
    buy_signals: Array<{
      stock: string;
      stock_name?: string;
      action: string;
      reason: string;
      risk_score?: number;
      confidence?: number;
      current_price?: number;
      indicators?: Record<string, any>;
      patterns?: Array<any>;
      ml_signals?: Array<any>;
      social_signals?: any;
      news_signals?: any;
      aggregated_signal?: any;
      position_size?: number;
      decision_details?: any;
      executed?: boolean;
      order_id?: string;
    }>;
    sell_signals: Array<{
      stock: string;
      stock_name?: string;
      action: string;
      reason: string;
      risk_score?: number;
      confidence?: number;
      current_price?: number;
      indicators?: Record<string, any>;
      patterns?: Array<any>;
      ml_signals?: Array<any>;
      social_signals?: any;
      news_signals?: any;
      aggregated_signal?: any;
      position_size?: number;
      decision_details?: any;
      executed?: boolean;
      order_id?: string;
    }>;
    skipped: Array<{
      stock: string;
      stock_name?: string;
      action?: string;
      reason: string;
      risk_score?: number;
      confidence?: number;
      current_price?: number;
      indicators?: Record<string, any>;
      patterns?: Array<any>;
      ml_signals?: Array<any>;
      social_signals?: any;
      news_signals?: any;
      aggregated_signal?: any;
      position_size?: number;
      decision_details?: any;
    }>;
    trades_executed?: number;
    trade_errors?: string[];
    executed_orders?: Order[];
    configurations_used?: Record<string, any>;
  }>> =>
    api.post(`/stocks/bots/${id}/execute/`),

  // Get bot execution history
  getBotExecutions: (botId: string): Promise<AxiosResponse<TradingBotExecution[]>> =>
    api.get(`/stocks/bots/${botId}/executions/`),

  // Get execution detail
  getExecutionDetail: (executionId: string): Promise<AxiosResponse<TradingBotExecution>> =>
    api.get(`/stocks/executions/${executionId}/`),

  // Get bot orders
  getBotOrders: (botId: string): Promise<AxiosResponse<{ count: number; results: Order[] } | Order[]>> =>
    api.get(`/stocks/bots/${botId}/orders/`),

  // Get bot performance
  getBotPerformance: (id: string): Promise<AxiosResponse<BotPerformance>> =>
    api.get(`/stocks/bots/${id}/performance/`),

  // Get bot portfolio holdings
  getBotPortfolio: (id: string): Promise<AxiosResponse<BotPortfolio[]>> =>
    api.get(`/stocks/bots/${id}/portfolio/`),

  // Get bot portfolio lots
  getBotPortfolioLots: (id: string, stockId?: string): Promise<AxiosResponse<BotPortfolioLot[]>> => {
    const params = stockId ? { stock_id: stockId } : {};
    return api.get(`/stocks/bots/${id}/portfolio/lots/`, { params });
  },

  // Get bot equity (cash + portfolio value)
  getBotEquity: (id: string): Promise<AxiosResponse<{
    bot_id: string;
    bot_name: string;
    cash_balance: number;
    portfolio_value: number;
    total_equity: number;
  }>> =>
    api.get(`/stocks/bots/${id}/equity/`),

  // Get bot templates
  getBotTemplates: (): Promise<AxiosResponse<Record<string, any>>> =>
    api.get('/stocks/bot-templates/'),
};

// ML Model Types
export interface MLModel {
  id: string;
  name: string;
  model_type: 'classification' | 'regression';
  framework: 'sklearn' | 'pytorch' | 'tensorflow' | 'custom';
  version: string;
  description?: string;
  parameters: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export const mlModelAPI = {
  // Get all ML models
  getModels: (params?: { is_active?: boolean; framework?: string; model_type?: string }): Promise<AxiosResponse<MLModel[]>> =>
    api.get('/stocks/ml-models/', { params }),

  // Get ML model by ID
  getModel: (id: string): Promise<AxiosResponse<MLModel>> =>
    api.get(`/stocks/ml-models/${id}/`),

  // Create ML model (admin only)
  createModel: (data: Partial<MLModel>): Promise<AxiosResponse<MLModel>> =>
    api.post('/stocks/ml-models/', data),

  // Update ML model (admin only)
  updateModel: (id: string, data: Partial<MLModel>): Promise<AxiosResponse<MLModel>> =>
    api.put(`/stocks/ml-models/${id}/`, data),

  // Delete ML model (admin only)
  deleteModel: (id: string): Promise<AxiosResponse<void>> =>
    api.delete(`/stocks/ml-models/${id}/`),

  // Make prediction
  predict: (modelId: string, data: { stock_symbol: string; price_data?: any[]; indicators?: Record<string, any> }): Promise<AxiosResponse<any>> =>
    api.post(`/stocks/ml-models/${modelId}/predict/`, data),
};

// Signal Prediction Types
export interface TimeframePrediction {
  min_timeframe?: string;
  max_timeframe?: string;
  expected_timeframe?: string;
  timeframe_confidence?: number;
}

export interface ScenarioCase {
  gain?: number;
  loss?: number;
  probability?: number;
  timeframe?: string;
}

export interface Consequences {
  best_case?: ScenarioCase;
  base_case?: ScenarioCase;
  worst_case?: ScenarioCase;
}

export interface SignalPrediction {
  possible_gain?: number;
  possible_loss?: number;
  gain_probability?: number;
  loss_probability?: number;
  timeframe_prediction?: TimeframePrediction;
  consequences?: Consequences;
}

// Signal History Types
export interface BotSignalHistory {
  id: string;
  bot_config: string;
  bot_config_name: string;
  stock: string;
  stock_symbol: string;
  timestamp: string;
  price_data_snapshot: Record<string, any>;
  ml_signals: Record<string, any>;
  social_signals: Record<string, any>;
  news_signals: Record<string, any>;
  indicator_signals: Record<string, any>;
  pattern_signals: Record<string, any>;
  aggregated_signal: Record<string, any> & SignalPrediction;
  final_decision: 'buy' | 'sell' | 'hold';
  decision_confidence?: number;
  risk_score?: number;
  execution?: string;
}

export const signalHistoryAPI = {
  // Get signal history
  getSignalHistory: (params?: { bot_id?: string; stock_symbol?: string; decision?: string; start_date?: string; end_date?: string }): Promise<AxiosResponse<BotSignalHistory[]>> =>
    api.get('/stocks/signal-history/', { params }),

  // Get signal history detail
  getSignalHistoryDetail: (id: string): Promise<AxiosResponse<BotSignalHistory>> =>
    api.get(`/stocks/signal-history/${id}/`),

  // Get signal analytics
  getSignalAnalytics: (botId: string): Promise<AxiosResponse<any[]>> =>
    api.get(`/stocks/bots/${botId}/signal-analytics/`),
};

// Utility function to convert relative media URLs to absolute backend URLs
export const getMediaUrl = (relativePath?: string | null): string | null => {
  if (!relativePath) return null;

  // If it's already an absolute URL, return as is
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }

  // If it starts with /media/, convert to backend URL
  if (relativePath.startsWith('/media/')) {
    return `${BACKEND_BASE_URL}${relativePath}`;
  }

  // If it doesn't start with /, add it
  if (!relativePath.startsWith('/')) {
    return `${BACKEND_BASE_URL}/media/${relativePath}`;
  }

  return `${BACKEND_BASE_URL}${relativePath}`;
};

// Default Indicator Thresholds
export interface DefaultIndicatorThresholds {
  [indicatorType: string]: {
    [thresholdKey: string]: number;
  };
}

/**
 * Fetch default indicator thresholds from the backend.
 * These are configurable via Django admin and fall back to code defaults.
 */
export const getDefaultIndicatorThresholds =
  async (): Promise<DefaultIndicatorThresholds> => {
    try {
      const response = await api.get<DefaultIndicatorThresholds>(
        '/stocks/default-indicator-thresholds/'
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching default indicator thresholds:', error);
      // Return empty object - frontend will use fallback
      return {};
    }
  };

// Simulation Types
export interface BotSimulationRun {
  id: string;
  user: string;
  user_details?: {
    id: number;
    email: string;
  };
  name: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  execution_start_date?: string;
  execution_end_date?: string;
  total_data_points: number;
  training_data_points?: number;
  validation_data_points?: number;
  stocks: string[] | Array<{ id: string; symbol: string; name?: string }>;
  total_bots: number;
  config_ranges: Record<string, any>;
  progress?: number | null;
  current_day?: string;
  bots_completed: number;
  top_performers?: Array<any>;
  bot_execution_times?: number[];
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  simulation_type?: "fund" | "portfolio";
  initial_fund?: number;
  initial_portfolio?: Record<string, number>; // {symbol: quantity}
}

export interface BotSimulationConfig {
  id: string;
  simulation_run: string;
  bot_index: number;
  config_json: Record<string, any>;
  assigned_stocks: string[];
  stock_symbols: string[];
  use_social_analysis: boolean;
  use_news_analysis: boolean;
}

export interface BotSimulationResult {
  id: string;
  simulation_config: BotSimulationConfig;
  total_profit: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  average_profit: number;
  average_loss: number;
  max_drawdown: number;
  sharpe_ratio?: number;
  signal_productivity: Record<string, any>;
  best_decisions: Array<any>;
  worst_decisions: Array<any>;
  final_cash: number;
  final_portfolio_value: number;
  created_at: string;
}

export interface SimulationProgress {
  simulation: {
    status: string;
    progress: number;
    current_day: string | null;
    bots_completed: number;
    total_bots: number;
  };
  bots: Array<{
    bot_index: number;
    status: string;
    progress: number;
    current_date: string | null;
    current_tick_index: number;
  }>;
  estimated_completion: string | null;
  // Legacy fields for backward compatibility
  status?: string;
  progress?: number | null;
  current_day?: string;
  bots_completed?: number;
  total_bots?: number;
  current_bot?: {
    bot_index: number;
    config: BotSimulationConfig;
  };
}

export interface SimulationCreateRequest {
  name: string;
  stock_ids?: string[];
  stocks?: string[]; // Legacy support
  config_ranges: Record<string, any>;
  training_start?: string;
  training_end?: string;
  validation_start?: string;
  validation_end?: string;
  execution_start_date?: string;
  execution_end_date?: string;
  simulation_type?: "fund" | "portfolio";
  initial_fund?: number;
  initial_portfolio?: Record<string, number>; // {symbol: quantity}
}

export const simulationAPI = {
  // Create new simulation
  createSimulation: (data: SimulationCreateRequest): Promise<AxiosResponse<BotSimulationRun>> =>
    api.post('/simulations/create/', data),

  // Update simulation
  updateSimulation: (id: string, data: Partial<SimulationCreateRequest>): Promise<AxiosResponse<BotSimulationRun>> =>
    api.patch(`/simulations/${id}/`, data),

  // Get all simulations
  getSimulations: (): Promise<AxiosResponse<BotSimulationRun[]>> =>
    api.get('/simulations/'),

  // Get simulation detail
  getSimulation: (id: string): Promise<AxiosResponse<BotSimulationRun>> =>
    api.get(`/simulations/${id}/`),

  // Get simulation status
  getSimulationStatus: (id: string): Promise<AxiosResponse<{
    id: string;
    status: string;
    progress?: number | null;
    current_day?: string;
    bots_completed: number;
    total_bots: number;
    started_at?: string;
    completed_at?: string;
    error_message?: string;
  }>> =>
    api.get(`/simulations/${id}/status/`),

  // Get simulation results
  getSimulationResults: (id: string): Promise<AxiosResponse<{
    simulation: BotSimulationRun;
    results: BotSimulationResult[];
    top_performers?: Array<any>;
  }>> =>
    api.get(`/simulations/${id}/results/`),

  // Get simulation progress (real-time) - enhanced with bot details
  getSimulationProgress: (id: string): Promise<AxiosResponse<{
    simulation: {
      status: string;
      progress: number;
      current_day: string | null;
      bots_completed: number;
      total_bots: number;
    };
    bots: Array<{
      bot_index: number;
      status: string;
      progress: number;
      current_date: string | null;
      current_tick_index: number;
    }>;
    estimated_completion: string | null;
  }>> =>
    api.get(`/simulations/${id}/progress/`),

  // Cancel simulation
  cancelSimulation: (id: string): Promise<AxiosResponse<{ message: string; status: string }>> =>
    api.post(`/simulations/${id}/cancel/`),

  // Rerun simulation
  rerunSimulation: (id: string): Promise<AxiosResponse<{
    message: string;
    simulation: BotSimulationRun;
    status: string;
    task_id?: string;
  }>> =>
    api.post(`/simulations/${id}/rerun/`),

  // Pause simulation
  pauseSimulation: (id: string): Promise<AxiosResponse<{ message: string; status: string }>> =>
    api.post(`/simulations/${id}/pause/`),

  // Resume simulation
  resumeSimulation: (id: string): Promise<AxiosResponse<{ message: string; status: string }>> =>
    api.post(`/simulations/${id}/resume/`),

  // Get comprehensive analysis
  getSimulationAnalysis: (id: string): Promise<AxiosResponse<{
    simulation_id: string;
    simulation_name: string;
    total_bots: number;
    top_performers: Array<{
      bot_index: number;
      total_profit: number;
      win_rate: number;
      total_trades: number;
      config: Record<string, any>;
    }>;
    indicator_impact: Record<string, any>;
    pattern_impact: Record<string, any>;
    signal_impact: Record<string, any>;
    daily_performance: Array<{
      date: string;
      daily_profit: number;
      cumulative_profit: number;
      cash: number;
      portfolio_value: number;
      total_value: number;
      trades_today: number;
    }>;
  }>> =>
    api.get(`/simulations/${id}/analysis/`),

  // Get bot progress details
  getBotProgress: (simulationId: string, botId: string): Promise<AxiosResponse<{
    bot_index: number;
    status: string;
    progress: number;
    current_date: string | null;
    current_tick_index: number;
    total_ticks_today: number;
    config: any;
  }>> =>
    api.get(`/simulations/${simulationId}/bots/${botId}/progress/`),

  // Get tick-level results
  getTicks: (id: string, params?: {
    bot_config_id?: string;
    date_from?: string;
    date_to?: string;
    stock_symbol?: string;
  }): Promise<AxiosResponse<{
    simulation_id: string;
    total_ticks: number;
    ticks: Array<{
      id: string;
      date: string;
      tick_timestamp: string;
      stock_symbol: string;
      tick_price: number;
      decision: any;
      signal_contributions: any;
      portfolio_state: any;
      cumulative_profit: number;
      trade_executed: boolean;
      trade_details: any;
    }>;
  }>> =>
    api.get(`/simulations/${id}/results/ticks/`, { params }),

  // Get daily results for a bot config
  getDailyResults: (configId: string, params?: {
    phase?: string;
  }): Promise<AxiosResponse<Array<{
    id: string;
    date: string;
    decisions: Record<string, any>;
    performance_metrics: Record<string, any>;
    signal_contributions?: Record<string, any>;
  }>>> =>
    api.get(`/simulations/daily-results/${configId}/`, { params }),
};

export default api;
