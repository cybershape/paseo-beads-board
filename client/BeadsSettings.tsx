import { useSettings, type PluginSurfaceProps } from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { preferences } from "../shared/settings";

const POLL_OPTIONS = [
  { label: "Off", value: "0" },
  { label: "5 seconds", value: "5" },
  { label: "20 seconds", value: "20" },
  { label: "60 seconds", value: "60" },
  { label: "5 minutes", value: "300" },
];

/** Settings → Plugins → Beads board. */
export function BeadsSettings({ theme }: PluginSurfaceProps) {
  const settings = useSettings(preferences);
  const [draftPath, setDraftPath] = useState("");

  if (settings.status !== "ready") {
    return (
      <SettingsSection title="Beads board" info="Scan this host for beads databases.">
        <SettingsCard>
          <SettingsRow
            label="Status"
            hint={settings.status === "error" ? settings.error : "Loading preferences…"}
          />
        </SettingsCard>
      </SettingsSection>
    );
  }

  const { values, revision, save, saving, saveError } = settings;

  function update(next: Partial<typeof values>) {
    void save({ ...values, ...next }, revision);
  }

  function addPath() {
    const trimmed = draftPath.trim();
    if (!trimmed || values.extraPaths.includes(trimmed)) return;
    update({ extraPaths: [...values.extraPaths, trimmed] });
    setDraftPath("");
  }

  return (
    <View style={{ gap: 4 }}>
      <SettingsSection title="Projects" info="Directories scanned for a .beads database on this host.">
        <SettingsCard>
          <SettingsRow label="Add project path" hint="Absolute path to a directory that contains .beads">
            <View style={{ gap: 8 }}>
              <TextInput
                value={draftPath}
                onChangeText={setDraftPath}
                placeholder="/home/you/code/project"
                placeholderTextColor={theme.colors.foregroundMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  color: theme.colors.foreground,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  fontSize: 13,
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add project path"
                disabled={saving}
                onPress={addPath}
                style={{
                  backgroundColor: theme.colors.accent,
                  borderRadius: 8,
                  paddingVertical: 8,
                  alignItems: "center",
                  opacity: saving ? 0.5 : 1,
                }}
              >
                <Text style={{ color: theme.colors.accentForeground, fontWeight: "600", fontSize: 13 }}>
                  Add project path
                </Text>
              </Pressable>
            </View>
          </SettingsRow>
          {values.extraPaths.map((extraPath) => (
            <SettingsAction
              key={extraPath}
              label={extraPath}
              hint="Included in every project scan"
              actionLabel="Remove"
              onPress={() => update({ extraPaths: values.extraPaths.filter((entry) => entry !== extraPath) })}
            />
          ))}
          <SettingsRow
            label="Paseo projects"
            hint="Paseo projects and workspaces are always scanned automatically."
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Board">
        <SettingsCard>
          <SettingsSelect
            label="Auto refresh"
            hint="How often the board reloads from the bd CLI"
            value={String(values.pollIntervalSeconds)}
            options={POLL_OPTIONS}
            onValueChange={(value) => update({ pollIntervalSeconds: Number.parseInt(value, 10) || 0 })}
          />
          <SettingsSwitch
            label="Show closed column"
            value={values.showClosed}
            onValueChange={(showClosed) => update({ showClosed })}
          />
        </SettingsCard>
      </SettingsSection>

      {saveError ? <SettingsAction label="Could not save" actionLabel="Retry" onPress={() => update({})} /> : null}
    </View>
  );
}
