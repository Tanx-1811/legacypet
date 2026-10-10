// MMPX pixel-art magnification: doubles a sprite, rounding its corners and smoothing the stair
// steps of diagonals while keeping lines, dots and the art's own palette intact.
// From Morgan McGuire and Mara Gagiu, "MMPX Style-Preserving Pixel Art Magnification",
// Journal of Computer Graphics Techniques 10(2), 2021 (https://jcgt.org/published/0010/02/04/).
// This follows the rules of the paper's Listing 4, on rows of palette letters instead of colors.
//
// Neighbourhood of source pixel E, and the four pixels J K / L M it becomes:
//         P
//       A B C
//     Q D E F R          J K
//       G H I            L M
//         S
// `luma(letter)` ranks letters: in ambiguous spots the darker (or opaque) one is the foreground.
// '.' and anything off the grid is transparent, which counts as the brightest.

const DOT = 46; // '.'
const PAD = 3; // the rules look up to three cells away

// The doubled sprite as letter codes, row by row: { codes, w, h } with w, h the new size.
export function magnifyCodes(rows, luma) {
  const w = rows[0].length;
  const h = rows.length;
  const pw = w + 2 * PAD;
  const grid = new Uint16Array(pw * (h + 2 * PAD)).fill(DOT);
  const lum = new Float64Array(grid.length).fill(Infinity);
  const seen = new Map();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const code = rows[y].charCodeAt(x);
      const i = (y + PAD) * pw + x + PAD;
      grid[i] = code;
      if (code !== DOT) {
        if (!seen.has(code)) seen.set(code, luma(String.fromCharCode(code)));
        lum[i] = seen.get(code);
      }
    }
  }
  const W = 2 * w;
  const out = new Uint16Array(W * 2 * h);
  const p2 = 2 * pw;
  const p3 = 3 * pw;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y + PAD) * pw + x + PAD;
      const E = grid[i];
      const A = grid[i - pw - 1]; const B = grid[i - pw]; const C = grid[i - pw + 1];
      const D = grid[i - 1]; const F = grid[i + 1];
      const G = grid[i + pw - 1]; const H = grid[i + pw]; const I = grid[i + pw + 1];
      let J = E; let K = E; let L = E; let M = E;
      if (A !== E || B !== E || C !== E || D !== E || F !== E || G !== E || H !== E || I !== E) {
        const P = grid[i - p2]; const Q = grid[i - 2]; const R = grid[i + 2]; const S = grid[i + p2];
        const Bl = lum[i - pw]; const Dl = lum[i - 1]; const El = lum[i]; const Fl = lum[i + 1]; const Hl = lum[i + pw];

        // 1:1 slopes (the EPX rules, made safer)
        if (D === B && D !== H && D !== F && (El >= Dl || E === A) && (E === A || E === C || E === G) && (El < Dl || A !== D || E !== P || E !== Q)) J = D;
        if (B === F && B !== D && B !== H && (El >= Bl || E === C) && (E === A || E === C || E === I) && (El < Bl || C !== B || E !== P || E !== R)) K = B;
        if (H === D && H !== F && H !== B && (El >= Hl || E === G) && (E === A || E === G || E === I) && (El < Hl || G !== H || E !== S || E !== Q)) L = H;
        if (F === H && F !== B && F !== D && (El >= Fl || E === I) && (E === C || E === G || E === I) && (El < Fl || I !== H || E !== R || E !== S)) M = F;

        // Intersections
        if (E !== F && E === C && E === I && E === D && E === Q && F === B && F === H && F !== grid[i + 3]) { K = F; M = F; }
        if (E !== D && E === A && E === G && E === F && E === R && D === B && D === H && D !== grid[i - 3]) { J = D; L = D; }
        if (E !== H && E === G && E === I && E === B && E === P && H === D && H === F && H !== grid[i + p3]) { L = H; M = H; }
        if (E !== B && E === A && E === C && E === H && E === S && B === D && B === F && B !== grid[i - p3]) { J = B; K = B; }

        // Triangle tips
        if (Bl < El && E === G && E === H && E === I && E === S && E !== A && E !== D && E !== C && E !== F) { J = B; K = B; }
        if (Hl < El && E === A && E === B && E === C && E === P && E !== D && E !== G && E !== I && E !== F) { L = H; M = H; }
        if (Fl < El && E === A && E === D && E === G && E === Q && E !== B && E !== C && E !== I && E !== H) { K = F; M = F; }
        if (Dl < El && E === C && E === F && E === I && E === R && E !== B && E !== A && E !== G && E !== H) { J = D; L = D; }

        // 2:1 slopes
        if (H !== B) {
          if (H !== A && H !== E && H !== C) {
            if (H === G && H === F && H === R && H !== D && H !== grid[i - pw + 2]) L = M;
            if (H === I && H === D && H === Q && H !== F && H !== grid[i - pw - 2]) M = L;
          }
          if (B !== I && B !== G && B !== E) {
            if (B === A && B === F && B === R && B !== D && B !== grid[i + pw + 2]) J = K;
            if (B === C && B === D && B === Q && B !== F && B !== grid[i + pw - 2]) K = J;
          }
        }
        if (F !== D) {
          if (D !== I && D !== E && D !== C) {
            if (D === A && D === H && D === S && D !== B && D !== grid[i + p2 + 1]) J = L;
            if (D === G && D === B && D === P && D !== H && D !== grid[i - p2 + 1]) L = J;
          }
          if (F !== E && F !== A && F !== G) {
            if (F === C && F === H && F === S && F !== B && F !== grid[i + p2 - 1]) K = M;
            if (F === I && F === B && F === P && F !== H && F !== grid[i - p2 - 1]) M = K;
          }
        }
      }
      const o = 2 * y * W + 2 * x;
      out[o] = J;
      out[o + 1] = K;
      out[o + W] = L;
      out[o + W + 1] = M;
    }
  }
  return { codes: out, w: W, h: 2 * h };
}

// The doubled sprite as rows of letters.
export function magnify(rows, luma) {
  const { codes, w, h } = magnifyCodes(rows, luma);
  return Array.from({ length: h }, (_, y) => String.fromCharCode(...codes.subarray(y * w, (y + 1) * w)));
}
