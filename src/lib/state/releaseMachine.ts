import { ReadinessProject, ProjectState, ProjectEvent, FindingSeverity } from "../../types";

export type ReleaseEvent =
  | { type: "START_COLLECTING" }
  | { type: "STAGE_FOR_CHECKS" }
  | { type: "RUN_CHECKS" }
  | { type: "CHECKS_BLOCKED" }
  | { type: "CHECKS_NEEDS_REVIEW" }
  | { type: "CHECKS_PASSED" }
  | { type: "RESOLVE_FINDING"; findingId: string }
  | { type: "APPROVE_RELEASE"; actorId: string; role: string; note?: string }
  | { type: "GENERATE_MANIFEST"; snapshotId?: string }
  | { type: "MATERIAL_EDIT"; reason?: string }
  | { type: "ARCHIVE" }
  | { type: "CANCEL" };

export interface TransitionRule {
  allowedFrom: ProjectState[];
  targetState: ProjectState;
  requiredRole?: ("client" | "operator" | "approver" | "viewer")[];
  description: string;
}

export const STATE_TRANSITION_RULES: Record<ReleaseEvent["type"], TransitionRule> = {
  START_COLLECTING: {
    allowedFrom: ["draft", "cancelled"],
    targetState: "collecting",
    description: "Begin collecting and staging release assets and split records."
  },
  STAGE_FOR_CHECKS: {
    allowedFrom: ["draft", "collecting"],
    targetState: "ready_for_checks",
    description: "Stage all assets and metadata for deterministic rule engine validation."
  },
  RUN_CHECKS: {
    allowedFrom: ["draft", "collecting", "ready_for_checks", "blocked", "needs_review"],
    targetState: "checks_running",
    description: "Execute deterministic rule engine checks on active project state."
  },
  CHECKS_BLOCKED: {
    allowedFrom: ["checks_running"],
    targetState: "blocked",
    description: "Project validation failed with unresolved blocker findings."
  },
  CHECKS_NEEDS_REVIEW: {
    allowedFrom: ["checks_running"],
    targetState: "needs_review",
    description: "Project validation requires human reviewer verification."
  },
  CHECKS_PASSED: {
    allowedFrom: ["checks_running", "needs_review"],
    targetState: "ready_for_approval",
    description: "Deterministic checks passed with zero unresolved blockers."
  },
  RESOLVE_FINDING: {
    allowedFrom: ["needs_review", "blocked"],
    targetState: "ready_for_approval",
    requiredRole: ["operator", "approver"],
    description: "Human operator or approver resolves or acknowledges non-blocking finding."
  },
  APPROVE_RELEASE: {
    allowedFrom: ["ready_for_approval"],
    targetState: "approved",
    requiredRole: ["approver"],
    description: "Authorized Approver grants formal sign-off on the release package."
  },
  GENERATE_MANIFEST: {
    allowedFrom: ["approved", "manifest_generated", "ready_for_approval"],
    targetState: "manifest_generated",
    requiredRole: ["operator", "approver"],
    description: "Compile an immutable delivery manifest with deterministic digest."
  },
  MATERIAL_EDIT: {
    allowedFrom: [
      "draft",
      "collecting",
      "ready_for_checks",
      "checks_running",
      "blocked",
      "needs_review",
      "ready_for_approval",
      "approved",
      "manifest_generated"
    ],
    targetState: "collecting",
    description: "A material edit to metadata, credits, or assets resets approval and bumps revision."
  },
  ARCHIVE: {
    allowedFrom: ["draft", "collecting", "ready_for_approval", "approved", "manifest_generated", "blocked"],
    targetState: "archived",
    description: "Archive the release session."
  },
  CANCEL: {
    allowedFrom: ["draft", "collecting", "ready_for_checks", "blocked", "needs_review"],
    targetState: "cancelled",
    description: "Cancel active session."
  }
};

/**
 * Checks if a transition is structurally valid according to state rules and actor role.
 */
export function validateStateTransition(
  project: ReadinessProject,
  event: ReleaseEvent,
  actor: { id: string; role?: string }
): { valid: boolean; reason?: string; targetState?: ProjectState } {
  const rule = STATE_TRANSITION_RULES[event.type];
  if (!rule) {
    return { valid: false, reason: `Unknown state transition event: ${event.type}` };
  }

  // 1. Check if current state allows this event
  if (!rule.allowedFrom.includes(project.state)) {
    return {
      valid: false,
      reason: `Cannot perform [${event.type}] while project is in [${project.state}] state. Allowed states: ${rule.allowedFrom.join(", ")}`
    };
  }

  // 2. Check role permissions if restricted
  if (rule.requiredRole && rule.requiredRole.length > 0) {
    const actorRole = (actor.role || "operator") as any;
    if (!rule.requiredRole.includes(actorRole)) {
      return {
        valid: false,
        reason: `Permission denied: [${event.type}] requires one of [${rule.requiredRole.join(", ")}] roles. Actor has [${actorRole}] role.`
      };
    }
  }

  // 3. Special rule checks
  if (event.type === "APPROVE_RELEASE") {
    const hasBlockers = project.findings?.some(
      (f) => f.severity === "blocked" && f.status === "unresolved"
    );
    if (hasBlockers) {
      return {
        valid: false,
        reason: "Cannot approve release: unresolved blocking findings exist in credits, audio assets, or metadata."
      };
    }
  }

  return { valid: true, targetState: rule.targetState };
}

/**
 * Executes state machine transition on a project, returning updated project state and an audit log event.
 */
export function applyStateTransition(
  project: ReadinessProject,
  event: ReleaseEvent,
  actor: { id: string; role?: string },
  payloadDigest: string = "sha256-verified"
): { nextProject: ReadinessProject; eventLog: ProjectEvent } {
  const validation = validateStateTransition(project, event, actor);
  if (!validation.valid || !validation.targetState) {
    throw new Error(validation.reason || "Invalid state transition");
  }

  const previousState = project.state;
  const nextState = validation.targetState;
  const now = new Date().toISOString();

  let nextRevision = project.revision;
  let nextApprovalSnapshot = project.approvalSnapshot;
  let nextManifest = project.manifest;
  let nextFindings = project.findings;

  // Material edits in advanced states (approved, manifest_generated, ready_for_approval)
  // must increment the revision count and invalidate downstream artifacts.
  if (
    event.type === "MATERIAL_EDIT" &&
    (previousState === "approved" ||
      previousState === "manifest_generated" ||
      previousState === "ready_for_approval")
  ) {
    nextRevision = project.revision + 1;
    nextApprovalSnapshot = null;
    nextManifest = null;
    nextFindings = []; // require re-evaluation
  }

  const eventLog: ProjectEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    projectId: project.id,
    actorId: actor.id || "system",
    eventType: event.type.toLowerCase(),
    previousState,
    nextState,
    entityType: "project",
    entityId: project.id,
    payloadDigest,
    createdAt: now
  };

  const nextProject: ReadinessProject = {
    ...project,
    state: nextState,
    revision: nextRevision,
    approvalSnapshot: nextApprovalSnapshot,
    manifest: nextManifest,
    findings: nextFindings,
    events: [...(project.events || []), eventLog],
    updatedAt: now
  };

  return { nextProject, eventLog };
}
