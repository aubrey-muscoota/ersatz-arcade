/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  angleDiff, armSpeed, dailyConfig, dayNumber, grade, initialState, makeConfig, MAX_MISSES, multiplier,
  noteFor, place, points, shareText, targetAngle,
} from './logic.ts';
import type { State } from './logic.ts';

const perfectRun = (s: State) => place(s, targetAngle(s.stars.length + 1)).state;

test('angleDiff wraps around 0/360', () => {
  assert.equal(angleDiff(2, 358), 4);
  assert.equal(angleDiff(358, 2), -4);
});

test('grades by window', () => {
  assert.equal(grade(3.9), 'perfect');
  assert.equal(grade(-9), 'good');
  assert.equal(grade(17), 'close');
  assert.equal(grade(40), 'miss');
});

test('streak raises the multiplier; golden stars are worth 5x', () => {
  assert.equal(multiplier(4), 1);
  assert.equal(multiplier(5), 2);
  assert.equal(multiplier(100), 4);
  assert.equal(points('good', 0, true), 10);
  assert.equal(points('miss', 0, true), 0);
});

test('the daily config is the same for everyone and differs by day', () => {
  assert.deepEqual(dailyConfig(42), dailyConfig(42));
  assert.notDeepEqual(dailyConfig(42).golden, dailyConfig(43).golden);
  assert.equal(dayNumber(new Date(2026, 10, 1, 9)), 1);
  assert.equal(dayNumber(new Date(2026, 10, 3, 23)), 3);
});

test('the arm reverses after reversal stars', () => {
  let s = initialState(makeConfig('endless', 5));
  while (s.stars.length < 21) s = perfectRun(s);
  assert.equal(s.dir, -1);
  while (s.stars.length < 55) s = perfectRun(s);
  assert.equal(s.dir, 1);
});

test('last life eases the arm', () => {
  const c = makeConfig('endless', 1);
  assert.ok(armSpeed(c, 10, MAX_MISSES - 1) < armSpeed(c, 10, 0));
});

test('three misses end the game', () => {
  let s = initialState();
  for (let i = 0; i < MAX_MISSES; i++) s = place(s, targetAngle(s.stars.length + 1) + 90).state;
  assert.equal(s.over, true);
  assert.equal(s.complete, false);
});

test('a full galaxy of perfects ends as complete and shares a gold strip', () => {
  let s = initialState(dailyConfig(3));
  while (!s.over) s = perfectRun(s);
  assert.equal(s.stars.length, 144);
  assert.equal(s.complete, true);
  assert.equal(s.bestStreak, 144);
  assert.match(shareText(s), /^Starspin #3 · 144\/144 stars 🌌/);
  assert.match(shareText(s), /🟨{12}$/u);
});

test('notes climb with the streak', () => {
  assert.equal(noteFor('perfect', 1), 0);
  assert.equal(noteFor('perfect', 4), 3);
  assert.equal(noteFor('perfect', 11), 0);
});
