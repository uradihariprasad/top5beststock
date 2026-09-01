// ─── Upstox API Types ───

export interface UpstoxTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface UpstoxInstrument {
  segment: string;
  name: string;
  exchange: string;
  isin?: string;
  instrument_type: string;
  instrument_key: string;
  lot_size: number;
  freeze_quantity?: number;
  exchange_token?: string;
  tick_size?: number;
  trading_symbol: string;
  short_name?: string;
  underlying_symbol?: string;
  underlying_key?: string;
  security_type?: string;
}

export interface UpstoxLtpc {
  ltp: number;
  ltt: string;
  ltq: string;
  cp: number;
}

export interface UpstoxBidAskQuote {
  bidQ: string;
  bidP: number;
  askQ: string;
  askP: number;
}

export interface UpstoxMarketLevel {
  bidAskQuote: UpstoxBidAskQuote[];
}

export interface UpstoxOHLC {
  interval: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: string;
  ts: string;
}

export interface UpstoxFullFeed {
  marketFF: {
    ltpc: UpstoxLtpc;
    marketLevel?: UpstoxMarketLevel;
    marketOHLC?: { ohlc: UpstoxOHLC[] };
    atp?: number;
    vtt?: string;
    oi?: number;
    tbq?: number;
    tsq?: number;
    iv?: number;
  };
}

export interface UpstoxFeedMessage {
  type: string;
  feeds?: Record<
    string,
    {
      ltpc?: UpstoxLtpc;
      fullFeed?: UpstoxFullFeed;
    }
  >;
  currentTs?: string;
  marketInfo?: {
    segmentStatus?: Record<string, string>;
  };
}

// ─── Momentum Engine Types ───

export type MomentumDirection = "BUY" | "SELL";
export type MomentumState = "NEUTRAL" | "BUY_MOMENTUM" | "SELL_MOMENTUM";
export type EventState = "ACTIVE" | "COMPLETED";

export type AgeCategory =
  | "Emerging"
  | "Developing"
  | "Established"
  | "Strong"
  | "Extended"
  | "Exhaustion Risk";

export type ConfidenceGrade = "A+" | "A" | "B+" | "B";

export interface MomentumMetrics {
  orderFlowScore: number;
  cumulativeDelta: number;
  deltaVelocity: number;
  deltaAcceleration: number;
  relativeVolume: number;
  vwapDistance: number;
  vwapSlope: number;
  oiChange: number;
  oiBehavior: string;
  trendScore: number;
  absorptionDetected: boolean;
  momentumPersistence: number;
}

export interface MomentumSignal {
  instrumentKey: string;
  tradingSymbol: string;
  direction: MomentumDirection;
  state: EventState;
  startTime: string;
  endTime?: string;
  startPrice: number;
  endPrice?: number;
  currentPrice: number;
  confidenceScore: number;
  confidenceGrade: ConfidenceGrade;
  ageCategory: AgeCategory;
  durationMinutes: number;
  metrics: MomentumMetrics;
  reasons: string[];
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
}

export interface DashboardData {
  topBuy: MomentumSignal[];
  topSell: MomentumSignal[];
  marketStatus: string;
  lastUpdate: string;
  totalFnoStocks: number;
  activeConnections: number;
  wsConnected: boolean;
}

// ─── Stock Tick State (in-memory) ───

export interface StockTickState {
  instrumentKey: string;
  tradingSymbol: string;
  ltp: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  oi: number;
  prevOi: number;
  atp: number; // VWAP proxy from Upstox
  bidPrice: number;
  askPrice: number;
  bidQty: number;
  askQty: number;
  totalBuyQty: number;
  totalSellQty: number;
  lastTradeTime: number;
  // Calculated
  cumulativeBuyVolume: number;
  cumulativeSellVolume: number;
  cumulativeDelta: number;
  deltaHistory: number[]; // last N deltas
  priceHistory: number[]; // last N prices for trend
  volumeHistory: number[]; // volume at each tick
  vwapHistory: number[]; // VWAP values
  candles1m: CandleData[];
  candles5m: CandleData[];
  candles15m: CandleData[];
  momentumState: MomentumState;
  confirmationCount: number;
  momentumStartTime?: number;
  momentumStartPrice?: number;
  maxFavorable: number;
  maxAdverse: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Historical Event ───

export interface HistoricalEvent {
  id: number;
  instrumentKey: string;
  tradingSymbol: string;
  direction: string;
  state: string;
  startTime: string;
  endTime?: string;
  startPrice: number;
  endPrice?: number;
  confidenceScore: number;
  confidenceGrade?: string;
  ageCategory?: string;
  durationMinutes?: number;
  oiBehavior?: string;
  vwapDistance?: number;
  maxFavorableExcursion?: number;
  maxAdverseExcursion?: number;
  reasons?: string[];
}

// ─── Auth Types ───

export interface AuthState {
  isAuthenticated: boolean;
  apiKey?: string;
  accessToken?: string;
}
