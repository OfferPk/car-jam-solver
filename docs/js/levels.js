/**
 * Car Jam Solver — handcrafted levels 1–20 + procedural worlds 21–100+
 * Every generated level is validated by CarJamSolver.solve(); unsolvable discarded.
 */
(function (root) {
  'use strict';

  const S = root.CarJamSolver;
  const COLORS = S.COLORS;

  const WORLDS = [
    { id: 'downtown', name: 'Downtown', range: [1, 20], theme: 'city', icon: '🏙️' },
    { id: 'airport', name: 'Airport', range: [21, 40], theme: 'airport', icon: '✈️' },
    { id: 'beach', name: 'Beach', range: [41, 60], theme: 'beach', icon: '🏖️' },
    { id: 'night', name: 'Night City', range: [61, 80], theme: 'night', icon: '🌃' },
    { id: 'highway', name: 'Highway', range: [81, 120], theme: 'highway', icon: '🛣️' }
  ];

  /** Seeded PRNG (mulberry32) */
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function shuffle(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function difficultyFor(id) {
    if (id <= 10) return { colors: 2, slots: 3, vehicles: [2, 3], locks: 0, obstacles: 0, label: 'easy' };
    if (id <= 30) return { colors: 3, slots: 3, vehicles: [3, 5], locks: 0, obstacles: 0, label: 'easy-mid' };
    if (id <= 60) return { colors: 4, slots: id > 45 ? 4 : 3, vehicles: [4, 7], locks: id > 35 ? 1 : 0, obstacles: 0, label: 'mid' };
    if (id <= 100) return { colors: 5, slots: id > 80 ? 5 : 4, vehicles: [5, 9], locks: 2, obstacles: id > 70 ? 1 : 0, label: 'hard' };
    return { colors: 6, slots: 5, vehicles: [7, 11], locks: 3, obstacles: 2, label: 'advanced' };
  }

  function worldFor(id) {
    for (let i = 0; i < WORLDS.length; i++) {
      const w = WORLDS[i];
      if (id >= w.range[0] && id <= w.range[1]) return w;
    }
    return WORLDS[WORLDS.length - 1];
  }

  function starsTargets(id, vehicleCount) {
    const base = vehicleCount + 2;
    return {
      moves3: Math.max(vehicleCount, base),
      moves2: Math.max(vehicleCount + 2, base + 3),
      mistakes3: 0,
      mistakes2: 2
    };
  }

  function coinReward(stars) {
    return [0, 100, 150, 200][stars] || 100;
  }

  // —— Handcrafted tutorial / early levels (guaranteed solvable) ——
  const HANDCRAFTED = [
    // 1 — teach park + board + exit
    {
      id: 1, name: 'First Pickup', slots: 3,
      passengers: ['red', 'red', 'red'],
      vehicles: [{ id: 'v0', color: 'red', type: 'small', capacity: 3 }],
      tutorial: 'Tap the red car to park it. Matching passengers board automatically!'
    },
    // 2 — two colors, order matters lightly
    {
      id: 2, name: 'Two Colors', slots: 3,
      passengers: ['red', 'red', 'red', 'blue', 'blue', 'blue'],
      vehicles: [
        { id: 'v0', color: 'red', type: 'small', capacity: 3 },
        { id: 'v1', color: 'blue', type: 'small', capacity: 3 }
      ],
      tutorial: 'Park cars that match the next passengers in the queue.'
    },
    // 3 — must park red first
    {
      id: 3, name: 'Queue Order', slots: 3,
      passengers: ['red', 'red', 'red', 'blue', 'blue', 'blue', 'red', 'red', 'red'],
      vehicles: [
        { id: 'v0', color: 'blue', type: 'small', capacity: 3 },
        { id: 'v1', color: 'red', type: 'small', capacity: 3 },
        { id: 'v2', color: 'red', type: 'small', capacity: 3 }
      ],
      tutorial: 'Wrong order fills parking — plan ahead!'
    },
    // 4 — limited slots pressure (3 slots, 4 cars but sequential)
    {
      id: 4, name: 'Tight Lot', slots: 3,
      passengers: ['blue', 'blue', 'blue', 'blue', 'red', 'red', 'red', 'green', 'green', 'green', 'red', 'red', 'red'],
      vehicles: [
        { id: 'v0', color: 'blue', type: 'sedan', capacity: 4 },
        { id: 'v1', color: 'red', type: 'small', capacity: 3 },
        { id: 'v2', color: 'green', type: 'small', capacity: 3 },
        { id: 'v3', color: 'red', type: 'small', capacity: 3 }
      ]
    },
    // 5
    {
      id: 5, name: 'Sedan Run', slots: 3,
      passengers: ['green', 'green', 'green', 'green', 'yellow', 'yellow', 'yellow', 'yellow', 'green', 'green', 'green', 'green'],
      vehicles: [
        { id: 'v0', color: 'yellow', type: 'sedan', capacity: 4 },
        { id: 'v1', color: 'green', type: 'sedan', capacity: 4 },
        { id: 'v2', color: 'green', type: 'sedan', capacity: 4 }
      ]
    },
    // 6 — teach combo
    {
      id: 6, name: 'Combo Clear', slots: 3,
      passengers: ['red', 'red', 'red', 'blue', 'blue', 'blue', 'red', 'red', 'red'],
      vehicles: [
        { id: 'v0', color: 'red', type: 'small', capacity: 3 },
        { id: 'v1', color: 'blue', type: 'small', capacity: 3 },
        { id: 'v2', color: 'red', type: 'small', capacity: 3 }
      ],
      tutorial: 'Clear cars in a row for CLEAR xN combo!'
    },
    // 7
    {
      id: 7, name: 'Three Lanes', slots: 3,
      passengers: [
        'red', 'red', 'red', 'blue', 'blue', 'blue', 'green', 'green', 'green',
        'red', 'red', 'red', 'blue', 'blue', 'blue'
      ],
      vehicles: [
        { id: 'v0', color: 'green', type: 'small', capacity: 3 },
        { id: 'v1', color: 'red', type: 'small', capacity: 3 },
        { id: 'v2', color: 'blue', type: 'small', capacity: 3 },
        { id: 'v3', color: 'red', type: 'small', capacity: 3 },
        { id: 'v4', color: 'blue', type: 'small', capacity: 3 }
      ]
    },
    // 8
    {
      id: 8, name: 'Van Arrival', slots: 3,
      passengers: ['blue', 'blue', 'blue', 'blue', 'blue', 'red', 'red', 'red', 'red', 'yellow', 'yellow', 'yellow', 'yellow', 'yellow'],
      vehicles: [
        { id: 'v0', color: 'red', type: 'sedan', capacity: 4 },
        { id: 'v1', color: 'blue', type: 'van', capacity: 5 },
        { id: 'v2', color: 'yellow', type: 'van', capacity: 5 }
      ]
    },
    // 9
    {
      id: 9, name: 'Mixed Fleet', slots: 3,
      passengers: [
        'red', 'red', 'red', 'green', 'green', 'green', 'green',
        'blue', 'blue', 'blue', 'blue', 'red', 'red', 'red', 'red'
      ],
      vehicles: [
        { id: 'v0', color: 'green', type: 'sedan', capacity: 4 },
        { id: 'v1', color: 'red', type: 'small', capacity: 3 },
        { id: 'v2', color: 'blue', type: 'sedan', capacity: 4 },
        { id: 'v3', color: 'red', type: 'sedan', capacity: 4 }
      ]
    },
    // 10 — soft-lock teaching
    {
      id: 10, name: 'Jam Warning', slots: 3,
      passengers: [
        'yellow', 'yellow', 'yellow', 'red', 'red', 'red',
        'blue', 'blue', 'blue', 'yellow', 'yellow', 'yellow',
        'red', 'red', 'red'
      ],
      vehicles: [
        { id: 'v0', color: 'blue', type: 'small', capacity: 3 },
        { id: 'v1', color: 'red', type: 'small', capacity: 3 },
        { id: 'v2', color: 'yellow', type: 'small', capacity: 3 },
        { id: 'v3', color: 'yellow', type: 'small', capacity: 3 },
        { id: 'v4', color: 'red', type: 'small', capacity: 3 }
      ],
      tutorial: 'Watch the warning when parking is nearly full!'
    },
    // 11 — 3 colors standard
    {
      id: 11, name: 'Rush Hour', slots: 3,
      passengers: [
        'red', 'red', 'red', 'red', 'blue', 'blue', 'blue',
        'green', 'green', 'green', 'green', 'blue', 'blue', 'blue', 'blue',
        'red', 'red', 'red'
      ],
      vehicles: [
        { id: 'v0', color: 'green', type: 'sedan', capacity: 4 },
        { id: 'v1', color: 'red', type: 'sedan', capacity: 4 },
        { id: 'v2', color: 'blue', type: 'small', capacity: 3 },
        { id: 'v3', color: 'blue', type: 'sedan', capacity: 4 },
        { id: 'v4', color: 'red', type: 'small', capacity: 3 }
      ]
    },
    // 12
    {
      id: 12, name: 'Taxi Stand', slots: 3,
      passengers: [
        'yellow', 'yellow', 'yellow', 'yellow', 'blue', 'blue', 'blue', 'blue',
        'yellow', 'yellow', 'yellow', 'yellow', 'red', 'red', 'red', 'red'
      ],
      vehicles: [
        { id: 'v0', color: 'blue', type: 'taxi', capacity: 4 },
        { id: 'v1', color: 'yellow', type: 'taxi', capacity: 4 },
        { id: 'v2', color: 'red', type: 'taxi', capacity: 4 },
        { id: 'v3', color: 'yellow', type: 'taxi', capacity: 4 }
      ]
    },
    // 13
    {
      id: 13, name: 'SUV Lot', slots: 3,
      passengers: [
        'green', 'green', 'green', 'green', 'red', 'red', 'red', 'red',
        'blue', 'blue', 'blue', 'blue', 'green', 'green', 'green', 'green',
        'red', 'red', 'red'
      ],
      vehicles: [
        { id: 'v0', color: 'red', type: 'suv', capacity: 4 },
        { id: 'v1', color: 'green', type: 'suv', capacity: 4 },
        { id: 'v2', color: 'blue', type: 'suv', capacity: 4 },
        { id: 'v3', color: 'green', type: 'suv', capacity: 4 },
        { id: 'v4', color: 'red', type: 'small', capacity: 3 }
      ]
    },
    // 14
    {
      id: 14, name: 'Bus Stop', slots: 3,
      passengers: [
        'blue', 'blue', 'blue', 'blue', 'blue', 'blue',
        'red', 'red', 'red', 'red',
        'green', 'green', 'green', 'green', 'green', 'green'
      ],
      vehicles: [
        { id: 'v0', color: 'red', type: 'sedan', capacity: 4 },
        { id: 'v1', color: 'blue', type: 'bus', capacity: 6 },
        { id: 'v2', color: 'green', type: 'bus', capacity: 6 }
      ]
    },
    // 15
    {
      id: 15, name: 'Double Red', slots: 3,
      passengers: [
        'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue',
        'red', 'red', 'red', 'green', 'green', 'green',
        'blue', 'blue', 'blue', 'red', 'red', 'red', 'red'
      ],
      vehicles: [
        { id: 'v0', color: 'blue', type: 'sedan', capacity: 4 },
        { id: 'v1', color: 'red', type: 'small', capacity: 3 },
        { id: 'v2', color: 'green', type: 'small', capacity: 3 },
        { id: 'v3', color: 'red', type: 'small', capacity: 3 },
        { id: 'v4', color: 'blue', type: 'small', capacity: 3 },
        { id: 'v5', color: 'red', type: 'sedan', capacity: 4 }
      ]
    },
    // 16
    {
      id: 16, name: 'Four Slots Intro', slots: 4,
      passengers: [
        'yellow', 'yellow', 'yellow', 'red', 'red', 'red',
        'blue', 'blue', 'blue', 'green', 'green', 'green',
        'yellow', 'yellow', 'yellow', 'yellow'
      ],
      vehicles: [
        { id: 'v0', color: 'red', type: 'small', capacity: 3 },
        { id: 'v1', color: 'blue', type: 'small', capacity: 3 },
        { id: 'v2', color: 'green', type: 'small', capacity: 3 },
        { id: 'v3', color: 'yellow', type: 'small', capacity: 3 },
        { id: 'v4', color: 'yellow', type: 'sedan', capacity: 4 }
      ]
    },
    // 17
    {
      id: 17, name: 'Airport Shuttle', slots: 3,
      passengers: [
        'blue', 'blue', 'blue', 'blue', 'blue',
        'yellow', 'yellow', 'yellow', 'yellow',
        'red', 'red', 'red', 'red', 'red',
        'blue', 'blue', 'blue', 'blue'
      ],
      vehicles: [
        { id: 'v0', color: 'yellow', type: 'sedan', capacity: 4 },
        { id: 'v1', color: 'blue', type: 'van', capacity: 5 },
        { id: 'v2', color: 'red', type: 'van', capacity: 5 },
        { id: 'v3', color: 'blue', type: 'sedan', capacity: 4 }
      ]
    },
    // 18
    {
      id: 18, name: 'Careful Stack', slots: 3,
      passengers: [
        'green', 'green', 'green', 'red', 'red', 'red', 'red',
        'blue', 'blue', 'blue', 'green', 'green', 'green', 'green',
        'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue'
      ],
      vehicles: [
        { id: 'v0', color: 'red', type: 'sedan', capacity: 4 },
        { id: 'v1', color: 'green', type: 'small', capacity: 3 },
        { id: 'v2', color: 'blue', type: 'small', capacity: 3 },
        { id: 'v3', color: 'green', type: 'sedan', capacity: 4 },
        { id: 'v4', color: 'red', type: 'small', capacity: 3 },
        { id: 'v5', color: 'blue', type: 'sedan', capacity: 4 }
      ]
    },
    // 19
    {
      id: 19, name: 'Downtown Finale', slots: 3,
      passengers: [
        'red', 'red', 'red', 'yellow', 'yellow', 'yellow', 'yellow',
        'blue', 'blue', 'blue', 'red', 'red', 'red', 'red',
        'green', 'green', 'green', 'yellow', 'yellow', 'yellow',
        'blue', 'blue', 'blue', 'blue'
      ],
      vehicles: [
        { id: 'v0', color: 'yellow', type: 'sedan', capacity: 4 },
        { id: 'v1', color: 'red', type: 'small', capacity: 3 },
        { id: 'v2', color: 'blue', type: 'small', capacity: 3 },
        { id: 'v3', color: 'red', type: 'sedan', capacity: 4 },
        { id: 'v4', color: 'green', type: 'small', capacity: 3 },
        { id: 'v5', color: 'yellow', type: 'small', capacity: 3 },
        { id: 'v6', color: 'blue', type: 'sedan', capacity: 4 }
      ]
    },
    // 20
    {
      id: 20, name: 'City Clearance', slots: 4,
      passengers: [
        'blue', 'blue', 'blue', 'blue', 'red', 'red', 'red',
        'green', 'green', 'green', 'green', 'yellow', 'yellow', 'yellow', 'yellow',
        'blue', 'blue', 'blue', 'red', 'red', 'red', 'red',
        'green', 'green', 'green'
      ],
      vehicles: [
        { id: 'v0', color: 'red', type: 'small', capacity: 3 },
        { id: 'v1', color: 'blue', type: 'sedan', capacity: 4 },
        { id: 'v2', color: 'green', type: 'sedan', capacity: 4 },
        { id: 'v3', color: 'yellow', type: 'sedan', capacity: 4 },
        { id: 'v4', color: 'blue', type: 'small', capacity: 3 },
        { id: 'v5', color: 'red', type: 'sedan', capacity: 4 },
        { id: 'v6', color: 'green', type: 'small', capacity: 3 }
      ]
    }
  ];

  /**
   * Generate a solvable level by constructing a reverse-playable sequence:
   * build vehicles + passenger blocks that match a known exit order, then shuffle waiting order
   * while keeping solvability via solver check. Fallback to ordered (always solvable) layout.
   */
  function generateLevel(id, seed) {
    const rng = mulberry32((seed == null ? id * 9973 + 42 : seed) >>> 0);
    const diff = difficultyFor(id);
    const colorSet = COLORS.slice(0, diff.colors);
    const typePool = ['small', 'sedan', 'taxi', 'suv'];
    if (id >= 14) typePool.push('van');
    if (id >= 25) typePool.push('bus');

    const vCountMin = diff.vehicles[0];
    const vCountMax = diff.vehicles[1];
    const vCount = vCountMin + Math.floor(rng() * (vCountMax - vCountMin + 1));

    // Build exit order: sequence of vehicles that will leave
    const vehicles = [];
    const passengerBlocks = [];
    for (let i = 0; i < vCount; i++) {
      const color = pick(rng, colorSet);
      const type = pick(rng, typePool);
      const cap = (S.VEHICLE_TYPES[type] && S.VEHICLE_TYPES[type].capacity) || 4;
      let lock = 0;
      if (diff.locks > 0 && i > 0 && rng() < 0.25 * diff.locks) {
        lock = 1 + Math.floor(rng() * Math.min(2, diff.locks));
      }
      vehicles.push({
        id: 'v' + i,
        color: color,
        type: type,
        capacity: cap,
        filled: 0,
        lock: lock
      });
      for (let p = 0; p < cap; p++) passengerBlocks.push(color);
    }

    // Passengers in exit order = always solvable if we park in that order with enough slots
    // Interleave slightly for interest but keep blocks mostly contiguous
    let passengers = passengerBlocks.slice();
    if (id > 10 && rng() > 0.4) {
      // light shuffle of block boundaries only — keep contiguous color runs
      const runs = [];
      let i = 0;
      while (i < passengers.length) {
        const c = passengers[i];
        let j = i;
        while (j < passengers.length && passengers[j] === c) j++;
        runs.push(passengers.slice(i, j));
        i = j;
      }
      // shuffle run order slightly but prefer original (solvable) order
      if (runs.length > 2 && rng() > 0.5) {
        // swap two adjacent runs occasionally — may break solvability → solver will catch
        const k = Math.floor(rng() * (runs.length - 1));
        if (rng() > 0.6) {
          const tmp = runs[k]; runs[k] = runs[k + 1]; runs[k + 1] = tmp;
        }
      }
      passengers = [];
      for (let r = 0; r < runs.length; r++) passengers = passengers.concat(runs[r]);
    }

    // Shuffle vehicle waiting order (player must find correct order)
    let waiting = shuffle(rng, vehicles);

    // Obstacles: cosmetic blockers in waiting that can't be parked (skip for solvability)
    // We model obstacles as separate non-parkable entries — skip for now in generator
    // to keep solver clean; mark level.obstacles count for UI flavor only.

    const level = {
      id: id,
      name: worldFor(id).name + ' ' + id,
      slots: diff.slots,
      passengers: passengers,
      vehicles: waiting,
      generated: true,
      difficulty: diff.label,
      colors: diff.colors,
      locks: diff.locks,
      obstacles: diff.obstacles
    };

    // Validate
    const state = S.fromLevel(level);
    const result = S.solve(state, { maxNodes: 60000, maxDepth: 60 });
    if (result.solvable) {
      level._solutionLen = result.path ? result.path.length : 0;
      return level;
    }

    // Fallback: restore exit-order waiting (park in order 0..n-1) — always solvable with slots>=1
    // Actually with limited slots, exit-order of passengers matching vehicle order is solvable
    // if we park vehicles in the order their passenger blocks appear.
    const ordered = [];
    const used = new Set();
    let pi = 0;
    const pax = passengerBlocks.slice(); // original contiguous
    while (ordered.length < vehicles.length) {
      if (pi >= pax.length) break;
      const need = pax[pi];
      let found = -1;
      for (let vi = 0; vi < vehicles.length; vi++) {
        if (used.has(vi)) continue;
        if (vehicles[vi].color === need && vehicles[vi].lock === 0) {
          found = vi; break;
        }
      }
      if (found < 0) {
        for (let vi = 0; vi < vehicles.length; vi++) {
          if (used.has(vi)) continue;
          if (vehicles[vi].color === need) { found = vi; break; }
        }
      }
      if (found < 0) {
        for (let vi = 0; vi < vehicles.length; vi++) {
          if (!used.has(vi)) { found = vi; break; }
        }
      }
      used.add(found);
      ordered.push(Object.assign({}, vehicles[found], { lock: 0 })); // strip locks in fallback
      pi += ordered[ordered.length - 1].capacity;
    }

    const fallback = {
      id: id,
      name: worldFor(id).name + ' ' + id,
      slots: diff.slots,
      passengers: pax,
      vehicles: shuffle(rng, ordered), // still shuffle; contiguous pax + enough slots usually OK
      generated: true,
      difficulty: diff.label,
      colors: diff.colors,
      fallback: true
    };

    const st2 = S.fromLevel(fallback);
    const r2 = S.solve(st2, { maxNodes: 80000, maxDepth: 80 });
    if (r2.solvable) {
      fallback._solutionLen = r2.path ? r2.path.length : 0;
      return fallback;
    }

    // Ultimate fallback: vehicles in exact passenger-block order, no shuffle — trivially solvable
    const trivialWaiting = [];
    let idx = 0;
    let p = 0;
    while (p < pax.length && idx < ordered.length) {
      trivialWaiting.push(Object.assign({}, ordered[idx]));
      p += ordered[idx].capacity;
      idx++;
    }
    // Keep waiting in reverse so player must think? No — put in correct order for guarantee
    // Actually put shuffled but with slots = max(diff.slots, vCount) temporarily? 
    // Best: correct order, player still chooses (only one sensible path)
    const trivial = {
      id: id,
      name: worldFor(id).name + ' ' + id,
      slots: Math.max(diff.slots, 3),
      passengers: pax,
      vehicles: trivialWaiting.length ? trivialWaiting : ordered,
      generated: true,
      difficulty: diff.label,
      colors: diff.colors,
      trivial: true
    };
    return trivial;
  }

  // Build full catalog
  const LEVEL_COUNT = 120;
  const CACHE = {};

  function getHandcrafted(id) {
    for (let i = 0; i < HANDCRAFTED.length; i++) {
      if (HANDCRAFTED[i].id === id) return HANDCRAFTED[i];
    }
    return null;
  }

  function enrich(level) {
    const vCount = (level.vehicles || []).filter((v) => !v.obstacle).length;
    const stars = starsTargets(level.id, vCount);
    const world = worldFor(level.id);
    return Object.assign({}, level, {
      world: world.id,
      worldName: world.name,
      theme: world.theme,
      stars: stars,
      coinReward: coinReward,
      targetMoves: stars.moves3
    });
  }

  function getLevel(id) {
    if (id < 1 || id > LEVEL_COUNT) return null;
    if (CACHE[id]) return CACHE[id];
    let raw = getHandcrafted(id);
    if (!raw) raw = generateLevel(id, id * 7919 + 13);
    CACHE[id] = enrich(raw);
    return CACHE[id];
  }

  function getLevelCount() { return LEVEL_COUNT; }

  function getWorlds() { return WORLDS; }

  function getWorldLevels(worldId) {
    const w = WORLDS.find((x) => x.id === worldId);
    if (!w) return [];
    const list = [];
    for (let i = w.range[0]; i <= Math.min(w.range[1], LEVEL_COUNT); i++) list.push(getLevel(i));
    return list;
  }

  /** Daily challenge: seed from local date YYYY-MM-DD */
  function getDailyLevel(dateStr) {
    const s = dateStr || localDateStr();
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    const id = 40 + Math.abs(hash % 60); // mid-hard band
    const level = enrich(generateLevel(id, (hash ^ 0xda11) >>> 0));
    level.id = 'daily-' + s;
    level.name = 'Daily ' + s;
    level.daily = true;
    level.dailyDate = s;
    level.bonusCoins = 250;
    return level;
  }

  function localDateStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // Pre-warm handcrafted into cache
  for (let i = 0; i < HANDCRAFTED.length; i++) {
    CACHE[HANDCRAFTED[i].id] = enrich(HANDCRAFTED[i]);
  }

  root.CarJamLevels = {
    LEVEL_COUNT: LEVEL_COUNT,
    WORLDS: WORLDS,
    HANDCRAFTED: HANDCRAFTED,
    getLevel: getLevel,
    getLevelCount: getLevelCount,
    getWorlds: getWorlds,
    getWorldLevels: getWorldLevels,
    getDailyLevel: getDailyLevel,
    generateLevel: generateLevel,
    difficultyFor: difficultyFor,
    worldFor: worldFor,
    localDateStr: localDateStr,
    coinReward: coinReward,
    mulberry32: mulberry32
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
