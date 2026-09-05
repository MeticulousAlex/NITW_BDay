// Минимальный звуковой движок на WebAudio: ночной эмбиент, гитарный рифф, тики печатной машинки.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
    startAmbient();
  } catch {
    // звук недоступен — игра работает и без него
  }
}

function startAmbient() {
  if (!ctx || !master) return;
  // два расстроенных синуса — низкий ночной гул
  const freqs = [55, 55.7, 110.4];
  freqs.forEach((f, i) => {
    const osc = ctx!.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ctx!.createGain();
    g.gain.value = i === 2 ? 0.012 : 0.03;
    osc.connect(g).connect(master!);
    osc.start();
  });
  // медленная «дыхательная» модуляция громкости
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.012;
  const padGain = ctx.createGain();
  padGain.gain.value = 0.02;
  lfo.connect(lfoGain).connect(padGain.gain);
  const pad = ctx.createOscillator();
  pad.type = 'triangle';
  pad.frequency.value = 220;
  pad.connect(padGain).connect(master);
  pad.start();
  lfo.start();
}

export function toggleMute(): boolean {
  muted = !muted;
  if (master && ctx) {
    master.gain.setTargetAtTime(muted ? 0 : 0.6, ctx.currentTime, 0.1);
  }
  return muted;
}

export function isMuted() {
  return muted;
}

// щелчок печатной машинки в диалогах
export function blip() {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 900 + Math.random() * 300;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.018, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.05);
}

// гитарный щипок
function pluck(freq: number, at: number, dur = 0.5) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  osc.connect(lp).connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// маленький ночной рифф
export function playRiff() {
  if (!ctx || !master || muted) return;
  const seq: Array<[number, number, number?]> = [
    [220.0, 0.0], // A3
    [261.63, 0.28], // C4
    [329.63, 0.56], // E4
    [293.66, 0.84], // D4
    [261.63, 1.12],
    [220.0, 1.4, 0.9],
  ];
  seq.forEach(([f, at, d]) => pluck(f, at, d ?? 0.5));
}
