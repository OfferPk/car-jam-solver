/**
 * Car Jam Solver — localStorage persistence
 */
(function (root) {
  'use strict';

  const KEY = 'carjam_save_v1';

  const DEFAULT = {
    version: 1,
    level: 1,
    unlocked: 1,
    stars: {},
    coins: 200,
    skins: { owned: ['classic'], equipped: 'classic' },
    boosters: { undo: 2, extraParking: 1, removeVehicle: 1, clearParking: 0, passengerSkip: 1 },
    daily: { lastDate: null, streak: 0, completed: null },
    settings: { sound: true, sfx: true, reduceFx: false, music: true },
    stats: { played: 0, won: 0, jams: 0 }
  };

  const SKINS = [
    { id: 'classic', name: 'Classic', price: 0 },
    { id: 'taxi', name: 'Taxi', price: 300 },
    { id: 'police', name: 'Police', price: 400 },
    { id: 'sports', name: 'Sports', price: 500 },
    { id: 'suv', name: 'SUV Gloss', price: 450 },
    { id: 'minibus', name: 'Mini Bus', price: 550 },
    { id: 'neon', name: 'Neon', price: 700 },
    { id: 'luxury', name: 'Luxury', price: 900 }
  ];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULT);
      const data = JSON.parse(raw);
      return deepMerge(clone(DEFAULT), data);
    } catch (e) {
      return clone(DEFAULT);
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function deepMerge(base, over) {
    if (!over || typeof over !== 'object') return base;
    Object.keys(over).forEach((k) => {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) {
        base[k] = deepMerge(base[k] || {}, over[k]);
      } else {
        base[k] = over[k];
      }
    });
    return base;
  }

  function recordWin(data, levelId, stars, coins) {
    const id = String(levelId);
    const prev = data.stars[id] || 0;
    if (stars > prev) data.stars[id] = stars;
    data.coins += coins;
    data.stats.played++;
    data.stats.won++;
    if (typeof levelId === 'number') {
      if (levelId >= data.unlocked) data.unlocked = Math.min(levelId + 1, root.CarJamLevels ? root.CarJamLevels.LEVEL_COUNT : 120);
      if (levelId >= data.level) data.level = levelId;
    }
    save(data);
    return data;
  }

  function recordFail(data) {
    data.stats.played++;
    data.stats.jams++;
    save(data);
    return data;
  }

  function spendCoins(data, n) {
    if (data.coins < n) return false;
    data.coins -= n;
    save(data);
    return true;
  }

  function addCoins(data, n) {
    data.coins += n;
    save(data);
    return data;
  }

  function useBoosterInv(data, key) {
    if ((data.boosters[key] || 0) > 0) {
      data.boosters[key]--;
      save(data);
      return true;
    }
    return false;
  }

  function buyBooster(data, key) {
    const costs = root.CarJamGame.BOOSTER_COSTS;
    const cost = costs[key];
    if (cost == null || data.coins < cost) return false;
    data.coins -= cost;
    data.boosters[key] = (data.boosters[key] || 0) + 1;
    save(data);
    return true;
  }

  function buySkin(data, skinId) {
    const skin = SKINS.find((s) => s.id === skinId);
    if (!skin) return false;
    if (data.skins.owned.indexOf(skinId) >= 0) return false;
    if (data.coins < skin.price) return false;
    data.coins -= skin.price;
    data.skins.owned.push(skinId);
    save(data);
    return true;
  }

  function equipSkin(data, skinId) {
    if (data.skins.owned.indexOf(skinId) < 0) return false;
    data.skins.equipped = skinId;
    save(data);
    return true;
  }

  function recordDaily(data, dateStr) {
    if (data.daily.completed === dateStr) return data;
    const yesterday = prevDate(dateStr);
    if (data.daily.lastDate === yesterday) data.daily.streak = (data.daily.streak || 0) + 1;
    else data.daily.streak = 1;
    data.daily.lastDate = dateStr;
    data.daily.completed = dateStr;
    save(data);
    return data;
  }

  function prevDate(s) {
    const d = new Date(s + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  root.CarJamStorage = {
    KEY: KEY,
    DEFAULT: DEFAULT,
    SKINS: SKINS,
    load: load,
    save: save,
    recordWin: recordWin,
    recordFail: recordFail,
    spendCoins: spendCoins,
    addCoins: addCoins,
    useBoosterInv: useBoosterInv,
    buyBooster: buyBooster,
    buySkin: buySkin,
    equipSkin: equipSkin,
    recordDaily: recordDaily
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
