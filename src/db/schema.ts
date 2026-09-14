import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const cases = sqliteTable("cases", {
  id: text("id").primaryKey(),
  caseNumber: text("case_number").notNull().unique(),
  title: text("title").notNull(),
  agency: text("agency").notNull(),
  investigatingOfficerBadge: text("investigating_officer_badge").notNull(),
  createdAt: text("created_at").notNull(),
  status: text("status").notNull().default("Active"),
});

export const evidenceItems = sqliteTable("evidence_items", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull(),
  evidenceId: text("evidence_id").notNull().unique(),
  originalFilename: text("original_filename").notNull(),
  fileType: text("file_type").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  merkleRoot: text("merkle_root").notNull(),
  sealedAt: text("sealed_at").notNull(),
  status: text("status").notNull().default("Sealed"),
  metadataJson: text("metadata_json").notNull(),
});

export const custodyLedger = sqliteTable("custody_ledger", {
  id: text("id").primaryKey(),
  evidenceId: text("evidence_id").notNull(),
  sequenceNumber: integer("sequence_number").notNull(),
  timestamp: text("timestamp").notNull(),
  actorBadgeId: text("actor_badge_id").notNull(),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  notes: text("notes").notNull(),
  canonicalHash: text("canonical_hash").notNull(),
  signature: text("signature").notNull(),
  publicStamp: text("public_stamp").notNull(),
  syncStatus: text("sync_status").notNull().default("synced"),
});

export const officerRegistry = sqliteTable("officer_registry", {
  badgeId: text("badge_id").primaryKey(),
  fullName: text("full_name").notNull(),
  rank: text("rank").notNull(),
  agency: text("agency").notNull(),
  ninHash: text("nin_hash").notNull(),
  publicStamp: text("public_stamp").notNull(),
});
