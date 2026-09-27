import { columnForStatus, type Bead, type Column, type StatusInfo } from "../shared/beads";
import { projectName, runBdJson } from "./bd";

interface RawDependency {
  issue_id?: string;
  depends_on_id?: string;
  type?: string;
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

/** Turn raw `bd list` output into board beads, resolving parents, blockers, and epic progress. */
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
      const type = (dep?.type ?? "").toLowerCase();
      const target = asString(dep?.depends_on_id);
      const source = asString(dep?.issue_id) ?? row.id;
      if (!target) continue;
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

interface RawStatus {
  name?: string;
  category?: string;
}

/** Read the statuses this database knows about, so the board can resolve move targets. */
export async function loadStatuses(dir: string): Promise<StatusInfo[]> {
  const raw = await runBdJson<{ built_in_statuses?: RawStatus[]; statuses?: RawStatus[] } | null>(
    dir,
    ["statuses", "--json"],
    15_000,
  );
  const rows = [...(raw?.built_in_statuses ?? []), ...(raw?.statuses ?? [])];
  const seen = new Set<string>();
  const statuses: StatusInfo[] = [];
  for (const row of rows) {
    const name = asString(row?.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    statuses.push({ name, category: asString(row?.category) ?? "active" });
  }
  return statuses;
}

export async function loadPrefix(dir: string): Promise<string | null> {
  const raw = await runBdJson<{ prefix?: string } | null>(dir, ["where", "--json"], 15_000);
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
  const args = ["list", "--json", "--brief", "-n", "0"];
  if (includeClosed) args.push("--all");
  const [raw, statuses, prefix] = await Promise.all([
    runBdJson<RawBead[]>(dir, args),
    loadStatuses(dir),
    loadPrefix(dir),
  ]);
  const { beads, counts, truncated } = normalizeBoard(raw ?? []);
  return { path: dir, name: projectName(dir), prefix, statuses, counts, beads, truncated };
}
