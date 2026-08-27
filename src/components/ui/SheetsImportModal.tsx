import { useState, useEffect } from "react";
import { ContributorCredit, RoyaltyType } from "../../types";
import { getAccessToken, googleSignIn } from "../../lib/workspace-auth";
import {
  fetchSpreadsheetData,
  autoDetectSheetMapping,
  parseSheetToCredits,
  extractSpreadsheetId,
  SheetMapping,
  DriveItem,
} from "../../lib/workspace-api";
import { Button } from "./button";
import { DrivePicker } from "./DrivePicker";

interface SheetsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (credits: ContributorCredit[]) => Promise<void>;
}

export function SheetsImportModal({ isOpen, onClose, onImport }: SheetsImportModalProps) {
  const [sheetInput, setSheetInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<SheetMapping>({
    nameColumn: 0,
    roleColumn: 1,
    songwriterColumn: 2,
    producerColumn: 3,
    performerColumn: 4,
    hasHeaderRow: true,
  });
  const [parsedCredits, setParsedCredits] = useState<ContributorCredit[]>([]);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  if (!isOpen) return null;

  const handleFetchSheet = async (targetInput?: string) => {
    const inputToUse = targetInput !== undefined ? targetInput : sheetInput;
    if (!inputToUse.trim()) {
      setError("Please provide a valid Google Spreadsheet URL or ID.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let token = await getAccessToken();
      if (!token) {
        const authRes = await googleSignIn();
        token = authRes?.accessToken || null;
      }

      if (!token) {
        throw new Error("Google Workspace authorization required to read sheets.");
      }

      const sheetId = extractSpreadsheetId(inputToUse);
      const data = await fetchSpreadsheetData(token, sheetId);

      if (!data.values || data.values.length === 0) {
        throw new Error("No data found in the specified spreadsheet.");
      }

      setRawRows(data.values);
      const detectedHeaders = data.values[0] || [];
      setHeaders(detectedHeaders);

      const autoMap = autoDetectSheetMapping(detectedHeaders);
      setMapping(autoMap);

      const initialParsed = parseSheetToCredits(data.values, autoMap);
      setParsedCredits(initialParsed);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load spreadsheet data.");
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (key: keyof SheetMapping, value: number) => {
    const newMapping = { ...mapping, [key]: value };
    setMapping(newMapping);
    if (rawRows.length > 0) {
      const updated = parseSheetToCredits(rawRows, newMapping);
      setParsedCredits(updated);
    }
  };

  const handleDriveSheetSelect = (file: DriveItem) => {
    setSheetInput(file.id);
    setShowDrivePicker(false);
    handleFetchSheet(file.id);
  };

  const handleApply = async () => {
    if (parsedCredits.length === 0) {
      setError("No valid contributor credits parsed.");
      return;
    }
    setIsApplying(true);
    try {
      await onImport(parsedCredits);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to apply credits to project.");
    } finally {
      setIsApplying(false);
    }
  };

  const types: RoyaltyType[] = ["songwriter", "producer", "performer"];
  const totals = types.reduce((acc, t) => {
    acc[t] = parsedCredits.reduce((sum, c) => sum + (c.splits[t] || 0), 0);
    return acc;
  }, {} as Record<RoyaltyType, number>);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#262626] w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[#E0E0E0]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#262626] bg-[#161616]">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
            <div>
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                Google Sheets &bull; Split Schema Mapping
              </h3>
              <p className="text-[11px] text-[#888] font-mono">
                Sync accounting records & auto-populate contributor royalty shares
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded border border-[#333] hover:bg-[#262626] flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Input & Action Bar */}
        <div className="p-5 border-b border-[#262626] bg-[#0F0F0F] space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 bg-[#181818] border border-[#333] rounded px-3 py-2 text-xs font-mono text-white placeholder-[#666] focus:outline-none focus:border-emerald-400"
              placeholder="Paste Google Sheet URL (https://docs.google.com/spreadsheets/d/...) or ID..."
              value={sheetInput}
              onChange={(e) => setSheetInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetchSheet()}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDrivePicker(true)}
              className="font-mono text-xs shrink-0"
            >
              Browse Drive
            </Button>
            <Button
              variant="hero"
              size="sm"
              onClick={() => handleFetchSheet()}
              disabled={loading || !sheetInput.trim()}
              className="font-mono text-xs shrink-0"
            >
              {loading ? "Fetching..." : "Fetch & Map"}
            </Button>
          </div>
          {error && <p className="text-red-400 font-mono text-xs">{error}</p>}
        </div>

        {/* Body content: Column Mapping & Live Preview */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {rawRows.length === 0 && !loading && (
            <div className="border border-dashed border-[#333] rounded-lg p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[#181818] border border-[#333] flex items-center justify-center mx-auto mb-3 font-mono text-emerald-400">
                📊
              </div>
              <h4 className="font-mono text-xs font-bold uppercase text-white mb-1">No Sheet Connected</h4>
              <p className="text-xs text-[#888] font-mono max-w-md mx-auto">
                Paste a Google Spreadsheet link above or browse Google Drive to automatically map names, roles, and split percentages.
              </p>
            </div>
          )}

          {rawRows.length > 0 && (
            <>
              {/* Column Mapping Controls */}
              <div className="bg-[#181818] border border-[#262626] rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-[#262626] pb-2">
                  <h4 className="font-mono text-xs font-bold uppercase text-emerald-400">Schema Column Mapper</h4>
                  <span className="text-[10px] font-mono text-[#888]">
                    {rawRows.length} Rows &bull; {headers.length} Columns Detected
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 font-mono text-xs">
                  <div>
                    <label className="block text-[10px] uppercase text-[#888] mb-1">Contributor Name</label>
                    <select
                      value={mapping.nameColumn}
                      onChange={(e) => handleMappingChange("nameColumn", parseInt(e.target.value, 10))}
                      className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-white"
                    >
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          Col {i + 1}: {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase text-[#888] mb-1">Role / Credit</label>
                    <select
                      value={mapping.roleColumn}
                      onChange={(e) => handleMappingChange("roleColumn", parseInt(e.target.value, 10))}
                      className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-white"
                    >
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          Col {i + 1}: {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase text-[#888] mb-1">Songwriter Split %</label>
                    <select
                      value={mapping.songwriterColumn}
                      onChange={(e) => handleMappingChange("songwriterColumn", parseInt(e.target.value, 10))}
                      className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-white"
                    >
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          Col {i + 1}: {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase text-[#888] mb-1">Producer Split %</label>
                    <select
                      value={mapping.producerColumn}
                      onChange={(e) => handleMappingChange("producerColumn", parseInt(e.target.value, 10))}
                      className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-white"
                    >
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          Col {i + 1}: {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase text-[#888] mb-1">Performer Split %</label>
                    <select
                      value={mapping.performerColumn}
                      onChange={(e) => handleMappingChange("performerColumn", parseInt(e.target.value, 10))}
                      className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-white"
                    >
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          Col {i + 1}: {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Parsed Live Preview Table */}
              <div className="border border-[#262626] bg-[#111] rounded-lg overflow-hidden font-mono text-xs">
                <div className="p-3 bg-[#181818] border-b border-[#262626] flex items-center justify-between">
                  <span className="font-bold text-white uppercase text-[11px]">Parsed Contributor Splits Preview</span>
                  <span className="text-[10px] text-[#888]">{parsedCredits.length} Contributors Ready</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#141414] text-[10px] uppercase text-[#888]">
                      <tr>
                        <th className="px-3 py-2 border-b border-[#262626]">Contributor</th>
                        <th className="px-3 py-2 border-b border-[#262626]">Role</th>
                        <th className="px-3 py-2 border-b border-[#262626] text-right">Songwriter</th>
                        <th className="px-3 py-2 border-b border-[#262626] text-right">Producer</th>
                        <th className="px-3 py-2 border-b border-[#262626] text-right">Performer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedCredits.map((c) => (
                        <tr key={c.id} className="border-b border-[#262626] last:border-0 hover:bg-[#181818]">
                          <td className="px-3 py-2.5 font-bold text-white">{c.name}</td>
                          <td className="px-3 py-2.5 text-[#AAA]">{c.role}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{(c.splits.songwriter || 0).toFixed(2)}%</td>
                          <td className="px-3 py-2.5 text-right font-mono">{(c.splits.producer || 0).toFixed(2)}%</td>
                          <td className="px-3 py-2.5 text-right font-mono">{(c.splits.performer || 0).toFixed(2)}%</td>
                        </tr>
                      ))}
                      <tr className="bg-[#181818] font-bold border-t border-[#333]">
                        <td className="px-3 py-3" colSpan={2}>
                          Calculated Totals
                        </td>
                        {types.map((type) => (
                          <td
                            key={type}
                            className={`px-3 py-3 text-right ${
                              totals[type] === 0
                                ? "text-[#888]"
                                : Math.abs(totals[type] - 100) > 0.01
                                ? "text-red-400"
                                : "text-lime-400"
                            }`}
                          >
                            {totals[type].toFixed(2)}%
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#262626] bg-[#161616] flex items-center justify-between">
          <span className="text-[11px] font-mono text-[#888]">
            {parsedCredits.length > 0
              ? `Ready to import ${parsedCredits.length} contributor credits into release record.`
              : "Fetch a sheet to preview splits."}
          </span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="hero"
              size="sm"
              disabled={isApplying || parsedCredits.length === 0}
              onClick={handleApply}
            >
              {isApplying ? "Importing..." : "Apply Credits to Project"}
            </Button>
          </div>
        </div>
      </div>

      {showDrivePicker && (
        <DrivePicker
          filterType="sheet"
          title="Select Split Sheet from Google Drive"
          onSelect={handleDriveSheetSelect}
          onCancel={() => setShowDrivePicker(false)}
        />
      )}
    </div>
  );
}
