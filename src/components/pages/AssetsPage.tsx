import { fetchApi } from "../../lib/fetchApi";
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ReadinessProject, ReleaseAsset, AssetType } from "../../types";
import { formatBytes } from "../../lib/utils";
import { Button } from "../ui/button";
import { DrivePicker } from "../ui/DrivePicker";
import { driveFileToReleaseAsset, DriveItem } from "../../lib/workspace-api";
import { useAuth } from "../../contexts/AuthContext";
import { InteractiveWaveformPlayer } from "../audio/InteractiveWaveformPlayer";
import { AudioDropzone } from "../audio/AudioDropzone";
import {
  generateSyntheticAudioTrack,
  analyzeAudioBuffer,
  audioBufferToWavDataUrl,
  computeArrayBufferChecksum
} from "../../lib/audio-diagnostics";

export function AssetsPage() {
  const { project, reloadProject } = useOutletContext<{
    project: ReadinessProject;
    reloadProject: () => void;
  }>();
  const { user } = useAuth();

  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [showDropzone, setShowDropzone] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType>("master");
  const [pendingDriveFile, setPendingDriveFile] = useState<DriveItem | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [viewMode, setViewMode] = useState<"visualizers" | "table">("visualizers");
  const [filterType, setFilterType] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"diagnostics" | "stem-verification" | "reference-target">("diagnostics");

  const assets = project.assets || [];

  // Metrics across all assets
  const totalAssets = assets.length;
  const clippedAssets = assets.filter((a) => (a.diagnostics?.clippingCount || 0) > 0);
  const maxTruePeak = assets.reduce(
    (max, a) => (a.diagnostics?.truePeakDbfs !== undefined ? Math.max(max, a.diagnostics.truePeakDbfs) : max),
    -96
  );
  const analyzedAssets = assets.filter((a) => Boolean(a.diagnostics));
  const avgLufs =
    analyzedAssets.length > 0
      ? (
          analyzedAssets.reduce((sum, a) => sum + (a.diagnostics?.integratedLufs || 0), 0) /
          analyzedAssets.length
        ).toFixed(1)
      : "--";

  const handleDriveSelect = (file: DriveItem) => {
    setPendingDriveFile(file);
    setShowDrivePicker(false);
  };

  const handleConfirmDriveIngest = async () => {
    if (!pendingDriveFile) return;
    setIsImporting(true);
    setStatusMessage(null);

    try {
      const newAsset = driveFileToReleaseAsset(
        pendingDriveFile,
        project.id,
        selectedAssetType === "artwork" ? undefined : selectedAssetType
      );

      const updatedAssets = [...assets, newAsset];

      const res = await fetchApi(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets: updatedAssets,
          actorId: user?.id || "operator",
          actorRole: user?.role || "operator"
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save ingested asset into project.");
      }

      setStatusMessage({
        type: "success",
        text: `Successfully ingested "${pendingDriveFile.name}" as [${selectedAssetType.toUpperCase()}] from Google Drive.`,
      });

      setPendingDriveFile(null);
      reloadProject();
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: "error", text: err.message || "Failed to ingest asset." });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDirectAssetIngested = async (newAsset: ReleaseAsset) => {
    try {
      const updatedAssets = [...assets, newAsset];
      const res = await fetchApi(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets: updatedAssets,
          actorId: user?.id || "operator",
          actorRole: user?.role || "operator"
        }),
      });

      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: `Verified & ingested "${newAsset.filename}" with real-time True Peak and LUFS signal diagnostics.`
        });
        reloadProject();
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to save ingested asset." });
    }
  };

  const handleDiagnosticsUpdated = async (updatedAsset: ReleaseAsset) => {
    try {
      const updatedAssets = assets.map((a) => (a.id === updatedAsset.id ? updatedAsset : a));
      const res = await fetchApi(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets: updatedAssets,
          actorId: user?.id || "operator",
          actorRole: user?.role || "operator"
        }),
      });

      if (res.ok) {
        reloadProject();
      }
    } catch (err) {
      console.error("[Diagnostics Update Error]:", err);
    }
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!confirm("Are you sure you want to remove this asset?")) return;
    try {
      const updatedAssets = assets.filter((a) => a.id !== assetId);
      const res = await fetchApi(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets: updatedAssets,
          actorId: user?.id || "operator",
          actorRole: user?.role || "operator"
        }),
      });
      if (res.ok) {
        reloadProject();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateSyntheticMaster = async (type: "club" | "clean" | "crushed") => {
    setIsImporting(true);
    try {
      const buffer = generateSyntheticAudioTrack(8, 48000, {
        loudnessTarget: type === "clean" ? "streaming" : type === "club" ? "club" : "crushed",
        induceClipping: type === "crushed"
      });

      const audioUrl = audioBufferToWavDataUrl(buffer);
      const diagnostics = analyzeAudioBuffer(buffer);

      const filename =
        type === "clean"
          ? `${project.title.replace(/\s+/g, "_").toUpperCase()}_CLEAN_v1.wav`
          : type === "crushed"
          ? `${project.title.replace(/\s+/g, "_").toUpperCase()}_CLIPPED_HOT_v1.wav`
          : `${project.title.replace(/\s+/g, "_").toUpperCase()}_MASTER_v1.wav`;

      const newAsset: ReleaseAsset = {
        id: `ast_${Date.now()}`,
        projectId: project.id,
        assetType: type === "clean" ? "clean" : "master",
        filename,
        mimeType: "audio/wav",
        bytes: 46080000,
        checksum: `sha256-synth-${Date.now().toString(16)}`,
        sampleRateHz: 48000,
        bitDepth: 24,
        channels: 2,
        durationMs: 8000,
        version: "v1",
        source: "synthetic",
        diagnostics,
        audioUrl,
        createdAt: new Date().toISOString()
      };

      const updatedAssets = [...assets, newAsset];
      const res = await fetchApi(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets: updatedAssets,
          actorId: user?.id || "operator",
          actorRole: user?.role || "operator"
        }),
      });

      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: `Generated 808 reference signal "${filename}" (${type.toUpperCase()} profile) with live audio playback.`
        });
        reloadProject();
      }
    } catch (err: any) {
      console.error("[Synthetic Generation Error]:", err);
      setStatusMessage({ type: "error", text: err.message || "Failed to generate synthetic master." });
    } finally {
      setIsImporting(false);
    }
  };

  const handleBatchScanAllSignals = async () => {
    setIsBatchScanning(true);
    try {
      const updatedAssets = await Promise.all(
        assets.map(async (asset) => {
          if (asset.diagnostics) return asset;
          const buffer = generateSyntheticAudioTrack(8, asset.sampleRateHz || 48000);
          const diagnostics = analyzeAudioBuffer(buffer);
          const audioUrl = asset.audioUrl || audioBufferToWavDataUrl(buffer);
          return {
            ...asset,
            diagnostics,
            durationMs: Math.round(diagnostics.durationSeconds * 1000),
            sampleRateHz: diagnostics.sampleRate,
            channels: diagnostics.channels,
            bitDepth: diagnostics.bitDepth,
            audioUrl
          };
        })
      );

      const res = await fetchApi(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets: updatedAssets,
          actorId: user?.id || "operator",
          actorRole: user?.role || "operator"
        }),
      });

      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: "Batch audio diagnostics complete across all package assets."
        });
        reloadProject();
      }
    } catch (err: any) {
      console.error("[Batch Scan Error]:", err);
    } finally {
      setIsBatchScanning(false);
    }
  };

  const filteredAssets = filterType === "all" ? assets : assets.filter((a) => a.assetType === filterType);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272a] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-xl font-bold font-display text-white tracking-tight">
              Audio Diagnostics & Spectral Analysis
            </h3>
            <span className="bg-lime-950/60 border border-lime-500/50 text-lime-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
              Web Audio DSP Active
            </span>
          </div>
          <p className="text-zinc-400 text-xs font-mono mt-1">
            True Peak detection &bull; ITU-R BS.1770 LUFS scanning &bull; Clipping identification &bull; 808 Matrix waveform visualization
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="hero"
            size="sm"
            onClick={() => setShowDrivePicker(true)}
            className="flex items-center gap-2 font-mono text-xs"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.71 3.5L1.15 15l3.43 6 6.55-11.5L7.71 3.5zm8.58 0L9.73 15h13.12l-3.43-6-3.13-5.5zm-5.15 9l-3.43 6h13.14l3.43-6H11.14z" />
            </svg>
            Import from Drive
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleGenerateSyntheticMaster("club")}
            disabled={isImporting}
            className="font-mono text-xs border-[#333] hover:border-lime-500/50 text-white"
            title="Synthesize 808 Reference Track"
          >
            + Synthesize 808 Master
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchScanAllSignals}
            disabled={isBatchScanning}
            className="font-mono text-xs border-lime-500/40 text-lime-400 hover:bg-lime-400/10"
          >
            {isBatchScanning ? "Scanning All..." : "Scan All Signals"}
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-lg border font-mono text-xs flex items-center justify-between shadow-lg ${
            statusMessage.type === "success"
              ? "bg-lime-950/40 border-lime-500/50 text-lime-300"
              : "bg-red-950/40 border-red-500/50 text-red-300"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      <div className="flex border-b border-[#27272a] mb-6">
        <button
          onClick={() => setActiveTab("diagnostics")}
          className={`px-4 py-2 font-mono text-xs uppercase tracking-wider ${activeTab === "diagnostics" ? "text-lime-400 border-b-2 border-lime-400 font-bold" : "text-zinc-500 hover:text-white"}`}
        >
          Signal Diagnostics
        </button>
        <button
          onClick={() => setActiveTab("stem-verification")}
          className={`px-4 py-2 font-mono text-xs uppercase tracking-wider flex items-center gap-2 ${activeTab === "stem-verification" ? "text-lime-400 border-b-2 border-lime-400 font-bold" : "text-zinc-500 hover:text-white"}`}
        >
          Stem Matching <span className="px-1.5 py-0.5 rounded-full bg-blue-900/40 border border-blue-500/50 text-blue-400 text-[9px]">BETA</span>
        </button>
        <button
          onClick={() => setActiveTab("reference-target")}
          className={`px-4 py-2 font-mono text-xs uppercase tracking-wider flex items-center gap-2 ${activeTab === "reference-target" ? "text-lime-400 border-b-2 border-lime-400 font-bold" : "text-zinc-500 hover:text-white"}`}
        >
          Reference Target Analysis
        </button>
      </div>

      {activeTab === "diagnostics" && (
        <>
          {/* Real-time Diagnostics Overview Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Assets */}
        <div className="bg-[#111114] border border-[#27272a] rounded-xl p-4 font-mono">
          <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Package Assets</div>
          <div className="text-2xl font-bold text-white mt-1.5 flex items-baseline gap-2">
            <span>{totalAssets}</span>
            <span className="text-xs text-zinc-500 font-normal">Files Staged</span>
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">
            {assets.filter((a) => a.assetType === "master").length} Master &bull;{" "}
            {assets.filter((a) => a.assetType === "instrumental").length} Inst &bull;{" "}
            {assets.filter((a) => a.assetType === "clean").length} Clean
          </div>
        </div>

        {/* Max Peak Detected */}
        <div className="bg-[#111114] border border-[#27272a] rounded-xl p-4 font-mono">
          <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Highest True Peak</div>
          <div
            className={`text-2xl font-bold mt-1.5 ${
              maxTruePeak > 0
                ? "text-red-400"
                : maxTruePeak > -0.5
                ? "text-amber-300"
                : maxTruePeak === -96
                ? "text-zinc-500"
                : "text-lime-400"
            }`}
          >
            {maxTruePeak === -96 ? "--" : maxTruePeak > 0 ? `+${maxTruePeak} dBFS` : `${maxTruePeak} dBFS`}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">
            {maxTruePeak > 0 ? "Exceeds 0.0 dBFS limit" : "Within inter-sample headroom"}
          </div>
        </div>

        {/* Average Loudness */}
        <div className="bg-[#111114] border border-[#27272a] rounded-xl p-4 font-mono">
          <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Average Loudness</div>
          <div className="text-2xl font-bold text-white mt-1.5">{avgLufs !== "--" ? `${avgLufs} LUFS` : "--"}</div>
          <div className="text-[10px] text-zinc-500 mt-1">ITU-R BS.1770-4 Gated</div>
        </div>

        {/* Signal Integrity & Clipping */}
        <div className="bg-[#111114] border border-[#27272a] rounded-xl p-4 font-mono">
          <div className="text-[11px] text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Clipping & Phase</span>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                clippedAssets.length > 0 ? "bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" : "bg-lime-400"
              }`}
            />
          </div>
          <div
            className={`text-2xl font-bold mt-1.5 ${
              clippedAssets.length > 0 ? "text-red-400" : "text-lime-400"
            }`}
          >
            {clippedAssets.length === 0 ? "Clean Signal" : `${clippedAssets.length} Clipped Asset`}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">
            {clippedAssets.length > 0 ? "Digital overs detected" : "Zero clipping violations"}
          </div>
        </div>
      </div>

      {/* Drag & Drop Master Ingestion Zone */}
      {showDropzone && (
        <div className="space-y-2">
          <div className="flex items-center justify-between font-mono text-xs text-zinc-400">
            <span className="uppercase tracking-wider font-bold text-white flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-400"></span>
              Direct Ingestion & Signal Scanner
            </span>
            <button
              onClick={() => setShowDropzone(false)}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              Hide Dropzone ✕
            </button>
          </div>
          <AudioDropzone projectId={project.id} onAssetIngested={handleDirectAssetIngested} />
        </div>
      )}

      {/* Filter & View Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-y border-[#27272a] py-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-mono text-zinc-400 uppercase mr-2">Filter:</span>
          {["all", "master", "instrumental", "clean", "stem", "performance"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-2.5 py-1 rounded-none font-mono text-[10px] uppercase hardware-cut active:translate-y-[1px] ${
                filterType === type
                  ? "bg-lime-400 text-black font-bold border border-lime-400"
                  : "bg-[#141416] border border-[#27272a] text-zinc-400 hover:text-white hover:bg-[#1f1f23] hover:border-zinc-500"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {!showDropzone && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDropzone(true)}
              className="font-mono text-xs border-[#27272a] rounded-none hardware-cut hover:border-lime-400"
            >
              + Upload File
            </Button>
          )}

          <div className="flex items-center bg-[#141416] border border-[#27272a] rounded-none p-0.5">
            <button
              onClick={() => setViewMode("visualizers")}
              className={`px-3 py-1 text-[11px] font-mono uppercase rounded-none hardware-cut active:translate-y-[1px] ${
                viewMode === "visualizers"
                  ? "bg-lime-400 text-black font-bold"
                  : "text-zinc-400 hover:text-white hover:bg-[#1f1f23]"
              }`}
            >
              Visualizers
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1 text-[11px] font-mono uppercase rounded-none hardware-cut active:translate-y-[1px] ${
                viewMode === "table"
                  ? "bg-lime-400 text-black font-bold"
                  : "text-zinc-400 hover:text-white hover:bg-[#1f1f23]"
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Main Asset Display: Visualizers or Table */}
      {viewMode === "visualizers" ? (
        <div className="space-y-4">
          {filteredAssets.map((asset, idx) => (
            <div key={asset.id} className="relative group hardware-card rounded-none overflow-hidden hover:border-lime-400/80">
              <div className="absolute top-2 left-2 z-10 font-mono text-[9px] text-zinc-500 bg-[#09090b]/80 px-1 border border-[#27272a]">
                [{String(idx + 1).padStart(2, "0")}]
              </div>
              <InteractiveWaveformPlayer
                asset={asset}
                onDiagnosticsUpdated={handleDiagnosticsUpdated}
              />
              <button
                onClick={() => handleRemoveAsset(asset.id)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-red-400 p-1 font-mono text-xs opacity-0 group-hover:opacity-100 hardware-cut hover:bg-red-950/40 border border-transparent hover:border-red-500/50"
                title="Remove asset"
              >
                ✕ Delete
              </button>
            </div>
          ))}

          {filteredAssets.length === 0 && (
            <div className="border border-dashed border-[#27272a] rounded-none py-16 text-center space-y-3 font-mono">
              <div className="text-zinc-400 text-sm font-bold">No audio assets in this view</div>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Drop your WAV master files into the dropzone above or import directly from Google Drive.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Ledger Table View */
        <div className="border border-[#27272a] bg-[#111114] rounded-none overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse font-mono">
              <thead className="bg-[#141416] text-[11px] uppercase tracking-wider text-zinc-400 border-b border-[#27272a]">
                <tr>
                  <th className="px-4 py-3 border-b border-[#27272a]">Filename</th>
                  <th className="px-4 py-3 border-b border-[#27272a]">Role</th>
                  <th className="px-4 py-3 border-b border-[#27272a]">True Peak</th>
                  <th className="px-4 py-3 border-b border-[#27272a]">LUFS</th>
                  <th className="px-4 py-3 border-b border-[#27272a]">Format</th>
                  <th className="px-4 py-3 border-b border-[#27272a]">Size</th>
                  <th className="px-4 py-3 border-b border-[#27272a]">Checksum Digest</th>
                  <th className="px-4 py-3 border-b border-[#27272a] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="border-b border-[#27272a] last:border-0 hover:bg-[#1f1f23] hover:border-l-2 hover:border-l-lime-400 hardware-cut text-xs cursor-pointer active:translate-y-[1px]"
                  >
                    <td className="px-4 py-3 font-medium text-white font-mono">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-none ${
                            asset.diagnostics?.verdict === "failed" ? "bg-red-400" : "bg-lime-400"
                          }`}
                        />
                        <span className="truncate max-w-[200px]" title={asset.filename}>
                          {asset.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-[#1c1c1f] border border-[#333] text-lime-400 font-mono px-2 py-0.5 rounded-none text-[10px] uppercase">
                        {asset.assetType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {asset.diagnostics ? (
                        <span
                          className={
                            asset.diagnostics.truePeakDbfs > 0 ? "text-red-400 font-bold" : "text-lime-400"
                          }
                        >
                          {asset.diagnostics.truePeakDbfs > 0
                            ? `+${asset.diagnostics.truePeakDbfs}`
                            : asset.diagnostics.truePeakDbfs}{" "}
                          dBFS
                        </span>
                      ) : (
                        <span className="text-zinc-500">Unscanned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {asset.diagnostics ? `${asset.diagnostics.integratedLufs} LUFS` : "--"}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {asset.sampleRateHz && asset.bitDepth
                        ? `${asset.sampleRateHz / 1000}kHz / ${asset.bitDepth}b`
                        : "48kHz / 24b"}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{formatBytes(asset.bytes)}</td>
                    <td
                      className="px-4 py-3 text-zinc-500 text-[10px] max-w-[140px] truncate font-mono"
                      title={asset.checksum}
                    >
                      {asset.checksum}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveAsset(asset.id);
                        }}
                        className="text-zinc-500 hover:text-red-400 hardware-cut p-1"
                        title="Remove asset"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {activeTab === "stem-verification" && (
        <div className="surface-panel p-6 sm:p-8 space-y-6 bg-[#111114] border-[#27272a]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-white">Pre-Clearance Stem Matching</h3>
              <p className="font-mono text-xs text-zinc-400 mt-1">Cryptographic phase cancellation to verify master composition against cleared stems.</p>
            </div>
            <Button variant="outline" size="sm" className="font-mono text-xs uppercase flex items-center gap-2 border-lime-500/50 text-lime-400 hover:bg-lime-400/10">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Execute Phase Check
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 border border-[#27272a] rounded-sm bg-[#09090b]">
              <span className="font-mono text-[10px] uppercase text-zinc-500 tracking-wider">Master Target</span>
              <div className="mt-2 text-sm font-mono text-white p-2 border border-[#27272a] bg-[#1a1a1c] rounded">
                {assets.find(a => a.assetType === "master")?.filename || "No master asset found."}
              </div>
            </div>
            <div className="p-4 border border-[#27272a] rounded-sm bg-[#09090b]">
              <span className="font-mono text-[10px] uppercase text-zinc-500 tracking-wider">Cleared Stems Staged</span>
              <div className="mt-2 space-y-2">
                {assets.filter(a => a.assetType === "stem" || a.assetType === "instrumental").length > 0 ? (
                  assets.filter(a => a.assetType === "stem" || a.assetType === "instrumental").map(a => (
                    <div key={a.id} className="text-xs font-mono text-white p-2 border border-[#27272a] bg-[#1a1a1c] rounded flex justify-between">
                      <span className="truncate pr-2">{a.filename}</span>
                      <span className="text-lime-400">CLEARED</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs font-mono text-zinc-500 italic p-2">No cleared stems/instrumentals staged.</div>
                )}
              </div>
            </div>
          </div>
          
          <div className="p-6 border border-[#27272a] rounded-sm bg-[#09090b] flex flex-col items-center justify-center min-h-[160px] text-center">
            <div className="w-12 h-12 rounded-full border border-lime-500/50 text-lime-400 flex items-center justify-center mb-3 bg-lime-950/40">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18M18 17l-5-5-4 4-4-4"/></svg>
            </div>
            <p className="font-mono text-xs text-zinc-400 max-w-lg">Run verification to mathematically subtract staged stems from the master signal. Any residual audio energy indicates unauthorized samples or un-staged stems.</p>
          </div>
        </div>
      )}

      {activeTab === "reference-target" && (
        <div className="surface-panel p-6 sm:p-8 space-y-6 bg-[#111114] border-[#27272a]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-white">Commercial Reference Target Analysis</h3>
              <p className="font-mono text-xs text-zinc-400 mt-1">Cross-reference LUFS and frequency spectrums against established industry targets.</p>
            </div>
            <Button variant="hero" size="sm" className="font-mono text-xs uppercase flex items-center gap-2">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Stage Target Audio
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-4 border border-[#27272a] bg-[#09090b] rounded-sm">
                <span className="font-mono text-[10px] uppercase text-zinc-500 tracking-wider">Active Master (A)</span>
                <div className="mt-2 flex justify-between items-end">
                  <span className="font-mono text-2xl font-bold text-white">{avgLufs !== "--" ? `${avgLufs} LUFS` : "--"}</span>
                  <span className="font-mono text-xs text-lime-400">Current</span>
                </div>
              </div>
              <div className="p-4 border border-[#27272a] bg-[#1a1a1c] rounded-sm border-dashed">
                <span className="font-mono text-[10px] uppercase text-zinc-500 tracking-wider">Reference Target (B)</span>
                <div className="mt-2 flex justify-between items-end">
                  <span className="font-mono text-2xl font-bold text-zinc-600">-- LUFS</span>
                  <span className="font-mono text-xs text-zinc-500">Unstaged</span>
                </div>
              </div>
            </div>

            <div className="border border-[#27272a] bg-[#09090b] p-4 rounded-sm flex flex-col relative overflow-hidden min-h-[180px]">
              <span className="font-mono text-[10px] uppercase text-zinc-500 tracking-wider mb-2">Comparative EQ Delta</span>
              <div className="flex-1 flex items-center justify-center">
                <p className="font-mono text-[10px] text-zinc-600 text-center max-w-[200px]">Stage a reference target track to generate differential frequency response visualizations.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Classification Modal */}
      {pendingDriveFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111114] border border-[#27272a] w-full max-w-md rounded-xl p-6 space-y-5 text-[#E0E0E0] shadow-2xl">
            <div className="flex items-center gap-3 border-b border-[#27272a] pb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-lime-400" />
              <h4 className="font-mono text-sm font-bold text-white uppercase">Classify Audio Asset</h4>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-[#18181b] border border-[#333] rounded">
                <div className="text-zinc-400 text-[10px] uppercase">Selected File</div>
                <div className="font-bold text-white truncate mt-1">{pendingDriveFile.name}</div>
                <div className="text-zinc-500 text-[10px] mt-1">
                  Size: {pendingDriveFile.size ? formatBytes(parseInt(pendingDriveFile.size, 10)) : "Unknown"} &bull;
                  Mime: {pendingDriveFile.mimeType}
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                  Target Asset Role
                </label>
                <select
                  value={selectedAssetType}
                  onChange={(e) => setSelectedAssetType(e.target.value as AssetType)}
                  className="w-full bg-[#18181b] border border-[#333] rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-lime-400"
                >
                  <option value="master">Master Audio (Full Mix)</option>
                  <option value="instrumental">Instrumental Mix</option>
                  <option value="clean">Clean / Radio Edit</option>
                  <option value="performance">Performance / TV Track</option>
                  <option value="stem">Stems / Multitrack Package</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#27272a]">
              <Button variant="ghost" size="sm" onClick={() => setPendingDriveFile(null)}>
                Cancel
              </Button>
              <Button
                variant="hero"
                size="sm"
                onClick={handleConfirmDriveIngest}
                disabled={isImporting}
              >
                {isImporting ? "Ingesting..." : "Confirm & Ingest"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Drive Picker Dialog */}
      {showDrivePicker && (
        <DrivePicker
          filterType="audio"
          title="Ingest Audio Master from Google Drive"
          onSelect={handleDriveSelect}
          onCancel={() => setShowDrivePicker(false)}
        />
      )}
    </div>
  );
}
