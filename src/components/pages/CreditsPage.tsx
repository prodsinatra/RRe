import { fetchApi } from "../../lib/fetchApi";
import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { ReadinessProject, RoyaltyType, ContributorCredit } from "../../types";
import { Button } from "../ui/button";
import { useAuth } from "../../contexts/AuthContext";
import { useRealtime } from "../../contexts/RealtimeContext";
import { getAccessToken, googleSignIn } from "../../lib/workspace-auth";
import { exportSplitSheetToGoogleDoc } from "../../lib/workspace-api";
import { SheetsImportModal } from "../ui/SheetsImportModal";
import { FieldPresenceIndicator } from "../telemetry/FieldPresenceIndicator";
import { SectionMarker, SystemRail, SignalMark, CoordinateLabel } from "../ui/MatrixPrimitives";
import { FileSpreadsheet, Edit3, CheckCircle2, AlertTriangle, Users, Check, X, FileText, ExternalLink } from "lucide-react";

export function CreditsPage() {
  const { project, reloadProject } = useOutletContext<{ project: ReadinessProject; reloadProject: () => void }>();
  const { user } = useAuth();
  const { updatePresence } = useRealtime();

  const types: RoyaltyType[] = ["songwriter", "producer", "performer"];
  const [credits, setCredits] = useState<ContributorCredit[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedDocUrl, setExportedDocUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (project) {
      setCredits(JSON.parse(JSON.stringify(project.credits || [])));
    }
  }, [project]);

  const totals = types.reduce((acc, type) => {
    acc[type] = credits.reduce((sum, c) => sum + (c.splits[type] || 0), 0);
    return acc;
  }, {} as Record<RoyaltyType, number>);

  const handleSplitChange = (creditId: string, type: RoyaltyType, value: string) => {
    const num = parseFloat(value);
    setCredits((prev) =>
      prev.map((c) => {
        if (c.id === creditId) {
          return { ...c, splits: { ...c.splits, [type]: isNaN(num) ? 0 : num } };
        }
        return c;
      })
    );
  };

  const handleSave = async (creditsToSave = credits) => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetchApi(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          credits: creditsToSave, 
          actorId: user?.id || "operator",
          actorRole: user?.role || "operator"
        }),
      });
      if (res.ok) {
        setIsEditing(false);
        updatePresence("credits", undefined, "Saved royalty matrix splits");
        reloadProject();
        setStatusMessage({ type: "success", text: "Contributor credits and royalty splits updated successfully." });
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save changes.");
      }
    } catch (e: any) {
      console.error(e);
      setStatusMessage({ type: "error", text: e.message || "Failed to update credits." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSheetsImport = async (importedCredits: ContributorCredit[]) => {
    await handleSave(importedCredits);
    setStatusMessage({
      type: "success",
      text: `Successfully synced ${importedCredits.length} contributors from Google Sheets.`,
    });
  };

  const handleExportDocs = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        const authRes = await googleSignIn();
        token = authRes?.accessToken || null;
      }
      if (!token) throw new Error("Google Workspace authorization required.");

      const { documentUrl } = await exportSplitSheetToGoogleDoc(token, project);
      setExportedDocUrl(documentUrl);
      setStatusMessage({ type: "success", text: "Successfully exported Split Sheet to Google Docs." });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: "error", text: err.message || "Failed to export doc." });
    } finally {
      setIsExporting(false);
    }
  };

  const isAllValid = types.every(t => totals[t] === 0 || Math.abs(totals[t] - 100) < 0.01);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <SectionMarker idx="03" label="Credits & Royalty Accounting" />
          <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mt-2">
            Contributor Splits Matrix
          </h2>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-wider mt-1">
            Deterministic 100.00% split validation &bull; Realtime Presence &bull; Google Sheets Schema Sync
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="quiet"
            onClick={handleExportDocs}
            disabled={isExporting}
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider"
          >
            <FileText className="w-3.5 h-3.5 text-primary-glow" />
            {isExporting ? "Exporting..." : "Export E-Sign PDF (Docs)"}
          </Button>

          <Button
            variant="quiet"
            onClick={() => setShowSheetsModal(true)}
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Import from Sheets
          </Button>

          {!isEditing ? (
            <Button 
              variant="quiet" 
              onClick={() => { setIsEditing(true); updatePresence("credits", "Editing Royalty Splits"); }} 
              className="font-mono text-xs uppercase tracking-wider flex items-center gap-2"
            >
              <Edit3 className="w-3.5 h-3.5 text-primary-glow" />
              Edit Splits
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setCredits(project.credits);
                  updatePresence("credits", undefined);
                }}
                className="font-mono text-xs uppercase tracking-wider"
              >
                Cancel
              </Button>
              <Button 
                variant="hero" 
                onClick={() => handleSave()} 
                disabled={isSaving || !isAllValid} 
                className="font-mono text-xs uppercase tracking-wider flex items-center gap-2"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isSaving ? "Syncing..." : "Save Splits"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <FieldPresenceIndicator fieldName="Editing Royalty Splits" />

      {exportedDocUrl && (
        <div className="surface-panel p-5 border-brand-border bg-brand-soft/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary-glow animate-pulse" />
            <div>
              <span className="font-bold text-foreground uppercase tracking-wider">Split Sheet Exported to Google Docs</span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Ready for e-signatures from all credited contributors.
              </p>
            </div>
          </div>
          <a
            href={exportedDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-primary hover:bg-brand-hover text-primary-foreground font-bold rounded-sm text-xs inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto shrink-0 shadow-glow"
          >
            Open Document <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {statusMessage && (
        <div
          className={`p-4 rounded-sm border font-mono text-xs flex items-center justify-between ${
            statusMessage.type === "success"
              ? "bg-accent-soft border-accent-border text-accent"
              : "bg-destructive/10 border-destructive/40 text-destructive"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-xs opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="surface-panel p-6 sm:p-8 space-y-6">
        <SystemRail 
          idx="03.A" 
          label="Deterministic 100.00% Ledger" 
          rightContent={
            <SignalMark 
              status={isAllValid ? "confirmed" : "pending"} 
              label={isAllValid ? "SPLITS 100% IN BALANCE" : "SPLIT ANOMALY DETECTED"} 
              tone={isAllValid ? "lime" : "amber"} 
            />
          }
        />

        {!isAllValid && isEditing && (
          <div className="bg-destructive/10 border border-destructive text-destructive p-4 font-mono text-xs crt-blocked-sweep animate-in fade-in flex items-start gap-3 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-1">
              <p className="font-bold uppercase tracking-wider">Matrix Error: Royalty Imbalance Detected</p>
              <p className="opacity-90 leading-relaxed">
                Deterministic validation requires every active royalty category to equal exactly 100.00%. 
                The system has locked saving until the mathematical anomaly is resolved.
              </p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[640px] font-mono">
            <thead className="bg-surface border-b border-border uppercase tracking-wider text-muted-foreground text-[10px]">
              <tr>
                <th className="px-4 py-3 font-semibold">Contributor Identity</th>
                <th className="px-4 py-3 font-semibold">Primary Role</th>
                <th className="px-4 py-3 text-right font-semibold">Songwriter %</th>
                <th className="px-4 py-3 text-right font-semibold">Producer %</th>
                <th className="px-4 py-3 text-right font-semibold">Performer %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {credits.map((c) => (
                <tr key={c.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-4 py-3 font-bold text-foreground">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground uppercase text-[11px]">{c.role}</td>
                  {types.map((type) => (
                    <td key={type} className="px-4 py-3 text-right tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          className="w-20 bg-background border border-border-strong rounded-sm px-2 py-1 text-right text-xs font-mono text-foreground focus:outline-none focus:border-brand-hover focus:ring-1 focus:ring-brand-hover tabular-nums"
                          value={c.splits[type] === 0 && !isEditing ? "" : c.splits[type]}
                          onFocus={() => updatePresence("credits", `${c.name} (${type})`)}
                          onBlur={() => updatePresence("credits", undefined)}
                          onChange={(e) => handleSplitChange(c.id, type, e.target.value)}
                        />
                      ) : (
                        <span className="font-mono text-foreground">{(c.splits[type] || 0).toFixed(2)}%</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Totals Row */}
              {credits.length > 0 && (
                <tr className="bg-surface/80 font-bold border-t-2 border-border-strong text-xs">
                  <td className="px-4 py-4 uppercase text-foreground" colSpan={2}>
                    Calculated Royalty Totals
                  </td>
                  {types.map((type) => {
                    const isZero = totals[type] === 0;
                    const isValid = !isZero && Math.abs(totals[type] - 100) < 0.01;
                    return (
                      <td
                        key={type}
                        className={`px-4 py-4 text-right font-mono tabular-nums ${
                          isZero
                            ? "text-muted-foreground"
                            : isValid
                            ? "text-accent"
                            : "text-destructive font-bold"
                        }`}
                      >
                        {totals[type].toFixed(2)}%
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isEditing && (
          <div className="p-4 bg-surface border border-border rounded-sm text-xs font-mono text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>Direct cell editing mode active.</span>
            <span className="text-accent font-bold">All non-zero columns must tally to exactly 100.00% to pass validation.</span>
          </div>
        )}
      </div>

      <SheetsImportModal
        isOpen={showSheetsModal}
        onClose={() => setShowSheetsModal(false)}
        onImport={handleSheetsImport}
      />
    </div>
  );
}
