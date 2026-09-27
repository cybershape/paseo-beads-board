import type { PluginClientContext } from "@getpaseo/plugin/client";
import { beadsAttachmentSource } from "./shared/attachments";
import { BeadsSurface, BeadsWorkspacePanel } from "./client/Boards";
import { BeadsSettings } from "./client/BeadsSettings";

export default function contribute(client: PluginClientContext) {
  client.addSurface("beads-board", BeadsSurface);
  client.addSidebarItem({
    id: "beads-board",
    title: "Beads board",
    icon: "Kanban",
    surface: "beads-board",
  });

  client.addWorkspacePanel({
    id: "beads-board-panel",
    title: "Beads",
    icon: "Kanban",
    context: "workspace",
    locations: ["workspace", "explorer"],
    Component: BeadsWorkspacePanel,
  });

  client.addSettingsScreen({
    id: "beads-board-settings",
    title: "Beads board",
    icon: "Kanban",
    Component: BeadsSettings,
  });

  client.addCommandCenterItem({
    id: "open-beads-board",
    title: "Open beads board",
    icon: "Kanban",
    keywords: ["bd", "beads", "issues", "kanban"],
    context: "global",
    onSelect({ openSurface }) {
      openSurface("beads-board");
    },
  });

  client.addCommandCenterItem({
    id: "open-beads-panel",
    title: "Open beads for this workspace",
    icon: "Kanban",
    keywords: ["bd", "beads", "issues"],
    context: "workspace",
    onSelect({ openPanel }) {
      openPanel("beads-board-panel");
    },
  });

  client.addSlashCommand({
    name: "beads",
    description: "Open the beads board for this workspace",
    argumentHint: "",
    context: "workspace",
    onSubmit({ openPanel }) {
      openPanel("beads-board-panel");
    },
  });

  client.addAttachmentSource(beadsAttachmentSource);

  return () => {};
}
