import type {
  StockTickState,
  MomentumMetrics,
  MomentumSignal,
  MomentumDirection,
  MomentumState,
  ConfidenceGrade,
  AgeCategory,
  CandleData,
} from "./types";

// ─── Configuration ───

const CONFIG = {
  ORDER_FLOW_THRESHOLD: 55,
  RELATIVE_VOLUME_THRESHOLD: 1.2,
  CONFIRMATION_COUNT: 3,
  MIN_CONFIDENCE: 60,
  DELTA_HISTORY_SIZE: 60,
  PRICE_HISTORY_SIZE: 100,
  VWAP_HISTORY_SIZE: 60,
};

// ─── Confidence Weights ───

const WEIGHTS = {
  orderFlow: 0.25,
  cumulativeDelta: 0.2,
  relativeVolume: 0.15,
  vwapStrength: 0.1,
  oiConfirmation: 0.1,
  trendStructure: 0.1,
  momentumPersistence: 0.1,
};

// ─── Initialize Stock State ───

export function createStockTickState(
  instrumentKey: string,
  tradingSymbol: string
): StockTickState {
  return {
    instrumentKey,
    tradingSymbol,
    ltp: 0,
    prevClose: 0,
    open: 0,
    high: 0,
    low: 0,
    volume: 0,
    oi: 0,
    prevOi: 0,
    atp: 0,
    bidPrice: 0,
    askPrice: 0,
    bidQty: 0,
    askQty: 0,
    totalBuyQty: 0,
    totalSellQty: 0,
    lastTradeTime: 0,
    cumulativeBuyVolume: 0,
    cumulativeSellVolume: 0,
    cumulativeDelta: 0,
    deltaHistory: [],
    priceHistory: [],
    volumeHistory: [],
    vwapHistory: [],
    candles1m: [],
    candles5m: [],
    candles15m: [],
    momentumState: "NEUTRAL",
    confirmationCount: 0,
    maxFavorable: 0,
    maxAdverse: 0,
  };
}

// ─── Update tick state from WebSocket data ───

export function updateTickState(
  state: StockTickState,
  data: {
    ltp: number;
    ltq: number;
    ltt: number;
    cp: number;
    open?: number;
    high?: number;
    low?: number;
    volume?: number;
    oi?: number;
    atp?: number;
    bidPrice?: number;
    askPrice?: number;
    bidQty?: number;
    askQty?: number;
    totalBuyQty?: number;
    totalSellQty?: number;
  }
): void {
  const prevLtp = state.ltp;

  state.ltp = data.ltp;
  state.prevClose = data.cp || state.prevClose;
  if (data.open) state.open = data.open;
  if (data.high) state.high = data.high;
  if (data.low) state.low = data.low;
  if (data.volume) state.volume = data.volume;
  if (data.oi !== undefined) {
    state.prevOi = state.oi || data.oi;
    state.oi = data.oi;
  }
  if (data.atp) state.atp = data.atp;
  if (data.bidPrice) state.bidPrice = data.bidPrice;
  if (data.askPrice) state.askPrice = data.askPrice;
  if (data.bidQty) state.bidQty = data.bidQty;
  if (data.askQty) state.askQty = data.askQty;
  if (data.totalBuyQty) state.totalBuyQty = data.totalBuyQty;
  if (data.totalSellQty) state.totalSellQty = data.totalSellQty;
  state.lastTradeTime = data.ltt;

  // Order flow classification: estimate trade direction
  const tradeQty = data.ltq || 1;
  const mid = (state.bidPrice + state.askPrice) / 2 || state.ltp;

  if (state.bidPrice > 0 && state.askPrice > 0) {
    if (data.ltp >= state.askPrice) {
      // Aggressive buy
      state.cumulativeBuyVolume += tradeQty;
    } else if (data.ltp <= state.bidPrice) {
      // Aggressive sell
      state.cumulativeSellVolume += tradeQty;
    } else if (data.ltp > mid) {
      state.cumulativeBuyVolume += tradeQty * 0.7;
      state.cumulativeSellVolume += tradeQty * 0.3;
    } else {
      state.cumulativeBuyVolume += tradeQty * 0.3;
      state.cumulativeSellVolume += tradeQty * 0.7;
    }
  } else {
    // Fallback: use price direction
    if (data.ltp > prevLtp) {
      state.cumulativeBuyVolume += tradeQty;
    } else if (data.ltp < prevLtp) {
      state.cumulativeSellVolume += tradeQty;
    } else {
      state.cumulativeBuyVolume += tradeQty * 0.5;
      state.cumulativeSellVolume += tradeQty * 0.5;
    }
  }

  state.cumulativeDelta =
    state.cumulativeBuyVolume - state.cumulativeSellVolume;

  // Update histories
  state.deltaHistory.push(state.cumulativeDelta);
  if (state.deltaHistory.length > CONFIG.DELTA_HISTORY_SIZE)
    state.deltaHistory.shift();

  state.priceHistory.push(data.ltp);
  if (state.priceHistory.length > CONFIG.PRICE_HISTORY_SIZE)
    state.priceHistory.shift();

  if (data.volume) {
    state.volumeHistory.push(data.volume);
    if (state.volumeHistory.length > CONFIG.PRICE_HISTORY_SIZE)
      state.volumeHistory.shift();
  }

  if (state.atp > 0) {
    state.vwapHistory.push(state.atp);
    if (state.vwapHistory.length > CONFIG.VWAP_HISTORY_SIZE)
      state.vwapHistory.shift();
  }

  // Update candles
  updateCandles(state, data.ltp, data.ltt, tradeQty);

  // Track excursion for active momentum
  if (state.momentumStartPrice) {
    if (state.momentumState === "BUY_MOMENTUM") {
      const favorable = data.ltp - state.momentumStartPrice;
      const adverse = state.momentumStartPrice - data.ltp;
      state.maxFavorable = Math.max(state.maxFavorable, favorable);
      state.maxAdverse = Math.max(state.maxAdverse, adverse);
    } else if (state.momentumState === "SELL_MOMENTUM") {
      const favorable = state.momentumStartPrice - data.ltp;
      const adverse = data.ltp - state.momentumStartPrice;
      state.maxFavorable = Math.max(state.maxFavorable, favorable);
      state.maxAdverse = Math.max(state.maxAdverse, adverse);
    }
  }
}

