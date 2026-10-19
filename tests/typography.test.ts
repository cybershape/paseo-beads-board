import assert from "node:assert/strict";
import { test } from "vitest";
import {
  DEFAULT_BASE_FONT_SIZE,
  DEFAULT_FONT_SCALE,
  computeFontScale,
  parsePaseoBaseFontSize,
  subscribeFontScale,
  getFontScaleSnapshot,
  _resetFontScaleForTesting,
} from "../client/typography";

test("computeFontScale returns exact baseline sizes at default base 14", () => {
  const scale = computeFontScale(14);
  assert.deepEqual(scale, {
    micro: 10,
    caption: 11,
    secondary: 12,
    body: 13,
    title: 14,
    stat: 15,
  });
  assert.deepEqual(DEFAULT_FONT_SCALE, scale);
});

test("computeFontScale scales up proportionally at maximum base 21", () => {
  const scale = computeFontScale(21);
  assert.deepEqual(scale, {
    micro: 15,
    caption: 17,
    secondary: 18,
    body: 20,
    title: 21,
    stat: 23,
  });
});

test("computeFontScale scales down proportionally with lower bounds at minimum base 10", () => {
  const scale = computeFontScale(10);
  assert.equal(scale.micro, 8);
  assert.equal(scale.caption, 9);
  assert.equal(scale.secondary, 10);
  assert.equal(scale.body, 11);
  assert.equal(scale.title, 12);
  assert.equal(scale.stat, 13);
  assert.ok(scale.micro >= 8);
});

test("parsePaseoBaseFontSize extracts valid uiBaseFontSize from JSON", () => {
  assert.equal(parsePaseoBaseFontSize(JSON.stringify({ uiBaseFontSize: 18 })), 18);
  assert.equal(parsePaseoBaseFontSize(JSON.stringify({ uiBaseFontSize: 12 })), 12);
});

test("parsePaseoBaseFontSize falls back to DEFAULT_BASE_FONT_SIZE on invalid inputs", () => {
  assert.equal(parsePaseoBaseFontSize(null), DEFAULT_BASE_FONT_SIZE);
  assert.equal(parsePaseoBaseFontSize(""), DEFAULT_BASE_FONT_SIZE);
  assert.equal(parsePaseoBaseFontSize("not-json"), DEFAULT_BASE_FONT_SIZE);
  assert.equal(parsePaseoBaseFontSize("{}"), DEFAULT_BASE_FONT_SIZE);
  assert.equal(parsePaseoBaseFontSize(JSON.stringify({ uiBaseFontSize: "large" })), DEFAULT_BASE_FONT_SIZE);
  assert.equal(parsePaseoBaseFontSize(JSON.stringify({ uiBaseFontSize: 2 })), DEFAULT_BASE_FONT_SIZE);
  assert.equal(parsePaseoBaseFontSize(JSON.stringify({ uiBaseFontSize: 100 })), DEFAULT_BASE_FONT_SIZE);
});

test("font scale store notifies subscribers on update", () => {
  let called = 0;
  const unsubscribe = subscribeFontScale(() => {
    called += 1;
  });

  _resetFontScaleForTesting(18);
  assert.equal(called, 1);
  assert.equal(getFontScaleSnapshot().title, 18);

  _resetFontScaleForTesting(14);
  assert.equal(called, 2);
  assert.equal(getFontScaleSnapshot().title, 14);

  unsubscribe();
  _resetFontScaleForTesting(16);
  assert.equal(called, 2); // Listener was cleaned up
});
