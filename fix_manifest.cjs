const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Update manifest endpoint to debit wallet and use server-generated digest
const manifestRegex = /app\.post\("\/api\/projects\/:id\/manifest".*?res\.json\({ project: saved, manifest }\);\n  } catch \(error: any\) {/s;
const newManifest = `app.post("/api/projects/:id/manifest", requireAuth, authorizeRoles("operator", "admin"), async (req, res) => {
  const proj = await getProject(req.params.id);
  if (!proj) return res.status(404).json({ error: "Project not found" });

  try {
    if (proj.ownerId !== req.user!.uid && req.user!.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Not your project" });
    }

    if (proj.state === "manifest_generated") {
      return res.status(400).json({ error: "Manifest already generated for this revision." });
    }

    // Attempt token deduction first
    try {
      await debitWalletForManifest(req.user!.uid, proj.id);
    } catch (err: any) {
      return res.status(402).json({ error: err.message || "Insufficient Readiness Tokens" });
    }

    const manifestData = {
      releaseId: proj.id,
      title: proj.title,
      artist: proj.primaryArtist,
      targetDate: proj.targetDate,
      revision: proj.revision,
      policyVersion: "1.0",
      generatedAt: new Date().toISOString(),
      findings: proj.findings.map(f => ({
        code: f.code,
        severity: f.severity,
        status: f.status
      })),
      assets: proj.assets.map(a => ({
        id: a.id,
        checksum: a.checksum,
        type: a.assetType
      }))
    };

    const csvHeaders = "filename,type,mimeType,bytes,checksum,version\\n";
    const csvRows = proj.assets
      .map(
        (a) =>
          \`\${a.filename},\${a.assetType},\${a.mimeType},\${a.bytes},\${a.checksum},\${a.version}\`
      )
      .join("\\n");

    const jsonString = JSON.stringify(manifestData, null, 2);
    const digest = \`sha256-\${sha256Canonical(manifestData)}\`;

    const ddexXml = \`<?xml version="1.0" encoding="utf-8"?>
<ern:NewReleaseMessage xmlns:ern="http://ddex.net/xml/ern/411" MessageSchemaVersionId="ern/411">
  <MessageHeader>
    <MessageThreadId>\${proj.id}</MessageThreadId>
    <MessageSender>
      <PartyId>808_SZN_ENGINE</PartyId>
    </MessageSender>
  </MessageHeader>
  <ResourceList>
    \${proj.assets.map(a => \`
    <SoundRecording>
      <ResourceReference>\${a.id}</ResourceReference>
      <Title>\${a.filename}</Title>
    </SoundRecording>\`).join('')}
  </ResourceList>
  <ReleaseList>
    <Release>
      <ReleaseId>
        <ICPN>\${proj.metadata.upc || 'PENDING'}</ICPN>
      </ReleaseId>
      <ReleaseReference>R0</ReleaseReference>
      <ReferenceTitle>
        <TitleText>\${proj.metadata.title}</TitleText>
      </ReferenceTitle>
    </Release>
  </ReleaseList>
</ern:NewReleaseMessage>\`;

    const manifest = {
      id: crypto.randomUUID(),
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
      { id: req.user!.uid, role: req.user!.role },
      digest
    );

    const saved = await updateProject(proj.id, nextProject);

    realtimeHub.broadcastProjectUpdate(saved.id, saved, eventLog);
    if (eventLog) {
      realtimeHub.broadcastProjectEvent(saved.id, eventLog);
      broadcastToWebhook(\`Final Manifest Generated for **\${proj.title}** (Digest: \\\`\${digest.substring(0, 16)}...\\\`). Package is now fully locked.\`);
    }

    res.json({ project: saved, manifest });
  } catch (error: any) {`;

content = content.replace(manifestRegex, newManifest);

fs.writeFileSync('server.ts', content);
