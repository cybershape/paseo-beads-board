import { Icon, copyText, useToast } from "@getpaseo/plugin/client/react-native";
import { usePaseo } from "@getpaseo/plugin/client";
import type { PluginTheme } from "@getpaseo/plugin";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, StyleSheet } from "react-native";
import { COLUMN_TITLES, type Bead, type Column, type ProjectSummary } from "../../shared/beads";
import {
  COLUMN_ORDER,
  closeWarnings,
  filterBeads,
  groupByColumn,
  useBeadActions,
  useBeadDetail,
  useBoard,
  usePollIntervalSeconds,
  usePreferences,
  useProjects,
  type CreateBeadInput,
} from "../hooks";
import { BeadDetail } from "./BeadDetail";
import { ColumnView } from "./ColumnView";
import { COLUMN_GAP, columnWidthForBoard, visibleColumnsForBoard } from "./layout";
import { CreateBead } from "./CreateBead";
import { ProjectPicker } from "./ProjectPicker";

export interface BoardScreenProps {
  theme: PluginTheme;
  compact: boolean;
  hostId: string;
  /** Pre-select a project directory, e.g. the current workspace's project root. */
  defaultPath?: string;
  /** Show the closed column. */
  defaultShowClosed?: boolean;
  /** Open a Paseo workspace by ID, when the host provides navigation. */
  openWorkspace?(workspaceId: string): void;
}

