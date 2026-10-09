// Messenger: an owl delivers every letter, +12 joy while no community issue waits for a first reply.
export default {
  id: 'owl',
  trait: 'messenger',
  home: 'meadow',
  modifiers: { inboxJoy: 12 },
  food: 'kibble',
  move: 'swivel',
  palette: {
    o: '#2e1a0e', b: '#a0703f', l: '#c99a62', s: '#714a27', f: '#fbe9cf', c: '#e8c99a', d: '#8a5a30',
    a: '#ffb330', A: '#d9860f', w: '#fff8ea', r: '#e0474c',
  },
  shinyKeep: ['f', 'a', 'A', 'w', 'r'],
  grid: [
  ],
  eyes: [[4, 5], [10, 5]],
  mouth: [6, 7],
  mouthStyle: 'beak',
  cheeks: [[2, 7], [12, 7]],
  hat: [8, 2],
};
