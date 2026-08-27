import { useOutletContext } from "react-router-dom";
import { ReadinessProject } from "../../types";
import { Button } from "../ui/button";
import { StateChip } from "../ui/badge";
import { getSeverityColor } from "../../lib/utils";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useRealtime } from "../../contexts/RealtimeContext";
import { Cpu } from "lucide-react";

export function ChecksPage() {
  const { project, reloadProject } = useOutletContext<{ project: ReadinessProject, reloadProject: () => void }>();
  const { user } = useAuth();
  const { updatePresence } = useRealtime();
  const [running, setRunning] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    updatePresence("checks", undefined, "Running deterministic checks");
    try {
      const res = await fetch(`/api/projects/${project.id}/checks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: user?.id, actorRole: user?.role })
      });
      if (res.ok) {
        updatePresence("checks", undefined, "Checks completed");
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 800);
        reloadProject();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  const blockers = project.findings.filter(f => f.severity === "blocked");
  const warnings = project.findings.filter(f => f.severity === "needs_review");

  return (
    <div className={`space-y-8 animate-in fade-in duration-300 ${glitchActive ? (blockers.length > 0 ? "crt-blocked-sweep glitch-transition-blocked" : "crt-refresh-sweep glitch-transition-active") : ""}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#27272a] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-xl font-bold font-display text-white tracking-tight">Deterministic Policy Engine</h3>
            <span className="bg-[#141416] border border-[#333] text-lime-400 font-mono text-[10px] uppercase px-2 py-0.5 rounded-none">
              808 Matrix Rules
            </span>
          </div>
          <p className="text-muted-foreground text-xs font-mono mt-1">Rule engine validation synced live across all connected clients.</p>
        </div>
        <Button onClick={runChecks} disabled={running} variant="hero" className="rounded-none hardware-btn font-mono text-xs">
          <Cpu className={`w-4 h-4 mr-2 ${running ? "animate-spin" : ""}`} />
          {running ? "Analyzing Signal & Policy..." : "Run Policy Checks"}
        </Button>
      </div>

      {project.findings.length === 0 ? (
        <div className="border border-[#27272a] border-dashed rounded-none p-12 text-center bg-[#111114]">
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-wider">No checks have been run yet. Trigger policy engine above.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`border p-4 rounded-none text-center font-mono hardware-card ${blockers.length > 0 ? "border-destructive/60 bg-red-950/20" : "border-[#27272a] bg-[#111114]"}`}>
              <div className={`text-2xl font-bold ${blockers.length > 0 ? "text-destructive" : "text-zinc-400"}`}>{blockers.length}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Hard Blockers</div>
            </div>
            <div className={`border p-4 rounded-none text-center font-mono hardware-card ${warnings.length > 0 ? "border-warning/60 bg-amber-950/20" : "border-[#27272a] bg-[#111114]"}`}>
              <div className={`text-2xl font-bold ${warnings.length > 0 ? "text-warning" : "text-zinc-400"}`}>{warnings.length}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Needs Review</div>
            </div>
            <div className="border border-[#27272a] bg-[#111114] p-4 rounded-none text-center font-mono hardware-card">
              <div className="text-2xl font-bold text-foreground">{project.findings.length}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Total Findings Evaluated</div>
            </div>
          </div>

          <div className="space-y-3">
            {project.findings.map((finding, idx) => {
              const isBlocker = finding.severity === "blocked";
              return (
                <div 
                  key={finding.id} 
                  className={`border rounded-none p-5 hardware-card font-mono text-xs ${
                    isBlocker ? "border-l-4 border-l-destructive bg-red-950/10 border-[#27272a]" : "border-l-4 border-l-warning bg-[#141416] border-[#27272a]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-none border ${
                          isBlocker ? "bg-destructive text-white border-destructive" : "bg-warning/20 text-warning border-warning/50"
                        }`}>
                          {finding.severity.replace("_", " ")}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          [{String(idx + 1).padStart(2, "0")}] &bull; {finding.code}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-sm font-sans tracking-tight">{finding.title}</h4>
                      <p className="text-muted-foreground text-xs mt-1.5 leading-relaxed">{finding.explanation}</p>
                      {finding.evidence && (
                        <div className="mt-3 bg-black/60 border border-[#333] rounded-none p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto">
                          &gt; {finding.evidence}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] uppercase tracking-wider text-primary-glow bg-[#18181b] border border-[#333] px-2 py-1 rounded-none">
                        {finding.category}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