// ─── Candle management ───

function updateCandles(
  state: StockTickState,
  price: number,
  timestamp: number,
  volume: number
): void {
  updateCandleArray(state.candles1m, price, timestamp, volume, 60000);
  updateCandleArray(state.candles5m, price, timestamp, volume, 300000);
  updateCandleArray(state.candles15m, price, timestamp, volume, 900000);
}

function updateCandleArray(
  candles: CandleData[],
  price: number,
  timestamp: number,
  volume: number,
  intervalMs: number
): void {
  const candleTime = Math.floor(timestamp / intervalMs) * intervalMs;
  const last = candles[candles.length - 1];

  if (last && last.time === candleTime) {
    last.high = Math.max(last.high, price);
    last.low = Math.min(last.low, price);
    last.close = price;
    last.volume += volume;
  } else {
    candles.push({
      time: candleTime,
      open: price,
      high: price,
      low: price,
      close: price,
      volume,
    });
    // Keep last 100 candles
    if (candles.length > 100) candles.shift();
  }
}

// ─── Calculate Momentum Metrics ───

export function calculateMetrics(state: StockTickState): MomentumMetrics {
  const orderFlowScore = calculateOrderFlowScore(state);
  const deltaMetrics = calculateDeltaMetrics(state);
  const relativeVolume = calculateRelativeVolume(state);
  const vwapMetrics = calculateVwapMetrics(state);
  const oiMetrics = calculateOiMetrics(state);
  const trendScore = calculateTrendScore(state);
  const absorptionDetected = detectAbsorption(state);
  const momentumPersistence = calculateMomentumPersistence(state);

  return {
    orderFlowScore,
    cumulativeDelta: state.cumulativeDelta,
    deltaVelocity: deltaMetrics.velocity,
    deltaAcceleration: deltaMetrics.acceleration,
    relativeVolume,
    vwapDistance: vwapMetrics.distance,
    vwapSlope: vwapMetrics.slope,
    oiChange: oiMetrics.change,
    oiBehavior: oiMetrics.behavior,
    trendScore,
    absorptionDetected,
    momentumPersistence,
  };
}

