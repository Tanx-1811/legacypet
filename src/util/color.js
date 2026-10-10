// Tiny color helpers used to tint pets (shiny, zombie, sick) and shade them, without a dependency.
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
export const hslOf = (hex) => toHsl(parseHex(hex));
export const fromHue = (h, s, l) => toHex(fromHsl({ h, s, l }));

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

// OKLab and its polar form OKLCH (Björn Ottosson, 2020): a perceptual color space, so equal
// steps in lightness look equal whatever the hue. The pets' shading ramps are built in it.
const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function toOklab({ r, g, b }) {
  const [lr, lg, lb] = [r, g, b].map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    A: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    B: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function linearFromOklab(L, A, B) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// { l: 0..1, c: chroma (about 0..0.37), h: hue in degrees }
export function oklchOf(hex) {
  const { L, A, B } = toOklab(parseHex(hex));
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

const fits = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

// A color outside sRGB keeps its lightness and hue and gives up chroma until it fits.
export function fromOklch({ l, c, h }, alpha = '') {
  const L = Math.min(1, Math.max(0, l));
  const rad = (h * Math.PI) / 180;
  const at = (chroma) => linearFromOklab(L, chroma * Math.cos(rad), chroma * Math.sin(rad));
  let rgb = at(c);
  if (!fits(rgb)) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (fits(at(mid))) lo = mid;
      else hi = mid;
    }
    rgb = at(lo);
  }
  const [r, g, b] = rgb.map((v) => toGamma(Math.min(1, Math.max(0, v))) * 255);
  return toHex({ r, g, b, a: alpha });
}

// Like mix(), but through OKLab, so a blend never passes through a muddy grey.
export function mixOklab(from, to, amount) {
  const x = toOklab(parseHex(from));
  const y = toOklab(parseHex(to));
  const L = x.L + (y.L - x.L) * amount;
  const A = x.A + (y.A - x.A) * amount;
  const B = x.B + (y.B - x.B) * amount;
  return fromOklch({ l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }, parseHex(from).a);
}
