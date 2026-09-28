#!/usr/bin/env node
/**
 * Smoke: solver unit tests + sample/handcrafted levels solvable + node syntax.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const sandbox = { console, Math, setTimeout, clearTimeout, Date };
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);

function load(rel) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInContext(code, sandbox, { filename: rel });
}

load('js/solver.js');
load('js/levels.js');
load('js/game.js');

const S = sandbox.CarJamSolver;
const L = sandbox.CarJamLevels;
const G = sandbox.CarJamGame;

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗', msg); }
}

console.log('== Syntax (node --check) ==');
const jsFiles = ['js/solver.js','js/levels.js','js/game.js','js/storage.js','js/audio.js','js/ads.js','js/ui.js','scripts/smoke-engine.js','scripts/build-web.js'];
for (const f of jsFiles) {
  try {
    execSync(`node --check "${path.join(root, f)}"`, { stdio: 'pipe' });
    assert(true, f + ' syntax OK');
  } catch (e) {
    assert(false, f + ' syntax FAIL: ' + (e.stderr || e.message));
  }
}

console.log('== Catalog ==');
assert(L.getLevelCount() >= 100, 'level count >= 100 (got ' + L.getLevelCount() + ')');
assert(L.HANDCRAFTED.length >= 20, 'handcrafted >= 20 (got ' + L.HANDCRAFTED.length + ')');
assert(L.getWorlds().length === 5, '5 worlds');
const worldNames = L.getWorlds().map((w) => w.name).join(', ');
assert(worldNames.indexOf('Downtown') >= 0 && worldNames.indexOf('Highway') >= 0, 'worlds: ' + worldNames);

console.log('== Solver basics ==');
{
  const level = {
    id: 99, slots: 3,
    passengers: ['red','red','red'],
    vehicles: [{ id: 'v0', color: 'red', type: 'small', capacity: 3 }]
  };
  const st = S.fromLevel(level);
  const r = S.solve(st);
  assert(r.solvable === true, 'trivial level solvable');
  assert(r.path && r.path.length === 1, 'trivial path length 1');
}
{
  // unsolvable: parking 1 slot, two cars needed before either can leave? 
  // actually with auto-board, red car parks and fills → leaves. Always works with 1 color.
  // Soft-lock: 2 slots, passengers start blue, but only park red cars that don't match → jam
  const level = {
    id: 98, slots: 2,
    passengers: ['blue','blue','blue','red','red','red'],
    vehicles: [
      { id: 'v0', color: 'red', capacity: 3 },
      { id: 'v1', color: 'red', capacity: 3 }
    ]
  };
  const st = S.fromLevel(level);
  const r = S.solve(st);
  assert(r.solvable === false, 'impossible color mismatch unsolvable');
}

console.log('== Handcrafted 1–20 solvable ==');
let hcOk = 0;
for (let id = 1; id <= 20; id++) {
  const lv = L.getLevel(id);
  const st = S.fromLevel(lv);
  const r = S.solve(st, { maxNodes: 100000, maxDepth: 80 });
  if (r.solvable) hcOk++;
  else console.error('    FAIL level', id, 'nodes', r.nodes);
}
assert(hcOk === 20, 'all handcrafted 1–20 solvable (' + hcOk + '/20)');

console.log('== Sample generated levels ==');
const samples = [21, 35, 50, 65, 80, 100, 120];
let genOk = 0;
for (const id of samples) {
  const lv = L.getLevel(id);
  const st = S.fromLevel(lv);
  const r = S.solve(st, { maxNodes: 100000, maxDepth: 90 });
  if (r.solvable) { genOk++; console.log('  ✓ level', id, 'solvable', lv.trivial ? '(trivial)' : lv.fallback ? '(fallback)' : ''); }
  else console.error('  ✗ level', id, 'UNSOLVABLE');
}
assert(genOk === samples.length, 'sample generated solvable (' + genOk + '/' + samples.length + ')');

console.log('== Game session / undo / win ==');
{
  const lv = L.getLevel(1);
  const sess = G.createSession(lv);
  const res = G.park(sess, 0);
  assert(res.ok && sess.won, 'level 1 win in one park');
  assert(sess.stars >= 1, 'stars awarded (' + sess.stars + ')');
}
{
  const lv = L.getLevel(2);
  const sess = G.createSession(lv);
  G.park(sess, 0);
  const before = sess.state.passengers.length;
  const u = G.undo(sess, false);
  assert(u.ok && u.free, 'free undo works');
  assert(sess.state.waiting.length === 2, 'undo restored waiting');
}
{
  const lv = L.getLevel(3);
  const sess = G.createSession(lv);
  const extra = G.boosterExtraParking(sess);
  assert(extra.ok && sess.state.slots === 4, 'extra parking booster');
}

console.log('== Daily ==');
{
  const d = L.getDailyLevel('2026-09-28');
  assert(d.daily === true && d.passengers.length > 0, 'daily level generated');
  const r = S.solve(S.fromLevel(d), { maxNodes: 100000 });
  assert(r.solvable, 'daily solvable');
}

console.log('\n==== RESULT: ' + passed + ' passed, ' + failed + ' failed ====');
process.exit(failed ? 1 : 0);
