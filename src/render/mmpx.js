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

export function magnify(rows, luma) {
  const w = rows[0].length;
  const h = rows.length;
  const cells = rows.map((row) => [...row]);
  const src = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : cells[y][x]);
  const lum = (k) => (k === '.' ? Infinity : luma(k));
  const out = Array.from({ length: h * 2 }, () => new Array(w * 2));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const A = src(x - 1, y - 1); const B = src(x, y - 1); const C = src(x + 1, y - 1);
      const D = src(x - 1, y); const E = src(x, y); const F = src(x + 1, y);
      const G = src(x - 1, y + 1); const H = src(x, y + 1); const I = src(x + 1, y + 1);
      let J = E; let K = E; let L = E; let M = E;
      if (A !== E || B !== E || C !== E || D !== E || F !== E || G !== E || H !== E || I !== E) {
        const P = src(x, y - 2); const Q = src(x - 2, y); const R = src(x + 2, y); const S = src(x, y + 2);
        const Bl = lum(B); const Dl = lum(D); const El = lum(E); const Fl = lum(F); const Hl = lum(H);

        // 1:1 slopes (the EPX rules, made safer)
        if (D === B && D !== H && D !== F && (El >= Dl || E === A) && (E === A || E === C || E === G) && (El < Dl || A !== D || E !== P || E !== Q)) J = D;
        if (B === F && B !== D && B !== H && (El >= Bl || E === C) && (E === A || E === C || E === I) && (El < Bl || C !== B || E !== P || E !== R)) K = B;
        if (H === D && H !== F && H !== B && (El >= Hl || E === G) && (E === A || E === G || E === I) && (El < Hl || G !== H || E !== S || E !== Q)) L = H;
        if (F === H && F !== B && F !== D && (El >= Fl || E === I) && (E === C || E === G || E === I) && (El < Fl || I !== H || E !== R || E !== S)) M = F;

        // Intersections
        if (E !== F && E === C && E === I && E === D && E === Q && F === B && F === H && F !== src(x + 3, y)) { K = F; M = F; }
        if (E !== D && E === A && E === G && E === F && E === R && D === B && D === H && D !== src(x - 3, y)) { J = D; L = D; }
        if (E !== H && E === G && E === I && E === B && E === P && H === D && H === F && H !== src(x, y + 3)) { L = H; M = H; }
        if (E !== B && E === A && E === C && E === H && E === S && B === D && B === F && B !== src(x, y - 3)) { J = B; K = B; }

        // Triangle tips
        if (Bl < El && E === G && E === H && E === I && E === S && E !== A && E !== D && E !== C && E !== F) { J = B; K = B; }
        if (Hl < El && E === A && E === B && E === C && E === P && E !== D && E !== G && E !== I && E !== F) { L = H; M = H; }
        if (Fl < El && E === A && E === D && E === G && E === Q && E !== B && E !== C && E !== I && E !== H) { K = F; M = F; }
        if (Dl < El && E === C && E === F && E === I && E === R && E !== B && E !== A && E !== G && E !== H) { J = D; L = D; }

        // 2:1 slopes
        if (H !== B) {
          if (H !== A && H !== E && H !== C) {
            if (H === G && H === F && H === R && H !== D && H !== src(x + 2, y - 1)) L = M;
            if (H === I && H === D && H === Q && H !== F && H !== src(x - 2, y - 1)) M = L;
          }
          if (B !== I && B !== G && B !== E) {
            if (B === A && B === F && B === R && B !== D && B !== src(x + 2, y + 1)) J = K;
            if (B === C && B === D && B === Q && B !== F && B !== src(x - 2, y + 1)) K = J;
          }
        }
        if (F !== D) {
          if (D !== I && D !== E && D !== C) {
            if (D === A && D === H && D === S && D !== B && D !== src(x + 1, y + 2)) J = L;
            if (D === G && D === B && D === P && D !== H && D !== src(x + 1, y - 2)) L = J;
          }
          if (F !== E && F !== A && F !== G) {
            if (F === C && F === H && F === S && F !== B && F !== src(x - 1, y + 2)) K = M;
            if (F === I && F === B && F === P && F !== H && F !== src(x - 1, y - 2)) M = K;
          }
        }
      }
      out[2 * y][2 * x] = J;
      out[2 * y][2 * x + 1] = K;
      out[2 * y + 1][2 * x] = L;
      out[2 * y + 1][2 * x + 1] = M;
    }
  }
  return out.map((row) => row.join(''));
}
