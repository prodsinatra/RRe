import { ReadinessProject, ReadinessFinding, FindingSeverity, CheckPolicy, RoyaltyType } from "../types";

function createFinding(
  projectId: string, 
  code: string, 
  category: string, 
  severity: FindingSeverity, 
  title: string, 
  explanation: string, 
  evidence: string,
  sourceType: string,
  sourceId: string
): ReadinessFinding {
  return {
    id: `finding_${Math.random().toString(36).substring(2, 9)}`,
    checkRunId: `run_${Date.now()}`,
    projectId,
    code,
    category,
    severity,
    title,
    explanation,
    evidence,
    sourceType,
    sourceId,
    status: "unresolved",
    deterministic: true,
    confidence: 1.0,
    createdAt: new Date().toISOString()
  };
}

export function runDeterministicChecks(project: ReadinessProject, policy: CheckPolicy): ReadinessFinding[] {
  const findings: ReadinessFinding[] = [];
  
  // 1. Release Identity
  if (!project.metadata.title) {
    findings.push(createFinding(project.id, "RI_001", "Release Identity", "blocked", "Missing Release Title", "The release title must be provided.", "", "metadata", "title"));
  }
  if (!project.metadata.primaryArtist) {
    findings.push(createFinding(project.id, "RI_002", "Release Identity", "blocked", "Missing Primary Artist", "The primary artist must be provided.", "", "metadata", "primaryArtist"));
  }
  if (!project.targetDate) {
    findings.push(createFinding(project.id, "RI_003", "Release Identity", "blocked", "Missing Target Date", "A target date must be set for the release.", "", "project", "targetDate"));
  }
  
  // 2. Credits and splits
  if (project.credits.length === 0) {
    findings.push(createFinding(project.id, "CR_001", "Credits", "blocked", "Missing Credits", "At least one contributor must be specified.", "", "credits", "all"));
  } else {
    // Check missing required roles from policy
    const providedRoles = project.credits.map(c => c.role.toLowerCase());
    policy.requiredRoles.forEach(role => {
      if (!providedRoles.some(pr => pr.includes(role.toLowerCase()))) {
        findings.push(createFinding(project.id, `CR_REQ_${role}`, "Credits", "needs_review", `Missing Required Role: ${role}`, `The policy requires a ${role} to be credited.`, "", "credits", "roles"));
      }
    });

    // Check splits for each royalty type
    const royaltyTypes: RoyaltyType[] = ["songwriter", "producer", "performer"];
    royaltyTypes.forEach(type => {
      let totalSplit = 0;
      project.credits.forEach(c => {
        totalSplit += (c.splits[type] || 0);
      });
      
      const roundedTotal = Math.round(totalSplit * 100) / 100;
      if (roundedTotal === 0) {
        findings.push(createFinding(project.id, `CR_SPLIT_${type}_0`, "Credits", "advisory", `Unassigned Splits: ${type}`, `There are no splits assigned for ${type} royalties.`, `Total is ${roundedTotal}%`, "credits", type));
      } else if (roundedTotal !== 100) {
        findings.push(createFinding(project.id, `CR_SPLIT_${type}`, "Credits", "blocked", `Invalid Split Total: ${type}`, `The total of all ${type} splits must equal exactly 100.00%.`, `Total is ${roundedTotal}%`, "credits", type));
      }
    });
  }

  // 3. Audio assets
  if (project.assets.length === 0) {
    findings.push(createFinding(project.id, "AA_001", "Audio Assets", "blocked", "No Audio Assets", "At least one master asset must be uploaded.", "", "assets", "all"));
  } else {
    let hasMaster = false;
    const checksums = new Set<string>();
    const filenames = new Set<string>();
    const namingRegex = new RegExp(policy.assetNamingConvention);
    
    project.assets.forEach(asset => {
      if (asset.assetType === "master") hasMaster = true;
      
      if (!namingRegex.test(asset.filename)) {
         findings.push(createFinding(project.id, "AA_006", "Audio Assets", "needs_review", "Naming Convention Violation", `Asset filename does not match the required policy convention.`, `Filename: ${asset.filename}`, "assets", asset.id));
      }

      if (checksums.has(asset.checksum)) {
         findings.push(createFinding(project.id, "AA_002", "Audio Assets", "blocked", "Duplicate Checksum", `Asset has the same checksum as another file.`, `Checksum: ${asset.checksum}`, "assets", asset.id));
      }
      checksums.add(asset.checksum);
      
      if (filenames.has(asset.filename)) {
         findings.push(createFinding(project.id, "AA_003", "Audio Assets", "blocked", "Duplicate Filename", `Asset filename is already used by another file.`, `Filename: ${asset.filename}`, "assets", asset.id));
      }
      filenames.add(asset.filename);
      
      if (!asset.sampleRateHz || !asset.bitDepth || !asset.channels) {
         findings.push(createFinding(project.id, "AA_004", "Audio Assets", "needs_review", "Missing Audio Spec", `Asset is missing sample rate, bit depth, or channels metadata.`, `Asset: ${asset.filename}`, "assets", asset.id));
      }

      // Audio Signal DSP Diagnostics Verification
      if (asset.diagnostics) {
        if (asset.diagnostics.clippingCount > 0) {
          findings.push(createFinding(
            project.id,
            "AA_CLIP",
            "Audio Assets",
            "blocked",
            `Digital Clipping Violation: ${asset.filename}`,
            `Detected ${asset.diagnostics.clippingCount} clipped samples in the audio signal. Masters must have zero digital overs.`,
            `Clipped samples: ${asset.diagnostics.clippingCount}`,
            "assets",
            asset.id
          ));
        }

        if (asset.diagnostics.truePeakDbfs > 0.0) {
          findings.push(createFinding(
            project.id,
            "AA_PEAK_OVER",
            "Audio Assets",
            "blocked",
            `True Peak Exceeds Digital Ceiling: ${asset.filename}`,
            `True peak level (+${asset.diagnostics.truePeakDbfs} dBFS) exceeds 0.0 dBFS, causing DAC inter-sample distortion.`,
            `True Peak: +${asset.diagnostics.truePeakDbfs} dBFS`,
            "assets",
            asset.id
          ));
        } else if (asset.diagnostics.truePeakDbfs > -0.2) {
          findings.push(createFinding(
            project.id,
            "AA_PEAK_HEADROOM",
            "Audio Assets",
            "needs_review",
            `True Peak Near Inter-Sample Limit: ${asset.filename}`,
            `True peak is ${asset.diagnostics.truePeakDbfs} dBFS. Streaming delivery standard recommends at least -0.5 dBFS to -1.0 dBFS true peak headroom.`,
            `True Peak: ${asset.diagnostics.truePeakDbfs} dBFS`,
            "assets",
            asset.id
          ));
        }

        if (asset.diagnostics.phaseCorrelation < 0.1) {
          findings.push(createFinding(
            project.id,
            "AA_PHASE_CORR",
            "Audio Assets",
            "needs_review",
            `Poor Stereo Phase Correlation: ${asset.filename}`,
            `Phase correlation is ${asset.diagnostics.phaseCorrelation}. Low or negative correlation risks sub-bass cancellation on mono playback systems.`,
            `Phase Correlation: ${asset.diagnostics.phaseCorrelation}`,
            "assets",
            asset.id
          ));
        }
      }
    });
    
    if (!hasMaster) {
      findings.push(createFinding(project.id, "AA_005", "Audio Assets", "blocked", "Missing Master", "A main master asset is required.", "", "assets", "all"));
    }
  }

  // 4. Artwork
  if (!project.artwork) {
    findings.push(createFinding(project.id, "AW_001", "Artwork", "blocked", "Missing Artwork", "Cover artwork is required.", "", "artwork", "all"));
  } else {
    if (project.artwork.dimensions !== policy.artworkDimensions) {
      findings.push(createFinding(project.id, "AW_002", "Artwork", "blocked", "Invalid Artwork Dimensions", `Artwork must be exactly ${policy.artworkDimensions} pixels based on policy.`, `Current: ${project.artwork.dimensions}`, "artwork", project.artwork.id));
    }
    if (!project.artwork.hasRightsAttestation) {
      findings.push(createFinding(project.id, "AW_003", "Artwork", "blocked", "Missing Rights Attestation", "Artwork rights attestation is required.", "", "artwork", project.artwork.id));
    }
  }

  return findings;
}
