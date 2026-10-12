import { columnForStatus, type Bead, type Column, type StatusInfo } from "../shared/beads";
import { projectName, runBrJson } from "./br";

interface RawDependency {
  issue_id?: string;
  depends_on_id?: string;
  /** `br show` names the dependency target `id` and the edge `dependency_type`. */
  id?: string;
  type?: string;
  dependency_type?: string;
}

export interface RawBead {
  id: string;
  title?: string;
  description?: string | null;
  design?: string | null;
  notes?: string | null;
  status?: string;
  priority?: number;
  issue_type?: string;
  assignee?: string | null;
  owner?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  closed_at?: string | null;
  close_reason?: string | null;
  labels?: string[] | null;
  dependencies?: RawDependency[] | null;
  parent?: string | null;
  dependency_count?: number;
  dependent_count?: number;
  comment_count?: number;
}

/** Dependency types that do not gate progress. */
const NON_BLOCKING_DEP_TYPES = new Set([
  "parent-child",
  "related",
  "relates-to",
  "duplicate",
  "duplicated-by",
  "supersedes",
  "superseded-by",
]);

const MAX_BEADS = 5000;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export interface NormalizedBoard {
  beads: Bead[];
  counts: Record<Column, number> & { total: number; blocked: number };
  truncated: boolean;
}

/** Turn raw issue rows into board beads, resolving parents, blockers, and epic progress. */
export function normalizeBoard(raw: RawBead[]): NormalizedBoard {
  const rows = Array.isArray(raw) ? raw.filter((row) => row && typeof row.id === "string") : [];
  const truncated = rows.length > MAX_BEADS;
  const limited = truncated ? rows.slice(0, MAX_BEADS) : rows;

  const byId = new Map<string, RawBead>(limited.map((row) => [row.id, row]));
  const childrenOf = new Map<string, string[]>();
  const parentOf = new Map<string, string>();
  const blockedBy = new Map<string, string[]>();
  const blocks = new Map<string, string[]>();

  for (const row of limited) {
    const deps = Array.isArray(row.dependencies) ? row.dependencies : [];
    for (const dep of deps) {
      const type = (dep?.type ?? dep?.dependency_type ?? "").toLowerCase();
      const target = asString(dep?.depends_on_id) ?? asString(dep?.id);
      const source = asString(dep?.issue_id) ?? row.id;
      if (!target || target === source) continue;
      if (type === "parent-child") {
        parentOf.set(source, target);
        const existing = childrenOf.get(target) ?? [];
        existing.push(source);
        childrenOf.set(target, existing);
        continue;
      }
      if (NON_BLOCKING_DEP_TYPES.has(type)) continue;
      const sources = blockedBy.get(source) ?? [];
      sources.push(target);
      blockedBy.set(source, sources);
      const targets = blocks.get(target) ?? [];
      targets.push(source);
      blocks.set(target, targets);
    }
  }

  const beads: Bead[] = [];
  const counts = { open: 0, in_progress: 0, in_review: 0, closed: 0, total: 0, blocked: 0 };

  for (const row of limited) {
    const status = asString(row.status) ?? "open";
    const mapped = columnForStatus(status);
    if (!mapped) continue;
    const childIds = childrenOf.get(row.id) ?? [];
    const parentId = asString(row.parent) ?? parentOf.get(row.id) ?? null;
    const pendingBlockers = (blockedBy.get(row.id) ?? []).filter((id) => {
      const target = byId.get(id);
      return target ? columnForStatus(target.status ?? "open")?.column !== "closed" : false;
    });
    const blocked = status === "blocked" || pendingBlockers.length > 0;
    const closedChildCount = childIds.filter((id) => {
      const child = byId.get(id);
      return child ? columnForStatus(child.status ?? "open")?.column === "closed" : false;
    }).length;

    beads.push({
      id: row.id,
      title: asString(row.title) ?? row.id,
      status,
      column: mapped.column,
      badge: mapped.badge,
      priority: asNumber(row.priority),
      issueType: asString(row.issue_type) ?? "task",
      assignee: asString(row.assignee) ?? asString(row.owner),
      parentId,
      isEpic: (asString(row.issue_type) ?? "task") === "epic" || childIds.length > 0,
      labels: Array.isArray(row.labels) ? row.labels.filter((l): l is string => typeof l === "string") : [],
      blocked,
      blockedBy: pendingBlockers,
      blocks: blocks.get(row.id) ?? [],
      childIds,
      closedChildCount,
      dependencyCount: asNumber(row.dependency_count),
      dependentCount: asNumber(row.dependent_count),
      commentCount: asNumber(row.comment_count),
      createdAt: asString(row.created_at),
      updatedAt: asString(row.updated_at),
      startedAt: asString(row.started_at),
      closedAt: asString(row.closed_at),
      closeReason: asString(row.close_reason),
    });

    counts[mapped.column] += 1;
    counts.total += 1;
    if (blocked) counts.blocked += 1;
  }

  return { beads, counts, truncated };
}