export function BoardScreen({
  theme,
  compact,
  hostId,
  defaultPath,
  defaultShowClosed,
  openWorkspace,
}: BoardScreenProps) {
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);
  const [boardWidth, setBoardWidth] = useState(0);
  const toast = useToast();
  const paseo = usePaseo();
  const preferences = usePreferences();
  const pollIntervalSeconds = usePollIntervalSeconds();

  const [selectedPath, setSelectedPath] = useState<string | null>(defaultPath ?? null);
  const [showClosed, setShowClosed] = useState(
    defaultShowClosed ?? (preferences.status === "ready" ? preferences.values.showClosed : true),
  );
  const [term, setTerm] = useState("");
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [activeColumn, setActiveColumn] = useState<Column>("open");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedBeadId, setSelectedBeadId] = useState<string | null>(null);
  const [touchedSelection, setTouchedSelection] = useState(false);
  const touchedClosed = useRef(false);

  useEffect(() => {
    if (touchedClosed.current || defaultShowClosed !== undefined) return;
    if (preferences.status === "ready") setShowClosed(preferences.values.showClosed);
  }, [preferences, defaultShowClosed]);

  const projectsQuery = useProjects(hostId);
  const projects = useMemo(() => projectsQuery.data?.projects ?? [], [projectsQuery.data]);

  useEffect(() => {
    if (touchedSelection) return;
    const candidates = defaultPath ? [defaultPath, ...projects.map((p) => p.path)] : projects.map((p) => p.path);
    const match = candidates.find((candidate) => candidate && projects.some((p) => p.path === candidate));
    const next = match ?? candidates[0] ?? null;
    if (next && next !== selectedPath) setSelectedPath(next);
  }, [defaultPath, projects, selectedPath, touchedSelection]);

  const boardQuery = useBoard(hostId, selectedPath, { includeClosed: showClosed, pollIntervalSeconds });
  const board = boardQuery.data ?? null;
  const project: ProjectSummary | null = useMemo(
    () => projects.find((entry) => entry.path === board?.path) ?? null,
    [projects, board?.path],
  );

  const actions = useBeadActions(selectedPath);
  const detailQuery = useBeadDetail(selectedPath, selectedBeadId);
  const detail = detailQuery.data ?? null;

  const workspacesQuery = useQuery({
    queryKey: ["beads", "workspaces", hostId, selectedPath],
    queryFn: () => paseo.workspaces.list(),
    enabled: Boolean(selectedPath && selectedBeadId),
    staleTime: 60_000,
  });
  const matchingWorkspace = useMemo(() => {
    const entries = workspacesQuery.data?.entries ?? [];
    if (!selectedPath) return null;
    return (
      entries.find((entry) => entry.projectRootPath === selectedPath) ??
      entries.find((entry) => entry.workspaceDirectory === selectedPath) ??
      null
    );
  }, [workspacesQuery.data, selectedPath]);

  const columns = useMemo(
    () => groupByColumn(filterBeads(board?.beads ?? [], { term, onlyBlocked })),
    [board?.beads, term, onlyBlocked],
  );
  const visibleColumns = visibleColumnsForBoard(COLUMN_ORDER, showClosed, columns.in_review.length);
  const columnWidth = columnWidthForBoard(boardWidth, visibleColumns.length);
  const displayedColumn = visibleColumns.includes(activeColumn) ? activeColumn : "open";

  const warnings = useMemo(
    () => (detail ? closeWarnings(detail.bead, board?.beads ?? []) : []),
    [detail, board?.beads],
  );

  async function copyId(bead: Bead) {
    try {
      await copyText(bead.id);
      toast.show(`Copied ${bead.id}`, { variant: "success" });
    } catch {
      toast.error("Could not copy the bead ID.");
    }
  }

  function run(action: Promise<unknown>, successMessage: string) {
    void action
      .then(() => toast.show(successMessage, { variant: "success" }))
      .catch((error: unknown) => toast.error(describeError(error)));
  }

  function moveBead(status: string, reason: string, force: boolean) {
    if (!selectedPath || !selectedBeadId) return;
    const args: Parameters<typeof actions.updateBead.mutateAsync>[0] = {
      path: selectedPath,
      id: selectedBeadId,
      status,
      reason: reason.trim() || undefined,
      force: force || undefined,
    };
    run(actions.updateBead.mutateAsync(args), `${selectedBeadId} ${force ? "force closed" : "updated"}`);
  }

  function saveBead(fields: {
    title?: string;
    description?: string;
    notes?: string;
    assignee?: string;
    priority?: number;
  }) {
    if (!selectedPath || !selectedBeadId) return;
    run(
      actions.updateBead.mutateAsync({ path: selectedPath, id: selectedBeadId, ...fields }),
      `${selectedBeadId} saved`,
    );
  }

  function createBead(input: CreateBeadInput) {
    if (!input.path) return;
    const projectName = projects.find((project) => project.path === input.path)?.name;
    run(
      actions.createBead
        .mutateAsync(input)
        .then((result) => {
          setCreateOpen(false);
          return result;
        }),
      projectName && projectName !== project?.name ? `Created ${input.title} in ${projectName}` : `Created ${input.title}`,
    );
  }

  const busy = actions.updateBead.isPending || actions.createBead.isPending || actions.commentOnBead.isPending;

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose beads project"
          onPress={() => setPickerOpen(true)}
          style={styles.projectButton}
        >
          <Icon name="FolderKanban" size={16} color={theme.colors.foreground} />
          <Text style={styles.projectName} numberOfLines={1}>
            {project?.name ?? board?.name ?? (projectsQuery.isLoading ? "Loading projects…" : "No project")}
          </Text>
          {project?.prefix ? <Text style={styles.prefix}>{project.prefix}</Text> : null}
          <Icon name="ChevronDown" size={14} color={theme.colors.foregroundMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh board"
          onPress={() => {
            void boardQuery.refetch();
            void projectsQuery.refetch();
          }}
          style={styles.iconButton}
        >
          <Icon name="RefreshCw" size={16} color={theme.colors.foreground} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create bead"
          disabled={!selectedPath}
          onPress={() => setCreateOpen(true)}
          style={[styles.iconButton, selectedPath ? null : styles.disabled]}
        >
          <Icon name="Plus" size={18} color={theme.colors.foreground} />
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder="Filter by ID, title, assignee, label"
          placeholderTextColor={theme.colors.foregroundMuted}
          style={[styles.search, compact ? styles.flex : styles.searchWide]}
        />
        <FilterChip
          label="Blocked"
          active={onlyBlocked}
          theme={theme}
          onPress={() => setOnlyBlocked((value: boolean) => !value)}
        />
        <FilterChip
          label="Closed"
          active={showClosed}
          theme={theme}
          onPress={() => {
            touchedClosed.current = true;
            setShowClosed((value: boolean) => !value);
          }}
        />
      </View>

      {board ? (
        <View style={styles.summary}>
          {visibleColumns.map((column) => (
            <View key={column} style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{columns[column].length}</Text>
              <Text style={styles.summaryLabel}>{COLUMN_TITLES[column]}</Text>
            </View>
          ))}
          {board.counts.blocked > 0 ? (
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.colors.statusWarning }]}>
                {board.counts.blocked}
              </Text>
              <Text style={styles.summaryLabel}>Blocked</Text>
            </View>
          ) : null}
          {board.truncated ? <Text style={styles.warning}>Large database: showing the first 5000 beads.</Text> : null}
        </View>
      ) : null}

      {projectsQuery.isError ? (
        <Text style={styles.error}>Could not list projects: {errorText(projectsQuery.error)}</Text>
      ) : null}

      {selectedPath && boardQuery.isError ? (
        <Text style={styles.error}>Could not load board: {errorText(boardQuery.error)}</Text>
      ) : null}

      {!selectedPath && !projectsQuery.isLoading ? (
        <Text style={styles.empty}>
          No beads projects on this host yet. Open a Paseo project that contains a `.beads` directory, or add a path in
          Settings → Plugins → Beads board.
        </Text>
      ) : null}

      {compact ? (
        <View style={styles.tabs}>
          {visibleColumns.map((column) => (
            <Pressable
              key={column}
              accessibilityRole="button"
              accessibilityLabel={`Show ${COLUMN_TITLES[column]}`}
              onPress={() => setActiveColumn(column)}
              style={[styles.tab, displayedColumn === column ? styles.tabActive : null]}
            >
              <Text style={displayedColumn === column ? styles.tabActiveText : styles.tabText}>
                {COLUMN_TITLES[column]} ({columns[column].length})
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View
        style={styles.board}
        onLayout={(event) => setBoardWidth(event.nativeEvent.layout.width)}
      >
        {board ? (
          compact ? (
            <ColumnView
              column={displayedColumn}
              beads={columns[displayedColumn]}
              theme={theme}
              compact
              onSelectBead={(bead) => setSelectedBeadId(bead.id)}
              onCopyId={(bead) => void copyId(bead)}
            />
          ) : (
            <ScrollView
              horizontal
              style={styles.boardScroll}
              contentContainerStyle={styles.boardColumns}
            >
              {visibleColumns.map((column) => (
                <ColumnView
                  key={column}
                  column={column}
                  beads={columns[column]}
                  theme={theme}
                  compact={false}
                  width={columnWidth}
                  onSelectBead={(bead) => setSelectedBeadId(bead.id)}
                  onCopyId={(bead) => void copyId(bead)}
                />
              ))}
            </ScrollView>
          )
        ) : null}
      </View>

      {pickerOpen ? (
        <ProjectPicker
          projects={projects}
          selectedPath={selectedPath}
          theme={theme}
          compact={compact}
          onClose={() => setPickerOpen(false)}
          onSelect={(path) => {
            setSelectedPath(path);
            setTouchedSelection(true);
            setPickerOpen(false);
            setSelectedBeadId(null);
          }}
        />
      ) : null}

      {createOpen ? (
        <CreateBead
          theme={theme}
          compact={compact}
          busy={busy}
          projects={projects}
          defaultPath={selectedPath}
          onClose={() => setCreateOpen(false)}
          onCreate={createBead}
        />
      ) : null}

      {selectedBeadId && detail ? (
        <BeadDetail
          bead={detail.bead}
          statuses={board?.statuses ?? []}
          theme={theme}
          compact={compact}
          busy={busy}
          closeWarnings={warnings}
          description={detail.description}
          design={detail.design}
          notes={detail.notes}
          comments={detail.comments}
          onClose={() => setSelectedBeadId(null)}
          onMove={moveBead}
          onSave={saveBead}
          onComment={(text) => {
            if (!selectedPath) return;
            run(actions.commentOnBead.mutateAsync({ id: selectedBeadId, text }), "Comment added");
          }}
          openInPaseo={
            matchingWorkspace && openWorkspace ? () => openWorkspace(matchingWorkspace.id) : undefined
          }
        />
      ) : null}

      {selectedBeadId && detailQuery.isError ? (
        <Text style={styles.error}>{errorText(detailQuery.error)}</Text>
      ) : null}
    </View>
  );
}

function FilterChip({
  label,
  active,
  theme,
  onPress,
}: {
  label: string;
  active: boolean;
  theme: PluginTheme;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Toggle ${label} filter`}
      onPress={onPress}
      style={[
        {
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderWidth: 1,
          borderColor: active ? theme.colors.accent : theme.colors.border,
          backgroundColor: active ? theme.colors.accent : "transparent",
        },
      ]}
    >
      <Text style={{ color: active ? theme.colors.accentForeground : theme.colors.foregroundMuted, fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function errorText(error: unknown): string {
  return describeError(error);
}

/** Drop the daemon's RPC envelope so toasts show the bd message, not transport noise. */
function describeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/\s*requestType=\S+\s*code=\S+\s*$/, "")
    .replace(/^Request failed:\s*/, "")
    .trim();
}

function createStyles(theme: PluginTheme, compact: boolean) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.surface0,
      padding: compact ? 12 : 16,
      gap: 10,
    },
    toolbar: { flexDirection: "row", alignItems: "center", gap: 8 },
    projectButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.surface1,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    projectName: { color: theme.colors.foreground, fontSize: 14, fontWeight: "600", flexShrink: 1 },
    prefix: { color: theme.colors.foregroundMuted, fontSize: 11 },
    iconButton: {
      backgroundColor: theme.colors.surface1,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 8,
    },
    disabled: { opacity: 0.4 },
    filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    search: {
      backgroundColor: theme.colors.surface2,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 10,
      color: theme.colors.foreground,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 13,
    },
    searchWide: { flex: 1 },
    flex: { flex: 1 },
    summary: { flexDirection: "row", alignItems: "center", gap: 16, flexWrap: "wrap" },
    summaryItem: { flexDirection: "row", alignItems: "baseline", gap: 4 },
    summaryValue: { color: theme.colors.foreground, fontSize: 15, fontWeight: "700" },
    summaryLabel: { color: theme.colors.foregroundMuted, fontSize: 11 },
    tabs: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    tab: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tabActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
    tabText: { color: theme.colors.foregroundMuted, fontSize: 12 },
    tabActiveText: { color: theme.colors.accentForeground, fontSize: 12, fontWeight: "600" },
    board: { flex: 1, flexDirection: "row", minWidth: 0, minHeight: 0 },
    boardScroll: { flex: 1, minWidth: 0, minHeight: 0 },
    boardColumns: { flexDirection: "row", gap: COLUMN_GAP, flexGrow: 1 },
    error: { color: theme.colors.statusDanger, fontSize: 12 },
    warning: { color: theme.colors.statusWarning, fontSize: 11 },
    empty: { color: theme.colors.foregroundMuted, fontSize: 12, padding: 8 },
  });
}
