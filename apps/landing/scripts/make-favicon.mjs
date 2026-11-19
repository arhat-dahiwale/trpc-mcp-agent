// Generates app/favicon.ico (PNG-in-ICO) from the LogoMark geometry.
// Zero dependencies: polygon rasterization -> PNG (node:zlib) -> ICO container.
// Run: node scripts/make-favicon.mjs

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "app", "favicon.ico");

// --- palette (cream + red + black only) ---
const BG = [10, 10, 10, 255]; // #0A0A0A
const TOP = [228, 49, 75, 255]; // #E4314B
const LEFT = [200, 16, 46, 255]; // #C8102E
const RIGHT = [142, 11, 32, 255]; // #8E0B20
const CREAM = [255, 248, 238, 255]; // #FFF8EE

// --- geometry (design space 64x64, matches app/icon.svg) ---
const SIZE = 64;
const CORNER_RADIUS = 14;
const FACES = [
  {
    pts: [
      [32, 10],
      [51, 21],
      [32, 32],
      [13, 21],
    ],
    color: TOP,
  },
  {
    pts: [
      [13, 21],
      [32, 32],
      [32, 54],
      [13, 43],
    ],
    color: LEFT,
  },
  {
    pts: [
      [32, 32],
      [51, 21],
      [51, 43],
      [32, 54],
    ],
    color: RIGHT,
  },
];
const EDGES = [
  [
    [13, 21],
    [32, 32],
  ],
  [
    [32, 32],
    [51, 21],
  ],
  [
    [32, 32],
    [32, 54],
  ],
];
const NODES = [
  [32, 10, 3.0],
  [51, 43, 3.0],
  [13, 43, 3.0],
  [32, 32, 2.2],
];

function pointInPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0];
    const yi = pts[i][1];
    const xj = pts[j][0];
    const yj = pts[j][1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distToSegment(px, py, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((px - a[0]) * dx + (py - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx;
  const y = a[1] + t * dy;
  return Math.hypot(px - x, py - y);
}

function insideRoundedRect(px, py, size, radius) {
  if (px < 0 || py < 0 || px >= size || py >= size) return false;
  const r = Math.min(radius, size / 2);
  const rx = Math.max(0, Math.max(r - px, px - (size - 1 - r)));
  const ry = Math.max(0, Math.max(r - py, py - (size - 1 - r)));
  return rx * rx + ry * ry <= r * r;
}

/** Color at a design-space point; topmost layer wins. */
function sample(dx, dy, targetSize) {
  if (!insideRoundedRect(dx, dy, SIZE, CORNER_RADIUS)) return null;
  let color = BG;
  for (const face of FACES) {
    if (pointInPoly(dx, dy, face.pts)) color = face.color;
  }
  // Small sizes get proportionally bolder strokes/nodes for legibility.
  const boost = targetSize <= 32 ? 1.7 : 1.0;
  for (const seg of EDGES) {
    if (distToSegment(dx, dy, seg[0], seg[1]) <= 0.8 * boost) color = CREAM;
  }
  for (const [nx, ny, nr] of NODES) {
    if (Math.hypot(dx - nx, dy - ny) <= nr * boost) color = CREAM;
  }
  return color;
}

/** 4x supersampled RGBA raster of the mark at the given pixel size. */
function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = SIZE / size;
  const offsets = [-0.25, 0.25];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (const ox of offsets) {
        for (const oy of offsets) {
          const dx = (x + 0.5 + ox) * scale;
          const dy = (y + 0.5 + oy) * scale;
          const color = sample(dx, dy, size);
          count++;
          if (color) {
            r += color[0];
            g += color[1];
            b += color[2];
            a += color[3];
          }
        }
      }
      const idx = (y * size + x) * 4;
      rgba[idx] = Math.round(r / count);
      rgba[idx + 1] = Math.round(g / count);
      rgba[idx + 2] = Math.round(b / count);
      rgba[idx + 3] = Math.round(a / count);
    }
  }
  return rgba;
}

// --- PNG encoding ---
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function pngFromRgba(rgba, size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- ICO container (PNG-compressed entries) ---
function icoFromPngs(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);
  const directory = Buffer.alloc(16 * entries.length);
  let offset = 6 + directory.length;
  entries.forEach((entry, i) => {
    const e = i * 16;
    directory[e] = entry.size >= 256 ? 0 : entry.size;
    directory[e + 1] = entry.size >= 256 ? 0 : entry.size;
    directory[e + 4] = 1; // planes
    directory[e + 6] = 32; // bpp
    directory.writeUInt32LE(entry.data.length, e + 8);
    directory.writeUInt32LE(offset, e + 12);
    offset += entry.data.length;
  });
  return Buffer.concat([header, directory, ...entries.map((x) => x.data)]);
}

const entries = [16, 32, 48].map((size) => ({
  size,
  data: pngFromRgba(render(size), size),
}));

writeFileSync(OUT, icoFromPngs(entries));
console.error(`favicon written: ${OUT} (${entries.map((e) => e.size).join("/")} px)`);
