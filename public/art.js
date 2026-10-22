import { random, colorFor, linearToSrgb, simulate } from "./core.js?v=color-5";

export const FONT_STYLES = {
  black: {
    family: '"Whisper Black", "PingFang SC", "Microsoft YaHei", sans-serif',
    weight: 500,
  },
  playful: {
    family: '"Whisper Playful", "PingFang SC", sans-serif',
    weight: 400,
  },
};
export const DEFAULT_TYPOGRAPHY = {
  font: "black",
  size: 270,
  spacing: 0.18,
  thickness: 20,
};
export function fontWeight(settings) {
  return settings.font === "playful"
    ? 400
    : 400 + Math.min(100, Math.max(0, settings.thickness ?? 20)) * 5;
}
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
    ctx.font = `${fontWeight(settings)} ${fontSize}px ${font.family}`;
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
  // Black uses real variable-font weights without the old extra outline.
  // The fixed-weight playful font gets a small, signed outline adjustment.
  const outline =
    settings.font === "playful"
      ? (Math.min(100, Math.max(0, settings.thickness)) - 40) *
        fontSize *
        0.00025
      : 0;
  ctx.lineWidth = Math.max(0.01, Math.abs(outline) * 2);
  const lineHeight = fontSize * 1.26;
  const metrics = ctx.measureText("国Ag");
  const baselineOffset =
    (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
  lines.forEach((line, i) => {
    let x = 500 - widthOf(line) / 2;
    const y = 500 + (i - (lines.length - 1) / 2) * lineHeight + baselineOffset;
    for (const ch of Array.from(line)) {
      ctx.fillText(ch, x, y);
      if (outline !== 0) {
        ctx.globalCompositeOperation =
          outline < 0 ? "destination-out" : "source-over";
        ctx.strokeText(ch, x, y);
        ctx.globalCompositeOperation = "source-over";
      }
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
    cellSize = 32,
    grid = new Map();
  const maxR = [15, 8.6, 6.3, 4.2][density],
    minR = [4.5, 3, 2.3, 1.5][density];
  function inside(x, y, r) {
    if (circular) return Math.hypot(x - 500, y - 500) + r < 465;
    // Rounded rectangle, independent of message mask.
    const dx = Math.max(Math.abs(x - 500) - 355, 0),
      dy = Math.max(Math.abs(y - 500) - 355, 0);
    return Math.hypot(dx, dy) + r < 100;
  }
  const attempts = [35000, 65000, 105000, 190000][density];
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

export const PATTERNS = {
  dots: "经典圆点",
  flowers: "小花花",
  stars: "星星糖",
  hearts: "爱心雨",
  confetti: "混搭彩屑",
};
const paths = new Map();
function patternPath(shape) {
  if (paths.has(shape)) return paths.get(shape);
  const path = new Path2D();
  if (shape === "flowers") {
    for (let i = 0; i <= 80; i++) {
      const angle = (i / 80) * Math.PI * 2;
      const radius = 0.78 + 0.22 * Math.cos(angle * 5);
      const x = Math.cos(angle) * radius,
        y = Math.sin(angle) * radius;
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
  } else if (shape === "stars") {
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const radius = i % 2 ? 0.58 : 1;
      if (i === 0)
        path.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      else path.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
  } else if (shape === "hearts") {
    path.moveTo(0, 0.92);
    path.bezierCurveTo(-1.35, 0.05, -0.78, -1.06, 0, -0.35);
    path.bezierCurveTo(0.78, -1.06, 1.35, 0.05, 0, 0.92);
  } else if (shape === "diamond") {
    path.moveTo(0, -1);
    path.lineTo(0.8, 0);
    path.lineTo(0, 1);
    path.lineTo(-0.8, 0);
  } else if (shape === "sprinkle") {
    path.roundRect(-0.88, -0.34, 1.76, 0.68, 0.3);
  } else {
    path.arc(0, 0, 1, 0, Math.PI * 2);
    if (shape === "ring") {
      path.moveTo(0.5, 0);
      path.arc(0, 0, 0.5, 0, Math.PI * 2, true);
    }
  }
  path.closePath();
  paths.set(shape, path);
  return path;
}

// Shape and rotation depend only on geometry, never on whether a dot is text.
export function motifFor(dot, pattern) {
  const hash =
    (Math.imul(Math.floor(dot.x * 100), 73856093) ^
      Math.imul(Math.floor(dot.y * 100), 19349663)) >>>
    0;
  const choices = [
    "dots",
    "flowers",
    "stars",
    "hearts",
    "diamond",
    "sprinkle",
    "ring",
  ];
  return {
    shape:
      pattern === "confetti"
        ? choices[hash % choices.length]
        : PATTERNS[pattern]
          ? pattern
          : "dots",
    angle: ((hash % 360) * Math.PI) / 180,
  };
}

export function drawArtwork(
  canvas,
  artwork,
  type,
  view,
  severity = 100,
  pattern = "dots",
  viewport = { x: 0, y: 0, size: 1000 },
  palette = "classic",
) {
  const ctx = canvas.getContext("2d");
  const scale = canvas.width / viewport.size;
  const tx = -viewport.x * scale,
    ty = -viewport.y * scale;
  ctx.resetTransform();
  ctx.fillStyle = "#f0f2e9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, tx, ty);
  for (const d of artwork.dots) {
    if (
      d.x + d.r < viewport.x ||
      d.x - d.r > viewport.x + viewport.size ||
      d.y + d.r < viewport.y ||
      d.y - d.r > viewport.y + viewport.size
    )
      continue;
    // Position-derived hue does not encode the message or affect dot packing.
    const hue =
      (Math.imul(Math.round(d.x * 100), 73856093) ^
        Math.imul(Math.round(d.y * 100), 19349663)) >>>
      0;
    let rgb = colorFor(d.isText, d.variation, type, palette, hue);
    if (view === "simulation") rgb = simulate(rgb, type, severity);
    ctx.fillStyle =
      view === "reveal"
        ? d.isText
          ? "#294e3e"
          : "#e0e5d6"
        : `rgb(${rgb.map((v) => Math.round(linearToSrgb(v) * 255)).join(",")})`;
    if (pattern === "dots") {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const { shape, angle } = motifFor(d, pattern);
      const c = Math.cos(angle) * d.r,
        s = Math.sin(angle) * d.r;
      ctx.setTransform(
        c * scale,
        s * scale,
        -s * scale,
        c * scale,
        d.x * scale + tx,
        d.y * scale + ty,
      );
      ctx.fill(patternPath(shape));
      ctx.setTransform(scale, 0, 0, scale, tx, ty);
    }
  }
  ctx.resetTransform();
}
