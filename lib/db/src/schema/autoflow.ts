import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    department: text("department").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const requestsTable = pgTable(
  "requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requesterId: uuid("requester_id").references(() => usersTable.id),
    rawText: text("raw_text").notNull(),
    category: text("category").notNull(),
    priority: text("priority").notNull(),
    riskLevel: text("risk_level").notNull(),
    extractedEntities: jsonb("extracted_entities").$type<Record<string, unknown>>().notNull().default({}),
    attachmentUrls: jsonb("attachment_urls").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("IN_PROGRESS"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("requests_requester_created_idx").on(table.requesterId, table.createdAt),
    index("requests_status_idx").on(table.status),
  ],
);

export const tasksTable = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id").notNull().references(() => requestsTable.id, { onDelete: "cascade" }),
    assignedRole: text("assigned_role").notNull(),
    assignedDepartment: text("assigned_department").notNull(),
    assignedUserId: uuid("assigned_user_id").references(() => usersTable.id),
    stepOrder: integer("step_order").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("PENDING"),
    slaDeadline: timestamp("sla_deadline", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("tasks_request_order_idx").on(table.requestId, table.stepOrder),
    index("tasks_assignment_status_idx").on(table.assignedDepartment, table.assignedRole, table.status),
  ],
);

export const workflowLogsTable = pgTable(
  "workflow_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id").notNull().references(() => requestsTable.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    actorId: uuid("actor_id").references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("workflow_logs_request_created_idx").on(table.requestId, table.createdAt)],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertRequestSchema = createInsertSchema(requestsTable).omit({ id: true, createdAt: true, resolvedAt: true });
export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, completedAt: true });
export const insertWorkflowLogSchema = createInsertSchema(workflowLogsTable).omit({ id: true, createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type RequestRecord = typeof requestsTable.$inferSelect;
export type TaskRecord = typeof tasksTable.$inferSelect;
export type WorkflowLogRecord = typeof workflowLogsTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
