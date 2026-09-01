"use client";

import { useState } from "react";

interface LoginFormProps {
  onAuthenticated: () => void;
}

export default function LoginForm({ onAuthenticated }: LoginFormProps) {
  const [mode, setMode] = useState<"oauth" | "token">("token");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleOAuthLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, apiSecret, redirectUri }),
      });
      const data = await resp.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError(data.error || "Failed to get auth URL");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  const handleTokenLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, apiKey: apiKey || "manual" }),
      });
      const data = await resp.json();
      if (data.success) {
        onAuthenticated();
      } else {
        setError(data.error || "Failed to save token");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-blue to-accent-green flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-text-primary">
              F&O Momentum Scanner
            </h1>
          </div>
          <p className="text-text-secondary text-sm">
            Real-time momentum detection using live Upstox API V3 market data
          </p>
        </div>

        <div className="bg-bg-card rounded-2xl border border-border-dark p-6">
          {/* Mode toggle */}
          <div className="flex gap-2 mb-6 bg-bg-dark rounded-lg p-1">
            <button
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                mode === "token"
                  ? "bg-accent-blue text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setMode("token")}
            >
              Access Token
            </button>
            <button
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                mode === "oauth"
                  ? "bg-accent-blue text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setMode("oauth")}
            >
              OAuth Flow
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-accent-red/10 border border-accent-red/30 rounded-lg text-accent-red text-sm">
              {error}
            </div>
          )}

          {mode === "token" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Upstox Access Token
                </label>
                <textarea
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Paste your access token from Upstox developer dashboard..."
                  className="w-full bg-bg-input border border-border-dark rounded-lg px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent-blue resize-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  API Key <span className="text-text-muted">(optional)</span>
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Your Upstox API Key"
                  className="w-full bg-bg-input border border-border-dark rounded-lg px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent-blue"
                />
              </div>
              <button
                onClick={handleTokenLogin}
                disabled={!accessToken || loading}
                className="w-full py-3 bg-gradient-to-r from-accent-blue to-blue-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all"
              >
                {loading ? "Connecting..." : "Connect to Market Feed"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Upstox API Key"
                  className="w-full bg-bg-input border border-border-dark rounded-lg px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  API Secret
                </label>
                <input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Upstox API Secret"
                  className="w-full bg-bg-input border border-border-dark rounded-lg px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Redirect URI
                </label>
                <input
                  type="text"
                  value={redirectUri}
                  onChange={(e) => setRedirectUri(e.target.value)}
                  placeholder="https://your-app.com/api/auth/callback"
                  className="w-full bg-bg-input border border-border-dark rounded-lg px-4 py-3 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent-blue"
                />
              </div>
              <button
                onClick={handleOAuthLogin}
                disabled={!apiKey || !apiSecret || !redirectUri || loading}
                className="w-full py-3 bg-gradient-to-r from-accent-blue to-blue-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all"
              >
                {loading ? "Redirecting..." : "Login with Upstox OAuth"}
              </button>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-border-dark">
            <p className="text-xs text-text-muted text-center">
              Your credentials are stored securely and never shared. This
              application uses official Upstox API V3 for all market data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
