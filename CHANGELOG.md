# Changelog

All notable changes to this project are documented here. The version here is the plugin's release
identity: the paseo.cafe catalog uses `package.json.version` to show and track updates, so bump it
and publish to npm for every user-visible change. Releases are `0.x` (semver pre-1.0): patch
versions are safe upgrades, minor versions may still contain breaking changes.

## 0.2.0

The board now talks to [beads_rust](https://github.com/Dicklesworthstone/beads_rust) (`br`) instead of
the Go `bd` CLI. `bd`'s embedded Dolt database was too slow for the polling board.

- Every RPC shells out to `br`. The binary override is `PASEO_BEADS_BR_BIN` (default `br`).
- `br list` returns `{ issues: [...] }`, not a bare array. Parents are recovered from dotted ids
  (`br-abc.1`), and blockers come from `br blocked`. Open children no longer mark an epic blocked.
- Comments are `br comments` / `br comments add`. Assignee updates use `--assignee` (`br update` has
  no `-a`). `br` has no `statuses` command; move targets are the built-in status names, with
  `in_review` preferred.
- A project database is also recognized when `.beads/beads.db` is present.
- Board cards and the bead detail show the creation time as local `YYYY-MM-DD HH:mm:ss`.

## 0.1.1

Fix for beads-enabled projects not showing up in the project picker.

- The project list no longer times out against the daemon's 30s plugin RPC limit. Two causes: a
  bare `.beads` directory counted as a database, so every Paseo worktree adopted the
  machine-level `~/.beads` event directory as its own project; and each surviving candidate ran
  three `bd` processes in parallel against a single embedded database.
- A directory counts as a beads database only when `config.yaml`, `metadata.json`, or `issues.db`
  is present in `.beads`.
- Projects and workspaces that share a database are collapsed onto it, so each database is
  summarised once instead of once per worktree.
- Project counts now come from `bd status --json`, `bd count --json --status inreview`, and
  `bd where --json`, instead of pulling every issue and counting locally. `bd` calls within one
  project run in sequence, which is several times faster against an embedded database.

## 0.1.0

First public release. The board is feature complete and usable, and the plugin behaves as
documented — but at `0.x` a minor bump may still break something, so pin a version if that matters
to you.

- Kanban board for beads (`bd`) with Open / In Progress / In Review / Closed columns and the
  beads-web status mapping.
- Project discovery across Paseo projects, workspaces, and extra configured paths.
- Epic grouping with progress, blocked detection from open dependencies, and priority/labels.
- Mutations: create, edit, move, close, reopen, and comment, all through the `bd` CLI.
- Sidebar surface, workspace panel, host settings screen, two Command Center items, a `/beads`
  slash command, and a beads composer attachment source.
- Host-scoped preferences for extra paths, refresh interval, and the Closed column.
- Tombstone-status beads are hidden from the board, matching beads-web.
