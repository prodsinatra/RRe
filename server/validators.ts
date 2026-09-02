import { z } from "zod";

export const CreateProjectSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  primaryArtist: z.string().min(1, "Primary artist is required").max(100),
  label: z.string().max(100).optional(),
});

export const UpdateProjectSchema = z.object({
  title: z.string().max(100).optional(),
  primaryArtist: z.string().max(100).optional(),
  label: z.string().max(100).optional(),
  targetDate: z.string().max(50).nullable().optional(),
  state: z.string().optional(),
  metadata: z.object({
    upc: z.string().optional(),
    genre: z.string().optional(),
    releaseType: z.string().optional(),
    isExplicit: z.boolean().optional(),
  }).optional(),
}).passthrough(); // Allowing other fields for now until full schema is modeled

export const StateTransitionSchema = z.object({
  digest: z.string().optional(),
});

export const ArtworkGenerateSchema = z.object({
  prompt: z.string().max(1000).optional(),
});

export const WebhookPolicySchema = z.object({
  webhookUrl: z.string().url(),
  artworkDimensions: z.string().optional(),
  audioConstraints: z.object({
    maxTruePeak: z.number(),
    minIntegratedLUFS: z.number(),
  }).optional(),
  requireRightsAttestation: z.boolean().optional(),
});
