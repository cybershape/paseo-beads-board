import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

/** The four kanban columns, mirroring beads-web. */
export const columnSchema = z.enum(["open", "in_progress", "in_review", "closed"]);
export type Column = z.infer<typeof columnSchema>;

export const COLUMNS: readonly Column[] = ["open", "in_progress", "in_review", "closed"] as const;

export const COLUMN_TITLES: Record<Column, string> = {
  open: "Open",
  in_progress: "In Progress",
  in_review: "In Review",
  closed: "Closed",
};

/** Raw `bd` status -> board column, matching beads-web's STATUS_MAP. */
const STATUS_MAP: Record<string, { column: Column; badge?: string } | null> = {
  open: { column: "open" },
  pending: { column: "open" },
  blocked: { column: "open", badge: "Blocked" },
  deferred: { column: "open", badge: "Deferred" },
  pinned: { column: "open", badge: "Pinned" },
  in_progress: { column: "in_progress" },
  hooked: { column: "in_progress", badge: "Waiting" },
  inreview: { column: "in_review" },
  in_review: { column: "in_review" },
  review: { column: "in_review" },
  closed: { column: "closed" },
  done: { column: "closed" },
  resolved: { column: "closed" },
  tombstone: null,
};

export function columnForStatus(status: string): { column: Column; badge: string | null } | null {
  // An explicit `null` entry (tombstone) hides the bead; an unknown status still lands on Open.
  const mapped = Object.hasOwn(STATUS_MAP, status) ? STATUS_MAP[status] : { column: "open" as const };
  if (!mapped) return null;
  return { column: mapped.column, badge: mapped.badge ?? null };
}

/** The raw status name this database uses for a board column, if any. */
export function statusNameForColumn(column: Column, statuses: readonly { name: string }[]): string | null {
  if (column === "closed") return "closed";
  const names = statuses.map((status) => status.name);
  const preferred =
    column === "open" ? ["open"] : column === "in_progress" ? ["in_progress"] : ["in_review", "inreview", "review"];
  for (const name of preferred) {
    if (names.includes(name)) return name;
  }
  return names.find((name) => columnForStatus(name)?.column === column) ?? null;
}

export const beadSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  column: columnSchema,
  badge: z.string().nullable(),
  priority: z.number(),
  issueType: z.string(),
  assignee: z.string().nullable(),
  parentId: z.string().nullable(),
  isEpic: z.boolean(),
  labels: z.array(z.string()),
  blocked: z.boolean(),
  blockedBy: z.array(z.string()),
  blocks: z.array(z.string()),
  childIds: z.array(z.string()),
  closedChildCount: z.number(),
  dependencyCount: z.number(),
  dependentCount: z.number(),
  commentCount: z.number(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  closeReason: z.string().nullable(),
});

export type Bead = z.infer<typeof beadSchema>;

export const projectSummarySchema = z.object({
  path: z.string(),
  name: z.string(),
  prefix: z.string().nullable(),
  total: z.number(),
  open: z.number(),
  inProgress: z.number(),
  inReview: z.number(),
  closed: z.number(),
  blocked: z.number(),
  error: z.string().nullable(),
});

export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const statusInfoSchema = z.object({ name: z.string(), category: z.string() });
export type StatusInfo = z.infer<typeof statusInfoSchema>;

export const countsSchema = z.object({
  total: z.number(),
  open: z.number(),
  in_progress: z.number(),
  in_review: z.number(),
  closed: z.number(),
  blocked: z.number(),
});

export const boardSchema = z.object({
  path: z.string(),
  name: z.string(),
  prefix: z.string().nullable(),
  statuses: z.array(statusInfoSchema),
  counts: countsSchema,
  beads: z.array(beadSchema),
  truncated: z.boolean(),
});

export type Board = z.infer<typeof boardSchema>;

export const listProjects = defineRpc({
  name: "beads.projects",
  input: z.object({ extraPaths: z.array(z.string()).default([]) }),
  output: z.object({ projects: z.array(projectSummarySchema) }),
});

export const loadBoard = defineRpc({
  name: "beads.board",
  input: z.object({ path: z.string(), includeClosed: z.boolean().default(true) }),
  output: boardSchema,
});

export const beadDetailSchema = z.object({
  bead: beadSchema,
  description: z.string().nullable(),
  design: z.string().nullable(),
  notes: z.string().nullable(),
  comments: z.array(
    z.object({
      id: z.string(),
      author: z.string(),
      text: z.string(),
      createdAt: z.string().nullable(),
    }),
  ),
});

export const showBead = defineRpc({
  name: "beads.show",
  input: z.object({ path: z.string(), id: z.string() }),
  output: beadDetailSchema,
});

export const createBead = defineRpc({
  name: "beads.create",
  input: z.object({
    path: z.string(),
    title: z.string(),
    description: z.string().default(""),
    priority: z.number().int().min(0).max(4).default(2),
    issueType: z.string().default("task"),
    assignee: z.string().default(""),
    labels: z.array(z.string()).default([]),
    parent: z.string().default(""),
  }),
  output: z.object({ id: z.string() }),
});

export const updateBead = defineRpc({
  name: "beads.update",
  input: z.object({
    path: z.string(),
    id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    priority: z.number().int().min(0).max(4).optional(),
    assignee: z.string().optional(),
    status: z.string().optional(),
    /** Recorded with `bd close --reason` when the move closes the bead. */
    reason: z.string().optional(),
    /** Close past beads' claim, gate, and open-children guards. */
    force: z.boolean().optional(),
  }),
  output: z.object({ ok: z.boolean(), message: z.string().default("") }),
});

export const commentOnBead = defineRpc({
  name: "beads.comment",
  input: z.object({ path: z.string(), id: z.string(), text: z.string() }),
  output: z.object({ ok: z.boolean() }),
});

export const searchBeads = defineRpc({
  name: "beads.search",
  input: z.object({ query: z.string(), paths: z.array(z.string()).default([]) }),
  output: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        identifier: z.string(),
        title: z.string(),
        subtitle: z.string().optional(),
        url: z.string().url(),
        text: z.string(),
        resourceType: z.string(),
      }),
    ),
  }),
});
