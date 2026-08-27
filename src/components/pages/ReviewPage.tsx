import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { ReadinessProject, AISummary } from "../../types";
import { Button } from "../ui/button";
import { useAuth } from "../../contexts/AuthContext";
import { useRealtime } from "../../contexts/RealtimeContext";
import { Shield, Sparkles, CheckCircle2, AlertTriangle, Lock } from "lucide-react";

export function ReviewPage() {
  const { project, reloadProject } = useOutletContext<{ project: ReadinessProject, reloadProject: () => void }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updatePresence } = useRealtime();
  
  const [summary, setSummary] = useState<AISummary | null>(project.aiSummary || null);
  
  useEffect(() => {
    if (project.aiSummary && !summary) {
      setSummary(project.aiSummary);
    }
  }, [project.aiSummary]);

  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [glitchActive, setGlitchActive] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    updatePresence("review", undefined, "Generating AI Synthesis");
    try {
      const res = await fetch(`/api/projects/${project.id}/summary`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate summary");
      setSummary(data.summary);
      setGlitchActive(true);
      setTimeout(() => setGlitchActive(false), 600);
      updatePresence("review", undefined, "Reviewing AI Synthesis");
    } catch (e) {
      console.error(e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    updatePresence("review", undefined, "Signing Authorization Manifest");
    try {
      const res = await fetch(`/api/projects/${project.id}/approve`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: user?.id, actorRole: user?.role })
      });
      if (!res.ok) throw new Error("Approval failed");
      setGlitchActive(true);
      reloadProject();
      setTimeout(() => {
        navigate(`/readiness/${project.id}/manifest`);
      }, 500);
    } catch (e) {
      console.error(e);
      setApproving(false);
    }
  };

  const isBlocked = project.findings.some(f => f.severity === "blocked" && f.status === "unresolved");
  const isApprover = user?.role === "approver";
  const isAlreadyApproved = project.state === "approved" || project.state === "exported";

  return (
    <div className={`space-y-8 animate-in fade-in duration-300 ${glitchActive ? (isBlocked ? "crt-blocked-sweep glitch-transition-blocked" : "crt-refresh-sweep glitch-transition-active") : ""}`}>
      <div className="flex items-center justify-between border-b border-[#27272a] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-xl font-bold font-display text-white tracking-tight">Executive Review &amp; Sign-off</h3>
            <span className="bg-[#141416] border border-[#333] text-lime-400 font-mono text-[10px] uppercase px-2 py-0.5 rounded-none">
              Authorization Gate
            </span>
          </div>
          <p className="text-muted-foreground text-xs font-mono mt-1">Review deterministic findings, generate AI insights, and execute cryptographic authorization.</p>
        </div>
      </div>

      <div className="border border-[#27272a] bg-[#111114] rounded-none p-6 hardware-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary-glow" />
            <h4 className="text-base font-bold font-mono uppercase text-white tracking-wider">AI Synthesis &amp; Triage</h4>
          </div>
          <Button onClick={fetchSummary} disabled={loading || project.findings.length === 0} variant="terminal" size="sm">
            {loading ? "Synthesizing..." : (summary ? "Regenerate AI Summary" : "Generate AI Summary")}
          </Button>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive rounded-none p-4 text-destructive text-xs mb-4 font-mono">
            [ERROR]: {error}
          </div>
        )}

        {summary ? (
          <div className="space-y-6 text-sm font-mono">
            <div>
              <h5 className="font-semibold mb-2 text-xs text-zinc-400 uppercase tracking-wider">Executive Summary</h5>
              <p className="text-zinc-300 leading-relaxed bg-[#09090b] p-4 rounded-none border border-[#27272a] text-xs">{summary.summary}</p>
            </div>
            {summary.priority_actions.length > 0 && (
              <div>
                <h5 className="font-semibold mb-2 text-xs text-zinc-400 uppercase tracking-wider">Required Actions</h5>
                <ul className="space-y-2">
                  {summary.priority_actions.map((action, i) => (
                    <li key={i} className="flex gap-2 text-zinc-300 bg-[#09090b] border border-[#27272a] rounded-none p-3 text-xs">
                      <span className="text-warning mt-0.5">•</span>
                      <div>
                        <span className="font-bold text-white block">{action.action}</span>
                        <span className="text-zinc-400 text-[11px]">{action.reason}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summary.uncertainties.length > 0 && (
              <div>
                <h5 className="font-semibold mb-2 text-xs text-zinc-400 uppercase tracking-wider">Uncertainties &amp; Anomalies</h5>
                <ul className="list-disc list-inside text-zinc-400 ml-4 space-y-1 text-xs">
                  {summary.uncertainties.map((u, i) => <li key={i}>{u}</li>)}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#09090b] border border-[#27272a] rounded-none p-5 text-center text-zinc-500 text-xs font-mono uppercase tracking-wider">
            {project.findings.length === 0 ? "Run deterministic checks first before generating AI summary." : "Click 'Generate AI Summary' to get automated risk assessment."}
          </div>
        )}
      </div>

      <div className="border border-[#27272a] bg-[#111114] rounded-none p-6 hardware-card">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary-glow" />
          <h4 className="text-base font-bold font-mono uppercase text-white tracking-wider">Authorization Gate</h4>
        </div>

        {isAlreadyApproved ? (
          <div className="bg-lime-950/20 border border-lime-500/40 rounded-none p-4 text-lime-300 text-xs font-mono flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-lime-400 shrink-0" />
            <div>
              <span className="font-bold uppercase block mb-0.5">Release Authorized</span>
              Project is signed off. State machine locked to <b>{project.state.toUpperCase()}</b>.
            </div>
          </div>
        ) : isBlocked ? (
          <div className="bg-red-950/20 border border-destructive rounded-none p-4 text-red-300 text-xs font-mono flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <span className="font-bold uppercase block mb-1">Approval Blocked by Policy Engine</span>
              There are active blocking findings (e.g. invalid splits, missing true-peak compliance, or pending metadata). Resolve them prior to sign-off.
            </div>
          </div>
        ) : !isApprover ? (
          <div className="bg-amber-950/20 border border-amber-500/40 rounded-none p-4 text-amber-300 text-xs font-mono flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div>
                <span className="font-bold uppercase block mb-1">Approver Permission Required</span>
                Current session is in <b>{user?.role.toUpperCase()}</b> mode. Use the Role switcher in the presence bar to switch to <b>Approver</b>.
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-lime-950/20 border border-lime-500/40 rounded-none p-4 text-lime-300 text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
             <div>
               <span className="font-bold uppercase block mb-1">Release Ready for Executive Sign-off</span>
               All deterministic policies passed. Authorized sign-off will lock manifest revisions and broadcast live to all clients.
             </div>
             <Button variant="hero" size="sm" className="rounded-none hardware-btn font-mono text-xs" disabled={isBlocked || approving} onClick={handleApprove}>
               {approving ? "Authorizing..." : "Authorize & Sign Off"}
             </Button>
          </div>
        )}
      </div>
    </div>
  );
}
