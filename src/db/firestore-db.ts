import { db as adminDb } from "../lib/firebase-admin";
let db: any = adminDb;
import { ReadinessProject, CheckPolicy, ProjectEvent } from "../types";

export const defaultPolicy: CheckPolicy = {
  id: "policy_01",
  version: "v1.0",
  requiredRoles: ["Producer", "Songwriter"],
  artworkDimensions: "3000x3000",
  artworkFileTypes: ["image/jpeg", "image/png"],
  assetNamingConvention: "^[A-Za-z0-9_]+_(MASTER|INST|CLEAN|STEM)_v[0-9]+\\.wav$",
  createdAt: new Date().toISOString()
};

export const initialMockProject: ReadinessProject = {
  id: "proj_123456",
  title: "NEW TRACK_0625",
  primaryArtist: "Ryu Phantom",
  ownerId: "user_client1",
  state: "ready_for_checks",
  revision: 1,
  targetDate: "2026-10-31",
  metadata: {
    title: "NEW TRACK_0625",
    primaryArtist: "Ryu Phantom",
    featuredArtists: ["Kyra V"],
    explicitContent: true,
    targetDate: "2026-10-31",
  },
  credits: [
    { 
      id: "c1", 
      name: "Ryu Phantom", 
      role: "Primary Artist / Writer", 
      splits: { songwriter: 50, performer: 100, producer: 0 } 
    },
    { 
      id: "c2", 
      name: "Kyra V", 
      role: "Featured Artist / Writer", 
      splits: { songwriter: 25, performer: 0, producer: 0 } 
    },
    { 
      id: "c3", 
      name: "DJ Ghost", 
      role: "Producer", 
      splits: { songwriter: 20, performer: 0, producer: 100 } 
    },
  ],
  assets: [
    {
      id: "a1",
      projectId: "proj_123456",
      assetType: "master",
      filename: "NEW_TRACK_0625_MASTER_v2.wav",
      mimeType: "audio/wav",
      bytes: 45000000,
      checksum: "sha256-abc123def456",
      sampleRateHz: 48000,
      bitDepth: 24,
      channels: 2,
      version: "v2",
      source: "synthetic",
      diagnostics: {
        analyzedAt: new Date().toISOString(),
        sampleRate: 48000,
        bitDepth: 24,
        channels: 2,
        durationSeconds: 8.0,
        truePeakDbfs: -0.3,
        integratedLufs: -8.4,
        shortTermLufsMax: -6.1,
        loudnessRangeLU: 6.2,
        dynamicRangeDb: 8.8,
        clippingCount: 0,
        clippingTimestamps: [],
        phaseCorrelation: 0.92,
        dcOffsetPercent: 0.01,
        spectralBands: { subBass: 0.35, bass: 0.28, mid: 0.24, high: 0.13 },
        waveformPeaks: [0.3,0.5,0.7,0.9,0.8,0.6,0.85,0.92,0.75,0.65,0.8,0.95,0.88,0.7,0.6,0.78,0.9,0.82,0.68,0.55,0.7,0.88,0.94,0.8,0.65,0.75,0.86,0.9,0.72,0.6,0.7,0.85,0.92,0.78,0.62,0.74,0.88,0.96,0.82,0.68],
        verdict: "passed",
        issues: []
      },
      createdAt: new Date().toISOString()
    },
    {
      id: "a2",
      projectId: "proj_123456",
      assetType: "instrumental",
      filename: "NEW_TRACK_0625_INST_v2.wav",
      mimeType: "audio/wav",
      bytes: 44000000,
      checksum: "sha256-def456abc123",
      sampleRateHz: 48000,
      bitDepth: 24,
      channels: 2,
      version: "v2",
      source: "synthetic",
      diagnostics: {
        analyzedAt: new Date().toISOString(),
        sampleRate: 48000,
        bitDepth: 24,
        channels: 2,
        durationSeconds: 8.0,
        truePeakDbfs: -0.4,
        integratedLufs: -8.9,
        shortTermLufsMax: -6.5,
        loudnessRangeLU: 6.8,
        dynamicRangeDb: 9.1,
        clippingCount: 0,
        clippingTimestamps: [],
        phaseCorrelation: 0.94,
        dcOffsetPercent: 0.01,
        spectralBands: { subBass: 0.38, bass: 0.30, mid: 0.20, high: 0.12 },
        waveformPeaks: [0.25,0.45,0.68,0.85,0.78,0.58,0.82,0.89,0.72,0.62,0.78,0.91,0.84,0.68,0.58,0.74,0.86,0.8,0.65,0.52,0.68,0.84,0.91,0.78,0.62,0.72,0.84,0.88,0.7,0.58,0.68,0.82,0.89,0.75,0.6,0.72,0.85,0.92,0.8,0.65],
        verdict: "passed",
        issues: []
      },
      createdAt: new Date().toISOString()
    },
    {
      id: "a3",
      projectId: "proj_123456",
      assetType: "clean",
      filename: "NEW_TRACK_0625_CLEAN_v2.wav",
      mimeType: "audio/wav",
      bytes: 45000000,
      checksum: "sha256-abc123def456",
      sampleRateHz: 48000,
      bitDepth: 24,
      channels: 2,
      version: "v2",
      source: "synthetic",
      diagnostics: {
        analyzedAt: new Date().toISOString(),
        sampleRate: 48000,
        bitDepth: 24,
        channels: 2,
        durationSeconds: 8.0,
        truePeakDbfs: 0.4,
        integratedLufs: -6.8,
        shortTermLufsMax: -5.1,
        loudnessRangeLU: 4.2,
        dynamicRangeDb: 5.4,
        clippingCount: 14,
        clippingTimestamps: [1.2, 2.4, 4.8, 6.1],
        phaseCorrelation: 0.88,
        dcOffsetPercent: 0.04,
        spectralBands: { subBass: 0.32, bass: 0.28, mid: 0.26, high: 0.14 },
        waveformPeaks: [0.4,0.6,0.85,1.0,0.95,0.7,0.95,1.0,0.85,0.75,0.9,1.0,0.95,0.8,0.7,0.88,1.0,0.92,0.78,0.65,0.8,0.98,1.0,0.9,0.75,0.85,0.96,1.0,0.82,0.7,0.8,0.95,1.0,0.88,0.72,0.84,0.98,1.0,0.92,0.78],
        verdict: "failed",
        issues: [
          "True peak exceeds digital ceiling (+0.4 dBFS > 0.0 dBFS)",
          "Detected 14 clipped samples across signal"
        ]
      },
      createdAt: new Date().toISOString()
    },
    {
      id: "a4",
      projectId: "proj_123456",
      assetType: "stem",
      filename: "NEW_TRACK_0625_MASTER_v2.wav",
      mimeType: "audio/wav",
      bytes: 12000000,
      checksum: "sha256-xyz789",
      sampleRateHz: 48000,
      bitDepth: 24,
      channels: 2,
      version: "v2",
      source: "synthetic",
      diagnostics: {
        analyzedAt: new Date().toISOString(),
        sampleRate: 48000,
        bitDepth: 24,
        channels: 2,
        durationSeconds: 8.0,
        truePeakDbfs: -1.2,
        integratedLufs: -14.2,
        shortTermLufsMax: -11.5,
        loudnessRangeLU: 8.4,
        dynamicRangeDb: 11.2,
        clippingCount: 0,
        clippingTimestamps: [],
        phaseCorrelation: 0.98,
        dcOffsetPercent: 0.0,
        spectralBands: { subBass: 0.45, bass: 0.32, mid: 0.15, high: 0.08 },
        waveformPeaks: [0.2,0.35,0.5,0.65,0.58,0.42,0.6,0.68,0.54,0.45,0.58,0.7,0.62,0.48,0.4,0.55,0.65,0.58,0.48,0.38,0.5,0.64,0.7,0.58,0.44,0.52,0.64,0.68,0.52,0.42,0.5,0.62,0.68,0.55,0.44,0.52,0.65,0.7,0.58,0.46],
        verdict: "passed",
        issues: []
      },
      createdAt: new Date().toISOString()
    }
  ],
  artwork: {
    id: "art1",
    assetId: "proj_123456",
    dimensions: "1500x1500",
    hasRightsAttestation: true
  },
  findings: [],
  resolutions: [],
  events: [
    {
      id: "evt_1",
      projectId: "proj_123456",
      actorId: "user_client1",
      eventType: "project_created",
      previousState: "draft",
      nextState: "collecting",
      entityType: "project",
      entityId: "proj_123456",
      payloadDigest: "sha256-111",
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: "evt_2",
      projectId: "proj_123456",
      actorId: "user_operator1",
      eventType: "state_changed",
      previousState: "collecting",
      nextState: "ready_for_checks",
      entityType: "project",
      entityId: "proj_123456",
      payloadDigest: "sha256-222",
      createdAt: new Date(Date.now() - 86400000).toISOString()
    }
  ],
  approvalSnapshot: null,
  manifest: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const initialMockProject2: ReadinessProject = {
  id: "proj_789012",
  title: "COLD SIGNALS",
  primaryArtist: "Neon Echo",
  ownerId: "user_client1",
  state: "draft",
  revision: 1,
  targetDate: null,
  metadata: {
    title: "COLD SIGNALS",
    primaryArtist: "Neon Echo",
    featuredArtists: [],
    explicitContent: false,
    targetDate: "",
  },
  credits: [],
  assets: [],
  artwork: null,
  findings: [],
  resolutions: [],
  events: [],
  approvalSnapshot: null,
  manifest: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const mockProject = initialMockProject;
export const mockProject2 = initialMockProject2;

// In-Memory Synchronized Cache for High-Availability & Instant Response
const projectCache = new Map<string, ReadinessProject>();
projectCache.set(initialMockProject.id, initialMockProject);
projectCache.set(initialMockProject2.id, initialMockProject2);

let activePolicyCache: CheckPolicy = { ...defaultPolicy };

let firestoreInitialized = false;

async function syncFromFirestore() {
  if (!db) return;
  try {
    const projectsSnapshot = await db.collection("projects").get();
    if (!projectsSnapshot.empty) {
      projectsSnapshot.forEach((doc) => {
        const data = doc.data() as ReadinessProject;
        projectCache.set(doc.id, { ...data, id: doc.id });
      });
    } else {
      // Seed Firestore with initial records
      console.log("[Firestore] Seeding initial projects into collection...");
      const batch = db.batch();
      const projRef1 = db.collection("projects").doc(initialMockProject.id);
      batch.set(projRef1, initialMockProject);
      const projRef2 = db.collection("projects").doc(initialMockProject2.id);
      batch.set(projRef2, initialMockProject2);
      await batch.commit();
    }

    const policyDoc = await db.collection("policies").doc("active").get();
    if (policyDoc.exists) {
      activePolicyCache = policyDoc.data() as CheckPolicy;
    } else {
      await db.collection("policies").doc("active").set(defaultPolicy);
    }

    firestoreInitialized = true;
    console.log("[Firestore] Durable cloud database successfully synchronized.");
  } catch (error) {
    console.log("[Firestore] Running in isolated mode, using local memory cache.");
    // Disable further attempts to avoid grpc-js spam
    if (error && error.code === 7) {
      // Permission denied or API disabled = we are in the default AI Studio GCP project without Firebase
      db = null;
    }
  }
}

// Background sync on boot
syncFromFirestore().catch((err) => console.warn("[Firestore Init Sync Error]:", err));

export async function getAllProjects(): Promise<ReadinessProject[]> {
  if (db) {
    try {
      const snapshot = await db.collection("projects").get();
      if (!snapshot.empty) {
        const projects: ReadinessProject[] = [];
        snapshot.forEach((doc) => {
          const item = doc.data() as ReadinessProject;
          item.id = doc.id;
          projectCache.set(doc.id, item);
          projects.push(item);
        });
        return projects;
      }
    } catch (e) {
      // Return cached
    }
  }
  return Array.from(projectCache.values());
}

export async function getProject(id: string): Promise<ReadinessProject | undefined> {
  if (db) {
    try {
      const doc = await db.collection("projects").doc(id).get();
      if (doc.exists) {
        const data = doc.data() as ReadinessProject;
        data.id = doc.id;
        projectCache.set(id, data);
        return data;
      }
    } catch (e) {
      // Return cached
    }
  }
  return projectCache.get(id);
}

export async function createProject(newProject: Partial<ReadinessProject>): Promise<ReadinessProject> {
  const id = newProject.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const project: ReadinessProject = {
    id,
    title: newProject.title || "UNTITLED_PROJECT",
    primaryArtist: newProject.primaryArtist || "Unknown Artist",
    ownerId: newProject.ownerId || "user_operator1",
    state: newProject.state || "draft",
    revision: 1,
    targetDate: newProject.targetDate || null,
    metadata: newProject.metadata || {
      title: newProject.title || "UNTITLED_PROJECT",
      primaryArtist: newProject.primaryArtist || "Unknown Artist",
      featuredArtists: [],
      explicitContent: false,
      targetDate: ""
    },
    credits: newProject.credits || [],
    assets: newProject.assets || [],
    artwork: newProject.artwork || null,
    findings: [],
    resolutions: [],
    events: [
      {
        id: `evt_${Date.now()}`,
        projectId: id,
        actorId: newProject.ownerId || "operator",
        eventType: "project_created",
        previousState: "draft",
        nextState: "draft",
        entityType: "project",
        entityId: id,
        payloadDigest: "init_sha256",
        createdAt: now
      }
    ],
    approvalSnapshot: null,
    manifest: null,
    createdAt: now,
    updatedAt: now
  };

  projectCache.set(id, project);

  if (db) {
    db.collection("projects")
      .doc(id)
      .set(project)
      .catch((err) => console.warn("[Firestore Write Error]:", err));
  }

  return project;
}

export async function updateProject(
  id: string,
  updates: Partial<ReadinessProject>
): Promise<ReadinessProject> {
  const existing = (await getProject(id)) || projectCache.get(id);
  if (!existing) {
    throw new Error(`Project [${id}] not found`);
  }

  const updated: ReadinessProject = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  projectCache.set(id, updated);

  if (db) {
    db.collection("projects")
      .doc(id)
      .set(updated, { merge: true })
      .catch((err) => console.warn("[Firestore Update Error]:", err));
  }

  return updated;
}

export async function deleteProject(id: string): Promise<boolean> {
  projectCache.delete(id);
  if (db) {
    try {
      await db.collection("projects").doc(id).delete();
      return true;
    } catch (e) {
      console.warn("[Firestore Delete Error]:", e);
    }
  }
  return true;
}

export async function getActivePolicy(): Promise<CheckPolicy> {
  if (db) {
    try {
      const doc = await db.collection("policies").doc("active").get();
      if (doc.exists) {
        activePolicyCache = doc.data() as CheckPolicy;
      }
    } catch (e) {
      // Use cached
    }
  }
  return activePolicyCache;
}

export async function updateActivePolicy(updates: Partial<CheckPolicy>): Promise<CheckPolicy> {
  activePolicyCache = {
    ...activePolicyCache,
    ...updates
  };

  if (db) {
    db.collection("policies")
      .doc("active")
      .set(activePolicyCache, { merge: true })
      .catch((err) => console.warn("[Firestore Policy Update Error]:", err));
  }

  return activePolicyCache;
}

export async function addProjectEvent(projectId: string, event: ProjectEvent): Promise<void> {
  const proj = projectCache.get(projectId);
  if (proj) {
    proj.events = [...(proj.events || []), event];
    projectCache.set(projectId, proj);
  }

  if (db) {
    db.collection("projects")
      .doc(projectId)
      .collection("events")
      .doc(event.id)
      .set(event)
      .catch((err) => console.warn("[Firestore Event Write Error]:", err));
  }
}
