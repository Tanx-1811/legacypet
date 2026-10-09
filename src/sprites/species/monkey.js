// Immortal Peach: a monkey that ate a peach of immortality, failing CI can't push its health below 35.
export default {
  id: 'monkey',
  trait: 'immortalPeach',
  home: 'jungle',
  modifiers: { healthFloor: 35 },
  food: 'kibble',
  move: 'somersault',
  palette: {
    o: '#3a200c', b: '#c98a3a', l: '#e8b264', s: '#9c6526', p: '#ffd5b0', y: '#ffd23f', Y: '#d99a0a',
    r: '#e23b3b', R: '#a82424',
  },
  shinyKeep: ['p', 'y', 'Y', 'r', 'R'],
  grid: [
  ],
  eyes: [[4, 6], [10, 6]],
  mouth: [6, 8],
  cheeks: [[3, 8], [11, 8]],
  hat: [8, 1],
};
