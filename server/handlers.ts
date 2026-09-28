import path from "node:path";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import { beadDetailSchema, type Bead, type ProjectSummary } from "../shared/beads";
import { BdError, findBeadsRoot, hasBeadsDatabase, projectName, runBdJson, runBdText } from "./bd";
import { loadBoardPayload, normalizeBoard, type RawBead } from "./beads";

const MAX_PROJECTS = 40;
/**
 * Beads runs on an embedded database that serialises writers per data directory, so
 * concurrent `bd` processes in one project crawl. Two per project is cheap; a wide
 * fan-out across projects is not.
 */
const MAX_CONCURRENT_BD = 4;

interface Candidate {
  dir: string;
  name: string;
  extra: boolean;
}

function addCandidate(map: Map<string, Candidate>, dir: unknown, name: unknown, extra: boolean): void {
  if (typeof dir !== "string") return;
  const trimmed = dir.trim();
  if (!trimmed) return;
  const resolved = path.resolve(trimmed);
  const existing = map.get(resolved);
  if (existing) {
    if (extra) existing.extra = true;
    return;
  }
  map.set(resolved, {
    dir: resolved,
    name: (typeof name === "string" && name.trim()) || projectName(resolved),
    extra,
  });
}

/** Collect every directory on this host that may hold a beads database. */
async function collectCandidates(extraPaths: string[], { paseo }: PluginHandlerContext): Promise<Candidate[]> {
  const map = new Map<string, Candidate>();

  for (const extra of extraPaths) addCandidate(map, extra, undefined, true);

  const results = await Promise.allSettled([paseo.projects.list(), paseo.workspaces.list()]);
  const projects = results[0];
  if (projects?.status === "fulfilled") {
    for (const project of projects.value.projects ?? []) {
      addCandidate(map, project.projectRootPath, project.projectDisplayName, false);
    }
  }
  const workspaces = results[1];
  if (workspaces?.status === "fulfilled") {
    for (const workspace of workspaces.value.entries ?? []) {
      addCandidate(map, workspace.projectRootPath, workspace.projectDisplayName, false);
      addCandidate(map, workspace.workspaceDirectory, workspace.projectDisplayName, false);
    }
  }
  if (projects?.status === "rejected") console.error("beads: project list failed", projects.reason);
  if (workspaces?.status === "rejected") console.error("beads: workspace list failed", workspaces.reason);

  return [...map.values()].slice(0, MAX_PROJECTS);
}

