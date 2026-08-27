import React, { useState } from "react";
import { useRealtime } from "../../contexts/RealtimeContext";
import { useAuth, Role } from "../../contexts/AuthContext";
import { Users, Wifi, Activity, Radio, Shield, Headphones, Music, Terminal, CheckCircle2 } from "lucide-react";

const ROLE_ICONS: Record<string, any> = {
  operator: Terminal,
  approver: Shield,
  client: Music,
  engineer: Headphones,
  viewer: Radio
};

const ROLE_COLORS: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  operator: { text: "#a3e635", bg: "rgba(163, 230, 53, 0.1)", border: "rgba(163, 230, 53, 0.3)", glow: "#a3e635" },
  approver: { text: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)", border: "rgba(251, 191, 36, 0.3)", glow: "#fbbf24" },
  client: { text: "#38bdf8", bg: "rgba(56, 189, 248, 0.1)", border: "rgba(56, 189, 248, 0.3)", glow: "#38bdf8" },
  engineer: { text: "#c084fc", bg: "rgba(192, 132, 252, 0.1)", border: "rgba(192, 132, 252, 0.3)", glow: "#c084fc" },
  viewer: { text: "#94a3b8", bg: "rgba(148, 163, 184, 0.1)", border: "rgba(148, 163, 184, 0.3)", glow: "#94a3b8" }
};

export function LivePresenceBar() {
  const { status, latencyMs, viewers } = useRealtime();
  const { user, switchRole } = useAuth();
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  const getTabLabel = (tab?: string) => {
    if (!tab) return "Viewing";
    const labels: Record<string, string> = {
      overview: "Overview",
      metadata: "Intake / Metadata",
      credits: "Splits / Credits",
      assets: "Audio Diagnostics",
      artwork: "Cover Artwork",
      checks: "Rule Engine",
      review: "Sign-off Review",
      manifest: "Manifest Spec",
      activity: "Live Telemetry"
    };
    return labels[tab] || tab;
  };

  return (
    <div className="bg-surface/80 border border-border backdrop-blur-md rounded-xl p-3 mb-6 flex flex-wrap items-center justify-between gap-4">
      {/* Realtime Status Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 bg-surface-raised border border-border-strong rounded-md font-mono text-[11px]">
          <span className="relative flex h-2 w-2">
            {status === "connected" ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-glow opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-glow"></span>
              </>
            ) : status === "connecting" || status === "reconnecting" ? (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 animate-pulse"></span>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
            )}
          </span>
          <span className="uppercase tracking-wider font-semibold text-foreground">
            {status === "connected" ? "Telemetry Live" : status === "reconnecting" ? "Reconnecting" : "Offline"}
          </span>
          {status === "connected" && (
            <span className="text-muted-foreground border-l border-border-strong pl-2 text-[10px]">
              {latencyMs}ms
            </span>
          )}
        </div>

        {/* Presence Counter */}
        <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <Users className="w-3.5 h-3.5 text-primary-glow" />
          <span>{viewers.length} Active {viewers.length === 1 ? "Session" : "Collaborators"}</span>
        </div>
      </div>

      {/* Online Collaborator Avatar Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {viewers.map((viewer) => {
          const colors = ROLE_COLORS[viewer.role] || ROLE_COLORS.operator;
          const RoleIcon = ROLE_ICONS[viewer.role] || Terminal;
          const isCurrentUser = viewer.id === user?.id;

          return (
            <div
              key={viewer.id}
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all duration-300 animate-in fade-in"
              style={{
                backgroundColor: colors.bg,
                borderColor: colors.border,
                color: colors.text
              }}
              title={`${viewer.name} (${viewer.email}) - Last seen: ${new Date(viewer.lastSeen).toLocaleTimeString()}`}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-background uppercase shadow-sm"
                style={{ backgroundColor: colors.text }}
              >
                {viewer.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-[11px] leading-none flex items-center gap-1">
                  {viewer.name} {isCurrentUser && <span className="opacity-60 text-[9px]">(You)</span>}
                </span>
                <span className="text-[9px] opacity-80 leading-tight mt-0.5">
                  {viewer.activeField ? `Editing [${viewer.activeField}]` : `${getTabLabel(viewer.activeTab)}`}
                </span>
              </div>
            </div>
          );
        })}

        {/* Multi-role Persona Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-raised hover:bg-border-strong border border-border-strong rounded-md font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            title="Switch Simulated Persona to test multi-role realtime sync"
          >
            <Shield className="w-3 h-3 text-primary-glow" />
            <span>Role: <strong className="text-foreground uppercase">{user?.role}</strong></span>
          </button>

          {showPersonaMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-border-strong rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-2 py-1.5 border-b border-border text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
                Simulate Multiplayer Persona
              </div>
              <div className="space-y-1 mt-1">
                {(["operator", "approver", "client", "engineer"] as Role[]).map((role) => {
                  const Icon = ROLE_ICONS[role];
                  const active = user?.role === role;
                  return (
                    <button
                      key={role}
                      onClick={() => {
                        switchRole(role);
                        setShowPersonaMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-between transition-colors ${
                        active
                          ? "bg-secondary text-foreground font-bold border border-brand/50"
                          : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-primary-glow" />
                        <span className="capitalize">{role}</span>
                      </div>
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-primary-glow" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
