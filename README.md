# F&O Momentum Scanner

A production-grade **F&O Intraday Momentum Scanner** that identifies the **Top 5 BUY** and **Top 5 SELL** momentum stocks from NSE F&O stocks using **live Upstox API V3** market data.

![Momentum Scanner](https://img.shields.io/badge/Market-NSE%20F%26O-blue)
![API](https://img.shields.io/badge/API-Upstox%20V3-green)
![Framework](https://img.shields.io/badge/Framework-Next.js%2016-black)

## ✨ Features

### 🎯 Momentum Detection
- **State-based engine**: NEUTRAL → BUY_MOMENTUM / SELL_MOMENTUM
- **Multi-factor confirmation**: Order flow, VWAP, Volume, OI, Trend
- **Confidence scoring**: 0-100 with grades (A+, A, B+, B)
- **Age tracking**: Emerging → Developing → Established → Strong → Extended

### 📊 Live Market Data
- **60 NSE F&O stocks** monitored in real-time
- **Upstox API V3** integration (REST API)
- **Auto-refresh** every 3-5 seconds
- **No mock/synthetic data** - 100% live market data

### 📈 Dashboard
- **Top 5 BUY signals** with detailed metrics
- **Top 5 SELL signals** with reasons
- **Market Overview** - all stocks with OHLC, volume
- **Historical events** tracking

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/fno-momentum-scanner.git
cd fno-momentum-scanner
npm install
```

### 2. Setup Database

```bash
# Start PostgreSQL (Docker example)
docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres

# Create database
psql -h localhost -U postgres -c "CREATE DATABASE app_db"

# Push schema
npx drizzle-kit push
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

### 5. Connect Upstox

1. Go to [Upstox Developer Portal](https://account.upstox.com/developer/apps)
2. Generate an Access Token
3. Click "Connect Upstox" in the app
4. Paste your token

## 📦 Deployment

### Deploy to Render (Recommended)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## 🔧 Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Drizzle ORM
- **API**: Upstox V3 REST API
- **Charting**: TradingView Lightweight Charts (ready to integrate)

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/          # OAuth & token management
│   │   ├── live-scanner/  # Main scanner endpoint
│   │   ├── market-data/   # Raw market data
│   │   ├── history/       # Historical events
│   │   └── health/        # Health check
│   ├── page.tsx           # Main page
│   └── layout.tsx
├── components/
│   ├── Dashboard.tsx      # Main dashboard
│   ├── MomentumCard.tsx   # Signal cards
│   ├── MarketOverview.tsx # All stocks view
│   ├── HistoryPanel.tsx   # Historical events
│   └── LoginForm.tsx      # Auth UI
├── lib/
│   ├── market-data-service.ts  # Upstox API + processing
│   ├── momentum-engine.ts      # Signal detection
│   ├── upstox-api.ts          # API helpers
│   ├── fno-stocks.ts          # F&O universe
│   └── types.ts               # TypeScript types
└── db/
    ├── schema.ts          # Database schema
    └── index.ts           # DB connection
```

## 📊 Momentum Metrics

| Metric | Weight | Description |
|--------|--------|-------------|
| Order Flow | 25% | Buy vs Sell quantity ratio |
| Cumulative Delta | 20% | Net aggressive buying/selling |
| Relative Volume | 15% | Current vs historical volume |
| VWAP Strength | 10% | Price position relative to VWAP |
| OI Confirmation | 10% | Open Interest behavior |
| Trend Structure | 10% | Higher highs/lows pattern |
| Momentum Persistence | 10% | Duration of momentum |

## 🔐 Authentication

The app supports two authentication methods:

1. **Access Token (Recommended)**
   - Get token from Upstox Developer Portal
   - Paste in app - valid for 24 hours

2. **OAuth Flow**
   - Configure API Key, Secret, Redirect URI
   - Full OAuth 2.0 authorization

## 📝 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/live-scanner` | GET | Top 5 BUY/SELL signals |
| `/api/market-data` | GET | All F&O stocks data |
| `/api/auth/token` | POST | Save access token |
| `/api/history` | GET | Historical momentum events |

## ⚠️ Disclaimer

- This tool **detects momentum**, it does **not predict** future prices
- No look-ahead bias - signals use only available data
- Not financial advice - use at your own risk
- Requires valid Upstox account and API access

## 📄 License

MIT License - see [LICENSE](./LICENSE)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request
