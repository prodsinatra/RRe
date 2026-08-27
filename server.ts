import express from "express";
import http from "http";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { config } from "dotenv";

config();

const app = express();
app.use(express.json());

const PORT = 3000;

// ==========================================
// Integrations: Stripe & Tokens
// ==========================================
import Stripe from "stripe";
const userWallets: Record<string, number> = {
  "user_1": 2,
};

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY || "sk_test_mock_12345";
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

app.get("/api/wallet/:userId", (req, res) => {
  const userId = req.params.userId;
  const balance = userWallets[userId] || 0;
  res.json({ balance });
});

app.post("/api/checkout/create-session", async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    // Mocking the behavior for the preview
    const { userId, tokens } = req.body;
    userWallets[userId] = (userWallets[userId] || 0) + tokens;
    return res.json({ url: "/?success=true", mocked: true });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Readiness Token',
              description: 'Enterprise Token to cryptographically seal and export delivery manifests.',
            },
            unit_amount: 500, // $5.00
          },
          quantity: req.body.tokens || 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.protocol}://${req.get('host')}/?success=true`,
      cancel_url: `${req.protocol}://${req.get('host')}/?canceled=true`,
      metadata: {
        userId: req.body.userId
      }
    });
    res.json({ url: session.url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


// ==========================================
// Persistence & State Machine Engine
// ==========================================

import {
  getAllProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getActivePolicy,
  updateActivePolicy,
  addProjectEvent
} from "./src/db/firestore-db";

import {
  validateStateTransition,
  applyStateTransition,
  STATE_TRANSITION_RULES,
  ReleaseEvent
} from "./src/lib/state/releaseMachine";

import { runDeterministicChecks } from "./src/db/rule-engine";
import { GoogleGenAI, Type } from "@google/genai";
import { realtimeHub } from "./server/realtime-hub";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const DEFAULT_REASONING_MODEL = "gemini-2.5-flash";

async function broadcastToWebhook(message: string) {
  try {
    const policy = await getActivePolicy();
    if (!policy || !policy.webhookUrl) return;
    
    await fetch(policy.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `**[808 SZN Engine]** ${message}`
      })
    });
  } catch (err) {
    console.warn("Webhook broadcast failed", err);
  }
}

// ==========================================
// API Routes
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", persistence: "firestore-ready" });
});

app.get("/api/config", (req, res) => {
  res.json({
    DEMO_MODE: true,
    LIVE_AI_ENABLED: Boolean(process.env.GEMINI_API_KEY),
    PERSISTENCE: "firestore"
  });
});

app.get("/api/state-machine/rules", (req, res) => {
  res.json({ rules: STATE_TRANSITION_RULES });
});

