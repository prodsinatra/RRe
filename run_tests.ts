import assert from "node:assert";
import { runDeterministicChecks } from "./src/db/rule-engine";
import { defaultPolicy } from "./src/db/in-memory-db";
import { ReadinessProject, ContributorCredit, CheckPolicy } from "./src/types";
import { aiSummarySchema } from "./src/types";
import {
  validateStateTransition,
  applyStateTransition,
  STATE_TRANSITION_RULES
} from "./src/lib/state/releaseMachine";

// Helper to create a dummy project
function createDummyProject(): ReadinessProject {
  return {
    id: "test",
    title: "Test",
    primaryArtist: "Test Artist",
    ownerId: "user",
    state: "ready_for_checks",
    revision: 1,
    targetDate: "2026-01-01",
    metadata: { title: "Test", primaryArtist: "Test Artist", featuredArtists: [], explicitContent: false, targetDate: "2026-01-01" },
    credits: [],
    assets: [],
    artwork: { id: "art1", assetId: "test", dimensions: "3000x3000", hasRightsAttestation: true },
    findings: [], resolutions: [], events: [], approvalSnapshot: null, manifest: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
}

function testSplits() {
  const p = createDummyProject();
  const testPolicy: CheckPolicy = { ...defaultPolicy, requiredRoles: [] };
  
  // Exactly 100
  p.credits = [{ id: "c1", name: "A", role: "Songwriter", splits: { songwriter: 100, producer: 100, performer: 100 } }];
  let findings = runDeterministicChecks(p, testPolicy);
  assert(!findings.some(f => f.title.includes("Invalid Split")), "100.00 should pass");

  // 99.99
  p.credits = [{ id: "c1", name: "A", role: "Songwriter", splits: { songwriter: 99.99, producer: 100, performer: 100 } }];
  findings = runDeterministicChecks(p, testPolicy);
  assert(findings.some(f => f.title.includes("Invalid Split Total: songwriter")), "99.99 should fail");

  // 100.01
  p.credits = [{ id: "c1", name: "A", role: "Songwriter", splits: { songwriter: 100.01, producer: 100, performer: 100 } }];
  findings = runDeterministicChecks(p, testPolicy);
  assert(findings.some(f => f.title.includes("Invalid Split Total: songwriter")), "100.01 should fail");
  
  console.log("✅ Split total tests passed.");
}

function testDuplicates() {
  const p = createDummyProject();
  p.assets = [
    { id: "a1", projectId: "test", assetType: "master", filename: "test_MASTER_v1.wav", mimeType: "audio/wav", bytes: 100, checksum: "hash1", version: "v1", source: "synthetic", createdAt: "" },
    { id: "a2", projectId: "test", assetType: "clean", filename: "test_MASTER_v1.wav", mimeType: "audio/wav", bytes: 100, checksum: "hash1", version: "v1", source: "synthetic", createdAt: "" }
  ];
  const findings = runDeterministicChecks(p, defaultPolicy);
  assert(findings.some(f => f.code === "AA_002"), "Duplicate checksum should be flagged");
  console.log("✅ Duplicate asset tests passed.");
}

function testZodRejection() {
  const badData = { summary: "Great", priority_actions: [{ finding_ids: ["1"], action: "Do this" }] }; // missing required fields
  const result = aiSummarySchema.safeParse(badData);
  assert(!result.success, "Malformed Gemini output must be rejected");
  console.log("✅ Zod AI Output Validation tests passed.");
}

function testStateMachineTransitions() {
  const p = createDummyProject();
  p.state = "ready_for_approval";
  p.findings = [];

  // 1. Operator without approver role cannot approve
  const failAuth = validateStateTransition(p, { type: "APPROVE_RELEASE", actorId: "u1", role: "viewer" }, { id: "u1", role: "viewer" });
  assert(!failAuth.valid, "Viewer must be blocked from approving release");

  // 2. Approver with blockers cannot approve
  p.findings = [{
    id: "f1",
    checkRunId: "r1",
    projectId: "test",
    code: "CR_001",
    category: "Credits",
    severity: "blocked",
    title: "Blocker",
    explanation: "E",
    evidence: "",
    sourceType: "credits",
    sourceId: "1",
    status: "unresolved",
    deterministic: true,
    confidence: 1,
    createdAt: ""
  }];
  const failBlocker = validateStateTransition(p, { type: "APPROVE_RELEASE", actorId: "app1", role: "approver" }, { id: "app1", role: "approver" });
  assert(!failBlocker.valid, "Blocker must prevent release approval");

  // 3. Clear blockers and approve
  p.findings = [];
  const { nextProject: approvedProj, eventLog } = applyStateTransition(
    p,
    { type: "APPROVE_RELEASE", actorId: "app1", role: "approver" },
    { id: "app1", role: "approver" },
    "digest_123"
  );
  assert.strictEqual(approvedProj.state, "approved", "Project should transition to approved");
  assert.strictEqual(eventLog.eventType, "approve_release");

  // 4. Material edit on approved project bumps revision and resets to collecting
  const { nextProject: editedProj } = applyStateTransition(
    approvedProj,
    { type: "MATERIAL_EDIT" },
    { id: "op1", role: "operator" }
  );
  assert.strictEqual(editedProj.state, "collecting", "State must reset to collecting on material edit");
  assert.strictEqual(editedProj.revision, 2, "Revision must bump on material edit");
  assert.strictEqual(editedProj.approvalSnapshot, null, "Approval snapshot must be invalidated");
  assert.strictEqual(editedProj.manifest, null, "Manifest must be invalidated");

  console.log("✅ State machine transition tests passed.");
}

function testAudioDiagnostics() {
  const p = createDummyProject();
  p.assets = [
    {
      id: "a1",
      projectId: "test",
      assetType: "master",
      filename: "TRACK_MASTER_v1.wav",
      mimeType: "audio/wav",
      bytes: 1000000,
      checksum: "hash_master_1",
      sampleRateHz: 48000,
      bitDepth: 24,
      channels: 2,
      version: "v1",
      source: "uploaded",
      diagnostics: {
        analyzedAt: new Date().toISOString(),
        sampleRate: 48000,
        bitDepth: 24,
        channels: 2,
        durationSeconds: 8.0,
        truePeakDbfs: 0.5,
        integratedLufs: -7.2,
        shortTermLufsMax: -5.0,
        loudnessRangeLU: 4.0,
        dynamicRangeDb: 6.2,
        clippingCount: 8,
        clippingTimestamps: [1.2, 3.4],
        phaseCorrelation: 0.85,
        dcOffsetPercent: 0.01,
        spectralBands: { subBass: 0.35, bass: 0.25, mid: 0.25, high: 0.15 },
        waveformPeaks: [0.5, 0.8, 1.0],
        verdict: "failed",
        issues: ["Exceeds 0dBFS", "8 clipped samples"]
      },
      createdAt: ""
    }
  ];

  const findings = runDeterministicChecks(p, defaultPolicy);
  assert(findings.some(f => f.code === "AA_CLIP"), "AA_CLIP finding must be generated for clipped master");
  assert(findings.some(f => f.code === "AA_PEAK_OVER"), "AA_PEAK_OVER finding must be generated for true peak > 0.0 dBFS");
  console.log("✅ Audio diagnostics rule validation tests passed.");
}

testSplits();
testDuplicates();
testZodRejection();
testStateMachineTransitions();
testAudioDiagnostics();
console.log("🎉 All automated domain, state machine & signal diagnostics tests passed successfully.");
