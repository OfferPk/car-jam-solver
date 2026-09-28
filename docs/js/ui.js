/**
 * Car Jam Solver — screens & DOM UI (2.5D feel)
 */
(function (root) {
  'use strict';

  const S = root.CarJamSolver;
  const L = root.CarJamLevels;
  const G = root.CarJamGame;
  const Store = root.CarJamStorage;
  const Audio = root.CarJamAudio;
  const Ads = root.CarJamAds;

  let save = null;
  let session = null;
  let screen = 'main';
  let selectedWorld = 'downtown';
  let pendingBooster = null;
  let animBusy = false;

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  function init() {
    save = Store.load();
    Audio.setEnabled(save.settings.sfx !== false);
    bindShell();
    show('main');
    renderHudCoins();
    document.body.addEventListener('pointerdown', function once() {
      Audio.unlock();
      document.body.removeEventListener('pointerdown', once);
    }, { once: true });
  }

  function bindShell() {
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const act = btn.getAttribute('data-action');
      handleAction(act, btn);
    });
  }

  function handleAction(act, btn) {
    Audio.play('click');
    switch (act) {
      case 'play': show('map'); break;
      case 'daily': startDaily(); break;
      case 'garage': show('garage'); break;
      case 'settings': show('settings'); break;
      case 'main': show('main'); break;
      case 'map': show('map'); break;
      case 'world':
        selectedWorld = btn.getAttribute('data-world');
        renderMap();
        break;
      case 'level':
        startLevel(parseInt(btn.getAttribute('data-level'), 10));
        break;
      case 'pause': showPause(); break;
      case 'resume': hideOverlay(); break;
      case 'retry':
        if (session) startLevel(session.level.daily ? session.level : session.level.id);
        break;
      case 'next':
        Ads.showInterstitial(function () {
          if (session && typeof session.level.id === 'number') {
            const n = session.level.id + 1;
            if (n <= L.getLevelCount()) startLevel(n);
            else show('map');
          } else show('map');
        });
        break;
      case 'undo': doUndo(); break;
      case 'booster':
        useBooster(btn.getAttribute('data-booster'));
        break;
      case 'buy-booster':
        buyBooster(btn.getAttribute('data-booster'));
        break;
      case 'buy-skin':
        buyOrEquipSkin(btn.getAttribute('data-skin'));
        break;
      case 'toggle-sfx':
        save.settings.sfx = !save.settings.sfx;
        Audio.setEnabled(save.settings.sfx);
        Store.save(save);
        renderSettings();
        break;
      case 'toggle-fx':
        save.settings.reduceFx = !save.settings.reduceFx;
        Store.save(save);
        document.body.classList.toggle('reduce-fx', save.settings.reduceFx);
        renderSettings();
        break;
      case 'reward-coins':
        Ads.showRewarded('coins', function (r) {
          if (r.rewarded) {
            Store.addCoins(save, 100);
            Audio.play('coin');
            renderHudCoins();
            toast('+100 coins');
          }
        });
        break;
      case 'reward-undo':
        Ads.showRewarded('undo', function (r) {
          if (r.rewarded && session) {
            session.freeUndoLeft++;
            toast('Free undo ready');
            renderPlay();
          }
        });
        break;
      case 'fail-undo':
        doUndo();
        hideOverlay();
        break;
      case 'fail-booster':
        useBooster('extraParking');
        hideOverlay();
        break;
      default: break;
    }
  }

  function show(name) {
    screen = name;
    $$('.screen').forEach((el) => el.classList.remove('active'));
    const el = $('#screen-' + name);
    if (el) el.classList.add('active');
    hideOverlay();
    if (name === 'main') renderMain();
    if (name === 'map') renderMap();
    if (name === 'garage') renderGarage();
    if (name === 'settings') renderSettings();
    renderHudCoins();
  }

  function renderHudCoins() {
    $$('.coin-count').forEach((el) => { el.textContent = String(save.coins); });
  }

  function renderMain() {
    const el = $('#screen-main');
    if (!el) return;
    el.innerHTML = `
      <div class="hero">
        <div class="logo-3d">🚗 CAR JAM</div>
        <div class="logo-sub">SOLVER</div>
        <p class="tagline">Plan the order. Clear the lot. Avoid the jam.</p>
      </div>
      <div class="menu-btns">
        <button class="btn btn-primary btn-lg" data-action="play">PLAY</button>
        <button class="btn btn-daily" data-action="daily">DAILY CHALLENGE</button>
        <div class="menu-row">
          <button class="btn btn-secondary" data-action="garage">GARAGE</button>
          <button class="btn btn-secondary" data-action="settings">SETTINGS</button>
        </div>
      </div>
      <div class="main-meta">
        <span>⭐ Level ${save.unlocked}/${L.getLevelCount()}</span>
        <span class="coins"><span class="coin-icon">🪙</span> <span class="coin-count">${save.coins}</span></span>
      </div>
      <div class="version">v1.0.0-complete · offline</div>
    `;
  }

  function renderMap() {
    const el = $('#screen-map');
    const worlds = L.getWorlds();
    if (!selectedWorld) selectedWorld = worlds[0].id;
    const levels = L.getWorldLevels(selectedWorld);
    const tabs = worlds.map((w) =>
      `<button class="world-tab ${w.id === selectedWorld ? 'active' : ''}" data-action="world" data-world="${w.id}">${w.icon} ${w.name}</button>`
    ).join('');
    const grid = levels.map((lv) => {
      const locked = lv.id > save.unlocked;
      const st = save.stars[String(lv.id)] || 0;
      const stars = [1, 2, 3].map((i) => `<span class="star ${st >= i ? 'on' : ''}">★</span>`).join('');
      return `<button class="level-btn ${locked ? 'locked' : ''}" data-action="level" data-level="${lv.id}" ${locked ? 'disabled' : ''}>
        <span class="lv-num">${lv.id}</span>
        <span class="lv-stars">${stars}</span>
      </button>`;
    }).join('');
    el.innerHTML = `
      <div class="topbar">
        <button class="btn btn-ghost" data-action="main">← Back</button>
        <h2>Select Level</h2>
        <span class="coins"><span class="coin-icon">🪙</span> <span class="coin-count">${save.coins}</span></span>
      </div>
      <div class="world-tabs">${tabs}</div>
      <div class="level-grid">${grid}</div>
    `;
  }

  function startDaily() {
    const date = L.localDateStr();
    if (save.daily.completed === date) {
      toast('Daily already cleared — bonus streak: ' + (save.daily.streak || 0));
    }
    const level = L.getDailyLevel(date);
    startLevel(level);
  }

  function startLevel(idOrLevel) {
    const level = typeof idOrLevel === 'object' ? idOrLevel : L.getLevel(idOrLevel);
    if (!level) return;
    session = G.createSession(level);
    animBusy = false;
    pendingBooster = null;
    show('play');
    renderPlay();
  }

  function vehicleHTML(v, opts) {
    opts = opts || {};
    const hex = S.COLOR_HEX[v.color] || '#888';
    const type = v.type || 'sedan';
    const pct = Math.round((v.filled / v.capacity) * 100);
    const skin = save.skins.equipped || 'classic';
    const lock = v.lock > 0 ? `<span class="lock-badge">🔒${v.lock}</span>` : '';
    return `<div class="vehicle skin-${skin} type-${type} ${opts.cls || ''}" style="--car:${hex}" data-vid="${v.id}" ${opts.attrs || ''}>
      <div class="car-body">
        <div class="car-cabin"></div>
        <div class="car-stripe"></div>
        <div class="wheels"><i></i><i></i></div>
      </div>
      <div class="car-meta">
        <span class="cap">${v.filled}/${v.capacity}</span>
        ${lock}
      </div>
      <div class="fill-bar"><div style="width:${pct}%"></div></div>
    </div>`;
  }

  function passengerHTML(color, i) {
    const hex = S.COLOR_HEX[color] || '#888';
    return `<div class="passenger" style="--p:${hex}" title="${color}" data-i="${i}"></div>`;
  }

  function renderPlay() {
    const el = $('#screen-play');
    if (!el || !session) return;
    const st = session.state;
    const lv = session.level;
    const danger = S.isDangerous(st);

    const waiting = st.waiting.map((v, i) =>
      vehicleHTML(v, { cls: 'waiting tap', attrs: `data-action-park="${i}"` })
    ).join('') || '<div class="empty-hint">No vehicles left</div>';

    const parking = st.parking.map((v, i) => {
      if (!v) return `<div class="park-slot empty" data-slot="${i}"><span>P${i + 1}</span></div>`;
      return `<div class="park-slot filled" data-slot="${i}">${vehicleHTML(v, { cls: 'parked' })}</div>`;
    }).join('');

    const queue = st.passengers.slice(0, 24).map(passengerHTML).join('') +
      (st.passengers.length > 24 ? `<span class="more">+${st.passengers.length - 24}</span>` : '');

    const costs = G.BOOSTER_COSTS;
    el.innerHTML = `
      <div class="play-top">
        <button class="btn btn-ghost btn-sm" data-action="pause">❚❚</button>
        <div class="play-title">
          <strong>${lv.daily ? 'Daily' : 'Lv ' + lv.id}</strong>
          <span>${lv.name || ''}</span>
        </div>
        <span class="coins"><span class="coin-icon">🪙</span> <span class="coin-count">${save.coins}</span></span>
      </div>
      <div class="play-stats">
        <span>Moves ${session.moves}</span>
        <span>Target ${lv.targetMoves || '—'}</span>
        <span>Queue ${st.passengers.length}</span>
      </div>
      ${danger ? '<div class="warn-banner">⚠️ Parking almost full — choose carefully!</div>' : ''}
      <div class="parking-row slots-${st.slots}">${parking}</div>
      <div class="combo-layer" id="combo-layer"></div>
      <div class="queue-wrap">
        <div class="queue-label">PASSENGERS →</div>
        <div class="passenger-queue">${queue || '<em>All boarded!</em>'}</div>
      </div>
      <div class="waiting-wrap">
        <div class="queue-label">VEHICLES — tap to park</div>
        <div class="waiting-row">${waiting}</div>
      </div>
      <div class="play-toolbar">
        <button class="tool-btn" data-action="undo" title="Undo">↩ Undo${session.freeUndoLeft ? ' (free)' : ''}</button>
        <button class="tool-btn" data-action="booster" data-booster="extraParking" title="Extra slot">➕ Slot</button>
        <button class="tool-btn" data-action="booster" data-booster="removeVehicle" title="Remove vehicle">🚗✖</button>
        <button class="tool-btn" data-action="booster" data-booster="clearParking" title="Clear parking">🅿️↺</button>
        <button class="tool-btn" data-action="booster" data-booster="passengerSkip" title="Skip passenger">👤⏭</button>
      </div>
    `;

    // bind park taps
    $$('[data-action-park]', el).forEach((node) => {
      node.addEventListener('click', () => {
        if (animBusy) return;
        const idx = parseInt(node.getAttribute('data-action-park'), 10);
        doPark(idx);
      });
    });

    // booster remove needs selection mode
    if (pendingBooster === 'removeVehicle') {
      toast('Tap a waiting vehicle to remove');
      $$('.vehicle.waiting', el).forEach((node) => {
        node.classList.add('selectable');
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(node.getAttribute('data-action-park'), 10);
          applyRemove(idx);
        }, { once: true });
      });
    }
  }

  function doPark(idx) {
    if (!session || animBusy) return;
    const res = G.park(session, idx);
    if (!res.ok) {
      toast(res.reason === 'no_slot' ? 'No parking slot!' : 'Cannot park');
      return;
    }
    Audio.play('park');
    playEvents(res.events || [], () => {
      renderPlay();
      if (res.warned) Audio.play('warn');
      if (session.won) onWin();
      else if (session.lost) onFail();
    });
  }

  function playEvents(events, done) {
    if (save.settings.reduceFx || !events.length) {
      // still play light SFX
      events.forEach((ev) => {
        if (ev.type === 'board') Audio.play('board');
        if (ev.type === 'exit') { Audio.play('exit'); if (ev.combo > 1) Audio.play('combo', ev.combo); }
        if (ev.type === 'park') Audio.play('door');
      });
      const lastExit = events.filter((e) => e.type === 'exit').pop();
      if (lastExit && lastExit.combo > 1) showCombo(lastExit.combo);
      done();
      return;
    }
    animBusy = true;
    let i = 0;
    function step() {
      if (i >= events.length) {
        animBusy = false;
        done();
        return;
      }
      const ev = events[i++];
      if (ev.type === 'park') Audio.play('door');
      if (ev.type === 'board') {
        Audio.play('board');
        spawnParticle(ev.color);
      }
      if (ev.type === 'exit') {
        Audio.play('exit');
        if (ev.combo > 1) {
          Audio.play('combo', ev.combo);
          showCombo(ev.combo);
        }
        spawnExitBurst(ev.color);
      }
      setTimeout(step, ev.type === 'exit' ? 180 : 70);
    }
    step();
  }

  function showCombo(n) {
    const layer = $('#combo-layer');
    if (!layer) return;
    const d = document.createElement('div');
    d.className = 'combo-text';
    d.textContent = 'CLEAR x' + n;
    layer.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  function spawnParticle(color) {
    const layer = $('#combo-layer');
    if (!layer) return;
    const hex = S.COLOR_HEX[color] || '#fff';
    for (let i = 0; i < 4; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      p.style.setProperty('--p', hex);
      p.style.left = (40 + Math.random() * 40) + '%';
      p.style.top = (30 + Math.random() * 40) + '%';
      layer.appendChild(p);
      setTimeout(() => p.remove(), 600);
    }
  }

  function spawnExitBurst(color) {
    spawnParticle(color);
  }

  function doUndo() {
    if (!session) return;
    let res;
    if (session.freeUndoLeft > 0) {
      res = G.undo(session, false);
    } else if (Store.useBoosterInv(save, 'undo')) {
      session.freeUndoLeft = 1;
      res = G.undo(session, false);
      renderHudCoins();
    } else if (save.coins >= G.BOOSTER_COSTS.undo) {
      if (!confirm('Spend ' + G.BOOSTER_COSTS.undo + ' coins for Undo?')) return;
      Store.spendCoins(save, G.BOOSTER_COSTS.undo);
      res = G.undo(session, true);
      renderHudCoins();
    } else {
      Ads.showRewarded('undo', function (r) {
        if (r.rewarded) {
          session.freeUndoLeft++;
          const u = G.undo(session, false);
          if (u.ok) { Audio.play('undo'); renderPlay(); }
        }
      });
      return;
    }
    if (res && res.ok) {
      Audio.play('undo');
      toast('Undone');
      renderPlay();
    } else toast('Nothing to undo');
  }

  function useBooster(key) {
    if (!session) return;
    if (key === 'removeVehicle') {
      // pay first
      if (!payBooster(key)) return;
      pendingBooster = 'removeVehicle';
      renderPlay();
      return;
    }
    if (!payBooster(key)) return;
    let res;
    if (key === 'extraParking') res = G.boosterExtraParking(session);
    else if (key === 'clearParking') res = G.boosterClearParking(session);
    else if (key === 'passengerSkip') res = G.boosterPassengerSkip(session);
    if (res && res.ok) {
      Audio.play('coin');
      toast('Booster used');
      renderPlay();
      if (session.won) onWin();
    }
  }

  function applyRemove(idx) {
    pendingBooster = null;
    const res = G.boosterRemoveVehicle(session, idx);
    if (res.ok) {
      Audio.play('exit');
      toast('Vehicle removed');
      renderPlay();
      if (session.won) onWin();
    }
  }

  function payBooster(key) {
    if (Store.useBoosterInv(save, key)) return true;
    const cost = G.BOOSTER_COSTS[key];
    if (save.coins >= cost) {
      if (!confirm('Spend ' + cost + ' coins?')) return false;
      Store.spendCoins(save, cost);
      renderHudCoins();
      return true;
    }
    toast('Need coins or inventory');
    return false;
  }

  function buyBooster(key) {
    if (Store.buyBooster(save, key)) {
      Audio.play('coin');
      toast('Purchased');
      renderHudCoins();
      renderSettings();
    } else toast('Not enough coins');
  }

  function onWin() {
    Audio.play('win');
    Store.recordWin(save, session.level.daily ? session.level.id : session.level.id, session.stars, session.coinsEarned);
    if (session.daily) Store.recordDaily(save, session.level.dailyDate || L.localDateStr());
    renderHudCoins();
    const stars = [1, 2, 3].map((i) => `<span class="star big ${session.stars >= i ? 'on' : ''}">★</span>`).join('');
    showOverlay(`
      <div class="modal win">
        <h2>LOT CLEARED!</h2>
        <div class="stars-row">${stars}</div>
        <p>Moves ${session.moves} · Target ${session.level.targetMoves || '—'}</p>
        <p class="reward">+${session.coinsEarned} 🪙</p>
        <div class="modal-btns">
          <button class="btn btn-secondary" data-action="map">Map</button>
          <button class="btn btn-primary" data-action="next">Next</button>
        </div>
      </div>
    `);
  }

  function onFail() {
    Audio.play('jam');
    Store.recordFail(save);
    showOverlay(`
      <div class="modal fail">
        <h2>🚦 TRAFFIC JAM</h2>
        <p>Parking full — no valid move.</p>
        <div class="modal-btns">
          <button class="btn btn-secondary" data-action="fail-undo">↩ Undo</button>
          <button class="btn btn-secondary" data-action="fail-booster">➕ Extra Slot</button>
          <button class="btn btn-primary" data-action="retry">Retry</button>
        </div>
        <button class="btn btn-ghost" data-action="map" style="margin-top:8px">Map</button>
      </div>
    `);
  }

  function showPause() {
    showOverlay(`
      <div class="modal">
        <h2>Paused</h2>
        <div class="modal-btns col">
          <button class="btn btn-primary" data-action="resume">Resume</button>
          <button class="btn btn-secondary" data-action="retry">Retry</button>
          <button class="btn btn-secondary" data-action="reward-undo">Watch Ad: Free Undo</button>
          <button class="btn btn-ghost" data-action="map">Quit to Map</button>
        </div>
      </div>
    `);
  }

  function showOverlay(html) {
    let o = $('#overlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'overlay';
      document.body.appendChild(o);
    }
    o.innerHTML = html;
    o.classList.add('show');
  }

  function hideOverlay() {
    const o = $('#overlay');
    if (o) { o.classList.remove('show'); o.innerHTML = ''; }
  }

  function renderGarage() {
    const el = $('#screen-garage');
    const cards = Store.SKINS.map((sk) => {
      const owned = save.skins.owned.indexOf(sk.id) >= 0;
      const eq = save.skins.equipped === sk.id;
      return `<div class="skin-card ${eq ? 'equipped' : ''}">
        <div class="skin-preview skin-${sk.id}"><div class="car-body"><div class="car-cabin"></div></div></div>
        <h3>${sk.name}</h3>
        <p>${owned ? (eq ? 'Equipped' : 'Owned') : sk.price + ' 🪙'}</p>
        <button class="btn btn-sm ${eq ? 'btn-ghost' : 'btn-primary'}" data-action="buy-skin" data-skin="${sk.id}">
          ${eq ? 'Equipped' : owned ? 'Equip' : 'Buy'}
        </button>
      </div>`;
    }).join('');
    el.innerHTML = `
      <div class="topbar">
        <button class="btn btn-ghost" data-action="main">← Back</button>
        <h2>Garage Skins</h2>
        <span class="coins"><span class="coin-icon">🪙</span> <span class="coin-count">${save.coins}</span></span>
      </div>
      <p class="hint">Cosmetic only — does not affect puzzle.</p>
      <div class="skin-grid">${cards}</div>
    `;
  }

  function buyOrEquipSkin(id) {
    if (save.skins.owned.indexOf(id) >= 0) {
      Store.equipSkin(save, id);
      toast('Equipped');
    } else if (Store.buySkin(save, id)) {
      Store.equipSkin(save, id);
      Audio.play('coin');
      toast('Purchased & equipped');
    } else toast('Not enough coins');
    renderHudCoins();
    renderGarage();
  }

  function renderSettings() {
    const el = $('#screen-settings');
    const b = save.boosters;
    el.innerHTML = `
      <div class="topbar">
        <button class="btn btn-ghost" data-action="main">← Back</button>
        <h2>Settings</h2>
        <span></span>
      </div>
      <div class="settings-list">
        <button class="setting-row" data-action="toggle-sfx">SFX: <strong>${save.settings.sfx ? 'ON' : 'OFF'}</strong></button>
        <button class="setting-row" data-action="toggle-fx">Reduce FX: <strong>${save.settings.reduceFx ? 'ON' : 'OFF'}</strong></button>
        <button class="setting-row" data-action="reward-coins">🎁 Rewarded: +100 coins</button>
      </div>
      <h3>Booster Inventory</h3>
      <div class="boost-inv">
        ${['undo','extraParking','removeVehicle','clearParking','passengerSkip'].map((k) =>
          `<div class="boost-card"><span>${k}</span><strong>×${b[k] || 0}</strong>
           <button class="btn btn-sm" data-action="buy-booster" data-booster="${k}">Buy ${G.BOOSTER_COSTS[k]}🪙</button></div>`
        ).join('')}
      </div>
      <p class="hint">Boosters are optional — every level is solvable without them.</p>
      <p class="version">Car Jam Solver ${document.querySelector('meta[name="version"]')?.content || '1.0.0-complete'} · Privacy: local-only save, no accounts.</p>
      <p><a href="privacy.html" style="color:#7ec8ff">Privacy</a></p>
    `;
  }

  function toast(msg) {
    let t = $('#toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(() => t.classList.remove('show'), 1600);
  }

  // map action from overlay buttons that say data-action="map"
  const _orig = handleAction;
  // already handled via bindShell

  // Fix: map action
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="map"]');
    if (btn) { show('map'); }
  });

  root.CarJamUI = { init: init, show: show, getSave: () => save, getSession: () => session };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof globalThis !== 'undefined' ? globalThis : window);