// Policies
app.get("/api/policies/active", async (req, res) => {
  try {
    const policy = await getActivePolicy();
    res.json({ policy });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.put("/api/policies/active", async (req, res) => {
  try {
    const updated = await updateActivePolicy(req.body);
    res.json({ policy: updated });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Projects Collection
app.get("/api/projects", async (req, res) => {
  try {
    const projects = await getAllProjects();
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post("/api/projects", async (req, res) => {
  try {
    const newProj = await createProject(req.body);
    realtimeHub.broadcastProjectUpdate(newProj.id, newProj);
    res.status(201).json({ project: newProj });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/projects/:id", async (req, res) => {
  try {
    const proj = await getProject(req.params.id);
    if (!proj) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json({ project: proj });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.delete("/api/projects/:id", async (req, res) => {
  try {
    await deleteProject(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Project Modification with State Machine Enforcement
app.put("/api/projects/:id", async (req, res) => {
  const proj = await getProject(req.params.id);
  if (!proj) return res.status(404).json({ error: "Project not found" });

  try {
    const actorId = req.body.actorId || "operator";
    const actorRole = req.body.actorRole || "operator";

    // 1. Deterministic Split-Validation
    if (req.body.credits) {
      let totalSongwriter = 0;
      let totalProducer = 0;
      let totalPerformer = 0;
      for (const c of req.body.credits) {
        totalSongwriter += c.splits.songwriter || 0;
        totalProducer += c.splits.producer || 0;
        totalPerformer += c.splits.performer || 0;
      }
      
      const isSongwriterValid = totalSongwriter === 0 || Math.abs(totalSongwriter - 100) < 0.01;
      const isProducerValid = totalProducer === 0 || Math.abs(totalProducer - 100) < 0.01;
      const isPerformerValid = totalPerformer === 0 || Math.abs(totalPerformer - 100) < 0.01;

      if (!isSongwriterValid || !isProducerValid || !isPerformerValid) {
        return res.status(400).json({ error: "Avvist: Den totale royalty-splitten må være nøyaktig 100.00% i hver aktive kategori." });
      }
    }

    const isMaterialEdit = Boolean(
      req.body.metadata ||
      req.body.credits ||
      req.body.assets ||
      req.body.artwork ||
      req.body.title ||
      req.body.primaryArtist
    );

    let updatedProjectState = { ...proj, ...req.body };

    // Enforce State Machine on Material Edits:
    // If a project is in ready_for_approval, approved, or manifest_generated,
    // any material modification forces an automated revision increment,
    // resets state to 'collecting', and generates a tamper-evident audit event.
    let eventLog: any = null;
    if (
      isMaterialEdit &&
      (proj.state === "approved" ||
        proj.state === "manifest_generated" ||
        proj.state === "ready_for_approval" ||
        proj.state === "blocked" ||
        proj.state === "needs_review")
    ) {
      const resTrans = applyStateTransition(
        updatedProjectState,
        { type: "MATERIAL_EDIT", reason: "Material data modification" },
        { id: actorId, role: actorRole },
        `sha256-rev-${proj.revision + 1}-${Date.now()}`
      );
      updatedProjectState = resTrans.nextProject;
      eventLog = resTrans.eventLog;
    } else if (
      isMaterialEdit && 
      (updatedProjectState.state === "draft" || updatedProjectState.state === "collecting")
    ) {
      // 3. State Management og Telemetri: 
      // Når alle policy-valideringer (nødvendige data) er på plass, endres prosjektstatus automatisk
      // fra DRAFT til READY FOR CHECKS.
      const isReady = updatedProjectState.metadata?.title &&
                      updatedProjectState.metadata?.primaryArtist &&
                      updatedProjectState.targetDate &&
                      updatedProjectState.credits &&
                      updatedProjectState.credits.length > 0;
                      
      if (isReady) {
        const resTrans = applyStateTransition(
          updatedProjectState,
          { type: "STAGE_FOR_CHECKS" },
          { id: actorId, role: actorRole }
        );
        updatedProjectState = resTrans.nextProject;
        eventLog = resTrans.eventLog;
      }
    }

    const saved = await updateProject(proj.id, updatedProjectState);
    realtimeHub.broadcastProjectUpdate(saved.id, saved, eventLog);
    if (eventLog) {
      realtimeHub.broadcastProjectEvent(saved.id, eventLog);
    }
    res.json({ project: saved });
  } catch (error: any) {
    console.error("[PUT /api/projects/:id Error]:", error);
    res.status(400).json({ error: error.message || String(error) });
  }
});

// Generic State Transition Handler
app.post("/api/projects/:id/transition", async (req, res) => {
  const proj = await getProject(req.params.id);
  if (!proj) return res.status(404).json({ error: "Project not found" });

  try {
    const { eventType, actorId = "operator", actorRole = "operator", note } = req.body;
    const event: ReleaseEvent = { type: eventType, actorId, role: actorRole, note } as any;

    const validation = validateStateTransition(proj, event, { id: actorId, role: actorRole });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }

    const { nextProject, eventLog } = applyStateTransition(
      proj,
      event,
      { id: actorId, role: actorRole },
      `transition-${eventType}-${Date.now()}`
    );

    const saved = await updateProject(proj.id, nextProject);
    realtimeHub.broadcastProjectUpdate(saved.id, saved, eventLog);
    if (eventLog) {
      realtimeHub.broadcastProjectEvent(saved.id, eventLog);
      // Broadcast deterministic state transition to webhook
      broadcastToWebhook(`State Transition: ${proj.title} moved from **${proj.state}** to **${nextProject.state}** via event **${eventLog.eventType}**.`);
    }
    res.json({ project: saved, eventLog });
  } catch (error: any) {
    res.status(400).json({ error: error.message || String(error) });
  }
});

// Deterministic Check Execution
app.post("/api/projects/:id/checks", async (req, res) => {
  const proj = await getProject(req.params.id);
  if (!proj) return res.status(404).json({ error: "Project not found" });

  try {
    const policy = await getActivePolicy();
    const findings = runDeterministicChecks(proj, policy);

    const hasBlocker = findings.some(
      (f) => f.severity === "blocked" && f.status === "unresolved"
    );
    const hasReview = findings.some(
      (f) => f.severity === "needs_review" && f.status === "unresolved"
    );

    let nextEventType: "CHECKS_BLOCKED" | "CHECKS_NEEDS_REVIEW" | "CHECKS_PASSED";
    if (hasBlocker) nextEventType = "CHECKS_BLOCKED";
    else if (hasReview) nextEventType = "CHECKS_NEEDS_REVIEW";
    else nextEventType = "CHECKS_PASSED";

    // Set findings first then apply state transition
    const projectWithFindings = { ...proj, findings };
    const { nextProject, eventLog } = applyStateTransition(
      projectWithFindings,
      { type: nextEventType },
      { id: req.body.actorId || "rule_engine", role: "operator" },
      `checks-digest-${Date.now()}`
    );

    const saved = await updateProject(proj.id, nextProject);
    realtimeHub.broadcastProjectUpdate(saved.id, saved, eventLog);
    if (eventLog) {
      realtimeHub.broadcastProjectEvent(saved.id, eventLog);
      if (nextProject.state !== proj.state) {
        broadcastToWebhook(`Policy Evaluation: ${proj.title} transitioned to **${nextProject.state}** based on deterministic checks.`);
      }
    }
    res.json({ project: saved, findings });
  } catch (error: any) {
    console.error("[Checks Error]:", error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

// Formal Approval Gate
app.post("/api/projects/:id/approve", async (req, res) => {
  const proj = await getProject(req.params.id);
  if (!proj) return res.status(404).json({ error: "Project not found" });

  const actorId = req.body.actorId || "approver_1";
  const actorRole = req.body.actorRole || "approver";

  try {
    const validation = validateStateTransition(
      proj,
      { type: "APPROVE_RELEASE", actorId, role: actorRole },
      { id: actorId, role: actorRole }
    );

    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }

    // Compute cryptographic input digest of all project data
    const inputDigest = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          title: proj.title,
          artist: proj.primaryArtist,
          revision: proj.revision,
          assets: proj.assets,
          credits: proj.credits,
          metadata: proj.metadata
        })
      )
      .digest("hex");

    const approvalSnapshot = {
      id: `snap_${Date.now()}`,
      projectId: proj.id,
      revision: proj.revision,
      approvedBy: actorId,
      approvedAt: new Date().toISOString(),
      inputDigest: `sha256-${inputDigest}`,
      note: req.body.note || "Human Approver sign-off granted"
    };

    const projectWithSnapshot = {
      ...proj,
      approvalSnapshot
    };

    const { nextProject, eventLog } = applyStateTransition(
      projectWithSnapshot,
      { type: "APPROVE_RELEASE", actorId, role: actorRole },
      { id: actorId, role: actorRole },
      `sha256-${inputDigest}`
    );

    const saved = await updateProject(proj.id, nextProject);
    realtimeHub.broadcastProjectUpdate(saved.id, saved, eventLog);
    if (eventLog) {
      realtimeHub.broadcastProjectEvent(saved.id, eventLog);
    }
    res.json({ project: saved, approvalSnapshot });
  } catch (error: any) {
    console.error("[Approve Error]:", error);
    res.status(400).json({ error: error.message || String(error) });
  }
});

// Delivery Manifest Generation
app.post("/api/projects/:id/manifest", async (req, res) => {
  const proj = await getProject(req.params.id);
  if (!proj) return res.status(404).json({ error: "Project not found" });

  const actorId = req.body.actorId || "operator";
  const actorRole = req.body.actorRole || "operator";

  try {
    const validation = validateStateTransition(
      proj,
      { type: "GENERATE_MANIFEST" },
      { id: actorId, role: actorRole }
    );

    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }

    // 4. Token Deduction Check
    const currentTokens = userWallets[actorId] || 0;
    if (currentTokens <= 0) {
      return res.status(402).json({ error: "Insufficient Readiness Tokens to seal manifest. Please recharge your wallet." });
    }
    userWallets[actorId] = currentTokens - 1;

    // Generate deterministic JSON
    const manifestData = {
      releaseId: proj.id,
      title: proj.title,
      artist: proj.primaryArtist,
      revision: proj.revision,
      generatedAt: new Date().toISOString(),
      assets: proj.assets.map((a) => ({
        filename: a.filename,
        type: a.assetType,
        mimeType: a.mimeType,
        bytes: a.bytes,
        checksum: a.checksum,
        version: a.version
      })),
      credits: proj.credits,
      ruleSetVersion: "v1.0"
    };

    // CSV format
    const csvHeaders = "filename,type,mimeType,bytes,checksum,version\n";
    const csvRows = proj.assets
      .map(
        (a) =>
          `${a.filename},${a.assetType},${a.mimeType},${a.bytes},${a.checksum},${a.version}`
      )
      .join("\n");

    const jsonString = JSON.stringify(manifestData, null, 2);
    const digest = req.body.clientDigest || `sha256-${crypto.createHash("sha256").update(jsonString).digest("hex")}`;
    
    // DDEX ERN XML format mock
    const ddexXml = `<?xml version="1.0" encoding="utf-8"?>
<ern:NewReleaseMessage xmlns:ern="http://ddex.net/xml/ern/411" MessageSchemaVersionId="ern/411">
  <MessageHeader>
    <MessageThreadId>${proj.id}</MessageThreadId>
    <MessageSender>
      <PartyId>808_SZN_ENGINE</PartyId>
    </MessageSender>
  </MessageHeader>
  <ResourceList>
    ${proj.assets.map(a => `
    <SoundRecording>
      <ResourceReference>${a.id}</ResourceReference>
      <Title>${a.filename}</Title>
    </SoundRecording>`).join('')}
  </ResourceList>
  <ReleaseList>
    <Release>
      <ReleaseId>
        <ICPN>${proj.metadata.upc || 'PENDING'}</ICPN>
      </ReleaseId>
      <ReleaseReference>R0</ReleaseReference>
      <ReferenceTitle>
        <TitleText>${proj.metadata.title}</TitleText>
      </ReferenceTitle>
    </Release>
  </ReleaseList>
</ern:NewReleaseMessage>`;

    const manifest = {
      id: `man_${Date.now()}`,
      projectId: proj.id,
      snapshotId: proj.approvalSnapshot?.id || "draft_snapshot",
      generatedAt: manifestData.generatedAt,
      digest,
      contentJson: jsonString,
      contentCsv: csvHeaders + csvRows,
      contentDdexXml: ddexXml
    };

    const projectWithManifest = {
      ...proj,
      manifest
    };

    const { nextProject, eventLog } = applyStateTransition(
      projectWithManifest,
      { type: "GENERATE_MANIFEST" },
      { id: actorId, role: actorRole },
      digest
    );

    const saved = await updateProject(proj.id, nextProject);
    realtimeHub.broadcastProjectUpdate(saved.id, saved, eventLog);
    if (eventLog) {
      realtimeHub.broadcastProjectEvent(saved.id, eventLog);
      broadcastToWebhook(`Final Manifest Generated for **${proj.title}** (Digest: \`${digest.substring(0, 16)}...\`). Package is now fully locked.`);
    }
    res.json({ project: saved, manifest });
  } catch (error: any) {
    console.error("[Manifest Error]:", error);
    res.status(400).json({ error: error.message || String(error) });
  }
});

// Artwork Generation
app.post("/api/projects/:id/artwork/generate", async (req, res) => {
  const proj = await getProject(req.params.id);
  if (!proj) return res.status(404).json({ error: "Project not found" });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image",
      contents: {
        parts: [
          {
            text:
              req.body.prompt ||
              "808 SZN high contrast dark brutalist album cover art, neon accents, signal waveforms, 3000x3000px digital art"
          }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });

    let base64EncodeString = "";
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        base64EncodeString = part.inlineData.data;
        break;
      }
    }

    if (!base64EncodeString) {
      throw new Error("No image generated by the model");
    }

    const imageUrl = `data:image/png;base64,${base64EncodeString}`;

    const updatedArtwork: import("./src/types").ArtworkAsset = {
      id: proj.artwork?.id || `art_${Date.now()}`,
      assetId: proj.artwork?.assetId || `asset_${Date.now()}`,
      dimensions: "3000x3000",
      hasRightsAttestation: true,
      url: imageUrl
    };

    let updatedProjectState: import("./src/types").ReadinessProject = {
      ...proj,
      artwork: updatedArtwork
    };

    // If material edit happens in locked states, trigger state transition
    let eventLog: any = null;
    if (
      proj.state === "approved" ||
      proj.state === "manifest_generated" ||
      proj.state === "ready_for_approval"
    ) {
      const resTrans = applyStateTransition(
        updatedProjectState,
        { type: "MATERIAL_EDIT", reason: "Cover artwork generated/updated" },
        { id: req.body.actorId || "operator", role: "operator" },
        `sha256-art-${Date.now()}`
      );
      updatedProjectState = resTrans.nextProject;
      eventLog = resTrans.eventLog;
    }

    const saved = await updateProject(proj.id, updatedProjectState);
    realtimeHub.broadcastProjectUpdate(saved.id, saved, eventLog);
    if (eventLog) {
      realtimeHub.broadcastProjectEvent(saved.id, eventLog);
    }
    res.json({ project: saved, imageUrl });
  } catch (error: any) {
    console.error("Image Gen Error:", error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

// AI Readiness Summary
app.post("/api/projects/:id/summary", async (req, res) => {
  const proj = await getProject(req.params.id);
  if (!proj) return res.status(404).json({ error: "Project not found" });

  try {
    const projectContext = JSON.stringify({
      title: proj.title,
      artist: proj.primaryArtist,
      metadata: proj.metadata,
      credits: proj.credits,
      findings: proj.findings
    });

    const response = await ai.models.generateContent({
      model: DEFAULT_REASONING_MODEL,
      contents: `You are a professional readiness reviewer for 808 SZN Studio. Analyze the following project data and findings and provide a summary following our strict guidelines. Do not invent details. Do not claim to resolve legal issues.
      Project Data: ${projectContext}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            priority_actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  finding_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
                  action: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  requires_human_decision: { type: Type.BOOLEAN }
                },
                required: ["finding_ids", "action", "reason", "requires_human_decision"]
              }
            },
            uncertainties: { type: Type.ARRAY, items: { type: Type.STRING } },
            prohibited_claims_avoided: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["summary", "priority_actions", "uncertainties", "prohibited_claims_avoided"]
        }
      }
    });

    if (!response.text) throw new Error("No response from AI");
    
    const parsedSummary = JSON.parse(response.text);
    proj.aiSummary = parsedSummary;
    const saved = await updateProject(proj.id, proj);
    
    // Broadcast update so the UI gets it automatically
    realtimeHub.broadcastProjectUpdate(saved.id, saved);

    res.json({ summary: parsedSummary, project: saved });
  } catch (error) {
    console.error("AI Summary Error:", error);
    res.status(500).json({ error: "Failed to generate AI summary." });
  }
});

// Audit Trail Events
app.get("/api/projects/:id/events", async (req, res) => {
  try {
    const proj = await getProject(req.params.id);
    if (!proj) return res.status(404).json({ error: "Project not found" });
    res.json({ events: proj.events || [] });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ==========================================
// Vite Middleware & Start
// ==========================================

async function startServer() {
  const httpServer = http.createServer(app);
  realtimeHub.init(httpServer);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`⚡ 808 SZN Engine running on http://0.0.0.0:${PORT} with WebSocket sync`);
  });
}

startServer();
