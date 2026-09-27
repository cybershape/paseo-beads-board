import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useRpc, useSettings } from "@getpaseo/plugin/client";
import {
  commentOnBead,
  createBead,
  listProjects,
  loadBoard,
  showBead,
  updateBead,
  type Board,
  type Column,
  type ProjectSummary,
} from "../shared/beads";
import { preferences } from "../shared/settings";

export function usePreferences() {
  return useSettings(preferences);
}

export function useExtraPaths(): string[] {
  const settings = usePreferences();
  return settings.status === "ready" ? settings.values.extraPaths : [];
}

export function usePollIntervalSeconds(): number {
  const settings = usePreferences();
  return settings.status === "ready" ? settings.values.pollIntervalSeconds : 20;
}

export function useProjects(hostId: string) {
  const rpc = useRpc(listProjects);
  const extraPaths = useExtraPaths();
  return useQuery({
    queryKey: ["beads", "projects", hostId, extraPaths],
    queryFn: () => rpc({ extraPaths }),
    staleTime: 30_000,
  });
}

export function useBoard(
  hostId: string,
  projectPath: string | null,
  options: { includeClosed: boolean; pollIntervalSeconds: number },
) {
  const rpc = useRpc(loadBoard);
  return useQuery({
    queryKey: ["beads", "board", hostId, projectPath, options.includeClosed],
    queryFn: () => rpc({ path: projectPath as string, includeClosed: options.includeClosed }),
    enabled: Boolean(projectPath),
    refetchInterval: options.pollIntervalSeconds > 0 ? options.pollIntervalSeconds * 1000 : false,
    staleTime: 5_000,
  });
}

export function useBeadDetail(projectPath: string | null, beadId: string | null) {
  const rpc = useRpc(showBead);
  return useQuery({
    queryKey: ["beads", "detail", projectPath, beadId],
    queryFn: () => rpc({ path: projectPath as string, id: beadId as string }),
    enabled: Boolean(projectPath && beadId),
    staleTime: 10_000,
  });
}

export interface CreateBeadInput {
  /** Beads database the bead lands in. May differ from the board's selected project. */
  path: string;
  title: string;
  description: string;
  priority: number;
  issueType: string;
  assignee: string;
  labels: string[];
  parent: string;
}

export function useBeadActions(projectPath: string | null) {
  const client = useQueryClient();
  const create = useRpc(createBead);
  const update = useRpc(updateBead);
  const comment = useRpc(commentOnBead);

  const invalidate = useCallback(() => {
    void client.invalidateQueries({ queryKey: ["beads"] });
  }, [client]);

  const createBeadMutation = useMutation({
    mutationFn: (input: CreateBeadInput) =>
      create({
        path: input.path,
        title: input.title,
        description: input.description,
        priority: input.priority,
        issueType: input.issueType,
        assignee: input.assignee,
        labels: input.labels,
        parent: input.parent,
      }),
    onSuccess: invalidate,
  });

  const updateBeadMutation = useMutation({
    mutationFn: (input: Parameters<typeof update>[0]) => update(input),
    onSuccess: invalidate,
  });

  const commentMutation = useMutation({
    mutationFn: (input: { id: string; text: string }) =>
      comment({ path: projectPath as string, id: input.id, text: input.text }),
    onSuccess: invalidate,
  });

  return {
    createBead: createBeadMutation,
    updateBead: updateBeadMutation,
    commentOnBead: commentMutation,
  };
}

export const COLUMN_ORDER: readonly Column[] = ["open", "in_progress", "in_review", "closed"];

export interface BoardView {
  board: Board;
  columns: Record<Column, Board["beads"]>;
  project: ProjectSummary | null;
}

/** Group normalized beads into the four board columns. */
export function groupByColumn(beads: Board["beads"]): Record<Column, Board["beads"]> {
  const grouped: Record<Column, Board["beads"]> = { open: [], in_progress: [], in_review: [], closed: [] };
  for (const bead of beads) grouped[bead.column].push(bead);
  const byPriority = (a: (typeof beads)[number], b: (typeof beads)[number]) =>
    a.priority - b.priority || a.id.localeCompare(b.id, undefined, { numeric: true });
  const byRecent = (a: (typeof beads)[number], b: (typeof beads)[number]) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.id.localeCompare(b.id, undefined, { numeric: true });
  for (const column of COLUMN_ORDER) {
    grouped[column].sort(column === "closed" ? byRecent : byPriority);
  }
  return grouped;
}

/**
 * Constraints beads enforces when closing. Shown in the close confirmation so the
 * user can decide with the same information the CLI would refuse on.
 */
export function closeWarnings(bead: Board["beads"][number], beads: Board["beads"]): string[] {
  const byId = new Map(beads.map((entry) => [entry.id, entry]));
  const warnings: string[] = [];

  if (bead.assignee && bead.status !== "closed") {
    warnings.push(`Claimed by ${bead.assignee}. Beads refuses to close an issue another actor is working on.`);
  }
  const openChildren = bead.childIds
    .map((id) => byId.get(id))
    .filter((child): child is Board["beads"][number] => Boolean(child) && child!.column !== "closed");
  if (openChildren.length > 0) {
    warnings.push(
      `${openChildren.length} open ${openChildren.length === 1 ? "child" : "children"}: ${openChildren
        .map((child) => child.id)
        .join(", ")}.`,
    );
  }
  if (bead.blockedBy.length > 0) {
    warnings.push(`Blocked by open dependencies: ${bead.blockedBy.join(", ")}.`);
  }
  if (bead.status === "pinned") {
    warnings.push("Pinned issues need --force to close.");
  }
  return warnings;
}

export function filterBeads(beads: Board["beads"], filter: { term: string; onlyBlocked: boolean }): Board["beads"] {
  const needle = filter.term.trim().toLowerCase();
  return beads.filter((bead) => {
    if (filter.onlyBlocked && !bead.blocked) return false;
    if (!needle) return true;
    return (
      bead.id.toLowerCase().includes(needle) ||
      bead.title.toLowerCase().includes(needle) ||
      (bead.assignee ?? "").toLowerCase().includes(needle) ||
      bead.labels.some((label) => label.toLowerCase().includes(needle))
    );
  });
}
