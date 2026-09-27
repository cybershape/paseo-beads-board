import { Icon, Modal } from "@getpaseo/plugin/client/react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import { useMemo } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { ScrollView } from "@getpaseo/plugin/client/react-native";
import type { ProjectSummary } from "../../shared/beads";

export interface ProjectPickerProps {
  projects: ProjectSummary[];
  selectedPath: string | null;
  theme: PluginTheme;
  compact: boolean;
  onSelect(path: string): void;
  onClose(): void;
}

export function ProjectPicker({ projects, selectedPath, theme, compact, onSelect, onClose }: ProjectPickerProps) {
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);

  return (
    <Modal
      title="Beads projects"
      icon={<Icon name="FolderKanban" size={18} color={theme.colors.foreground} />}
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Content scrollable={false} style={styles.body} contentContainerStyle={styles.content}>
        {projects.length === 0 ? (
          <Text style={styles.empty}>
            No beads databases found. Add a project path in Settings → Plugins → Beads board, or run `bd init` in a
            Paseo project.
          </Text>
        ) : null}
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {projects.map((project) => (
            <Pressable
              key={project.path}
              accessibilityRole="button"
              accessibilityLabel={`Open ${project.name}`}
              onPress={() => onSelect(project.path)}
              style={({ pressed }) => [
                styles.row,
                project.path === selectedPath ? styles.rowActive : null,
                pressed ? styles.rowPressed : null,
              ]}
            >
              <View style={styles.titleRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {project.name}
                </Text>
                {project.prefix ? <Text style={styles.prefix}>{project.prefix}</Text> : null}
              </View>
              <Text style={styles.path} numberOfLines={1}>
                {project.path}
              </Text>
              {project.error ? (
                <Text style={styles.error}>{project.error}</Text>
              ) : (
                <View style={styles.counts}>
                  <Text style={styles.count}>{project.open} open</Text>
                  <Text style={styles.count}>{project.inProgress} doing</Text>
                  {project.inReview > 0 ? <Text style={styles.count}>{project.inReview} review</Text> : null}
                  {project.blocked > 0 ? (
                    <Text style={[styles.count, styles.blocked]}>{project.blocked} blocked</Text>
                  ) : null}
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </Modal.Content>
    </Modal>
  );
}

function createStyles(theme: PluginTheme, compact: boolean) {
  return StyleSheet.create({
    body: { backgroundColor: theme.colors.surface0, flex: 1, minHeight: 0 },
    content: { padding: 12, gap: 8, flex: 1, minHeight: 0 },
    list: { flex: 1, minHeight: 0 },
    listContent: { gap: 8, paddingBottom: 8 },
    row: {
      backgroundColor: theme.colors.surface1,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: compact ? 10 : 12,
      gap: 4,
    },
    rowActive: { borderColor: theme.colors.accent },
    rowPressed: { opacity: 0.75 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    name: { color: theme.colors.foreground, fontSize: 14, fontWeight: "600", flexShrink: 1 },
    prefix: { color: theme.colors.foregroundMuted, fontSize: 11 },
    path: { color: theme.colors.foregroundMuted, fontSize: 11 },
    counts: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    count: { color: theme.colors.foregroundMuted, fontSize: 11 },
    blocked: { color: theme.colors.statusWarning },
    error: { color: theme.colors.statusDanger, fontSize: 11 },
    empty: { color: theme.colors.foregroundMuted, fontSize: 12, padding: 8 },
  });
}
