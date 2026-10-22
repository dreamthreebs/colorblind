import test from "node:test";
import assert from "node:assert/strict";
import { motifFor, PATTERNS } from "../public/art.js";

test("motif shape and rotation never encode the hidden text mask", () => {
  for (const pattern of Object.keys(PATTERNS)) {
    for (let i = 0; i < 100; i++) {
      const dot = { x: 42.3 + i * 3.3, y: 93.5 + i * 2.4, r: 7 };
      assert.deepEqual(
        motifFor({ ...dot, isText: true }, pattern),
        motifFor({ ...dot, isText: false }, pattern),
      );
    }
  }
});

test("confetti contains diverse shapes with stable placement", () => {
  const shapes = new Set();
  for (let i = 0; i < 100; i++) {
    const dot = { x: 32.8 + i * 6.7, y: 51.3 + i * 7.2 };
    const a = motifFor(dot, "confetti");
    assert.deepEqual(a, motifFor(dot, "confetti"));
    shapes.add(a.shape);
  }
  assert.equal(shapes.size, 7);
});
