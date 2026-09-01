import {
  pgTable,
  serial,
  text,
  timestamp,
  real,
  integer,
  boolean,
  jsonb,
  varchar,
  index,
} from "drizzle-orm/pg-core";

// OAuth sessions
export const authSessions = pgTable("auth_sessions", {
  id: serial("id").primaryKey(),
  apiKey: text("api_key").notNull(),
  apiSecret: text("api_secret").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  accessToken: text("access_token"),
  tokenExpiry: timestamp("token_expiry"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// F&O instrument universe
export const fnoInstruments = pgTable(
  "fno_instruments",
  {
    id: serial("id").primaryKey(),
    instrumentKey: varchar("instrument_key", { length: 100 }).notNull().unique(),
    tradingSymbol: varchar("trading_symbol", { length: 100 }).notNull(),
    name: text("name"),
    isin: varchar("isin", { length: 20 }),
    exchange: varchar("exchange", { length: 10 }).default("NSE"),
    segment: varchar("segment", { length: 20 }).default("NSE_EQ"),
    lotSize: integer("lot_size").default(1),
    tickSize: real("tick_size"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_fno_instrument_key").on(table.instrumentKey)]
);

// Momentum events (historical + active)
export const momentumEvents = pgTable(
  "momentum_events",
  {
    id: serial("id").primaryKey(),
    instrumentKey: varchar("instrument_key", { length: 100 }).notNull(),
    tradingSymbol: varchar("trading_symbol", { length: 100 }).notNull(),
    direction: varchar("direction", { length: 10 }).notNull(), // BUY or SELL
    state: varchar("state", { length: 20 }).notNull(), // ACTIVE, COMPLETED
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time"),
    startPrice: real("start_price").notNull(),
    endPrice: real("end_price"),
    currentPrice: real("current_price"),
    confidenceScore: real("confidence_score").notNull(),
    confidenceGrade: varchar("confidence_grade", { length: 5 }),
    ageCategory: varchar("age_category", { length: 30 }),
    durationMinutes: real("duration_minutes"),
    // Momentum metrics
    orderFlowScore: real("order_flow_score"),
    cumulativeDelta: real("cumulative_delta"),
    relativeVolume: real("relative_volume"),
    vwapDistance: real("vwap_distance"),
    vwapSlope: real("vwap_slope"),
    oiChange: real("oi_change"),
    oiBehavior: varchar("oi_behavior", { length: 30 }),
    trendScore: real("trend_score"),
    absorptionDetected: boolean("absorption_detected").default(false),
    // Excursion
    maxFavorableExcursion: real("max_favorable_excursion"),
    maxAdverseExcursion: real("max_adverse_excursion"),
    // Reasons
    reasons: jsonb("reasons").$type<string[]>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_momentum_instrument").on(table.instrumentKey),
    index("idx_momentum_state").on(table.state),
    index("idx_momentum_direction").on(table.direction),
    index("idx_momentum_start").on(table.startTime),
  ]
);

// Tick data cache (recent ticks for calculations)
export const tickData = pgTable(
  "tick_data",
  {
    id: serial("id").primaryKey(),
    instrumentKey: varchar("instrument_key", { length: 100 }).notNull(),
    ltp: real("ltp").notNull(),
    ltq: integer("ltq"),
    volume: real("volume"),
    oi: real("oi"),
    bidPrice: real("bid_price"),
    askPrice: real("ask_price"),
    bidQty: integer("bid_qty"),
    askQty: integer("ask_qty"),
    open: real("open"),
    high: real("high"),
    low: real("low"),
    close: real("close"),
    atp: real("atp"), // average traded price (vwap proxy)
    totalBuyQty: real("total_buy_qty"),
    totalSellQty: real("total_sell_qty"),
    tickTime: timestamp("tick_time").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_tick_instrument").on(table.instrumentKey),
    index("idx_tick_time").on(table.tickTime),
  ]
);

// Candle data for trend analysis
export const candleData = pgTable(
  "candle_data",
  {
    id: serial("id").primaryKey(),
    instrumentKey: varchar("instrument_key", { length: 100 }).notNull(),
    interval: varchar("interval", { length: 10 }).notNull(), // 1m, 5m, 15m
    open: real("open").notNull(),
    high: real("high").notNull(),
    low: real("low").notNull(),
    close: real("close").notNull(),
    volume: real("volume"),
    candleTime: timestamp("candle_time").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_candle_instrument").on(table.instrumentKey),
    index("idx_candle_time").on(table.candleTime),
  ]
);

// App settings
export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});
