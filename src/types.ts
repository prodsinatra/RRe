import { z } from "zod";

// =======================================
// Domain Models
// =======================================

export type ProjectState = 
  | "draft"
  | "collecting"
  | "ready_for_checks"
  | "checks_running"
  | "blocked"
  | "needs_review"
  | "ready_for_approval"
  | "approved"
  | "manifest_generated"
  | "exported"
  | "archived"
  | "cancelled";

export type FindingSeverity = "blocked" | "needs_review" | "advisory" | "passed";
export type AssetType = "master" | "instrumental" | "clean" | "performance" | "stem" | "artwork";

export interface AudioDiagnostics {
  analyzedAt: string;
  sampleRate: number;
  bitDepth: number;
  channels: number;
  durationSeconds: number;
  truePeakDbfs: number;
  integratedLufs: number;
  shortTermLufsMax?: number;
  loudnessRangeLU?: number;
  dynamicRangeDb: number;
  clippingCount: number;
  clippingTimestamps: number[];
  phaseCorrelation: number; // -1.0 to +1.0
  dcOffsetPercent: number;
  spectralBands: {
    subBass: number; // 20-60Hz energy %
    bass: number;    // 60-250Hz energy %
    mid: number;     // 250-4000Hz energy %
    high: number;    // 4k-20kHz energy %
  };
  waveformPeaks?: number[]; // normalized 0..1 for visual rendering
  verdict: "passed" | "warning" | "failed";
  issues: string[];
}

export interface ReleaseAsset {
  id: string;
  projectId: string;
  assetType: AssetType;
  filename: string;
  mimeType: string;
  bytes: number;
  checksum: string;
  sampleRateHz?: number;
  bitDepth?: number;
  channels?: number;
  durationMs?: number;
  version: string;
  source: "synthetic" | "uploaded";
  diagnostics?: AudioDiagnostics;
  audioUrl?: string;
  createdAt: string;
}

export interface ReadinessFinding {
  id: string;
  checkRunId: string;
  projectId: string;
  code: string;
  category: string;
  severity: FindingSeverity;
  title: string;
  explanation: string;
  evidence: string;
  sourceType: string;
  sourceId: string;
  status: "unresolved" | "acknowledged" | "resolved";
  deterministic: boolean;
  confidence: number;
  createdAt: string;
}

export interface FindingResolution {
  id: string;
  findingId: string;
  actorId: string;
  status: "acknowledged" | "resolved";
  note: string;
  createdAt: string;
}

export type RoyaltyType = "songwriter" | "producer" | "performer";

export interface ContributorCredit {
  id: string;
  name: string;
  role: string;
  splits: Record<RoyaltyType, number>;
}

export interface CheckPolicy {
  id: string;
  version: string;
  requiredRoles: string[];
  artworkDimensions: string;
  artworkFileTypes: string[];
  assetNamingConvention: string;
  webhookUrl?: string;
  createdAt: string;
}

export interface ArtworkAsset {
  id: string;
  assetId: string;
  dimensions: string; // e.g., "3000x3000"
  hasRightsAttestation: boolean;
  url?: string;
}

export interface ReleaseMetadata {
  title: string;
  primaryArtist: string;
  featuredArtists: string[];
  explicitContent: boolean;
  targetDate: string;
  isrc?: string;
  upc?: string;
}

export interface ApprovalSnapshot {
  id: string;
  projectId: string;
  revision: number;
  approvedBy: string;
  approvedAt: string;
  inputDigest: string;
  note: string;
}

export interface DeliveryManifest {
  id: string;
  projectId: string;
  snapshotId: string;
  generatedAt: string;
  digest: string;
  contentJson: string;
  contentCsv: string;
  contentDdexXml?: string;
}

export interface ProjectEvent {
  id: string;
  projectId: string;
  actorId: string;
  actorRole?: string;
  eventType: string;
  previousState: ProjectState;
  nextState: ProjectState;
  entityType: string;
  entityId: string;
  payloadDigest: string;
  createdAt: string;
}

export interface ReadinessProject {
  id: string;
  title: string;
  primaryArtist: string;
  ownerId: string;
  state: ProjectState;
  revision: number;
  targetDate: string | null;
  metadata: ReleaseMetadata;
  credits: ContributorCredit[];
  assets: ReleaseAsset[];
  artwork: ArtworkAsset | null;
  findings: ReadinessFinding[];
  resolutions: FindingResolution[];
  events: ProjectEvent[];
  approvalSnapshot: ApprovalSnapshot | null;
  manifest: DeliveryManifest | null;
  aiSummary?: AISummary;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: "client" | "operator" | "approver" | "viewer";
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "client" | "operator" | "approver" | "viewer" | "engineer";
}

export interface PresenceUser {
  id: string;
  name: string;
  email: string;
  role: "operator" | "approver" | "client" | "engineer";
  avatarColor: string;
  activeTab?: string;
  activeField?: string;
  statusMessage?: string;
  joinedAt: string;
  lastSeen: number;
}

export interface RealtimeTelemetry {
  status: "connected" | "connecting" | "disconnected" | "reconnecting";
  latencyMs: number;
  viewers: PresenceUser[];
  activeRoomId: string | null;
}

export const aiSummarySchema = z.object({
  summary: z.string(),
  priority_actions: z.array(z.object({
    finding_ids: z.array(z.string()),
    action: z.string(),
    reason: z.string(),
    requires_human_decision: z.boolean()
  })),
  uncertainties: z.array(z.string()),
  prohibited_claims_avoided: z.array(z.string())
});

export type AISummary = z.infer<typeof aiSummarySchema>;
