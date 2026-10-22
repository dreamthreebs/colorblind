import { random, colorFor, linearToSrgb, simulate } from "./core.js";

export function makeArtwork(text, density, seed) {
  const mask = document.createElement("canvas");
  mask.width = mask.height = 1000;
  const ctx = mask.getContext("2d", { willReadFrequently: true });
  const chars = Array.from(text),
    circular = chars.length <= 12 && text.split("\n").length <= 3;
  const cjkCount = chars.filter((ch) => /[\u3400-\u9fff]/u.test(ch)).length;
  const columns = Math.ceil(Math.sqrt(chars.length));
  const paragraphs =
    circular && !text.includes("\n") && cjkCount > chars.length / 2
      ? Array.from({ length: Math.ceil(chars.length / columns) }, (_, i) =>
          chars.slice(i * columns, (i + 1) * columns).join(""),
        )
      : text.split("\n");
  let lines = [],
    fontSize = 210;
  const maxWidth = circular ? 660 : 810,
    maxHeight = circular ? 580 : 760;
  for (; fontSize >= 36; fontSize -= 2) {
    ctx.font = `900 ${fontSize}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`;
    lines = [];
    for (const paragraph of paragraphs) {
      let current = "";
      for (const ch of Array.from(paragraph)) {
        if (current && ctx.measureText(current + ch).width > maxWidth) {
          lines.push(current);
          current = ch;
        } else current += ch;
      }
      lines.push(current);
    }
    if (lines.length * fontSize * 1.22 <= maxHeight) break;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  const lineHeight = fontSize * 1.22;
  lines.forEach((line, i) =>
    ctx.fillText(line, 500, 500 + (i - (lines.length - 1) / 2) * lineHeight),
  );
  const pixels = ctx.getImageData(0, 0, 1000, 1000).data;
  const rng = random(seed),
    dots = [],
    cellSize = 24,
    grid = new Map();
  const maxR = [12, 8.6, 6.3][density],
    minR = [4.5, 3, 2.3][density];
  function inside(x, y, r) {
    if (circular) return Math.hypot(x - 500, y - 500) + r < 465;
    // Rounded rectangle, independent of message mask.
    const dx = Math.max(Math.abs(x - 500) - 355, 0),
      dy = Math.max(Math.abs(y - 500) - 355, 0);
    return Math.hypot(dx, dy) + r < 100;
  }
  const attempts = [35000, 65000, 105000][density];
  for (let n = 0; n < attempts; n++) {
    const x = 35 + rng() * 930,
      y = 35 + rng() * 930,
      r = minR + rng() ** 1.7 * (maxR - minR);
    if (!inside(x, y, r)) continue;
    const gx = Math.floor(x / cellSize),
      gy = Math.floor(y / cellSize);
    let collides = false;
    for (let dx = -1; dx <= 1 && !collides; dx++)
      for (let dy = -1; dy <= 1 && !collides; dy++) {
        for (const d of grid.get(`${gx + dx},${gy + dy}`) || []) {
          if ((d.x - x) ** 2 + (d.y - y) ** 2 < (d.r + r + 1.5) ** 2) {
            collides = true;
            break;
          }
        }
      }
    if (collides) continue;
    const isText = pixels[(Math.floor(y) * 1000 + Math.floor(x)) * 4 + 3] > 100;
    const dot = { x, y, r, isText, variation: 0.67 + rng() * 0.52 };
    dots.push(dot);
    const key = `${gx},${gy}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(dot);
  }
  return { dots, circular, text };
}

export function drawArtwork(canvas, artwork, type, view, severity = 100) {
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f0f2e9";
  ctx.fillRect(0, 0, 1000, 1000);
  for (const d of artwork.dots) {
    let rgb = colorFor(d.isText, d.variation, type);
    if (view === "simulation") rgb = simulate(rgb, type, severity);
    ctx.fillStyle =
      view === "reveal"
        ? d.isText
          ? "#294e3e"
          : "#e0e5d6"
        : `rgb(${rgb.map((v) => Math.round(linearToSrgb(v) * 255)).join(",")})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
