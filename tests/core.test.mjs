import test from "node:test";
import assert from "node:assert/strict";
import {
  splitPages,
  colorFor,
  simulate,
  embedMessage,
  extractMessage,
  crc32,
} from "../public/core.js";
const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGZkAAAAASUVORK5CYII=",
    "base64",
  ),
);
test("original PNG round trips Unicode, line breaks, and literal markup safely", () => {
  const text = "你：今天开心吗？\n我：超级开心🧡 <script>alert(1)</script>";
  assert.equal(
    extractMessage(embedMessage(png, { text, type: "deutan" })).text,
    text,
  );
});
test("rejects ordinary images, truncated data, wrong types, and corrupt envelope", () => {
  assert.throws(() => extractMessage(png), /没有找到/);
  assert.throws(() => extractMessage(new Uint8Array([1, 2, 3])), /PNG/);
  assert.throws(() => extractMessage(png.slice(0, 30)), /不完整/);
  const encoded = embedMessage(png, { text: "hello" });
  encoded[encoded.length - 20] ^= 1;
  assert.throws(() => extractMessage(encoded), /损坏/);
  assert.throws(
    () => extractMessage(embedMessage(png, { text: 123 })),
    /不支持/,
  );
});
test("CRC uses standard PNG polynomial", () =>
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926));
test("chat pagination loses no text and respects line and character limits", () => {
  for (const text of [
    "🧡你好".repeat(70),
    "你：你好\n我：在的\n".repeat(30),
    "\n".repeat(100),
    "abc\r\ndef",
  ]) {
    const pages = splitPages(text);
    assert.equal(pages.join(""), text.replace(/\r\n?/g, "\n"));
    assert.ok(
      pages.every(
        (p) => Array.from(p).length <= 36 && p.split("\n").length <= 6,
      ),
    );
  }
});
test("target simulation reduces text/background separation for all three types", () => {
  const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  for (const type of ["deutan", "protan", "tritan"]) {
    for (const variation of [0.67, 1, 1.19]) {
      const a = colorFor(true, variation, type),
        b = colorFor(false, variation, type);
      assert.ok(dist(simulate(a, type), simulate(b, type)) < dist(a, b) * 0.17);
      assert.deepEqual(simulate(a, type, 0), a);
      assert.ok(
        simulate(a, type, 50).every(
          (v) => Number.isFinite(v) && v >= 0 && v <= 1,
        ),
      );
    }
  }
});