function calculateOrderFlowScore(state: StockTickState): number {
  const totalVol = state.cumulativeBuyVolume + state.cumulativeSellVolume;
  if (totalVol === 0) return 50;

  const buyPct = (state.cumulativeBuyVolume / totalVol) * 100;
  // Also factor in order book imbalance
  const totalBookQty = state.totalBuyQty + state.totalSellQty;
  let bookImbalance = 50;
  if (totalBookQty > 0) {
    bookImbalance = (state.totalBuyQty / totalBookQty) * 100;
  }

  return buyPct * 0.7 + bookImbalance * 0.3;
}

function calculateDeltaMetrics(state: StockTickState): {
  velocity: number;
  acceleration: number;
} {
  const hist = state.deltaHistory;
  if (hist.length < 3) return { velocity: 0, acceleration: 0 };

  const n = Math.min(hist.length, 10);
  const recent = hist.slice(-n);
  const velocity = (recent[recent.length - 1] - recent[0]) / n;

  if (hist.length < 6) return { velocity, acceleration: 0 };

  const mid = Math.floor(n / 2);
  const v1 = (recent[mid] - recent[0]) / mid;
  const v2 = (recent[recent.length - 1] - recent[mid]) / (n - mid);
  const acceleration = v2 - v1;

  return { velocity, acceleration };
}

function calculateRelativeVolume(state: StockTickState): number {
  // Compare current volume against what we have
  // Without historical data, use total buy+sell qty as relative indicator
  if (state.volume === 0) return 1;
  const avgVol = state.volumeHistory.length > 5
    ? state.volumeHistory.slice(0, -1).reduce((a, b) => a + b, 0) /
      (state.volumeHistory.length - 1)
    : state.volume;

  if (avgVol === 0) return 1;
  return state.volume / avgVol;
}

function calculateVwapMetrics(state: StockTickState): {
  distance: number;
  slope: number;
} {
  const vwap = state.atp;
  if (vwap === 0 || state.ltp === 0) return { distance: 0, slope: 0 };

  const distance = ((state.ltp - vwap) / vwap) * 100;

  // VWAP slope from history
  let slope = 0;
  if (state.vwapHistory.length >= 3) {
    const n = Math.min(state.vwapHistory.length, 10);
    const recent = state.vwapHistory.slice(-n);
    slope = (recent[recent.length - 1] - recent[0]) / n;
  }

  return { distance, slope };
}

function calculateOiMetrics(state: StockTickState): {
  change: number;
  behavior: string;
} {
  if (state.oi === 0 || state.prevOi === 0)
    return { change: 0, behavior: "Unknown" };

  const oiChange = ((state.oi - state.prevOi) / state.prevOi) * 100;
  const priceChange = state.prevClose > 0
    ? ((state.ltp - state.prevClose) / state.prevClose) * 100
    : 0;

  let behavior = "Unknown";
  if (priceChange > 0 && oiChange > 0) behavior = "Long Buildup";
  else if (priceChange < 0 && oiChange > 0) behavior = "Short Buildup";
  else if (priceChange > 0 && oiChange < 0) behavior = "Short Covering";
  else if (priceChange < 0 && oiChange < 0) behavior = "Long Unwinding";

  return { change: oiChange, behavior };
}

function calculateTrendScore(state: StockTickState): number {
  const candles = state.candles5m;
  if (candles.length < 3) return 50;

  let score = 50;
  const recent = candles.slice(-5);

  // Higher highs & higher lows = bullish
  let hhCount = 0;
  let hlCount = 0;
  let lhCount = 0;
  let llCount = 0;

  for (let i = 1; i < recent.length; i++) {
    if (recent[i].high > recent[i - 1].high) hhCount++;
    else lhCount++;
    if (recent[i].low > recent[i - 1].low) hlCount++;
    else llCount++;
  }

  // Bullish trend: HH & HL
  score += (hhCount + hlCount) * 5;
  // Bearish trend: LH & LL
  score -= (lhCount + llCount) * 5;

  // EMA slope from 1m candles
  if (state.candles1m.length >= 10) {
    const closes = state.candles1m.slice(-10).map((c) => c.close);
    const ema = calculateEMA(closes, 10);
    const emaSlope = ema[ema.length - 1] - ema[Math.max(0, ema.length - 5)];
    score += Math.min(Math.max(emaSlope * 10, -15), 15);
  }

  return Math.min(Math.max(score, 0), 100);
}

function calculateEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function detectAbsorption(state: StockTickState): boolean {
  if (state.priceHistory.length < 10) return false;

  const recent = state.priceHistory.slice(-10);
  const priceRange = Math.max(...recent) - Math.min(...recent);
  const avgPrice = recent.reduce((a, b) => a + b, 0) / recent.length;
  const pctRange = (priceRange / avgPrice) * 100;

  // Large volume but small price range = absorption
  const totalFlow = state.cumulativeBuyVolume + state.cumulativeSellVolume;
  if (totalFlow > 0 && pctRange < 0.1) {
    return true;
  }

  return false;
}

function calculateMomentumPersistence(state: StockTickState): number {
  if (state.momentumState === "NEUTRAL") return 0;

  const startTime = state.momentumStartTime || Date.now();
  const duration = (Date.now() - startTime) / 60000; // minutes

  // Persistence is higher for sustained momentum
  if (duration < 5) return 30;
  if (duration < 15) return 50;
  if (duration < 30) return 70;
  if (duration < 60) return 85;
  return 95;
}

// ─── Evaluate Momentum State ───

export function evaluateMomentum(
  state: StockTickState,
  metrics: MomentumMetrics
): {
  newState: MomentumState;
  signal?: MomentumSignal;
  eventEnded?: boolean;
} {
  const buyConditions = checkBuyConditions(state, metrics);
  const sellConditions = checkSellConditions(state, metrics);

  const now = Date.now();

  // Currently neutral
  if (state.momentumState === "NEUTRAL") {
    if (buyConditions.passed) {
      state.confirmationCount++;
      if (state.confirmationCount >= CONFIG.CONFIRMATION_COUNT) {
        state.momentumState = "BUY_MOMENTUM";
        state.momentumStartTime = now;
        state.momentumStartPrice = state.ltp;
        state.maxFavorable = 0;
        state.maxAdverse = 0;
        state.confirmationCount = 0;

        const signal = buildSignal(state, metrics, "BUY", buyConditions.reasons);
        return { newState: "BUY_MOMENTUM", signal };
      }
    } else if (sellConditions.passed) {
      state.confirmationCount++;
      if (state.confirmationCount >= CONFIG.CONFIRMATION_COUNT) {
        state.momentumState = "SELL_MOMENTUM";
        state.momentumStartTime = now;
        state.momentumStartPrice = state.ltp;
        state.maxFavorable = 0;
        state.maxAdverse = 0;
        state.confirmationCount = 0;

        const signal = buildSignal(
          state,
          metrics,
          "SELL",
          sellConditions.reasons
        );
        return { newState: "SELL_MOMENTUM", signal };
      }
    } else {
      state.confirmationCount = 0;
    }
    return { newState: "NEUTRAL" };
  }

  // Currently in BUY momentum
  if (state.momentumState === "BUY_MOMENTUM") {
    if (!buyConditions.stillValid) {
      // Momentum ended
      state.momentumState = "NEUTRAL";
      state.confirmationCount = 0;
      const signal = buildSignal(state, metrics, "BUY", buyConditions.reasons);
      state.momentumStartTime = undefined;
      state.momentumStartPrice = undefined;
      return { newState: "NEUTRAL", signal, eventEnded: true };
    }
    const signal = buildSignal(state, metrics, "BUY", buyConditions.reasons);
    return { newState: "BUY_MOMENTUM", signal };
  }

  // Currently in SELL momentum
  if (state.momentumState === "SELL_MOMENTUM") {
    if (!sellConditions.stillValid) {
      state.momentumState = "NEUTRAL";
      state.confirmationCount = 0;
      const signal = buildSignal(
        state,
        metrics,
        "SELL",
        sellConditions.reasons
      );
      state.momentumStartTime = undefined;
      state.momentumStartPrice = undefined;
      return { newState: "NEUTRAL", signal, eventEnded: true };
    }
    const signal = buildSignal(state, metrics, "SELL", sellConditions.reasons);
    return { newState: "SELL_MOMENTUM", signal };
  }

  return { newState: state.momentumState };
}

// ─── Check conditions ───