interface StatusSummary {
  summary?: {
    total_issues?: number;
    open_issues?: number;
    in_progress_issues?: number;
    closed_issues?: number;
    blocked_issues?: number;
  };
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Ask `bd` for its own overview instead of pulling the whole issue list and counting
 * it here. `status` covers the totals, `where` the issue prefix, and `count` the one
 * column beads has no summary bucket for. Three cheap reads beat one heavy one, and
 * they keep the RPC well inside the daemon's 30s budget.
 */
async function summarize(candidate: Candidate): Promise<ProjectSummary> {
  const base: ProjectSummary = {
    path: candidate.dir,
    name: candidate.name,
    prefix: null,
    total: 0,
    open: 0,
    inProgress: 0,
    inReview: 0,
    closed: 0,
    blocked: 0,
    error: null,
  };
  try {
    const status = await runBdJson<StatusSummary>(candidate.dir, ["status", "--json", "--no-activity"], 20_000);
    const inReview = await runBdJson<{ count?: number } | null>(
      candidate.dir,
      ["count", "--json", "--status", "inreview"],
      15_000,
    ).catch(() => null);
    const where = await runBdJson<{ prefix?: string } | null>(candidate.dir, ["where", "--json"], 15_000);
    const summary = status?.summary ?? {};
    const prefix = typeof where?.prefix === "string" && where.prefix.length > 0 ? where.prefix : null;
    return {
      ...base,
      prefix,
      total: count(summary.total_issues),
      open: count(summary.open_issues),
      inProgress: count(summary.in_progress_issues),
      inReview: count(inReview?.count),
      closed: count(summary.closed_issues),
      blocked: count(summary.blocked_issues),
    };
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Run `bd` for each project with a bounded fan-out, preserving input order. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Collapse candidates onto the beads database that actually holds them. Every Paseo
 * worktree of a project points at the same database, and summarising each one
 * separately used to fan a dozen `bd` processes at a single embedded database.
 */
function resolveDatabaseRoots(candidates: Candidate[]): Candidate[] {
  const byRoot = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const root = hasBeadsDatabase(candidate.dir) ? candidate.dir : findBeadsRoot(candidate.dir);
    if (!root) continue;
    const existing = byRoot.get(root);
    if (existing) {
      existing.extra = existing.extra || candidate.extra;
      continue;
    }
    byRoot.set(root, {
      dir: root,
      name: candidate.dir === root ? candidate.name : projectName(root),
      extra: candidate.extra,
    });
  }
  return [...byRoot.values()];
}

export async function handleListProjects(
  { extraPaths }: { extraPaths: string[] },
  context: PluginHandlerContext,
) {
  const candidates = await collectCandidates(extraPaths, context);
  const withDatabase = resolveDatabaseRoots(candidates);
  const projects = await mapWithConcurrency(withDatabase, MAX_CONCURRENT_BD, summarize);
  projects.sort((a, b) => {
    if (a.error && !b.error) return 1;
    if (b.error && !a.error) return -1;
    return a.name.localeCompare(b.name);
  });
  return { projects };
}

export async function handleLoadBoard({ path: dir, includeClosed }: { path: string; includeClosed: boolean }) {
  const root = hasBeadsDatabase(dir) ? dir : findBeadsRoot(dir);
  if (!root) {
    throw new Error(`No beads database found at ${dir}. Run \`bd init\` there, or add the project path in settings.`);
  }
  return loadBoardPayload(root, includeClosed);
}

export async function handleShowBead({ path: dir, id }: { path: string; id: string }) {
  const root = hasBeadsDatabase(dir) ? dir : findBeadsRoot(dir);
  if (!root) throw new Error(`No beads database found at ${dir}.`);

  // Sequential: bd serialises access to one database, so parallel reads here cost
  // seconds each. The detail pane is not on a hot path.
  const rows = await runBdJson<RawBead[]>(root, ["show", id, "--json"]);
  const comments = await runBdJson<{ id?: string; author?: string; text?: string; created_at?: string }[]>(root, [
    "comments",
    id,
    "--json",
  ]).catch(() => []);
  const board = await runBdJson<RawBead[]>(root, ["list", "--json", "--brief", "--all", "-n", "0"]).catch(
    (): RawBead[] => [],
  );

  const row = (rows ?? [])[0];
  if (!row) throw new Error(`Bead ${id} was not found in ${root}.`);

  const normalized = normalizeBoard(board);
  const base: Bead | undefined = normalized.beads.find((bead) => bead.id === id);
  const fromRow = normalizeBoard([row]).beads[0];
  const bead: Bead = { ...(base ?? fromRow), ...(fromRow ?? {}) };

  return beadDetailSchema.parse({
    bead,
    description: row.description ?? null,
    design: row.design ?? null,
    notes: row.notes ?? null,
    comments: (comments ?? []).map((comment) => ({
      id: comment.id ?? `${comment.created_at ?? ""}`,
      author: comment.author ?? "unknown",
      text: comment.text ?? "",
      createdAt: comment.created_at ?? null,
    })),
  });
}

export async function handleCreateBead({
  path: dir,
  title,
  description,
  priority,
  issueType,
  assignee,
  labels,
  parent,
}: {
  path: string;
  title: string;
  description: string;
  priority: number;
  issueType: string;
  assignee: string;
  labels: string[];
  parent: string;
}) {
  const root = hasBeadsDatabase(dir) ? dir : findBeadsRoot(dir);
  if (!root) throw new Error(`No beads database found at ${dir}.`);

  const args = ["create", title, "--json", "-p", String(priority), "-t", issueType];
  if (description.trim()) args.push("-d", description);
  if (assignee.trim()) args.push("-a", assignee.trim());
  if (labels.length > 0) args.push("-l", labels.join(","));
  if (parent.trim()) args.push("--parent", parent.trim());

  const created = await runBdJson<{ id?: string } | RawBead[] | null>(root, args, 30_000);
  const id = Array.isArray(created) ? created[0]?.id : created?.id;
  if (!id) throw new Error("bd create did not return an issue ID.");
  return { id };
}

export async function handleUpdateBead({
  path: dir,
  id,
  title,
  description,
  notes,
  priority,
  assignee,
  status,
  reason,
  force,
}: {
  path: string;
  id: string;
  title?: string;
  description?: string;
  notes?: string;
  priority?: number;
  assignee?: string;
  status?: string;
  reason?: string;
  force?: boolean;
}) {
  const root = hasBeadsDatabase(dir) ? dir : findBeadsRoot(dir);
  if (!root) throw new Error(`No beads database found at ${dir}.`);

  if (status && columnIsDone(status)) {
    const closeArgs = ["close", id];
    if (reason?.trim()) closeArgs.push("--reason", reason.trim());
    if (force) closeArgs.push("--force");
    try {
      await runBdText(root, closeArgs, 30_000);
    } catch (error) {
      throw closeRefusal(id, error);
    }
    return { ok: true, message: `${id} closed` };
  }
  if (status && statusIsOpenLike(status)) {
    await runBdText(root, ["reopen", id], 30_000);
    return { ok: true, message: `${id} reopened` };
  }

  const args = ["update", id];
  if (title !== undefined) args.push("--title", title);
  if (description !== undefined) args.push("-d", description);
  if (notes !== undefined) args.push("--notes", notes);
  if (priority !== undefined) args.push("-p", String(priority));
  if (assignee !== undefined) args.push("-a", assignee);
  if (status !== undefined) args.push("-s", status);

  const result = await runBdText(root, args, 30_000);
  const message = result
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .at(-1);
  return { ok: true, message: message && message.length < 200 ? message : `${id} updated` };
}

/** Turn a `bd close` refusal into an actionable message instead of raw CLI output. */
function closeRefusal(id: string, error: unknown): Error {
  const detail = error instanceof BdError ? `${error.message}` : String(error);
  if (/assignee is|reclaim|claimed/i.test(detail)) {
    return new Error(
      `${id} is claimed by another assignee, so beads refused to close it. Reassign it, or use Force close.`,
    );
  }
  if (/open children|child/i.test(detail)) {
    return new Error(`${id} still has open children, so beads refused to close it. Close them first, or use Force close.`);
  }
  if (/gate/i.test(detail)) {
    return new Error(`${id} has an unsatisfied gate, so beads refused to close it. Use Force close to override.`);
  }
  return new Error(`Could not close ${id}. ${firstLines(detail, 2)}`);
}

function firstLines(text: string, count: number): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, count)
    .join(" ");
}

