// Игровой движок: цикл, ввод, физика, камера, точки взаимодействия и диалоги.

import {
  WORLD_W,
  WORLD_H,
  FLOOR_Y,
  ROOM_L,
  ROOM_R,
  MAE_H,
  RUN_SPEED,
  RUN_ACCEL,
  RUN_DECEL,
  TURN_HOLD,
  TURN_ACCEL,
  GRAVITY,
  JUMP_VELOCITY,
  HOTSPOTS,
  type Hotspot,
} from './data';
import { clamp, damp } from './draw';
import { drawRoom, drawFront } from './room';
import { Mae } from './mae';
import { Dialogue } from './dialogue';

const FADE_TIME = 0.9; // выход: затемнение → пауза → обратно (сцены этажа пока нет)

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mae = new Mae();
  private dialogue = new Dialogue();

  private raf = 0;
  private lastT = 0;
  private running = false;

  private keys = new Set<string>();
  private player = {
    x: 900,
    y: FLOOR_Y,
    vy: 0,
    dir: 1 as 1 | -1,
    speed: 0,
    airborne: false,
    turning: false, // разворот на бегу: торможение → пауза → быстрый разгон, без облачка пыли
    turnHold: 0, // остаток паузы на месте, с
  };
  private camX = 0;
  private viewW = WORLD_W;
  private viewH = WORLD_H;
  private scale = 1;

  private activeHotspot: Hotspot | null = null;
  private promptSpot: Hotspot | null = null; // где рисовать подсказку (и пока она исчезает)
  private fade = -1; // время затемнения при выходе, −1 — нет
  private dust: { x: number; y: number; dir: 1 | -1; t: number }[] = [];
  // dev: эталонный кадр поверх Мэй (?ref=имя файла из refs-local), O — вкл/выкл
  private refImg = ((): HTMLImageElement | null => {
    const name = import.meta.env.DEV && new URLSearchParams(location.search).get('ref');
    if (!name) return null;
    const img = new Image();
    img.src = `/refs-local/${name}`;
    return img;
  })();
  private refOn = true;

  private get locked() {
    return this.dialogue.open || this.fade >= 0;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', ' ', 'a', 'd', 'w', 'e', 'enter'].includes(k)) {
      e.preventDefault();
    }
    this.keys.add(k);
    if (k === 'o') this.refOn = !this.refOn;
    if (this.dialogue.open) {
      if (!e.repeat) this.dialogue.key(k);
      return;
    }
    if (this.locked) return;
    if ((k === ' ' || k === 'w' || k === 'arrowup') && !e.repeat && !this.player.airborne) {
      this.player.vy = JUMP_VELOCITY;
      this.player.airborne = true;
    }
    if ((k === 'e' || k === 'enter') && !e.repeat && this.activeHotspot && !this.player.airborne) {
      const h = this.activeHotspot;
      this.player.speed = 0;
      this.dialogue.start(h.script, h.promptX, h.promptY);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onResize = () => {
    this.resize();
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dialogue.onClose = (action) => {
      if (action === 'exit') this.fade = 0;
    };
    void document.fonts.load('600 58px "Yanone Kaffeesatz"'); // canvas сам шрифт не подгружает
    this.resize();
  }

  start() {
    if (this.running) return;
    this.running = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    this.lastT = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.lastT) / 1000);
      this.lastT = now;
      this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
  }

  private resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    // логический вьюпорт: высота всегда WORLD_H, ширина по аспекту
    this.viewH = WORLD_H;
    this.viewW = WORLD_H * (w / Math.max(1, h));
    this.scale = (h * dpr) / WORLD_H;
  }

  private update(dt: number) {
    const p = this.player;

    if (!this.locked) {
      let move = 0;
      if (this.keys.has('arrowleft') || this.keys.has('a')) move -= 1;
      if (this.keys.has('arrowright') || this.keys.has('d')) move += 1;

      if (move !== 0) {
        if (p.speed !== 0 && Math.sign(p.speed) !== move && !p.airborne) {
          // разворот на бегу (по видео): сначала торможение как при остановке, лицом по старому направлению
          p.speed = Math.sign(p.speed) * Math.max(0, Math.abs(p.speed) - RUN_DECEL * dt);
          p.turning = true;
          p.turnHold = TURN_HOLD;
        } else if (p.turning && p.turnHold > 0 && p.speed === 0) {
          p.turnHold -= dt; // пара кадров на месте
        } else {
          if (p.speed === 0 && !p.airborne && !p.turning) this.dust.push({ x: p.x - move * 0.16 * MAE_H, y: p.y, dir: move > 0 ? 1 : -1, t: 0 });
          if (move !== p.dir && p.speed !== 0) p.speed = -p.speed; // в воздухе разворот без торможения
          p.dir = move > 0 ? 1 : -1;
          p.speed = clamp(p.speed + move * (p.turning ? TURN_ACCEL : RUN_ACCEL) * dt, -RUN_SPEED, RUN_SPEED);
          if (Math.abs(p.speed) === RUN_SPEED) p.turning = false;
        }
      } else {
        const v = Math.max(0, Math.abs(p.speed) - RUN_DECEL * dt);
        p.speed = Math.sign(p.speed) * v;
        p.turning = false;
        p.turnHold = 0;
      }
      p.x = clamp(p.x + p.speed * dt, ROOM_L + MAE_H * 0.3, ROOM_R - MAE_H * 0.3);
    } else {
      p.speed = 0;
      p.turning = false;
      p.turnHold = 0;
    }

    // гравитация
    if (p.airborne) {
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
      if (p.y >= FLOOR_Y) {
        p.y = FLOOR_Y;
        p.vy = 0;
        p.airborne = false;
      }
    }

    this.mae.update(dt, p.speed, p.dir, p.airborne, p.turning && p.turnHold > 0);

    for (const d of this.dust) d.t += dt;
    this.dust = this.dust.filter((d) => d.t < DUST_LIFE);

    if (this.fade >= 0) {
      this.fade += dt;
      if (this.fade >= FADE_TIME) this.fade = -1;
    }

    // камера с упреждением по направлению взгляда
    const lookAhead = p.dir * 0.5 * MAE_H;
    const targetCam = clamp(p.x + lookAhead - this.viewW / 2, 0, Math.max(0, WORLD_W - this.viewW));
    this.camX = damp(this.camX, targetCam, 4, dt);

    // ближайшая точка взаимодействия
    let nearest: Hotspot | null = null;
    let best = Infinity;
    for (const h of HOTSPOTS) {
      const d = Math.abs(h.x - p.x);
      if (d < h.radius && d < best) {
        best = d;
        nearest = h;
      }
    }
    this.activeHotspot = nearest;
    if (nearest) this.promptSpot = nearest;
    this.dialogue.update(dt, nearest !== null && !this.locked);
  }

  private render() {
    const { ctx } = this;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    // вокруг дома — чернота, как в игре
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    const camX = this.viewW >= WORLD_W ? ((WORLD_W - this.viewW) / 2) * -1 : this.camX;

    ctx.save();
    ctx.translate(-camX, 0);
    drawRoom(ctx);
    for (const d of this.dust) drawDust(ctx, d);
    this.mae.draw(ctx, { x: this.player.x, y: this.player.y, dir: this.player.dir });

    if (this.refImg?.complete && this.refOn) {
      this.mae.drawReference(ctx, this.refImg, this.player.x, this.player.y, this.player.dir);
    }

    drawFront(ctx); // коробки переднего плана — поверх Мэй

    if (this.promptSpot) this.dialogue.drawPrompt(ctx, this.promptSpot.promptX, this.promptSpot.promptY);
    this.dialogue.drawBubble(ctx, this.player.x, this.player.y, camX, camX + this.viewW);
    ctx.restore();

    if (this.fade >= 0) {
      const t = this.fade;
      ctx.globalAlpha = t < 0.35 ? t / 0.35 : t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.35);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.globalAlpha = 1;
    }
  }
}

// Пыль: быстро растёт ~0.08 с, затем тает и сносится назад и вверх.
const DUST_LIFE = 0.28;
function drawDust(ctx: CanvasRenderingContext2D, d: { x: number; y: number; dir: 1 | -1; t: number }) {
  const k = d.t / DUST_LIFE;
  const grow = Math.min(1, d.t / 0.08);
  const S = MAE_H / 235; // размеры облачка подбирались при росте Мэй 235
  ctx.save();
  ctx.globalAlpha = 0.85 * (1 - Math.max(0, (k - 0.3) / 0.7));
  ctx.fillStyle = '#e3ead6';
  for (const [ox, oy, r] of [[0, -14, 18], [-d.dir * 22, -10, 14], [d.dir * 18, -9, 12]]) {
    ctx.beginPath();
    ctx.arc(d.x + (ox * grow - d.dir * 26 * k) * S, d.y + (oy * grow - 10 * k) * S, r * (0.4 + 0.6 * grow) * S, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
