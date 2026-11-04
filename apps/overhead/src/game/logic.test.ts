import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayNumber, haversineKm, judge, levelFor, shareText, SKIP, suggest, won, isOver, bearing } from './logic.ts';
import { byId, PLACES } from './places.ts';
import { PUZZLES } from './puzzles.ts';

test('day #1 is Nov 4, 2026', () => {
  assert.equal(dayNumber(new Date(2026, 10, 4, 0, 1)), 1);
  assert.equal(dayNumber(new Date(2026, 10, 4, 23, 59)), 1);
  assert.equal(dayNumber(new Date(2026, 10, 5, 0, 0)), 2);
  assert.equal(dayNumber(new Date(2027, 0, 1, 12)), 59);
});

test('distance and bearing', () => {
  const km = haversineKm(byId['paris'], byId['london']);
  assert.ok(km > 330 && km < 350, `Paris-London ${km}`);
  const b = bearing(byId['paris'], byId['london']);
  assert.ok(b > 315 || b < 360, `bearing ${b}`);
});

test('nearby guesses count as correct', () => {
  assert.equal(judge(byId['giza'], 'cairo').correct, true);
  assert.equal(judge(byId['vesuvius'], 'naples').correct, true);
  assert.equal(judge(byId['dubai'], 'abu-dhabi').correct, false);
});

test('each guess zooms out one level; game ends on hit or 6 tries', () => {
  const answer = byId['venice'];
  const g = [judge(answer, 'rome'), SKIP, judge(answer, 'milan')];
  assert.equal(levelFor(g), 3);
  assert.equal(isOver(g), false);
  const done = [...g, judge(answer, 'venice')];
  assert.equal(won(done), true);
  assert.equal(levelFor(done), 5);
  assert.equal(shareText(3, done), 'Overhead #3 4/6\n🟨⬜🟨🟩');
  const lost = [SKIP, SKIP, SKIP, SKIP, SKIP, SKIP];
  assert.equal(isOver(lost), true);
  assert.equal(shareText(1, lost).split('\n')[0], 'Overhead #1 X/6');
});

test('suggestions match names, other names and accents', () => {
  assert.equal(suggest('sao')[0].id, 'sao-paulo');
  assert.equal(suggest('palm')[0].id, 'dubai');
  assert.equal(suggest('fran')[0].id, 'san-francisco');
  assert.deepEqual(suggest('par', ['paris']).map((p) => p.id).includes('paris'), false);
  assert.deepEqual(suggest(''), []);
});

test('every puzzle answer is a guessable place and ids are unique', () => {
  for (const p of PUZZLES) assert.ok(byId[p.answer], p.answer);
  assert.equal(new Set(PLACES.map((p) => p.id)).size, PLACES.length);
});
