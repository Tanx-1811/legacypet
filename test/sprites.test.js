import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HATS } from '../src/sprites/accessories.js';
import { EGG } from '../src/sprites/egg.js';
import { BEAKS, EYES, MOOD_FACES, MOUTHS } from '../src/sprites/faces.js';
import { LANGUAGE_SPECIES, pickSpecies, SPECIES, SPECIES_IDS } from '../src/sprites/index.js';
import { LANGS } from '../src/i18n/index.js';

const inBody = (species, x, y) => {
  const ch = species.grid[y]?.[x];
  return ch !== undefined && ch !== '.';
};

for (const id of SPECIES_IDS) {
  const species = SPECIES[id];

  test(`${id}: grid is 16×16 and every pixel has a color`, () => {
    assert.equal(species.id, id);
    assert.equal(species.grid.length, 16);
    species.grid.forEach((row, y) => {
      assert.equal([...row].length, 16, `row ${y} is ${row.length} wide`);
      for (const ch of row) if (ch !== '.') assert.ok(species.palette[ch], `no palette color for "${ch}" in row ${y}`);
    });
  });

  test(`${id}: eyes, mouth and cheeks sit on the body`, () => {
    assert.equal(species.eyes.length, 2);
    for (const [x, y] of species.eyes) {
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) assert.ok(inBody(species, x + dx, y + dy), `eye pixel ${x + dx},${y + dy}`);
    }
    const [mx, my] = species.mouth;
    for (let dx = 0; dx < 4; dx++) assert.ok(inBody(species, mx + dx, my), `mouth pixel ${mx + dx},${my}`);
    for (const [x, y] of species.cheeks) assert.ok(inBody(species, x, y) && inBody(species, x + 1, y), `cheek ${x},${y}`);
    if (species.mouthStyle === 'beak') assert.ok(species.palette.a && species.palette.A, 'beaks need a and A colors');
  });

  test(`${id}: has a trait name in every language`, () => {
    for (const tr of Object.values(LANGS)) {
      assert.ok(tr.traits[species.trait], `${tr.code} is missing trait ${species.trait}`);
      assert.ok(tr.species[id], `${tr.code} is missing species ${id}`);
    }
  });
}

test('every mood has a face and every face part exists', () => {
  for (const [mood, face] of Object.entries(MOOD_FACES)) {
    assert.ok(EYES[face.eyes], `${mood} eyes`);
    assert.ok(MOUTHS[face.mouth], `${mood} mouth`);
    assert.ok(BEAKS[face.mouth], `${mood} beak`);
  }
});

test('stamps are rectangular', () => {
  const check = (name, rows) => rows.forEach((row) => assert.equal(row.length, rows[0].length, name));
  for (const [name, hat] of Object.entries(HATS)) {
    check(name, hat.rows);
    assert.equal(hat.rows[0].length % 2, 0, `${name} must be an even width to center`);
  }
  for (const [name, rows] of Object.entries(MOUTHS)) check(name, rows);
  check('egg', EGG);
});

test('species selection: language easter eggs, overrides and stable hashing', () => {
  assert.equal(pickSpecies({ fullName: 'a/b', language: 'Rust' }).id, LANGUAGE_SPECIES.Rust);
  assert.equal(pickSpecies({ requested: 'cactus', fullName: 'a/b', language: 'Rust' }).id, 'cactus');
  assert.equal(pickSpecies({ fullName: 'Foo/Bar' }).id, pickSpecies({ fullName: 'foo/bar' }).id);
  assert.throws(() => pickSpecies({ requested: 'dragon', fullName: 'a/b' }), /Unknown species/);
});
