// Tiny color helpers used to tint pets (shiny, zombie, sick) without a dependency.
// Colors are '#rrggbb' or '#rrggbbaa'; the alpha suffix is preserved.

export function parseHex(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: h.length === 8 ? h.slice(6) : '' };
}

export function toHex({ r, g, b, a = '' }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}${a}`;
}

export function mix(from, to, amount) {
  const x = parseHex(from);
  const y = parseHex(to);
  return toHex({
    r: x.r + (y.r - x.r) * amount,
    g: x.g + (y.g - x.g) * amount,
    b: x.b + (y.b - x.b) * amount,
    a: x.a,
  });
}

function toHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function fromHsl({ h, s, l }) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}

export const hueOf = (hex) => Math.round(toHsl(parseHex(hex)).h) % 360;

export function shiftHue(hex, degrees) {
  const rgb = parseHex(hex);
  const hsl = toHsl(rgb);
  return toHex({ ...fromHsl({ ...hsl, h: (hsl.h + degrees + 360) % 360 }), a: rgb.a });
}

export function desaturate(hex, amount) {
  const rgb = parseHex(hex);
  const hsl = toHsl(rgb);
  return toHex({ ...fromHsl({ ...hsl, s: hsl.s * (1 - amount) }), a: rgb.a });
}
