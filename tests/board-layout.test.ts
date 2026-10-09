import assert from "node:assert/strict";
import { test } from "vitest";
import { COLUMN_GAP, MIN_COLUMN_WIDTH, columnWidthForBoard } from "../client/board/layout";

test("columns fill the board container after accounting for gaps", () => {
  const width = columnWidthForBoard(1200, 4);
  assert.equal(width, 291);
  assert.equal(width * 4 + COLUMN_GAP * 3, 1200);
});

test("hiding the closed column redistributes the available width", () => {
  assert.equal(columnWidthForBoard(1200, 3), 392);
  assert.equal(columnWidthForBoard(1200, 4), 291);
});

test("narrow containers retain readable columns and overflow horizontally", () => {
  const width = columnWidthForBoard(800, 4);
  assert.equal(width, MIN_COLUMN_WIDTH);
  assert.ok(width * 4 + COLUMN_GAP * 3 > 800);
});

test("columns fit exactly at the minimum board width", () => {
  const minimumBoardWidth = MIN_COLUMN_WIDTH * 4 + COLUMN_GAP * 3;
  assert.equal(columnWidthForBoard(minimumBoardWidth, 4), MIN_COLUMN_WIDTH);
});

test("columns adapt to container resizing, including the initial unmeasured layout", () => {
  assert.equal(columnWidthForBoard(0, 4), MIN_COLUMN_WIDTH);
  assert.equal(columnWidthForBoard(1000, 4), 241);
  assert.equal(columnWidthForBoard(1600, 4), 391);
});
