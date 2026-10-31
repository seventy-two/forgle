import { test } from "node:test";
import assert from "node:assert/strict";
import { pastKey } from "../game.js";

test("pastKey plays an earlier day by number or date, never today or later", () => {
  const today = "2026-10-31";
  assert.equal(pastKey("#1", today), "2026-10-15");
  assert.equal(pastKey("#2", today), new Date(Date.parse("2026-10-15") + 86400000).toISOString().slice(0, 10));
  assert.equal(pastKey("#2026-10-30", today), "2026-10-30");
  assert.equal(pastKey("#2026-10-31", today), null);
  assert.equal(pastKey("#999", today), null);
  assert.equal(pastKey("#0", today), null);
  assert.equal(pastKey("#2020-01-01", today), null);
  assert.equal(pastKey("", today), null);
  assert.equal(pastKey("#help", today), null);
});
