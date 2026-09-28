import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "vitest";

import { findBeadsRoot, hasBeadsDatabase } from "../server/bd";
import { normalizeBoard, type RawBead } from "../server/beads";
import { columnForStatus, statusNameForColumn } from "../shared/beads";

function scratch(): string {
  return mkdtempSync(path.join(tmpdir(), "beads-board-test-"));
}

test("hasBeadsDatabase needs a real database, not just a .beads directory", () => {
  const root = scratch();
  mkdirSync(path.join(root, ".beads", "eventsData"), { recursive: true });
  writeFileSync(path.join(root, ".beads", "machine-id"), "abc");
  assert.equal(hasBeadsDatabase(root), false, "a machine-level .beads dir is not a project database");
  assert.equal(findBeadsRoot(path.join(root, "apps", "web", "src")), null, "walks past it instead of adopting it");

  writeFileSync(path.join(root, ".beads", "config.yaml"), "issue_prefix: demo\n");
  assert.equal(hasBeadsDatabase(root), true);
  assert.equal(findBeadsRoot(path.join(root, "apps", "web", "src")), root, "nested dirs resolve to the database root");
});

test("columnForStatus maps the bd status vocabulary onto board columns", () => {
  assert.deepEqual(columnForStatus("open"), { column: "open", badge: null });
  assert.deepEqual(columnForStatus("in_progress"), { column: "in_progress", badge: null });
  assert.deepEqual(columnForStatus("inreview"), { column: "in_review", badge: null });
  assert.deepEqual(columnForStatus("done"), { column: "closed", badge: null });
  assert.deepEqual(columnForStatus("blocked"), { column: "open", badge: "Blocked" });
  assert.deepEqual(columnForStatus("hooked"), { column: "in_progress", badge: "Waiting" });
});

test("columnForStatus hides tombstones and falls back to open for unknown statuses", () => {
  assert.equal(columnForStatus("tombstone"), null);
  assert.deepEqual(columnForStatus("something-new"), { column: "open", badge: null });
});

test("statusNameForColumn prefers the canonical status name a database exposes", () => {
  const statuses = [{ name: "open" }, { name: "in_progress" }, { name: "inreview" }];
  assert.equal(statusNameForColumn("open", statuses), "open");
  assert.equal(statusNameForColumn("in_progress", statuses), "in_progress");
  assert.equal(statusNameForColumn("in_review", statuses), "inreview");
  assert.equal(statusNameForColumn("closed", statuses), "closed");
  assert.equal(statusNameForColumn("open", []), null);
});

function bead(overrides: Partial<RawBead> & { id: string }): RawBead {
  return {
    title: overrides.id,
    status: "open",
    ...overrides,
  };
}

test("normalizeBoard groups children under epics and counts columns", () => {
  const board = normalizeBoard([
    bead({ id: "epic-1", issue_type: "epic" }),
    bead({
      id: "child-1",
      parent: "epic-1",
      dependencies: [{ issue_id: "child-1", depends_on_id: "epic-1", type: "parent-child" }],
    }),
    bead({
      id: "child-2",
      parent: "epic-1",
      status: "closed",
      dependencies: [{ issue_id: "child-2", depends_on_id: "epic-1", type: "parent-child" }],
    }),
    bead({ id: "solo-1", status: "in_progress" }),
  ]);

  const epic = board.beads.find((entry) => entry.id === "epic-1");
  assert.ok(epic, "epic is present");
  assert.equal(epic.isEpic, true);
  assert.deepEqual(epic.childIds, ["child-1", "child-2"]);
  assert.equal(epic.closedChildCount, 1);
  assert.equal(epic.blocked, false, "parent-child links do not block");

  const child = board.beads.find((entry) => entry.id === "child-1");
  assert.equal(child?.parentId, "epic-1");

  const solo = board.beads.find((entry) => entry.id === "solo-1");
  assert.ok(solo, "standalone bead is present");
  assert.equal(solo.column, "in_progress");
  assert.deepEqual(board.counts, {
    open: 2,
    in_progress: 1,
    in_review: 0,
    closed: 1,
    total: 4,
    blocked: 0,
  });
});

test("normalizeBoard marks a bead blocked by an open dependency", () => {
  const board = normalizeBoard([
    bead({ id: "blocker", status: "open" }),
    bead({
      id: "blocked-one",
      dependencies: [{ issue_id: "blocked-one", depends_on_id: "blocker", type: "blocks" }],
    }),
    bead({
      id: "related-one",
      dependencies: [{ issue_id: "related-one", depends_on_id: "blocker", type: "related" }],
    }),
  ]);

  const blocked = board.beads.find((entry) => entry.id === "blocked-one");
  const related = board.beads.find((entry) => entry.id === "related-one");
  assert.equal(blocked?.blocked, true);
  assert.deepEqual(blocked?.blockedBy, ["blocker"]);
  assert.equal(related?.blocked, false);
  assert.equal(board.counts.blocked, 1);
});