/** `br list --json` is `{ issues, total, ... }`; older `bd list --json` was a bare array. */
export function issuesFromList(payload: unknown): RawBead[] {
  if (Array.isArray(payload)) return payload as RawBead[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { issues?: unknown }).issues)) {
    return (payload as { issues: RawBead[] }).issues;
  }
  return [];
}

export interface BlockedRow {
  id?: string;
  blocked_by?: string[];
}

/**
 * `br list` omits dependency edges. Children are dotted ids (`parent.1`), and
 * `br blocked` reports both real blockers and open children of an epic. Drop the
 * latter: this board does not treat parent-child links as blockers.
 */
export function enrichBrRows(rows: RawBead[], blocked: BlockedRow[]): RawBead[] {
  const ids = new Set(rows.map((row) => row.id));
  const blockedBy = new Map<string, string[]>();
  for (const row of blocked) {
    if (typeof row?.id === "string") blockedBy.set(row.id, Array.isArray(row.blocked_by) ? row.blocked_by : []);
  }
  return rows.map((row) => {
    const deps: RawDependency[] = Array.isArray(row.dependencies) ? [...row.dependencies] : [];
    const dot = row.id.lastIndexOf(".");
    const parent = dot > 0 ? row.id.slice(0, dot) : null;
    const hasEdge = (target: string, type?: string) =>
      deps.some((dep) => (dep.depends_on_id ?? dep.id) === target && (type == null || (dep.type ?? dep.dependency_type) === type));
    if (parent && ids.has(parent) && !hasEdge(parent)) {
      deps.push({ issue_id: row.id, depends_on_id: parent, type: "parent-child" });
    }
    for (const target of blockedBy.get(row.id) ?? []) {
      if (!target || target.startsWith(`${row.id}.`) || row.id.startsWith(`${target}.`)) continue;
      if (!hasEdge(target)) deps.push({ issue_id: row.id, depends_on_id: target, type: "blocks" });
    }
    return {
      ...row,
      parent: asString(row.parent) ?? (parent && ids.has(parent) ? parent : null),
      dependencies: deps,
    };
  });
}

/**
 * `br show` is normalized on its own, so blocker targets are unknown and dropped.
 * Keep the board's dependency graph when the show payload cannot see it.
 */
export function mergeShownBead(base: Bead | undefined, fromRow: Bead | undefined): Bead {
  const row = fromRow ?? base;
  const board = base ?? fromRow;
  if (!row || !board) throw new Error("Bead was not found.");
  return {
    ...board,
    ...row,
    blocked: board.blocked || row.blocked,
    blockedBy: row.blockedBy.length > 0 ? row.blockedBy : board.blockedBy,
    blocks: row.blocks.length > 0 ? row.blocks : board.blocks,
    childIds: row.childIds.length > 0 ? row.childIds : board.childIds,
    closedChildCount: row.closedChildCount > 0 ? row.closedChildCount : board.closedChildCount,
    parentId: row.parentId ?? board.parentId,
  };
}

/** Statuses `br update --status` accepts. br has no `statuses` subcommand. */
const BR_STATUSES: StatusInfo[] = [
  { name: "open", category: "active" },
  { name: "in_progress", category: "active" },
  { name: "blocked", category: "active" },
  { name: "deferred", category: "active" },
  { name: "pinned", category: "active" },
  { name: "hooked", category: "active" },
  { name: "in_review", category: "active" },
  { name: "inreview", category: "active" },
  { name: "closed", category: "closed" },
];

export function loadStatuses(): StatusInfo[] {
  return BR_STATUSES;
}

export async function loadPrefix(dir: string): Promise<string | null> {
  const raw = await runBrJson<{ prefix?: string } | null>(dir, ["where", "--json"], 15_000);
  return asString(raw?.prefix);
}

export interface BoardPayload {
  path: string;
  name: string;
  prefix: string | null;
  statuses: StatusInfo[];
  counts: NormalizedBoard["counts"];
  beads: Bead[];
  truncated: boolean;
}

export async function loadBoardPayload(dir: string, includeClosed: boolean): Promise<BoardPayload> {
  const args = ["list", "--json", "--limit", "0"];
  if (includeClosed) args.push("--all");
  // Sequential: br's SQLite store allows one writer, and the board polls.
  const listed = await runBrJson<unknown>(dir, args);
  const blocked = await runBrJson<{ issues?: BlockedRow[] } | null>(dir, ["blocked", "--json", "--limit", "0"]);
  const prefix = await loadPrefix(dir);
  const rows = enrichBrRows(issuesFromList(listed), blocked?.issues ?? []);
  const { beads, counts, truncated } = normalizeBoard(rows);
  return { path: dir, name: projectName(dir), prefix, statuses: loadStatuses(), counts, beads, truncated };
}
