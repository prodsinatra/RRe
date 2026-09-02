import { fetchApi } from "../../lib/fetchApi";
import { useState, useEffect } from "react";
import { CheckPolicy } from "../../types";
import { Button } from "../ui/button";
import { SectionMarker, SystemRail, SignalMark, CoordinateLabel } from "../ui/MatrixPrimitives";
import { Sliders, CheckCircle2, Shield, Save } from "lucide-react";

export function PoliciesPage() {
  const [policy, setPolicy] = useState<CheckPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchApi("/api/policies/active")
      .then(res => res.json())
      .then(data => {
        setPolicy(data.policy);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    if (!policy) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetchApi("/api/policies/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy)
      });
      const data = await res.json();
      setPolicy(data.policy);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !policy) {
    return (
      <div className="flex items-center justify-center h-48 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Loading policy specifications...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <SectionMarker idx="11" label="Deterministic Evaluation Policies" />
          <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mt-2">
            Readiness Check Rules
          </h2>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-wider mt-1">
            Global evaluation invariants enforced during state machine transitions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="font-mono text-xs text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" /> Policies Saved
            </span>
          )}
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            variant="hero"
            className="font-mono uppercase tracking-wider text-xs flex items-center gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving Rules..." : "Save Policies"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Release Identity Rules */}
        <div className="surface-panel p-6 sm:p-8 space-y-4">
          <SystemRail 
            idx="11.A" 
            label="Release Identity Requirements" 
            rightContent={<SignalMark status="live" label="ENFORCED" tone="lime" />}
          />
          <div className="space-y-2">
            <label className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
              Required Roles (Comma-separated)
            </label>
            <input 
              type="text" 
              className="w-full bg-background border border-border-strong rounded-sm px-3.5 py-2.5 text-xs text-foreground font-mono focus:outline-none focus:border-brand-hover focus:ring-1 focus:ring-brand-hover"
              value={policy.requiredRoles.join(", ")}
              onChange={e => setPolicy({ ...policy, requiredRoles: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
            />
            <p className="text-[11px] font-mono text-muted-foreground">
              Sessions must have at least one contributor assigned to each of these roles to clear blocking status.
            </p>
          </div>
        </div>

        {/* Audio Asset Rules */}
        <div className="surface-panel p-6 sm:p-8 space-y-4">
          <SystemRail 
            idx="11.B" 
            label="Audio Asset Formatting Spec" 
            rightContent={<SignalMark status="live" label="REGEX PATTERN" tone="violet" />}
          />
          <div className="space-y-2">
            <label className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
              Naming Convention (Regular Expression)
            </label>
            <input 
              type="text" 
              className="w-full bg-background border border-border-strong rounded-sm px-3.5 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-brand-hover focus:ring-1 focus:ring-brand-hover"
              value={policy.assetNamingConvention}
              onChange={e => setPolicy({ ...policy, assetNamingConvention: e.target.value })}
            />
            <p className="text-[11px] font-mono text-muted-foreground">
              Filename pattern enforced during master audio stem ingest (e.g. ^[A-Z0-9_-]+\.(wav|flac)$).
            </p>
          </div>
        </div>

        {/* Artwork Rules */}
        <div className="surface-panel p-6 sm:p-8 space-y-4">
          <SystemRail 
            idx="11.C" 
            label="Visual Delivery Specification" 
            rightContent={<SignalMark status="live" label="DSP COMPLIANCE" tone="lime" />}
          />
          <div className="space-y-2">
            <label className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
              Required Image Dimensions
            </label>
            <input 
              type="text" 
              className="w-full bg-background border border-border-strong rounded-sm px-3.5 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-brand-hover focus:ring-1 focus:ring-brand-hover tabular-nums"
              value={policy.artworkDimensions}
              onChange={e => setPolicy({ ...policy, artworkDimensions: e.target.value })}
            />
            <p className="text-[11px] font-mono text-muted-foreground">
              Standard 1:1 master dimensions (e.g. 3000x3000px) required by Apple Music and Spotify.
            </p>
          </div>
        </div>

        {/* Webhook Configuration */}
        <div className="surface-panel p-6 sm:p-8 space-y-4 border-brand-border">
          <SystemRail 
            idx="11.D" 
            label="External Webhook Broadcasting" 
            rightContent={<SignalMark status={policy.webhookUrl ? "live" : "pending"} label={policy.webhookUrl ? "ACTIVE" : "INACTIVE"} tone={policy.webhookUrl ? "lime" : "amber"} />}
          />
          <div className="space-y-2">
            <label className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
              Discord / Slack Webhook URL
            </label>
            <input 
              type="text" 
              className="w-full bg-background border border-border-strong rounded-sm px-3.5 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-brand-hover focus:ring-1 focus:ring-brand-hover"
              value={policy.webhookUrl || ""}
              placeholder="https://discord.com/api/webhooks/..."
              onChange={e => setPolicy({ ...policy, webhookUrl: e.target.value })}
            />
            <p className="text-[11px] font-mono text-muted-foreground">
              Automatically broadcast deterministic state transitions (e.g. [BLOCKED] or [AUTHORIZED]) and manifest hashes to external A&R or engineering channels.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
