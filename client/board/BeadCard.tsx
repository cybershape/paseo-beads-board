import { Icon } from "@getpaseo/plugin/client/react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import type { Bead } from "../../shared/beads";

const PRIORITY_COLORS: Record<string, string> = {
  "0": "#ef4444",
  "1": "#f97316",
  "2": "#eab308",
  "3": "#3b82f6",
  "4": "#64748b",
};

export interface BeadCardProps {
  bead: Bead;
  theme: PluginTheme;
  compact: boolean;
  onPress(): void;
  onCopyId(): void;
}

export function BeadCard({ bead, theme, compact, onPress, onCopyId }: BeadCardProps) {
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);
  const [showHint, setShowHint] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = bead.childIds.length > 0 ? bead.closedChildCount / bead.childIds.length : 0;
  const priorityColor = PRIORITY_COLORS[String(bead.priority)] ?? PRIORITY_COLORS["2"];

  useEffect(() => {
    return () => {
      if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
    };
  }, []);

  function hoverIn() {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
    if (!bead.blocked) return;
    hoverTimer.current = setTimeout(() => {
      hoverTimer.current = null;
      setShowHint(true);
    }, 200);
  }

  function hoverOut() {
    if (hoverTimer.current !== null) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setShowHint(false);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${bead.id}: ${bead.title}`}
      onPress={onPress}
      onHoverIn={hoverIn}
      onHoverOut={hoverOut}
      style={({ pressed }) => [
        styles.card,
        pressed ? styles.cardPressed : null,
        showHint ? styles.cardRaised : null,
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.priority, { backgroundColor: priorityColor }]}>
          <Text style={styles.priorityText}>P{bead.priority}</Text>
        </View>
        <Text style={styles.id} numberOfLines={1}>
          {bead.id}
        </Text>
        {bead.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{bead.badge}</Text>
          </View>
        ) : null}
        {bead.blocked ? <Icon name="Ban" size={14} color={theme.colors.statusWarning} /> : null}
        <View style={styles.spacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Copy ${bead.id}`}
          hitSlop={8}
          onPress={onCopyId}
          style={styles.iconButton}
        >
          <Icon name="Copy" size={14} color={theme.colors.foregroundMuted} />
        </Pressable>
      </View>

      <Text style={styles.title} numberOfLines={3} selectable>
        {bead.title}
      </Text>

      {bead.childIds.length > 0 ? (
        <View style={styles.epicRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { flex: Math.max(progress, 0.02) }]} />
            <View style={{ flex: Math.max(1 - progress, 0) }} />
          </View>
          <Text style={styles.epicText}>
            {bead.closedChildCount}/{bead.childIds.length}
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        {bead.labels.slice(0, 2).map((label) => (
          <View key={label} style={styles.label}>
            <Text style={styles.labelText}>{label}</Text>
          </View>
        ))}
        <View style={styles.spacer} />
        {bead.issueType !== "task" ? <Text style={styles.meta}>{bead.issueType}</Text> : null}
        {bead.commentCount > 0 ? (
          <View style={styles.metaRow}>
            <Icon name="MessageSquare" size={12} color={theme.colors.foregroundMuted} />
            <Text style={styles.meta}>{bead.commentCount}</Text>
          </View>
        ) : null}
        {bead.assignee ? (
          <View style={styles.metaRow}>
            <Icon name="User" size={12} color={theme.colors.foregroundMuted} />
            <Text style={styles.meta} numberOfLines={1}>
              {bead.assignee}
            </Text>
          </View>
        ) : null}
      </View>
      {showHint ? <BlockedHint bead={bead} styles={styles} /> : null}
    </Pressable>
  );
}

type Styles = ReturnType<typeof createStyles>;

function BlockedHint({ bead, styles }: { bead: Bead; styles: Styles }) {
  const lines =
    bead.blockedBy.length > 0 ? [`Blocked by ${bead.blockedBy.join(", ")}`] : ["Blocked"];
  if (bead.blocks.length > 0) lines.push(`Blocks ${bead.blocks.join(", ")}`);
  return (
    <View style={styles.tooltip} pointerEvents="none">
      {lines.map((line) => (
        <Text key={line} style={styles.tooltipText}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function createStyles(theme: PluginTheme, compact: boolean) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface1,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: compact ? 10 : 12,
      gap: 6,
    },
    cardPressed: { opacity: 0.7 },
    cardRaised: { zIndex: 2 },
    tooltip: {
      position: "absolute",
      top: compact ? 28 : 30,
      left: compact ? 8 : 10,
      right: compact ? 8 : 10,
      zIndex: 3,
      gap: 2,
      backgroundColor: theme.colors.surface0,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    tooltipText: { color: theme.colors.foreground, fontSize: 11 },
    header: { flexDirection: "row", alignItems: "center", gap: 6 },
    spacer: { flex: 1 },
    priority: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
    priorityText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
    id: { color: theme.colors.foregroundMuted, fontSize: 11 },
    badge: {
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
      backgroundColor: theme.colors.surface2,
    },
    badgeText: { color: theme.colors.foregroundMuted, fontSize: 10 },
    iconButton: { padding: 2 },
    title: { color: theme.colors.foreground, fontSize: 13, fontWeight: "500" },
    epicRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    progressTrack: {
      flex: 1,
      flexDirection: "row",
      height: 4,
      borderRadius: 2,
      overflow: "hidden",
      backgroundColor: theme.colors.surface2,
    },
    progressFill: { backgroundColor: theme.colors.statusSuccess },
    epicText: { color: theme.colors.foregroundMuted, fontSize: 10 },
    footer: { flexDirection: "row", alignItems: "center", gap: 6 },
    label: {
      backgroundColor: theme.colors.surface2,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    labelText: { color: theme.colors.foregroundMuted, fontSize: 10 },
    meta: { color: theme.colors.foregroundMuted, fontSize: 10 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  });
}

export type { Styles };
