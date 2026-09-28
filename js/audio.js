/**
 * Car Jam Solver — Web Audio SFX stubs (engine, door, board, exit, jam, win, click)
 */
(function (root) {
  'use strict';

  let ctx = null;
  let enabled = true;

  function ac() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, slide) {
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.linearRampToValueAtTime(slide, c.currentTime + dur);
    g.gain.setValueAtTime(gain || 0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }

  function noise(dur, gain) {
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    const n = c.createBufferSource();
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    n.buffer = buf;
    const g = c.createGain();
    g.gain.value = gain || 0.05;
    n.connect(g); g.connect(c.destination);
    n.start();
  }

  const SFX = {
    click: function () { tone(600, 0.05, 'sine', 0.06); },
    park: function () { tone(180, 0.15, 'sawtooth', 0.05, 120); noise(0.08, 0.03); },
    door: function () { tone(320, 0.08, 'triangle', 0.07); tone(220, 0.1, 'square', 0.03); },
    board: function () { tone(520, 0.06, 'sine', 0.05); },
    exit: function () { tone(240, 0.2, 'sawtooth', 0.06, 400); },
    combo: function (n) { tone(400 + n * 80, 0.18, 'square', 0.07); },
    win: function () { tone(523, 0.12, 'sine', 0.08); setTimeout(function () { tone(659, 0.12, 'sine', 0.08); }, 100); setTimeout(function () { tone(784, 0.25, 'sine', 0.09); }, 200); },
    jam: function () { tone(100, 0.4, 'sawtooth', 0.1, 60); noise(0.3, 0.06); },
    warn: function () { tone(440, 0.1, 'square', 0.05); setTimeout(function () { tone(440, 0.1, 'square', 0.05); }, 150); },
    undo: function () { tone(300, 0.1, 'sine', 0.05, 200); },
    coin: function () { tone(880, 0.08, 'sine', 0.06); tone(1175, 0.12, 'sine', 0.05); }
  };

  root.CarJamAudio = {
    setEnabled: function (v) { enabled = !!v; },
    isEnabled: function () { return enabled; },
    play: function (name, arg) { if (SFX[name]) SFX[name](arg); },
    unlock: function () { ac(); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
