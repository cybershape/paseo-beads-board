import { Icon, Modal, ScrollView } from "@getpaseo/plugin/client/react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View, StyleSheet } from "react-native";
import type { ProjectSummary } from "../../shared/beads";

const ISSUE_TYPES = ["task", "bug", "epic", "chore", "feature"];

export interface CreateBeadInput {
  path: string;
  title: string;
  description: string;
  priority: number;
  issueType: string;
  assignee: string;
  labels: string[];
  parent: string;
}

export interface CreateBeadProps {
  theme: PluginTheme;
  compact: boolean;
  busy: boolean;
  /** Beads-enabled projects the bead can be created in. */
  projects: ProjectSummary[];
  /** Project the board is showing, preselected in the dropdown. */
  defaultPath: string | null;
  onClose(): void;
  onCreate(input: CreateBeadInput): void;
}

export function CreateBead({
  theme,
  compact,
  busy,
  projects,
  defaultPath,
  onClose,
  onCreate,
}: CreateBeadProps) {
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);
  const [path, setPath] = useState<string | null>(defaultPath);
  const [projectOpen, setProjectOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("2");
  const [issueType, setIssueType] = useState("task");
  const [assignee, setAssignee] = useState("");
  const [labels, setLabels] = useState("");
  const [parent, setParent] = useState("");

  const selectedProject = projects.find((project) => project.path === path) ?? null;

  useEffect(() => {
    // Keep the selection valid when the project list loads or the board switches project.
    setPath((current) => {
      if (current && projects.some((project) => project.path === current)) return current;
      return defaultPath && projects.some((project) => project.path === defaultPath)
        ? defaultPath
        : (projects[0]?.path ?? null);
    });
  }, [projects, defaultPath]);

  const canCreate = title.trim().length > 0 && !busy && Boolean(path);

  return (
    <Modal
      title="New bead"
      icon={<Icon name="Plus" size={18} color={theme.colors.foreground} />}
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Content style={styles.body}>
        <View style={styles.projectField}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose project"
            disabled={projects.length === 0}
            onPress={() => setProjectOpen((open) => !open)}
            style={styles.projectTrigger}
          >
            <Icon name="FolderKanban" size={14} color={theme.colors.foregroundMuted} />
            <Text style={styles.projectTriggerName} numberOfLines={1}>
              {selectedProject?.name ?? (projects.length === 0 ? "No beads projects" : "Select project")}
            </Text>
            {selectedProject?.prefix ? <Text style={styles.projectPrefix}>{selectedProject.prefix}</Text> : null}
            <Icon name="ChevronDown" size={14} color={theme.colors.foregroundMuted} />
          </Pressable>
          {projectOpen ? (
            <ScrollView style={styles.projectList} contentContainerStyle={styles.projectListContent}>
              {projects.map((project) => (
                <Pressable
                  key={project.path}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${project.name}`}
                  onPress={() => {
                    setPath(project.path);
                    setProjectOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.projectOption,
                    project.path === path ? styles.projectOptionActive : null,
                    pressed ? styles.projectOptionPressed : null,
                  ]}
                >
                  <Text style={styles.projectOptionName} numberOfLines={1}>
                    {project.name}
                  </Text>
                  <Text style={styles.projectOptionPath} numberOfLines={1}>
                    {project.path}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
        <TextInput
          value={title}
          onChangeText={setTitle}
          autoFocus
          placeholder="Title"
          placeholderTextColor={theme.colors.foregroundMuted}
          style={styles.input}
        />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Description (optional)"
          placeholderTextColor={theme.colors.foregroundMuted}
          style={[styles.input, styles.multiline]}
          multiline
        />
        <View style={styles.row}>
          {ISSUE_TYPES.map((type) => (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityLabel={`Type ${type}`}
              onPress={() => setIssueType(type)}
              style={[styles.chip, issueType === type ? styles.chipActive : null]}
            >
              <Text style={issueType === type ? styles.chipActiveText : styles.chipText}>{type}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <TextInput
            value={priority}
            onChangeText={setPriority}
            keyboardType="number-pad"
            placeholder="Priority 0-4"
            placeholderTextColor={theme.colors.foregroundMuted}
            style={[styles.input, styles.flex]}
          />
          <TextInput
            value={assignee}
            onChangeText={setAssignee}
            autoCapitalize="none"
            placeholder="Assignee"
            placeholderTextColor={theme.colors.foregroundMuted}
            style={[styles.input, styles.flex]}
          />
        </View>
        <View style={styles.row}>
          <TextInput
            value={labels}
            onChangeText={setLabels}
            autoCapitalize="none"
            placeholder="Labels, comma separated"
            placeholderTextColor={theme.colors.foregroundMuted}
            style={[styles.input, styles.flex]}
          />
          <TextInput
            value={parent}
            onChangeText={setParent}
            autoCapitalize="none"
            placeholder="Parent ID"
            placeholderTextColor={theme.colors.foregroundMuted}
            style={[styles.input, styles.flex]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create bead"
          disabled={!canCreate}
          onPress={() =>
            onCreate({
              path: path as string,
              title: title.trim(),
              description,
              priority: clampPriority(priority),
              issueType,
              assignee,
              labels: labels
                .split(",")
                .map((label) => label.trim())
                .filter((label) => label.length > 0),
              parent: parent.trim(),
            })
          }
          style={[styles.primary, canCreate ? null : styles.disabled]}
        >
          <Text style={styles.primaryText}>{busy ? "Creating…" : "Create bead"}</Text>
        </Pressable>
      </Modal.Content>
    </Modal>
  );
}

function clampPriority(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 2;
  return Math.min(4, Math.max(0, parsed));
}

function createStyles(theme: PluginTheme, compact: boolean) {
  return StyleSheet.create({
    body: { backgroundColor: theme.colors.surface0, gap: 10 },
    row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    projectField: { gap: 6 },
    projectTrigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.surface2,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    projectTriggerName: { color: theme.colors.foreground, fontSize: 13, fontWeight: "600", flexShrink: 1 },
    projectPrefix: { color: theme.colors.foregroundMuted, fontSize: 11 },
    projectList: { maxHeight: 168 },
    projectListContent: { gap: 6 },
    projectOption: {
      backgroundColor: theme.colors.surface1,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 2,
    },
    projectOptionActive: { borderColor: theme.colors.accent },
    projectOptionPressed: { opacity: 0.75 },
    projectOptionName: { color: theme.colors.foreground, fontSize: 13, fontWeight: "600" },
    projectOptionPath: { color: theme.colors.foregroundMuted, fontSize: 11 },
    flex: { flex: 1, minWidth: 120 },
    input: {
      backgroundColor: theme.colors.surface2,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 8,
      color: theme.colors.foreground,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 13,
    },
    multiline: { minHeight: compact ? 72 : 96, textAlignVertical: "top" },
    chip: {
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
    chipText: { color: theme.colors.foreground, fontSize: 12 },
    chipActiveText: { color: theme.colors.accentForeground, fontSize: 12, fontWeight: "600" },
    primary: { backgroundColor: theme.colors.accent, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
    primaryText: { color: theme.colors.accentForeground, fontWeight: "600", fontSize: 13 },
    disabled: { opacity: 0.5 },
  });
}
