import { useState, useRef } from "react";
import { AssetType, ReleaseAsset } from "../../types";
import {
  decodeAudioBuffer,
  analyzeAudioBuffer,
  computeArrayBufferChecksum,
  audioBufferToWavDataUrl
} from "../../lib/audio-diagnostics";
import { Button } from "../ui/button";
import { formatBytes } from "../../lib/utils";

interface AudioDropzoneProps {
  projectId: string;
  onAssetIngested: (asset: ReleaseAsset) => void;
}

export function AudioDropzone({ projectId, onAssetIngested }: AudioDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processAudioFile = async (file: File, assetType: AssetType = "master") => {
    setIsProcessing(true);
    setProgressMsg(`Reading ${file.name}...`);

    try {
      // 1. Read binary array buffer
      const arrayBuffer = await file.arrayBuffer();

      // 2. Compute SHA-256 Checksum
      setProgressMsg("Computing SHA-256 bitwise digest...");
      const checksum = await computeArrayBufferChecksum(arrayBuffer);

      // 3. Web Audio Signal Analysis
      setProgressMsg("Executing Web Audio DSP & True Peak analysis...");
      const audioBuffer = await decodeAudioBuffer(arrayBuffer);
      const diagnostics = analyzeAudioBuffer(audioBuffer);

      // 4. Generate local playable URL
      const audioUrl = audioBufferToWavDataUrl(audioBuffer);

      // 5. Build Release Asset object
      const newAsset: ReleaseAsset = {
        id: `ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        projectId,
        assetType,
        filename: file.name,
        mimeType: file.type || "audio/wav",
        bytes: file.size,
        checksum,
        sampleRateHz: diagnostics.sampleRate,
        bitDepth: diagnostics.bitDepth,
        channels: diagnostics.channels,
        durationMs: Math.round(diagnostics.durationSeconds * 1000),
        version: "v1",
        source: "uploaded",
        diagnostics,
        audioUrl,
        createdAt: new Date().toISOString()
      };

      onAssetIngested(newAsset);
    } catch (err: any) {
      console.error("[Audio Processing Error]:", err);
      alert(`Failed to analyze audio file: ${err.message || String(err)}`);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // Infer type from filename if contains INST, CLEAN, STEM
      let inferredType: AssetType = "master";
      const upper = file.name.toUpperCase();
      if (upper.includes("INST")) inferredType = "instrumental";
      else if (upper.includes("CLEAN") || upper.includes("RADIO")) inferredType = "clean";
      else if (upper.includes("STEM")) inferredType = "stem";
      else if (upper.includes("TV") || upper.includes("PERF")) inferredType = "performance";

      await processAudioFile(file, inferredType);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await processAudioFile(file, "master");
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
        isDragging
          ? "border-lime-400 bg-lime-950/20 shadow-[0_0_20px_rgba(163,230,53,0.2)]"
          : "border-[#27272a] bg-[#0c0c0e] hover:border-zinc-500 hover:bg-[#111114]"
      }`}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/wav,audio/x-wav,audio/flac,audio/mp3,audio/aiff,audio/ogg"
        onChange={handleFileChange}
        className="hidden"
      />

      {isProcessing ? (
        <div className="py-4 space-y-3 font-mono">
          <div className="w-8 h-8 border-2 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm font-bold text-lime-400 uppercase tracking-wider">
            Signal Verification in Progress
          </div>
          <p className="text-xs text-zinc-400">{progressMsg}</p>
        </div>
      ) : (
        <div className="space-y-3 font-mono">
          <div className="w-12 h-12 rounded-full bg-[#18181b] border border-[#27272a] flex items-center justify-center mx-auto text-lime-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>

          <div>
            <span className="text-sm font-bold text-white block">
              Drop Master Audio File Here or Click to Upload
            </span>
            <span className="text-xs text-zinc-400 block mt-1">
              Supports Broadcast WAV (48kHz/24bit), FLAC, AIFF &bull; Real-Time Peak & LUFS Scan
            </span>
          </div>

          <div className="inline-flex items-center gap-2 pt-2">
            <span className="px-2 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[10px] text-zinc-400">
              WAV
            </span>
            <span className="px-2 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[10px] text-zinc-400">
              24-BIT
            </span>
            <span className="px-2 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[10px] text-zinc-400">
              48 kHz
            </span>
            <span className="px-2 py-0.5 rounded bg-lime-950/40 border border-lime-500/40 text-[10px] text-lime-400 font-bold">
              TRUE PEAK & LUFS
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
