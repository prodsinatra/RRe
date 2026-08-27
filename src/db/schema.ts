import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  primaryArtist: text("primary_artist").notNull(),
  label: text("label"),
  state: text("state").notNull().default("draft"),
  targetDate: text("target_date"),
  upc: text("upc"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id).notNull(),
  filename: text("filename").notNull(),
  assetType: text("asset_type").notNull(),
  mimeType: text("mime_type").notNull(),
  bytes: text("bytes"),
  diagnostics: jsonb("diagnostics"),
  version: text("version").default("v1"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const credits = pgTable("credits", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id).notNull(),
  fullName: text("full_name").notNull(),
  ipi: text("ipi"),
  pro: text("pro"),
  splits: jsonb("splits").notNull(), // { songwriter: 50, producer: 50 }
});

export const findings = pgTable("findings", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id).notNull(),
  code: text("code").notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull(),
});

export const manifests = pgTable("manifests", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id).notNull(),
  clientDigest: text("client_digest").notNull(),
  generatedAt: timestamp("generated_at").defaultNow(),
  signedBy: text("signed_by"),
});
