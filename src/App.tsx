import { fetchApi } from "./lib/fetchApi";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Outlet, Link } from "react-router-dom";
import { Wordmark } from "./components/ui/Wordmark";
import { Dashboard } from "./components/pages/Dashboard";
import { PoliciesPage } from "./components/pages/PoliciesPage";
import { IntegrationsPage } from "./components/pages/IntegrationsPage";
import { ProjectLayout } from "./components/layout/ProjectLayout";
import { LoginPage } from "./components/pages/LoginPage";
import { useAuth } from "./contexts/AuthContext";
import { RealtimeProvider, useRealtime } from "./contexts/RealtimeContext";
import { OverviewPage } from "./components/pages/OverviewPage";
import { MetadataPage } from "./components/pages/MetadataPage";
import { CreditsPage } from "./components/pages/CreditsPage";
import { ArtworkPage } from "./components/pages/ArtworkPage";
import { AssetsPage } from "./components/pages/AssetsPage";
import { ChecksPage } from "./components/pages/ChecksPage";
import { ManifestPage } from "./components/pages/ManifestPage";
import { ReviewPage } from "./components/pages/ReviewPage";
import { ActivityPage } from "./components/pages/ActivityPage";
import { Wifi, Activity, Coins } from "lucide-react";
import { useStore } from "./lib/store";

function Layout() {
  const { logout, user } = useAuth();
  const { status, latencyMs } = useRealtime();
  const { walletTokens, fetchWallet } = useStore();

  useEffect(() => {
    if (user) {
      fetchWallet(user.id);
    }
  }, [user, fetchWallet]);
  
  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground font-sans antialiased overflow-hidden">
      <header className="border-b border-border bg-surface py-3 px-6 flex items-center justify-between" role="banner">
        <div className="flex items-center gap-4">
          <Wordmark />
          <div className="w-px h-4 bg-border-strong hidden sm:block" aria-hidden="true"></div>
          <span className="text-xs font-mono tracking-widest text-muted-foreground uppercase hidden sm:block" aria-label="Application Role">
            Release Readiness Engine v1.0.4
          </span>
          <nav className="hidden md:flex items-center gap-4 ml-4" aria-label="Main Navigation">
            <Link to="/" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Sessions</Link>
            <Link to="/integrations" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Integrations</Link>
          </nav>
        </div>
        {user && (
          <div className="flex items-center gap-4 sm:gap-6" aria-label="User Menu">
            {/* Tokens Pill */}
            <button onClick={async () => {
              try {
                const res = await fetchApi("/api/checkout/create-session", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: user.id, tokens: 5 })
                });
                const data = await res.json();
                if (data.url) {
                  window.location.href = data.url;
                }
              } catch (e) {
                console.error(e);
              }
            }} className="flex items-center gap-1.5 px-3 py-1 bg-brand-soft/20 border border-brand-border hover:bg-brand-soft/40 transition-colors rounded font-mono text-[10px] text-accent font-bold uppercase cursor-pointer" title="Recharge Tokens">
              <Coins className="w-3 h-3" />
              {walletTokens} TKNS
            </button>
            
            {/* Live WS Sync Status Pill */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-surface-raised border border-border-strong rounded-full font-mono text-[10px]">
              <span className={`w-1.5 h-1.5 rounded-full ${status === "connected" ? "bg-primary-glow animate-pulse" : "bg-destructive"}`}></span>
              <span className="uppercase text-muted-foreground hidden sm:inline">{status === "connected" ? "Sync" : "Offline"}</span>
              {status === "connected" && <span className="text-primary-glow font-bold">{latencyMs}ms</span>}
            </div>

            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-[10px] text-muted-foreground uppercase font-mono">{user.role} Mode</span>
              <span className="text-xs font-semibold">{user.email}</span>
            </div>
            <button 
               onClick={logout}
              className="w-8 h-8 rounded bg-border border border-border-strong flex items-center justify-center text-[10px] font-mono hover:bg-border-strong transition-colors uppercase font-bold"
              style={{ color: user.avatarColor || "#a3e635" }}
              aria-label="Sign out of application"
              title={`Sign Out (${user.email})`}
            >
              {user.role.substring(0, 2).toUpperCase()}
            </button>
          </div>
        )}
      </header>
      <main className="flex-1 overflow-auto w-full mx-auto px-6 md:px-8 py-8" id="main-content" aria-label="Main Content" role="main">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground font-mono uppercase text-sm tracking-widest">Loading...</div>;
  }

  return (
    <RealtimeProvider>
      <BrowserRouter>
        {!user ? (
          <LoginPage />
        ) : (
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="settings/policies" element={<PoliciesPage />} />
              <Route path="readiness/new" element={<div>New Session</div>} />
              <Route path="readiness/:id" element={<ProjectLayout />}>
                <Route path="overview" element={<OverviewPage />} />
                <Route path="metadata" element={<MetadataPage />} />
                <Route path="credits" element={<CreditsPage />} />
                <Route path="assets" element={<AssetsPage />} />
                <Route path="artwork" element={<ArtworkPage />} />
                <Route path="checks" element={<ChecksPage />} />
                <Route path="review" element={<ReviewPage />} />
                <Route path="manifest" element={<ManifestPage />} />
                <Route path="activity" element={<ActivityPage />} />
              </Route>
            </Route>
          </Routes>
        )}
      </BrowserRouter>
    </RealtimeProvider>
  );
}
