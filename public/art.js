import { random, colorFor, linearToSrgb, simulate } from "./core.js";

export const FONT_STYLES = {
  black: {
    family: '"Whisper Black", "PingFang SC", "Microsoft YaHei", sans-serif',
    weight: 900,
  },
  playful: {
    family: '"Whisper Playful", "PingFang SC", sans-serif',
    weight: 400,
  },
};
export const DEFAULT_TYPOGRAPHY = { font: "black", size: 270, spacing: 0.18 };
const geometryCache = new Map();

export function makeArtwork(text, density, seed, typography = {}) {
  const settings = { ...DEFAULT_TYPOGRAPHY, ...typography };
  const font = FONT_STYLES[settings.font] || FONT_STYLES.black;
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
    fontSize = Math.min(340, Math.max(120, settings.size));
  const spacing = Math.min(0.4, Math.max(0, settings.spacing));
  const maxWidth = circular ? 640 : 810,
    maxHeight = circular ? 640 : 760;
  const widthOf = (line) =>
    Array.from(line).reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) +
    Math.max(0, Array.from(line).length - 1) * fontSize * spacing;
  for (; fontSize >= 20; fontSize -= 2) {
    ctx.font = `${font.weight} ${fontSize}px ${font.family}`;
    lines = [];
    for (const paragraph of paragraphs) {
      let current = "";
      for (const ch of Array.from(paragraph)) {
        if (current && widthOf(current + ch) > maxWidth) {
          lines.push(current);
          current = ch;
        } else current += ch;
      }
      lines.push(current);
    }
    if ((lines.length - 1) * fontSize * 1.26 + fontSize <= maxHeight) break;
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineJoin = "round";
  // A small mask expansion keeps narrow strokes connected across dot gaps.
  ctx.lineWidth = fontSize * 0.012;
  const lineHeight = fontSize * 1.26;
  const metrics = ctx.measureText("国Ag");
  const baselineOffset =
    (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
  lines.forEach((line, i) => {
    let x = 500 - widthOf(line) / 2;
    const y = 500 + (i - (lines.length - 1) / 2) * lineHeight + baselineOffset;
    for (const ch of Array.from(line)) {
      ctx.strokeText(ch, x, y);
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width + fontSize * spacing;
    }
  });
  const pixels = ctx.getImageData(0, 0, 1000, 1000).data;
  const geometryKey = `${density}:${seed}:${circular}`;
  const layout = { fontSize, spacing: fontSize * spacing, lines };
  const classify = (dot) => ({
    ...dot,
    isText:
      pixels[(Math.floor(dot.y) * 1000 + Math.floor(dot.x)) * 4 + 3] > 100,
  });
  if (geometryCache.has(geometryKey)) {
    return {
      dots: geometryCache.get(geometryKey).map(classify),
      circular,
      text,
      layout,
    };
  }
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
          if ((d.x - x) ** 2 + (d.y - y) ** 2 < (d.r + r + 0.8) ** 2) {
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
  geometryCache.set(geometryKey, dots);
  if (geometryCache.size > 4)
    geometryCache.delete(geometryCache.keys().next().value);
  return {
    dots,
    circular,
    text,
    layout,
  };
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