function columnIsDone(status: string): boolean {
  return ["closed", "done", "resolved"].includes(status.toLowerCase());
}

function statusIsOpenLike(status: string): boolean {
  return status.toLowerCase() === "open";
}

export async function handleComment({ path: dir, id, text }: { path: string; id: string; text: string }) {
  const root = hasBeadsDatabase(dir) ? dir : findBeadsRoot(dir);
  if (!root) throw new Error(`No beads database found at ${dir}.`);
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Comment text is empty.");
  await runBdText(root, ["comment", id, trimmed], 30_000);
  return { ok: true };
}

export async function handleSearchBeads(
  { query, paths }: { query: string; paths: string[] },
  context: PluginHandlerContext,
) {
  const requested = paths.length > 0 ? paths : (await collectCandidates([], context)).map((entry) => entry.dir);
  const roots = requested
    .map((dir) => (hasBeadsDatabase(dir) ? dir : findBeadsRoot(dir)))
    .filter((root): root is string => Boolean(root));
  const term = query.trim();
  if (!term || roots.length === 0) return { items: [] };

  const perRoot = await mapWithConcurrency(roots.slice(0, 12), MAX_CONCURRENT_BD, async (root) => {
    const rows = await runBdJson<RawBead[]>(root, ["list", "--json", "--brief", "-n", "0", "--all"]).catch(
      (): RawBead[] => [],
    );
      const normalized = normalizeBoard(rows ?? []);
      const needle = term.toLowerCase();
      return normalized.beads
        .filter(
          (bead) =>
            bead.id.toLowerCase().includes(needle) || bead.title.toLowerCase().includes(needle),
        )
      .slice(0, 20)
      .map((bead) => ({ bead, root }));
  });

  const items = perRoot
    .flat()
    .sort((a, b) => a.bead.priority - b.bead.priority || a.bead.id.localeCompare(b.bead.id))
    .slice(0, 25)
    .map(({ bead, root }) => ({
      id: `${root}#${bead.id}`,
      identifier: bead.id,
      title: bead.title,
      subtitle: `${root} · ${bead.status}${bead.assignee ? ` · ${bead.assignee}` : ""}`,
      url: `file://${root}`,
      text: [
        `Bead ${bead.id}: ${bead.title}`,
        `Project: ${root}`,
        `Status: ${bead.status} (priority P${bead.priority}, type ${bead.issueType})`,
        bead.assignee ? `Assignee: ${bead.assignee}` : null,
        bead.labels.length > 0 ? `Labels: ${bead.labels.join(", ")}` : null,
        "",
        `Managed with the beads CLI (bd). Change status with: bd update ${bead.id} -s <status>`,
        `Close it with: bd close ${bead.id} --reason "<reason>"`,
      ]
        .filter((line) => line !== null)
        .join("\n"),
      resourceType: "beads.issue",
    }));

  return { items };
}
