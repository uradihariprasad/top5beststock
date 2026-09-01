"use client";

import { useState, useEffect, useCallback } from "react";
import LoginForm from "@/components/LoginForm";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [authState, setAuthState] = useState<"checking" | "no" | "yes">("checking");

  const checkAuth = useCallback(async () => {
    try {
      const resp = await fetch("/api/auth/token");
      const data = await resp.json();
      setAuthState(data.authenticated ? "yes" : "no");
    } catch {
      setAuthState("no");
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Handle OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("authenticated") === "true") {
      setAuthState("yes");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  if (authState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-bg-card border border-border-dark flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent-blue animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-text-secondary">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (authState === "no") {
    return <LoginForm onAuthenticated={() => setAuthState("yes")} />;
  }

  return <Dashboard onLogout={() => setAuthState("no")} />;
}
