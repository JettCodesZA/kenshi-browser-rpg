import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  assignJob,
  stepGame,
  recruitDrifter,
  tradeAtTown,
  getSquadPower,
} from '../src/engine.js';

test('game starts as a vulnerable desert squad with Kenshi-like survival stats', () => {
  const game = createGame({ seed: 42 });
  assert.equal(game.squad.length, 2);
  assert.equal(game.squad[0].limbs.head, 100);
  assert.equal(game.squad[0].hunger, 72);
  assert.equal(game.cats, 120);
  assert.ok(game.world.towns.length >= 3);
  assert.ok(game.world.factions.some((f) => f.name === 'Dust Jackals'));
});

test('jobs progress over time: mining produces ore and trains labor', () => {
  const game = createGame({ seed: 7 });
  assignJob(game, game.squad[0].id, 'mine');
  for (let i = 0; i < 50; i += 1) stepGame(game, 1);
  assert.ok(game.inventory.ore >= 2, `expected ore, got ${game.inventory.ore}`);
  assert.ok(game.squad[0].skills.labor > 1);
});

test('trade converts ore to cats and food at town prices', () => {
  const game = createGame({ seed: 10 });
  game.inventory.ore = 5;
  tradeAtTown(game, 'Waystation Kudu', { sellOre: 3, buyFood: 2 });
  assert.equal(game.inventory.ore, 2);
  assert.equal(game.inventory.food, 5);
  assert.equal(game.cats, 120 + 3 * 18 - 2 * 12);
});

test('combat targets body parts, can down units, and grants toughness/xp', () => {
  const game = createGame({ seed: 2 });
  game.location.threat = 1;
  const beforePower = getSquadPower(game);
  for (let i = 0; i < 40; i += 1) stepGame(game, 1);
  const injured = game.squad.some((m) => Object.values(m.limbs).some((v) => v < 100));
  assert.equal(injured, true);
  assert.ok(getSquadPower(game) >= beforePower, 'surviving fights should train the squad');
  assert.ok(game.log.some((l) => l.includes('ambushed') || l.includes('wounded')));
});

test('recruiting costs cats and adds a controllable drifter', () => {
  const game = createGame({ seed: 12 });
  const recruit = recruitDrifter(game, 'Rook', 'scout');
  assert.equal(recruit.name, 'Rook');
  assert.equal(game.squad.length, 3);
  assert.equal(game.cats, 45);
  assert.ok(game.squad[2].skills.athletics >= 2);
});