function checkBuyConditions(
  state: StockTickState,
  metrics: MomentumMetrics
): { passed: boolean; stillValid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let passCount = 0;
  let totalChecks = 0;

  // 1. Order flow
  totalChecks++;
  if (metrics.orderFlowScore > CONFIG.ORDER_FLOW_THRESHOLD) {
    passCount++;
    reasons.push(
      `Buyer domination ${metrics.orderFlowScore.toFixed(0)}%`
    );
  }

  // 2. Delta rising
  totalChecks++;
  if (metrics.deltaVelocity > 0) {
    passCount++;
    reasons.push("Cumulative delta rising");
  }

  // 3. Relative volume
  totalChecks++;
  if (metrics.relativeVolume > CONFIG.RELATIVE_VOLUME_THRESHOLD) {
    passCount++;
    reasons.push(`Volume ${metrics.relativeVolume.toFixed(1)}×`);
  }

  // 4. Price above VWAP
  totalChecks++;
  if (metrics.vwapDistance > 0) {
    passCount++;
    reasons.push(`VWAP +${metrics.vwapDistance.toFixed(2)}%`);
  }

  // 5. VWAP slope positive
  totalChecks++;
  if (metrics.vwapSlope > 0) {
    passCount++;
    reasons.push("VWAP slope positive");
  }

  // 6. 5min trend positive
  totalChecks++;
  if (metrics.trendScore > 55) {
    passCount++;
    reasons.push("Trend intact");
  }

  // 7. OI confirmation
  totalChecks++;
  if (
    metrics.oiBehavior === "Long Buildup" ||
    metrics.oiBehavior === "Short Covering"
  ) {
    passCount++;
    reasons.push(`${metrics.oiBehavior} (OI ${metrics.oiChange > 0 ? "+" : ""}${metrics.oiChange.toFixed(1)}%)`);
  }

  // 8. No absorption
  totalChecks++;
  if (!metrics.absorptionDetected) {
    passCount++;
    reasons.push("No absorption detected");
  }

  const passed = passCount >= 5; // At least 5 of 8 conditions
  const stillValid = passCount >= 3; // At least 3 to stay valid

  return { passed, stillValid, reasons };
}

function checkSellConditions(
  state: StockTickState,
  metrics: MomentumMetrics
): { passed: boolean; stillValid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let passCount = 0;
  let totalChecks = 0;

  // 1. Seller domination
  totalChecks++;
  if (metrics.orderFlowScore < 100 - CONFIG.ORDER_FLOW_THRESHOLD) {
    passCount++;
    reasons.push(
      `Seller domination ${(100 - metrics.orderFlowScore).toFixed(0)}%`
    );
  }

  // 2. Delta falling
  totalChecks++;
  if (metrics.deltaVelocity < 0) {
    passCount++;
    reasons.push("Cumulative delta falling");
  }

  // 3. Relative volume
  totalChecks++;
  if (metrics.relativeVolume > CONFIG.RELATIVE_VOLUME_THRESHOLD) {
    passCount++;
    reasons.push(`Volume ${metrics.relativeVolume.toFixed(1)}×`);
  }

  // 4. Price below VWAP
  totalChecks++;
  if (metrics.vwapDistance < 0) {
    passCount++;
    reasons.push(`VWAP ${metrics.vwapDistance.toFixed(2)}%`);
  }

  // 5. VWAP slope negative
  totalChecks++;
  if (metrics.vwapSlope < 0) {
    passCount++;
    reasons.push("VWAP slope negative");
  }

  // 6. 5min trend negative
  totalChecks++;
  if (metrics.trendScore < 45) {
    passCount++;
    reasons.push("Trend bearish");
  }

  // 7. OI confirmation
  totalChecks++;
  if (
    metrics.oiBehavior === "Short Buildup" ||
    metrics.oiBehavior === "Long Unwinding"
  ) {
    passCount++;
    reasons.push(`${metrics.oiBehavior} (OI ${metrics.oiChange > 0 ? "+" : ""}${metrics.oiChange.toFixed(1)}%)`);
  }

  // 8. No absorption
  totalChecks++;
  if (!metrics.absorptionDetected) {
    passCount++;
    reasons.push("No absorption detected");
  }

  const passed = passCount >= 5;
  const stillValid = passCount >= 3;

  return { passed, stillValid, reasons };
}

// ─── Build Signal ───

