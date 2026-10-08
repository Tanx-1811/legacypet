import { parseHex } from '../util/color.js';
import { composePet } from './compose.js';

const fg = (hex) => { const { r, g, b } = parseHex(hex); return `\x1b[38;2;${r};${g};${b}m`; };
const bg = (hex) => { const { r, g, b } = parseHex(hex); return `\x1b[48;2;${r};${g};${b}m`; };
const RESET = '\x1b[0m';

// Prints the pet with half-block characters: two pixels per terminal cell.
export function terminalArt(pet) {
  const comp = composePet(pet);
  const cells = new Map();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of [...comp.base, ...comp.eyesOpen, ...comp.gear]) {
    if (p.c.startsWith('.')) continue;
    cells.set(`${p.x},${p.y}`, p.c);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const lines = [];
  for (let y = minY; y <= maxY; y += 2) {
    let line = '  ';
    for (let x = minX; x <= maxX; x++) {
      const top = cells.get(`${x},${y}`);
      const bottom = cells.get(`${x},${y + 1}`);
      if (top && bottom) line += `${fg(top)}${bg(bottom)}▀${RESET}`;
      else if (top) line += `${fg(top)}▀${RESET}`;
      else if (bottom) line += `${fg(bottom)}▄${RESET}`;
      else line += ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}
