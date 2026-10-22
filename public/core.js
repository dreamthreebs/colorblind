import { MATRICES } from "./matrices.js";

export const TYPES = {
  deutan: {
    name: "绿色觉差异",
    direction: [0.92205465, -0.38601957, 0.02835689],
    base: [0.39, 0.36, 0.15],
  },
  protan: {
    name: "红色觉差异",
    direction: [0.98961056, -0.14374418, -0.00292277],
    base: [0.38, 0.31, 0.12],
  },
  tritan: {
    name: "蓝色觉差异",
    direction: [0.11845286, -0.2471608, 0.96170705],
    base: [0.34, 0.42, 0.42],
  },
};
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const linearToSrgb = (v) => {
  v = clamp(v);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
};
export const multiply = (m, c) =>
  m.map((row) => row.reduce((sum, value, i) => sum + value * c[i], 0));
export function simulate(rgb, type, severity = 100) {
  const lo = Math.floor(clamp(severity, 0, 100) / 10) * 10;
  const hi = Math.min(100, lo + 10),
    t = (severity - lo) / 10;
  const m = MATRICES[type][lo].map((row, i) =>
    row.map((n, j) => n * (1 - t) + MATRICES[type][hi][i][j] * t),
  );
  return multiply(m, rgb).map((v) => clamp(v));
}
export function random(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function splitPages(text, size = 36) {
  const chars = Array.from(text.replace(/\r\n?/g, "\n"));
  const pages = [];
  let page = "",
    count = 0,
    breaks = 0;
  for (const ch of chars) {
    if (count >= size || (ch === "\n" && breaks >= 5)) {
      pages.push(page);
      page = "";
      count = 0;
      breaks = 0;
    }
    page += ch;
    count++;
    if (ch === "\n") breaks++;
  }
  if (page) pages.push(page);
  return pages.length ? pages : [""];
}
// Each theme has neighboring tones plus one quiet accent in sixteen dots.
// Hue selection is shared by text/background; accents carry no text signal.
export const PALETTES = {
  garden: {
    name: "奶油花园",
    bases: [
      [0.46, 0.48, 0.29],
      [0.42, 0.44, 0.27],
      [0.49, 0.5, 0.32],
    ],
    amplitude: 0.17,
    accent: [0.32, 0.4, 0.44],
  },
  mist: {
    name: "雾蓝暮色",
    bases: [
      [0.4, 0.38, 0.49],
      [0.37, 0.35, 0.46],
      [0.43, 0.41, 0.52],
    ],
    amplitude: 0.14,
    accent: [0.48, 0.46, 0.38],
  },
};
export function colorFor(
  isText,
  variation,
  type,
  palette = "classic",
  hue = 0,
) {
  const { direction } = TYPES[type];
  const theme = PALETTES[palette];
  const slot = hue % 16;
  // A narrow brightness range keeps the palette soft instead of speckled.
  const brightness = theme ? 0.92 + (variation - 0.67) * 0.24 : variation;
  if (theme && slot === 15) return theme.accent.map((v) => v * brightness);
  const base = theme
    ? theme.bases[slot % theme.bases.length]
    : TYPES[type].base;
  let amplitude = theme ? theme.amplitude : type === "tritan" ? 0.26 : 0.31;
  // Limit both sides together before conversion to preserve their confusion
  // direction, rather than clipping channels independently at the gamut edge.
  if (theme) {
    for (let i = 0; i < 3; i++) {
      amplitude = Math.min(
        amplitude,
        (Math.max(0, Math.min(base[i], 1 / brightness - base[i])) /
          Math.abs(direction[i])) *
          0.98,
      );
    }
  }
  return base.map((value, i) =>
    clamp((value + (isText ? 1 : -1) * amplitude * direction[i]) * brightness),
  );
}

// PNG ancillary chunk: uncompressed UTF-8 JSON. This is a portable envelope, not encryption.
const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++)
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function scanPng(bytes) {
  if (bytes.length < 20 || signature.some((v, i) => bytes[i] !== v))
    throw new Error("请选择 PNG 格式的原始图片。");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    chunks = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const size = view.getUint32(offset),
      end = offset + size + 12;
    if (end > bytes.length) throw new Error("图片文件不完整，请重新选择原图。");
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    chunks.push({
      type,
      start: offset,
      end,
      data: bytes.slice(offset + 8, end - 4),
      crc: view.getUint32(end - 4),
    });
    if (type === "IEND") return chunks;
    offset = end;
  }
  throw new Error("图片文件不完整，请重新选择原图。");
}
export function embedMessage(bytes, payload) {
  const chunks = scanPng(bytes),
    iend = chunks.find((c) => c.type === "IEND");
  const data = encoder.encode(
    JSON.stringify({ app: "color-whisper", version: 1, ...payload }),
  );
  const chunk = new Uint8Array(data.length + 12),
    view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(encoder.encode("cwHt"), 4);
  chunk.set(data, 8);
  view.setUint32(chunk.length - 4, crc32(chunk.slice(4, -4)));
  const before = bytes.slice(0, iend.start),
    after = bytes.slice(iend.start);
  const result = new Uint8Array(before.length + chunk.length + after.length);
  result.set(before);
  result.set(chunk, before.length);
  result.set(after, before.length + chunk.length);
  return result;
}
export function extractMessage(bytes) {
  const chunk = scanPng(bytes).find((c) => c.type === "cwHt");
  if (!chunk)
    throw new Error(
      "没有找到可读回的文字。请使用本站下载的原始 PNG；截图、压缩图片或其他来源的图片不支持读回。",
    );
  if (
    chunk.data.length > 65536 ||
    crc32(bytes.slice(chunk.start + 4, chunk.end - 4)) !== chunk.crc
  )
    throw new Error("文字数据已损坏，请重新获取原始 PNG。");
  let payload;
  try {
    payload = JSON.parse(decoder.decode(chunk.data));
  } catch {
    throw new Error("图片附带的文字格式无效。");
  }
  if (
    payload.app !== "color-whisper" ||
    payload.version !== 1 ||
    typeof payload.text !== "string" ||
    payload.text.length > 600
  )
    throw new Error("这张图片的数据格式暂不支持。");
  return payload;
}