function buildSignal(
  state: StockTickState,
  metrics: MomentumMetrics,
  direction: MomentumDirection,
  reasons: string[]
): MomentumSignal {
  const now = Date.now();
  const startTime = state.momentumStartTime || now;
  const durationMinutes = (now - startTime) / 60000;

  const confidenceScore = calculateConfidence(metrics, durationMinutes);
  const confidenceGrade = getConfidenceGrade(confidenceScore);
  const ageCategory = getAgeCategory(durationMinutes);

  return {
    instrumentKey: state.instrumentKey,
    tradingSymbol: state.tradingSymbol,
    direction,
    state: state.momentumState !== "NEUTRAL" ? "ACTIVE" : "COMPLETED",
    startTime: new Date(startTime).toISOString(),
    currentPrice: state.ltp,
    startPrice: state.momentumStartPrice || state.ltp,
    confidenceScore,
    confidenceGrade,
    ageCategory,
    durationMinutes,
    metrics,
    reasons,
    maxFavorableExcursion: state.maxFavorable,
    maxAdverseExcursion: state.maxAdverse,
  };
}

// ─── Confidence Score ───

function calculateConfidence(
  metrics: MomentumMetrics,
  durationMinutes: number
): number {
  // Normalize each metric to 0-100
  const orderFlowNorm = Math.min(
    Math.max(Math.abs(metrics.orderFlowScore - 50) * 2, 0),
    100
  );
  const deltaNorm = Math.min(
    Math.abs(metrics.deltaVelocity) * 10,
    100
  );
  const volumeNorm = Math.min(
    (metrics.relativeVolume / 3) * 100,
    100
  );
  const vwapNorm = Math.min(
    Math.abs(metrics.vwapDistance) * 20,
    100
  );
  const oiNorm =
    metrics.oiBehavior === "Long Buildup" ||
    metrics.oiBehavior === "Short Buildup"
      ? 80
      : metrics.oiBehavior === "Short Covering" ||
        metrics.oiBehavior === "Long Unwinding"
      ? 60
      : 30;
  const trendNorm = Math.abs(metrics.trendScore - 50) * 2;
  const persistenceNorm = metrics.momentumPersistence;

  const score =
    orderFlowNorm * WEIGHTS.orderFlow +
    deltaNorm * WEIGHTS.cumulativeDelta +
    volumeNorm * WEIGHTS.relativeVolume +
    vwapNorm * WEIGHTS.vwapStrength +
    oiNorm * WEIGHTS.oiConfirmation +
    trendNorm * WEIGHTS.trendStructure +
    persistenceNorm * WEIGHTS.momentumPersistence;

  // Penalty for absorption
  const absorptionPenalty = metrics.absorptionDetected ? 15 : 0;

  return Math.min(Math.max(Math.round(score - absorptionPenalty), 0), 100);
}

function getConfidenceGrade(score: number): ConfidenceGrade {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  return "B";
}

function getAgeCategory(durationMinutes: number): AgeCategory {
  if (durationMinutes <= 10) return "Emerging";
  if (durationMinutes <= 25) return "Developing";
  if (durationMinutes <= 45) return "Established";
  if (durationMinutes <= 75) return "Strong";
  if (durationMinutes <= 105) return "Extended";
  return "Exhaustion Risk";
}

// ─── Ranking ───

export function rankSignals(
  signals: MomentumSignal[],
  direction: MomentumDirection,
  limit: number = 10
): MomentumSignal[] {
  return signals
    .filter(
      (s) =>
        s.direction === direction &&
        s.state === "ACTIVE" &&
        s.confidenceScore >= CONFIG.MIN_CONFIDENCE
    )
    .sort((a, b) => {
      // Multi-factor ranking
      const scoreA =
        a.confidenceScore * 0.35 +
        Math.min(a.durationMinutes, 60) * 0.2 +
        Math.abs(a.metrics.cumulativeDelta) * 0.001 * 0.15 +
        (a.metrics.oiBehavior.includes("Buildup") ? 20 : 0) * 0.15 +
        a.metrics.relativeVolume * 10 * 0.15;

      const scoreB =
        b.confidenceScore * 0.35 +
        Math.min(b.durationMinutes, 60) * 0.2 +
        Math.abs(b.metrics.cumulativeDelta) * 0.001 * 0.15 +
        (b.metrics.oiBehavior.includes("Buildup") ? 20 : 0) * 0.15 +
        b.metrics.relativeVolume * 10 * 0.15;

      return scoreB - scoreA;
    })
    .slice(0, limit);
}
