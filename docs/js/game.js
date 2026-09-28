/**
 * Car Jam Solver — session / undo / boosters / stars
 */
(function (root) {
  'use strict';

  const S = root.CarJamSolver;

  const BOOSTER_COSTS = {
    undo: 50,
    extraParking: 120,
    removeVehicle: 100,
    clearParking: 150,
    passengerSkip: 80
  };

  function createSession(level, opts) {
    opts = opts || {};
    const state = S.fromLevel(level);
    return {
      level: level,
      state: state,
      history: [],
      moves: 0,
      mistakes: 0,
      undosUsed: 0,
      freeUndoLeft: 1,
      boostersUsed: 0,
      comboMax: 0,
      won: false,
      lost: false,
      stars: 0,
      coinsEarned: 0,
      warned: false,
      extraSlots: 0,
      startedAt: Date.now(),
      daily: !!level.daily
    };
  }

  function snapshot(session) {
    return {
      state: S.cloneState(session.state),
      moves: session.moves,
      mistakes: session.mistakes,
      comboMax: session.comboMax,
      extraSlots: session.extraSlots
    };
  }

  function pushHistory(session) {
    session.history.push(snapshot(session));
    if (session.history.length > 40) session.history.shift();
  }

  function restoreSnapshot(session, snap) {
    session.state = S.cloneState(snap.state);
    session.moves = snap.moves;
    session.mistakes = snap.mistakes;
    session.comboMax = snap.comboMax;
    session.extraSlots = snap.extraSlots;
    session.won = false;
    session.lost = false;
    session.warned = false;
  }

  function park(session, waitingIndex) {
    if (session.won || session.lost) return { ok: false, reason: 'ended' };
    pushHistory(session);
    const beforeDanger = S.isDangerous(session.state);
    const res = S.parkVehicle(session.state, waitingIndex);
    if (!res.ok) {
      session.history.pop();
      return res;
    }
    session.state = res.state;
    session.moves = session.state.moves;
    if (session.state.combo > session.comboMax) session.comboMax = session.state.combo;

    // mistake heuristic: parked a car that couldn't board anything while danger
    const boarded = (res.events || []).some((e) => e.type === 'board');
    if (beforeDanger && !boarded) session.mistakes++;

    if (S.isWin(session.state)) {
      session.won = true;
      session.stars = calcStars(session);
      session.coinsEarned = (session.level.coinReward || root.CarJamLevels.coinReward)(session.stars);
      if (session.daily) session.coinsEarned += (session.level.bonusCoins || 250);
    } else if (S.isLose(session.state)) {
      session.lost = true;
    } else if (S.isDangerous(session.state)) {
      session.warned = true;
    } else {
      session.warned = false;
    }
    return { ok: true, events: res.events, won: session.won, lost: session.lost, warned: session.warned };
  }

  function calcStars(session) {
    const t = session.level.stars || { moves3: 99, moves2: 999, mistakes3: 0, mistakes2: 2 };
    const noBooster = session.boostersUsed === 0;
    if (session.mistakes <= (t.mistakes3 || 0) && session.moves <= (t.moves3 || 99) && noBooster) return 3;
    if (session.mistakes <= (t.mistakes2 || 2) && session.moves <= (t.moves2 || 999)) return 2;
    return 1;
  }

  function undo(session, payWithCoin) {
    if (!session.history.length) return { ok: false, reason: 'empty' };
    if (session.freeUndoLeft > 0) {
      session.freeUndoLeft--;
      session.undosUsed++;
      restoreSnapshot(session, session.history.pop());
      return { ok: true, free: true };
    }
    if (payWithCoin) {
      session.undosUsed++;
      session.boostersUsed++;
      restoreSnapshot(session, session.history.pop());
      return { ok: true, free: false, cost: BOOSTER_COSTS.undo };
    }
    return { ok: false, reason: 'need_coins', cost: BOOSTER_COSTS.undo };
  }

  /** Extra parking slot booster */
  function boosterExtraParking(session) {
    if (session.won || session.lost) return { ok: false };
    pushHistory(session);
    session.state.slots += 1;
    session.state.parking.push(null);
    session.extraSlots++;
    session.boostersUsed++;
    session.lost = false;
    return { ok: true, cost: BOOSTER_COSTS.extraParking };
  }

  /** Remove one waiting vehicle (and its required passengers from queue — from back matching color) */
  function boosterRemoveVehicle(session, waitingIndex) {
    if (session.won || session.lost) return { ok: false };
    if (waitingIndex < 0 || waitingIndex >= session.state.waiting.length) return { ok: false };
    pushHistory(session);
    const v = session.state.waiting.splice(waitingIndex, 1)[0];
    let need = v.capacity - v.filled;
    // remove matching passengers from end of queue to keep front stable
    for (let i = session.state.passengers.length - 1; i >= 0 && need > 0; i--) {
      if (session.state.passengers[i] === v.color) {
        session.state.passengers.splice(i, 1);
        need--;
      }
    }
    session.boostersUsed++;
    if (S.isWin(session.state)) {
      session.won = true;
      session.stars = calcStars(session);
      session.coinsEarned = (session.level.coinReward || root.CarJamLevels.coinReward)(session.stars);
    }
    return { ok: true, cost: BOOSTER_COSTS.removeVehicle, removed: v };
  }

  /** Clear all parking — send cars back to waiting (filled stays) */
  function boosterClearParking(session) {
    if (session.won || session.lost) return { ok: false };
    pushHistory(session);
    for (let i = 0; i < session.state.parking.length; i++) {
      if (session.state.parking[i]) {
        session.state.waiting.push(session.state.parking[i]);
        session.state.parking[i] = null;
      }
    }
    session.boostersUsed++;
    session.lost = false;
    return { ok: true, cost: BOOSTER_COSTS.clearParking };
  }

  /** Skip / remove front passenger */
  function boosterPassengerSkip(session) {
    if (session.won || session.lost) return { ok: false };
    if (!session.state.passengers.length) return { ok: false };
    pushHistory(session);
    const c = session.state.passengers.shift();
    session.boostersUsed++;
    // also reduce a matching waiting/parked capacity need? simpler: just remove passenger;
    // may make a vehicle impossible to fill — also remove 1 capacity from a matching waiting car
    const pool = session.state.parking.filter(Boolean).concat(session.state.waiting);
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].color === c && pool[i].capacity > pool[i].filled) {
        pool[i].capacity--;
        if (pool[i].capacity <= pool[i].filled) {
          // treat as full → if parked, exit
          const slot = session.state.parking.indexOf(pool[i]);
          if (slot >= 0) {
            session.state.parking[slot] = null;
            session.state.cleared++;
          } else {
            const wi = session.state.waiting.indexOf(pool[i]);
            if (wi >= 0) session.state.waiting.splice(wi, 1);
          }
        }
        break;
      }
    }
    S.processBoarding(session.state);
    if (S.isWin(session.state)) {
      session.won = true;
      session.stars = calcStars(session);
      session.coinsEarned = (session.level.coinReward || root.CarJamLevels.coinReward)(session.stars);
    } else if (S.isLose(session.state)) session.lost = true;
    return { ok: true, cost: BOOSTER_COSTS.passengerSkip, skipped: c };
  }

  root.CarJamGame = {
    BOOSTER_COSTS: BOOSTER_COSTS,
    createSession: createSession,
    park: park,
    undo: undo,
    calcStars: calcStars,
    boosterExtraParking: boosterExtraParking,
    boosterRemoveVehicle: boosterRemoveVehicle,
    boosterClearParking: boosterClearParking,
    boosterPassengerSkip: boosterPassengerSkip,
    snapshot: snapshot
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
