/**
 * Car Jam Solver — pure logic + BFS auto-solver for level validation.
 * No DOM. Usable from browser and Node smoke tests.
 */
(function (root) {
  'use strict';

  const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];
  const COLOR_HEX = {
    red: '#e74c3c', blue: '#3498db', green: '#2ecc71', yellow: '#f1c40f',
    purple: '#9b59b6', orange: '#e67e22', pink: '#ff6b9d', cyan: '#1abc9c'
  };

  const VEHICLE_TYPES = {
    small: { name: 'Small Car', capacity: 3, len: 1 },
    sedan: { name: 'Sedan', capacity: 4, len: 1.1 },
    taxi: { name: 'Taxi', capacity: 4, len: 1.1 },
    suv: { name: 'SUV', capacity: 4, len: 1.2 },
    van: { name: 'Van', capacity: 5, len: 1.35 },
    bus: { name: 'Bus', capacity: 6, len: 1.6 }
  };

  function cloneState(s) {
    return {
      passengers: s.passengers.slice(),
      waiting: s.waiting.map((v) => Object.assign({}, v)),
      parking: s.parking.map((v) => (v ? Object.assign({}, v) : null)),
      slots: s.slots,
      moves: s.moves || 0,
      cleared: s.cleared || 0,
      combo: s.combo || 0,
      locksCleared: s.locksCleared || 0
    };
  }

  function stateKey(s) {
    const p = s.passengers.join('');
    const w = s.waiting.map((v) => v.color[0] + v.capacity + ':' + v.filled + (v.lock ? 'L' + v.lock : '')).sort().join('|');
    const park = s.parking.map((v) => (v ? v.color[0] + v.capacity + ':' + v.filled + (v.lock ? 'L' + v.lock : '') : '_')).join(',');
    return p + '#' + w + '#' + park;
  }

  function emptySlots(s) {
    let n = 0;
    for (let i = 0; i < s.parking.length; i++) if (!s.parking[i]) n++;
    return n;
  }

  function canBoard(vehicle, passengerColor) {
    if (!vehicle) return false;
    if (vehicle.lock && vehicle.lock > 0) return false;
    if (vehicle.color !== passengerColor) return false;
    return vehicle.filled < vehicle.capacity;
  }

  /** Auto-board passengers into matching parked vehicles; exit full ones. Returns events. */
  function processBoarding(s) {
    const events = [];
    let changed = true;
    let combo = 0;
    while (changed) {
      changed = false;
      if (s.passengers.length === 0) break;
      const next = s.passengers[0];
      let boarded = false;
      for (let i = 0; i < s.parking.length; i++) {
        const v = s.parking[i];
        if (canBoard(v, next)) {
          v.filled++;
          s.passengers.shift();
          events.push({ type: 'board', slot: i, color: next, filled: v.filled, capacity: v.capacity });
          boarded = true;
          changed = true;
          if (v.filled >= v.capacity) {
            combo++;
            s.cleared = (s.cleared || 0) + 1;
            s.combo = combo;
            events.push({ type: 'exit', slot: i, color: v.color, combo: combo });
            // unlock other locked vehicles by 1 when any exits
            unlockStep(s, events);
            s.parking[i] = null;
            events.push({ type: 'free', slot: i });
          }
          break;
        }
      }
      if (!boarded) break;
    }
    return events;
  }

  function unlockStep(s, events) {
    const all = s.waiting.concat(s.parking.filter(Boolean));
    for (let i = 0; i < all.length; i++) {
      const v = all[i];
      if (v && v.lock && v.lock > 0) {
        v.lock--;
        s.locksCleared = (s.locksCleared || 0) + 1;
        if (events) events.push({ type: 'unlock', id: v.id, lock: v.lock });
      }
    }
  }

  /** Park waiting vehicle at waitingIndex into first empty slot. Returns {ok, events, state} or fail. */
  function parkVehicle(s, waitingIndex) {
    if (waitingIndex < 0 || waitingIndex >= s.waiting.length) return { ok: false, reason: 'bad_index' };
    const slot = s.parking.indexOf(null);
    if (slot < 0) return { ok: false, reason: 'no_slot' };
    const v = s.waiting[waitingIndex];
    if (v.obstacle) return { ok: false, reason: 'obstacle' };
    // obstacles in front of lane: optional blockedUntil
    if (v.blocked) return { ok: false, reason: 'blocked' };

    const next = cloneState(s);
    const vehicle = next.waiting.splice(waitingIndex, 1)[0];
    next.parking[slot] = vehicle;
    next.moves = (next.moves || 0) + 1;
    const events = [{ type: 'park', slot: slot, vehicle: Object.assign({}, vehicle) }];
    const boardEvents = processBoarding(next);
    return { ok: true, events: events.concat(boardEvents), state: next };
  }

  function isWin(s) {
    return s.passengers.length === 0 && s.waiting.length === 0 && s.parking.every((v) => !v);
  }

  function isLose(s) {
    if (isWin(s)) return false;
    if (emptySlots(s) > 0) return false;
    if (s.passengers.length === 0) {
      // parking still has cars but no passengers — can only win if cars somehow leave;
      // without passengers they never fill → stuck unless already full (shouldn't happen)
      return s.parking.some(Boolean);
    }
    const nextColor = s.passengers[0];
    for (let i = 0; i < s.parking.length; i++) {
      if (canBoard(s.parking[i], nextColor)) return false;
    }
    // parking full and no match → traffic jam
    return true;
  }

  function isDangerous(s) {
    if (emptySlots(s) !== 1) return false;
    if (s.passengers.length === 0) return false;
    // one slot left — warn if bringing wrong colors could jam
    return true;
  }

  function legalMoves(s) {
    const moves = [];
    if (emptySlots(s) === 0) return moves;
    for (let i = 0; i < s.waiting.length; i++) {
      const v = s.waiting[i];
      if (v.obstacle || v.blocked) continue;
      moves.push(i);
    }
    return moves;
  }

  /**
   * BFS solver. Returns { solvable, path, nodes } path = waiting indices sequence on evolving state.
   * path stores vehicle ids for stability.
   */
  function solve(initial, opts) {
    opts = opts || {};
    const maxNodes = opts.maxNodes || 80000;
    const maxDepth = opts.maxDepth || 80;
    const start = cloneState(initial);
    // normalize parking length
    while (start.parking.length < start.slots) start.parking.push(null);
    start.parking = start.parking.slice(0, start.slots);

    if (isWin(start)) return { solvable: true, path: [], nodes: 0 };
    if (isLose(start)) return { solvable: false, path: null, nodes: 0 };

    const queue = [{ state: start, path: [] }];
    const seen = new Set([stateKey(start)]);
    let nodes = 0;

    while (queue.length && nodes < maxNodes) {
      const cur = queue.shift();
      nodes++;
      if (cur.path.length >= maxDepth) continue;
      const moves = legalMoves(cur.state);
      for (let m = 0; m < moves.length; m++) {
        const idx = moves[m];
        const vid = cur.state.waiting[idx].id;
        const res = parkVehicle(cur.state, idx);
        if (!res.ok) continue;
        if (isWin(res.state)) {
          return { solvable: true, path: cur.path.concat([vid]), nodes: nodes };
        }
        if (isLose(res.state)) continue;
        const key = stateKey(res.state);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ state: res.state, path: cur.path.concat([vid]) });
      }
    }
    return { solvable: false, path: null, nodes: nodes };
  }

  /** Build initial state from level definition */
  function fromLevel(level) {
    const waiting = (level.vehicles || []).map((v, i) => ({
      id: v.id != null ? v.id : 'v' + i,
      color: v.color,
      capacity: v.capacity || (VEHICLE_TYPES[v.type] && VEHICLE_TYPES[v.type].capacity) || 4,
      filled: v.filled || 0,
      type: v.type || 'sedan',
      lock: v.lock || 0,
      obstacle: !!v.obstacle,
      blocked: !!v.blocked,
      skin: v.skin || null
    }));
    const slots = level.slots || 3;
    const parking = [];
    for (let i = 0; i < slots; i++) {
      if (level.parking && level.parking[i]) {
        const v = level.parking[i];
        parking.push({
          id: v.id != null ? v.id : 'p' + i,
          color: v.color,
          capacity: v.capacity || 4,
          filled: v.filled || 0,
          type: v.type || 'sedan',
          lock: v.lock || 0,
          skin: v.skin || null
        });
      } else parking.push(null);
    }
    const state = {
      passengers: (level.passengers || []).slice(),
      waiting: waiting,
      parking: parking,
      slots: slots,
      moves: 0,
      cleared: 0,
      combo: 0
    };
    // initial auto-board if any
    processBoarding(state);
    return state;
  }

  function countPassengersNeeded(vehicles) {
    let n = 0;
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      if (v.obstacle) continue;
      n += (v.capacity || 4) - (v.filled || 0);
    }
    return n;
  }

  root.CarJamSolver = {
    COLORS: COLORS,
    COLOR_HEX: COLOR_HEX,
    VEHICLE_TYPES: VEHICLE_TYPES,
    cloneState: cloneState,
    stateKey: stateKey,
    emptySlots: emptySlots,
    canBoard: canBoard,
    processBoarding: processBoarding,
    parkVehicle: parkVehicle,
    isWin: isWin,
    isLose: isLose,
    isDangerous: isDangerous,
    legalMoves: legalMoves,
    solve: solve,
    fromLevel: fromLevel,
    countPassengersNeeded: countPassengersNeeded
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
