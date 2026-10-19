import { Icon, Modal, ScrollView, copyText, useToast } from "@getpaseo/plugin/client/react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View, StyleSheet } from "react-native";
import {
  COLUMN_TITLES,
  COLUMNS,
  statusNameForColumn,
  type Bead,
  type StatusInfo,
} from "../../shared/beads";
import { formatCreatedAt } from "./time";
import { useFontScale, type FontScale } from "../hooks";

const PRIORITY_OPTIONS = [0, 1, 2, 3, 4] as const;

export interface BeadDetailProps {
  bead: Bead;
  statuses: StatusInfo[];
  theme: PluginTheme;
  compact: boolean;
  busy: boolean;
  onClose(): void;
  onMove(status: string, reason: string, force: boolean): void;
  /** Constraints beads will refuse the close on, shown in the confirmation. */
  closeWarnings: string[];
  onSave(fields: { title?: string; description?: string; notes?: string; assignee?: string; priority?: number }): void;
  onLabels(change: { add: string[]; remove: string[] }): void;
  onOpen(id: string): void;
  onComment(text: string): void;
  description: string | null;
  design: string | null;
  notes: string | null;
  comments: { id: string; author: string; text: string; createdAt: string | null }[];
  openInPaseo?(): void;
}

export function BeadDetail(props: BeadDetailProps) {
  const { bead, statuses, theme, compact, busy, onClose, onMove, onSave, onLabels, onOpen, onComment, openInPaseo } =
    props;
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const fontScale = useFontScale();
  const styles = useMemo(() => createStyles(theme, compact, fontScale), [theme, compact, fontScale]);
  const toast = useToast();
  const [title, setTitle] = useState(bead.title);
  const [description, setDescription] = useState(props.description ?? "");
  const [notes, setNotes] = useState(props.notes ?? "");
  const [assignee, setAssignee] = useState(bead.assignee ?? "");
  const [priority, setPriority] = useState(Math.min(4, Math.max(0, bead.priority)));
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [labelDraft, setLabelDraft] = useState("");
  const [addingLabel, setAddingLabel] = useState(false);
  const created = formatCreatedAt(bead.createdAt);
  const locked = bead.column === "closed";

  async function copyId() {
    try {
      await copyText(bead.id);
      toast.show(`Copied ${bead.id}`, { variant: "success" });
    } catch {
      toast.error("Could not copy the bead ID.");
    }
  }

  function save() {
    if (locked) return;
    onSave({
      title: title.trim() || bead.title,
      description,
      notes,
      assignee: assignee.trim(),
      priority,
    });
  }

  function requestClose() {
    if (props.closeWarnings.length > 0) {
      setConfirmClose(true);
      return;
    }
    onMove("closed", reason.trim(), false);
  }

  function addLabels() {
    const existing = new Set(bead.labels);
    const add = [
      ...new Set(
        labelDraft
          .split(",")
          .map((label) => label.trim())
          .filter((label) => label.length > 0 && !existing.has(label)),
      ),
    ];
    if (add.length === 0) return;
    onLabels({ add, remove: [] });
    setLabelDraft("");
    setAddingLabel(false);
  }

  function submitComment() {
    const text = comment.trim();
    if (!text) return;
    onComment(text);
    setComment("");
  }

  return (
    <Modal
      title={`${bead.id}`}
      icon={<Icon name="CircleDot" size={18} color={theme.colors.foreground} />}
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Content scrollable style={styles.body}>
        <View style={styles.row}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{bead.status}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>P{bead.priority}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{bead.issueType}</Text>
          </View>
          {bead.badge ? (
            <View style={[styles.chip, styles.warningChip]}>
              <Text style={styles.chipText}>{bead.badge}</Text>
            </View>
          ) : null}
          {bead.assignee ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{bead.assignee}</Text>
            </View>
          ) : null}
          {created ? <Text style={styles.muted}>{created}</Text> : null}
          <View style={styles.spacer} />
          <Pressable accessibilityRole="button" accessibilityLabel="Copy bead ID" onPress={() => void copyId()}>
            <Icon name="Copy" size={16} color={theme.colors.foregroundMuted} />
          </Pressable>
        </View>

        {bead.blocked || bead.blockedBy.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.label}>Blocked by</Text>
            {bead.blockedBy.length === 0 ? <Text style={styles.muted}>Blocked</Text> : null}
            {bead.blockedBy.map((id) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${id}`}
                onPress={() => onOpen(id)}
                style={styles.relation}
              >
                <Text style={styles.link}>{id}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Labels</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add label"
              disabled={busy}
              hitSlop={6}
              onPress={() => setAddingLabel(true)}
            >
              <Icon name="Plus" size={14} color={theme.colors.foregroundMuted} />
            </Pressable>
          </View>
          {bead.labels.length === 0 && !addingLabel ? <Text style={styles.muted}>No labels yet.</Text> : null}
          <View style={styles.wrapRow}>
            {bead.labels.map((label) => (
              <View key={label} style={styles.chip}>
                <Text style={styles.chipText}>{label}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove label ${label}`}
                  disabled={busy}
                  hitSlop={6}
                  onPress={() => onLabels({ add: [], remove: [label] })}
                >
                  <Text style={styles.chipRemove}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
          {addingLabel ? (
            <View style={styles.sectionRow}>
              <TextInput
                value={labelDraft}
                onChangeText={setLabelDraft}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={addLabels}
                placeholder="Add label"
                placeholderTextColor={theme.colors.foregroundMuted}
                style={[styles.input, styles.flex]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save label"
                disabled={busy || labelDraft.trim().length === 0}
                onPress={addLabels}
                style={[styles.secondary, styles.labelAdd, busy ? styles.disabled : null]}
              >
                <Text style={styles.secondaryText}>Add</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Move to</Text>
          <View style={styles.wrapRow}>
            {COLUMNS.map((column) => {
              const statusName = statusNameForColumn(column, statuses);
              const active = bead.column === column;
              return (
                <Pressable
                  key={column}
                  accessibilityRole="button"
                  accessibilityLabel={`Move to ${COLUMN_TITLES[column]}`}
                  disabled={active || !statusName || busy}
                  onPress={() =>
                    column === "closed" ? setClosing(true) : onMove(statusName ?? column, reason.trim(), false)
                  }
                  style={[styles.action, active ? styles.actionActive : null, busy ? styles.disabled : null]}
                >
                  <Text style={active ? styles.actionActiveText : styles.actionText}>
                    {COLUMN_TITLES[column]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {closing && bead.column !== "closed" ? (
            <>
              <TextInput
                value={reason}
                onChangeText={setReason}
                autoFocus
                placeholder="Close reason (optional)"
                placeholderTextColor={theme.colors.foregroundMuted}
                style={styles.input}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close bead"
                disabled={busy}
                onPress={requestClose}
                style={[styles.close, busy ? styles.disabled : null]}
              >
                <Text style={styles.primaryText}>Close</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            editable={!locked}
            style={[styles.input, locked ? styles.disabled : null]}
            placeholder="Title"
            placeholderTextColor={theme.colors.foregroundMuted}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            editable={!locked}
            style={[styles.input, styles.multiline, locked ? styles.disabled : null]}
            multiline
            placeholder="What needs to happen?"
            placeholderTextColor={theme.colors.foregroundMuted}
          />
        </View>

        <View style={styles.sectionRow}>
          <View style={[styles.section, styles.flex]}>
            <Text style={styles.label}>Priority</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Priority P${priority}`}
              disabled={locked || busy}
              onPress={() => {
                if (!locked) setPriorityOpen(true);
              }}
              style={[styles.input, styles.dropdown, busy ? styles.disabled : null]}
            >
              <Text style={styles.dropdownText}>P{priority}</Text>
              <Icon name="ChevronDown" size={14} color={theme.colors.foregroundMuted} />
            </Pressable>
          </View>
          <View style={[styles.section, styles.flex]}>
            <Text style={styles.label}>Assignee</Text>
            <TextInput
              value={assignee}
              onChangeText={setAssignee}
              editable={!locked}
              autoCapitalize="none"
              style={[styles.input, locked ? styles.disabled : null]}
              placeholder="unassigned"
              placeholderTextColor={theme.colors.foregroundMuted}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save bead"
          disabled={locked || busy}
          onPress={save}
          style={[styles.primary, locked || busy ? styles.disabled : null]}
        >
          <Text style={styles.primaryText}>Save changes</Text>
        </Pressable>

        {props.design ? (
          <View style={styles.section}>
            <Text style={styles.label}>Design</Text>
            <Text style={styles.text} selectable>
              {props.design}
            </Text>
          </View>
        ) : null}

        {bead.parentId || bead.blocks.length > 0 || bead.childIds.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.label}>Relations</Text>
            {bead.parentId ? <RelationRow label="Parent" value={bead.parentId} theme={theme} styles={styles} /> : null}
            {bead.childIds.map((id) => (
              <RelationRow key={`child-${id}`} label="Child" value={id} theme={theme} styles={styles} />
            ))}
            {bead.blocks.map((id) => (
              <RelationRow key={`blocks-${id}`} label="Blocks" value={id} theme={theme} styles={styles} />
            ))}
          </View>
        ) : null}

        {notes ? (
          <View style={styles.section}>
            <Text style={styles.label}>Notes</Text>
            <Text style={styles.text} selectable>
              {notes}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.label}>Comments ({bead.commentCount})</Text>
          {props.comments.length === 0 ? (
            <Text style={styles.muted}>No comments yet.</Text>
          ) : null}
          {props.comments.map((entry) => (
            <View key={entry.id} style={styles.comment}>
              <Text style={styles.commentMeta}>
                {entry.author}
                {entry.createdAt ? ` · ${entry.createdAt.slice(0, 10)}` : ""}
              </Text>
              <Text style={styles.text} selectable>
                {entry.text}
              </Text>
            </View>
          ))}
          <TextInput
            value={comment}
            onChangeText={setComment}
            style={styles.input}
            placeholder="Add a comment"
            placeholderTextColor={theme.colors.foregroundMuted}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add comment"
            disabled={busy || comment.trim().length === 0}
            onPress={submitComment}
            style={[styles.secondary, busy ? styles.disabled : null]}
          >
            <Text style={styles.secondaryText}>Comment</Text>
          </Pressable>
        </View>

        {openInPaseo ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Open workspace in Paseo" onPress={openInPaseo}>
            <Text style={styles.link}>Open project in Paseo</Text>
          </Pressable>
        ) : null}
      </Modal.Content>

      <Modal
        title="Priority"
        icon={<Icon name="ChevronDown" size={18} color={theme.colors.foreground} />}
        open={priorityOpen}
        onOpenChange={setPriorityOpen}
      >
        <Modal.Content style={styles.confirmBody}>
          {PRIORITY_OPTIONS.map((option) => {
            const active = option === priority;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`Set priority P${option}`}
                onPress={() => {
                  setPriority(option);
                  setPriorityOpen(false);
                }}
                style={[styles.priorityOption, active ? styles.actionActive : null]}
              >
                <Text style={active ? styles.actionActiveText : styles.actionText}>P{option}</Text>
              </Pressable>
            );
          })}
        </Modal.Content>
      </Modal>

      <Modal
        title="Close anyway?"
        icon={<Icon name="ShieldAlert" size={18} color={theme.colors.statusWarning} />}
        open={confirmClose}
        onOpenChange={setConfirmClose}
      >
        <Modal.Content style={styles.confirmBody}>
          <Text style={styles.text}>
            {bead.id} has constraints that normally block a close. Closing it runs `br close --force`.
          </Text>
          <ScrollView style={styles.confirmList} contentContainerStyle={styles.confirmListContent}>
            {props.closeWarnings.map((warning) => (
              <View key={warning} style={styles.warningRow}>
                <Icon name="AlertTriangle" size={14} color={theme.colors.statusWarning} />
                <Text style={styles.warningText}>{warning}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.confirmActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Keep bead open"
              onPress={() => setConfirmClose(false)}
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>Keep open</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close anyway"
              disabled={busy}
              onPress={() => {
                setConfirmClose(false);
                onMove("closed", reason.trim(), true);
              }}
              style={[styles.danger, busy ? styles.disabled : null]}
            >
              <Text style={styles.primaryText}>Close anyway</Text>
            </Pressable>
          </View>
        </Modal.Content>
      </Modal>
    </Modal>
  );
}

type Styles = ReturnType<typeof createStyles>;

function RelationRow({
  label,
  value,
  theme,
  styles,
}: {
  label: string;
  value: string;
  theme: PluginTheme;
  styles: Styles;
}) {
  return (
    <View style={styles.relation}>
      <Text style={styles.relationLabel}>{label}</Text>
      <Text style={styles.relationValue} selectable>
        {value}
      </Text>
      <View style={styles.spacer} />
      <Icon name="CornerDownRight" size={12} color={theme.colors.foregroundMuted} />
    </View>
  );
}

function createStyles(theme: PluginTheme, compact: boolean, fontScale: FontScale) {
  return StyleSheet.create({
    body: { backgroundColor: theme.colors.surface0, gap: 14 },
    text: { color: theme.colors.foreground, fontSize: fontScale.body },
    row: { flexDirection: "row", alignItems: "center", gap: 6 },
    wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    spacer: { flex: 1 },
    section: { gap: 6 },
    sectionRow: { flexDirection: "row", gap: 10 },
    flex: { flex: 1 },
    label: { color: theme.colors.foregroundMuted, fontSize: fontScale.caption, textTransform: "uppercase" },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.colors.surface2,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    chipRemove: { color: theme.colors.foregroundMuted, fontSize: fontScale.title, lineHeight: fontScale.title + 2 },
    labelAdd: { paddingHorizontal: 14 },
    warningChip: { backgroundColor: theme.colors.statusWarning },
    chipText: { color: theme.colors.foreground, fontSize: fontScale.caption },
    action: {
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    actionActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
    actionText: { color: theme.colors.foreground, fontSize: fontScale.secondary },
    actionActiveText: { color: theme.colors.accentForeground, fontSize: fontScale.secondary, fontWeight: "600" },
    disabled: { opacity: 0.5 },
    input: {
      backgroundColor: theme.colors.surface2,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 8,
      color: theme.colors.foreground,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: fontScale.body,
    },
    dropdown: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    dropdownText: { color: theme.colors.foreground, fontSize: fontScale.body },
    priorityOption: {
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    multiline: { minHeight: compact ? 88 : 120, textAlignVertical: "top" },
    primary: {
      backgroundColor: theme.colors.accent,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: "center",
    },
    primaryText: { color: theme.colors.accentForeground, fontWeight: "600", fontSize: fontScale.body },
    secondary: {
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: "center",
    },
    secondaryText: { color: theme.colors.foreground, fontSize: fontScale.body },
    muted: { color: theme.colors.foregroundMuted, fontSize: fontScale.secondary },
    relation: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.surface1,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    relationLabel: { color: theme.colors.foregroundMuted, fontSize: fontScale.caption },
    relationValue: { color: theme.colors.foreground, fontSize: fontScale.secondary },
    comment: { gap: 2 },
    commentMeta: { color: theme.colors.foregroundMuted, fontSize: fontScale.caption },
    link: { color: theme.colors.accent, fontSize: fontScale.body },
    confirmBody: { backgroundColor: theme.colors.surface0, gap: 12 },
    confirmList: { maxHeight: 200 },
    confirmListContent: { gap: 8 },
    warningRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
    warningText: { color: theme.colors.foreground, fontSize: fontScale.secondary, flexShrink: 1 },
    confirmActions: { flexDirection: "row", gap: 10 },
    close: { backgroundColor: theme.colors.statusDanger, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
    danger: { flex: 1, backgroundColor: theme.colors.statusDanger, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  });
}
