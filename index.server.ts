import type { PluginServerContext } from "@getpaseo/plugin/server";
import {
  commentOnBead,
  createBead,
  listProjects,
  loadBoard,
  searchBeads,
  showBead,
  updateBead,
} from "./shared/beads";
import { preferences } from "./shared/settings";
import {
  handleComment,
  handleCreateBead,
  handleListProjects,
  handleLoadBoard,
  handleSearchBeads,
  handleShowBead,
  handleUpdateBead,
} from "./server/handlers";

export default function contribute(server: PluginServerContext) {
  server.registerSettings(preferences);

  server.handle(listProjects, handleListProjects);
  server.handle(loadBoard, handleLoadBoard);
  server.handle(showBead, handleShowBead);
  server.handle(createBead, handleCreateBead);
  server.handle(updateBead, handleUpdateBead);
  server.handle(commentOnBead, handleComment);
  server.handle(searchBeads, handleSearchBeads);

  return () => {};
}
