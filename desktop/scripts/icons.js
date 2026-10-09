// Draws the app icon and the menu bar / tray icons as PNGs, straight from the pet sprites.
// No image libraries: a tiny PNG encoder on top of node:zlib.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { buildPet, mockSnapshot } from '../../src/index.js';
import { composePet } from '../../src/render/compose.js';

const out = fileURLToPath(new URL('../build/', import.meta.url));
mkdirSync(out, { recursive: true });

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}
function png(canvas) {
  const { w, h, px } = canvas;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
function canvas(w, h) {
  const px = Buffer.alloc(w * h * 4);
  const blend = (x, y, [r, g, b], a) => {
    if (x < 0 || y < 0 || x >= w || y >= h || a <= 0) return;
    const i = (y * w + x) * 4;
    const da = px[i + 3] / 255;
    const oa = a + da * (1 - a);
    for (const [k, v] of [[0, r], [1, g], [2, b]]) px[i + k] = Math.round((v * a + px[i + k] * da * (1 - a)) / (oa || 1));
    px[i + 3] = Math.round(oa * 255);
  };
  return {
    w, h, px, blend,
    rect(x0, y0, rw, rh, color, a = 1) {
      for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) blend(x, y, color, a);
    },
    // A rounded rectangle with soft edges (4×4 samples per pixel), filled by fn(y) → color.
    rounded(x0, y0, rw, rh, r, fill, alpha = 1) {
      for (let y = y0; y < y0 + rh; y++) {
        for (let x = x0; x < x0 + rw; x++) {
          let hit = 0;
          for (let sy = 0; sy < 4; sy++) {
            for (let sx = 0; sx < 4; sx++) {
              const px_ = x + (sx + 0.5) / 4 - x0;
              const py = y + (sy + 0.5) / 4 - y0;
              const cx = Math.min(Math.max(px_, r), rw - r);
              const cy = Math.min(Math.max(py, r), rh - r);
              if ((px_ - cx) ** 2 + (py - cy) ** 2 <= r * r) hit++;
            }
          }
          if (hit) blend(x, y, fill((y - y0) / rh), (hit / 16) * alpha);
        }
      }
    },
    ellipse(cx, cy, rx, ry, color, a) {
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
          const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
          if (d <= 1) blend(x, y, color, a * (1 - d) ** 0.6);
        }
      }
    },
  };
}
const mixRgb = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// The pet in the app icon: a happy rubber duck, LegacyPet's mascot.
function petPixels() {
  const now = new Date('2026-06-01T12:00:00Z');
  const pet = buildPet({ snapshot: mockSnapshot({ mood: 'happy', now, fullName: 'Tanx-1811/legacypet' }), now, options: { species: 'duck', mood: 'happy', holiday: null, shiny: false, aura: false } });
  const comp = composePet(pet);
  return [...comp.base, ...comp.eyesOpen].filter((p) => !p.c.startsWith('.'));
}

function appIcon(size = 1024) {
  const c = canvas(size, size);
  const inset = Math.round(size * 0.1);
  const box = size - inset * 2;
  const top = hex('#9b7cff');
  const bottom = hex('#5d33e6');
  c.rounded(inset, inset + Math.round(size * 0.014), box, box, box * 0.225, () => [20, 10, 50], 0.28); // a soft drop shadow
  c.rounded(inset, inset, box, box, box * 0.225, (t) => mixRgb(top, bottom, t));
  c.ellipse(size / 2, size * 0.47, box * 0.36, box * 0.36, [255, 255, 255], 0.16);
  const pixels = petPixels();
  const xs = pixels.map((p) => p.x);
  const ys = pixels.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.floor((box * 0.6) / Math.max(maxX - minX + 1, maxY - minY + 1));
  const ox = Math.round(size / 2 - ((maxX - minX + 1) * scale) / 2);
  const oy = Math.round(size * 0.47 - ((maxY - minY + 1) * scale) / 2);
  c.ellipse(size / 2, oy + (maxY - minY + 1) * scale + scale * 0.6, box * 0.27, scale * 1.4, [20, 8, 60], 0.35);
  for (const p of pixels) c.rect(ox + (p.x - minX) * scale, oy + (p.y - minY) * scale, scale, scale, hex(p.c));
  return c;
}

// LegacyPet's paw, the same one as the web app's logo.
const PAW = [
  '...##...##..',
  '...##...##..',
  '...##...##..',
  '##........##',
  '##..####..##',
  '##.######.##',
  '..########..',
  '..########..',
  '..########..',
];
function paw(size, { color, background = null }) {
  const c = canvas(size, size);
  if (background) c.rounded(0, 0, size, size, size * 0.22, () => hex(background));
  const scale = Math.max(1, Math.floor((size * (background ? 0.62 : 0.8)) / PAW[0].length));
  const ox = Math.floor((size - PAW[0].length * scale) / 2);
  const oy = Math.floor((size - PAW.length * scale) / 2);
  PAW.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') c.rect(ox + x * scale, oy + y * scale, scale, scale, hex(color)); }));
  return c;
}

const files = {
  'icon.png': appIcon(1024),
  'trayTemplate.png': paw(16, { color: '#000000' }),
  'trayTemplate@2x.png': paw(32, { color: '#000000' }),
  'tray.png': paw(32, { color: '#ffffff', background: '#7c4dff' }),
  'tray@2x.png': paw(64, { color: '#ffffff', background: '#7c4dff' }),
};
for (const [name, img] of Object.entries(files)) writeFileSync(`${out}${name}`, png(img));
console.log(`Wrote ${Object.keys(files).join(', ')} to ${out}`);
