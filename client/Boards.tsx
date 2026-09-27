import type { PluginSurfaceProps, PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { useWorkspace } from "@getpaseo/plugin/client";
import { useMemo } from "react";
import { BoardScreen } from "./board/BoardScreen";

export function BeadsSurface({ theme, layout, host, navigation }: PluginSurfaceProps) {
  return (
    <BoardScreen
      theme={theme}
      compact={layout.compact}
      hostId={host.id}
      openWorkspace={navigation ? (workspaceId) => navigation.openWorkspace({ workspaceId }) : undefined}
    />
  );
}

export function BeadsWorkspacePanel({ theme, layout, host, workspaceId, navigation }: PluginWorkspacePanelProps) {
  const projectRootPath = useWorkspace(workspaceId, (workspace) => workspace.projectRootPath);
  const openWorkspace = useMemo(
    () => (navigation ? (id: string) => navigation.openWorkspace({ workspaceId: id }) : undefined),
    [navigation],
  );

  return (
    <BoardScreen
      theme={theme}
      compact={layout.compact}
      hostId={host.id}
      defaultPath={projectRootPath ?? undefined}
      openWorkspace={openWorkspace}
    />
  );
}
