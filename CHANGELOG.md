# Changelog

All notable changes to this project are documented here. The version here is the plugin's release
identity: the paseo.cafe catalog uses `package.json.version` to show and track updates, so bump it
and publish to npm for every user-visible change.

## 1.0.0

First public release.

- Kanban board for beads (`bd`) with Open / In Progress / In Review / Closed columns and the
  beads-web status mapping.
- Project discovery across Paseo projects, workspaces, and extra configured paths.
- Epic grouping with progress, blocked detection from open dependencies, and priority/labels.
- Mutations: create, edit, move, close, reopen, and comment, all through the `bd` CLI.
- Sidebar surface, workspace panel, host settings screen, two Command Center items, a `/beads`
  slash command, and a beads composer attachment source.
- Host-scoped preferences for extra paths, refresh interval, and the Closed column.
- Tombstone-status beads are hidden from the board, matching beads-web.
