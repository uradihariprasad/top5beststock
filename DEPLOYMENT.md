# Deploying F&O Momentum Scanner to Render

## Prerequisites

1. A [Render](https://render.com) account
2. A GitHub/GitLab account with this repository
3. Upstox Developer account with API credentials

---

## Option 1: One-Click Deploy (Recommended)

### Step 1: Push to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit - F&O Momentum Scanner"

# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/fno-momentum-scanner.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will detect `render.yaml` and create:
   - Web Service (Next.js app)
   - PostgreSQL Database
5. Click **"Apply"** to deploy

### Step 3: Wait for Deployment

- Database creation: ~2-3 minutes
- Web service build: ~3-5 minutes
- First deployment total: ~5-8 minutes

---

## Option 2: Manual Setup

### Step 1: Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `fno-scanner-db`
   - **Database**: `fno_scanner`
   - **User**: `fno_user`
   - **Region**: Singapore (or closest to you)
   - **Plan**: Starter ($7/mo) or Free (for testing)
4. Click **"Create Database"**
5. Copy the **Internal Database URL** (starts with `postgres://`)

### Step 2: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `fno-momentum-scanner`
   - **Region**: Same as database
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: 
     ```
     npm install && npm run build && npx drizzle-kit push
     ```
   - **Start Command**: 
     ```
     npm run start
     ```
   - **Plan**: Starter ($7/mo) or Free

### Step 3: Add Environment Variables

In the Web Service settings, add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgres://fno_user:xxx@xxx.render.com/fno_scanner` (from Step 1) |

### Step 4: Deploy

Click **"Create Web Service"** and wait for deployment.

---

## Post-Deployment Setup

### 1. Verify Deployment

Visit your app URL: `https://fno-momentum-scanner.onrender.com`

Check health endpoint:
```bash
curl https://fno-momentum-scanner.onrender.com/api/health
# Should return: {"ok":true}
```

### 2. Connect Upstox Account

1. Go to [Upstox Developer Portal](https://account.upstox.com/developer/apps)
2. Create an app or use existing one
3. Generate an **Access Token** (valid for 24 hours)
4. In your deployed app:
   - Click **"Connect Upstox"**
   - Paste your access token
   - Click **"Connect"**

### 3. View Live Data

Once connected, the scanner will:
- Fetch live market data every 3 seconds
- Display Top 5 BUY and Top 5 SELL momentum signals
- Show Market Overview with all F&O stocks

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NODE_ENV` | ✅ | Set to `production` |
| `UPSTOX_API_KEY` | ❌ | Optional - for OAuth flow |
| `UPSTOX_API_SECRET` | ❌ | Optional - for OAuth flow |

---

## Troubleshooting

### Build Fails

Check build logs in Render dashboard. Common issues:
- Missing `DATABASE_URL` - Add the env variable
- TypeScript errors - Run `npm run build` locally first

### Database Connection Error

- Ensure `DATABASE_URL` uses the **Internal** connection string
- Check database is running in Render dashboard

### App Shows "Demo Mode"

- You need to connect your Upstox access token
- Access tokens expire every 24 hours - generate a new one

### No Momentum Signals

- Market may be closed (Indian market: 9:15 AM - 3:30 PM IST)
- Check "Market Overview" tab to verify data is loading
- Signals appear only when stocks meet momentum criteria

---

## Costs

### Render Pricing (as of 2024)

| Resource | Free Tier | Starter |
|----------|-----------|---------|
| Web Service | 750 hrs/mo, sleeps after 15min | $7/mo, always on |
| PostgreSQL | 90 days, 256MB | $7/mo, 1GB |

**Recommended**: Starter plan ($14/mo total) for production use.

---

## Updating the App

### Automatic Deploys

With `autoDeploy: true` in render.yaml, pushing to `main` triggers a new deploy.

### Manual Deploy

1. Go to Render Dashboard
2. Select your web service
3. Click **"Manual Deploy"** → **"Deploy latest commit"**

---

## Custom Domain (Optional)

1. Go to Web Service → **Settings** → **Custom Domains**
2. Add your domain (e.g., `scanner.yourdomain.com`)
3. Add CNAME record in your DNS:
   ```
   scanner.yourdomain.com → fno-momentum-scanner.onrender.com
   ```

---

## Support

- [Render Documentation](https://render.com/docs)
- [Upstox API Documentation](https://upstox.com/developer/api-documentation/)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
