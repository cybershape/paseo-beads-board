import type { PluginTheme } from "@getpaseo/plugin";
import { useMemo } from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { COLUMN_TITLES, type Bead, type Column } from "../../shared/beads";
import { BeadCard } from "./BeadCard";

export interface ColumnViewProps {
  column: Column;
  beads: Bead[];
  theme: PluginTheme;
  compact: boolean;
  width?: number;
  onSelectBead(bead: Bead): void;
  onCopyId(bead: Bead): void;
}

export function ColumnView({ column, beads, theme, compact, width, onSelectBead, onCopyId }: ColumnViewProps) {
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);

  return (
    <View style={[styles.column, width !== undefined ? { width } : null]}>
      <View style={styles.header}>
        <Text style={styles.title}>{COLUMN_TITLES[column]}</Text>
        <View style={styles.count}>
          <Text style={styles.countText}>{beads.length}</Text>
        </View>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {beads.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No beads</Text>
          </View>
        ) : null}
        {beads.map((bead) => (
          <BeadCard
            key={bead.id}
            bead={bead}
            theme={theme}
            compact={compact}
            onPress={() => onSelectBead(bead)}
            onCopyId={() => onCopyId(bead)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(theme: PluginTheme, compact: boolean) {
  return StyleSheet.create({
    column: { flex: compact ? 1 : undefined, flexShrink: compact ? 1 : 0, gap: 8 },
    header: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 2 },
    title: { color: theme.colors.foreground, fontSize: 13, fontWeight: "600" },
    count: {
      backgroundColor: theme.colors.surface2,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    countText: { color: theme.colors.foregroundMuted, fontSize: 11 },
    scroll: { flex: 1 },
    scrollContent: { gap: 8, paddingBottom: 24, paddingTop: 2 },
    empty: {
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 10,
      borderStyle: "dashed",
      padding: 12,
      alignItems: "center",
    },
    emptyText: { color: theme.colors.foregroundMuted, fontSize: 11 },
  });
}
