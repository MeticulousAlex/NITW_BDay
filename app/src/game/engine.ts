// Игровой движок: цикл, ввод, физика, камера, сцены дома, лестницы, точки взаимодействия и диалоги.

import { MAE_H, RUN_SPEED, RUN_ACCEL, RUN_DECEL, TURN_HOLD, TURN_ACCEL, GRAVITY, JUMP_VELOCITY, type Hotspot } from './data';
import { clamp, damp } from './draw';
import { Mae } from './mae';
import { Dialogue } from './dialogue';
import { SCENES, type Scene, type Spawn } from './scenes';

const FADE_HALF = 0.35; // переход между сценами: затемнение, смена сцены, проявление
const STAIR_ENTRY = 180; // насколько близко к подножию лестницы надо стоять, чтобы на неё встать

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mae = new Mae();
  private dialogue = new Dialogue();
  /** Где начинается игра. Для правок арта удобно стартовать прямо на месте: смени строку и перезагрузи. */
  private static readonly START: Spawn = { scene: 'street', at: 'fromHouse' };

  private scene: Scene = SCENES[Engine.START.scene];

  private raf = 0;
  private lastT = 0;
  private running = false;

  private keys = new Set<string>();
  private player = {
    x: 900,
    y: SCENES[Engine.START.scene].floorY,
    vy: 0,
    dir: 1 as 1 | -1,
    speed: 0,
    airborne: false,
    turning: false, // разворот на бегу: торможение → пауза → быстрый разгон, без облачка пыли
    turnHold: 0, // остаток паузы на месте, с
    stair: -1, // индекс лестницы, на которой стоит Мэй
  };
  private camX = 0;
  private viewW = 1;
  private viewH = 1;
  private scale = 1;

  private activeHotspot: Hotspot | null = null;
  private promptSpot: Hotspot | null = null; // где рисовать подсказку (и пока она исчезает)
  private fade = -1; // время перехода, −1 — нет
  private pending: Spawn | null = null; // куда переходим
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
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'a', 'd', 'w', 's', 'e', 'enter'].includes(k)) {
      e.preventDefault();
    }
    this.keys.add(k);
    if (k === 'o') this.refOn = !this.refOn;
    if (this.dialogue.open) {
      if (!e.repeat) this.dialogue.key(k);
      return;
    }
    if (this.locked || e.repeat) return;
    const p = this.player;
    const up = k === 'w' || k === 'arrowup';
    const down = k === 's' || k === 'arrowdown';
    if ((up || down) && p.stair < 0 && !p.airborne && this.enterStair(up ? -1 : 1)) return;
    if ((k === ' ' || up) && p.stair < 0 && !p.airborne) {
      p.vy = JUMP_VELOCITY;
      p.airborne = true;
    }
    if ((k === 'e' || k === 'enter') && this.activeHotspot && !p.airborne) {
      const h = this.activeHotspot;
      p.speed = 0;
      if (h.exit) this.go(h.exit);
      else this.dialogue.start(h.script, h.promptX, h.promptY);
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
    void document.fonts.load('600 58px "Yanone Kaffeesatz"'); // canvas сам шрифт не подгружает
    this.resize();
    // dev: состояние для проверок из браузера
    if (import.meta.env.DEV) (window as unknown as { __game: unknown }).__game = { player: this.player, scene: () => this.scene.id };
  }

  start() {
    if (this.running) return;
    this.place(Engine.START);
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
    // логический вьюпорт: высота — во всю сцену, ширина по аспекту
    this.viewH = this.scene.h;
    this.viewW = this.scene.h * (w / Math.max(1, h));
    this.scale = (h * dpr) / this.scene.h;
  }

  /** Встать на лестницу у её подножия: vertical −1 — вверх, 1 — вниз. */
  private enterStair(vertical: -1 | 1): boolean {
    const p = this.player;
    const i = this.scene.stairs.findIndex(
      (s) => Math.abs(p.x - s.a[0]) < STAIR_ENTRY && Math.sign(s.b[1] - s.a[1]) === vertical,
    );
    if (i < 0) return false;
    const s = this.scene.stairs[i];
    // встать на первую ступень: если Мэй по другую сторону подножия — подвинуть к нему
    const along = Math.sign(s.b[0] - s.a[0]);
    const t = Math.max((p.x - s.a[0]) * along, 2) / Math.abs(s.b[0] - s.a[0]);
    p.x = s.a[0] + (s.b[0] - s.a[0]) * t;
    p.y = s.a[1] + (s.b[1] - s.a[1]) * t;
    p.stair = i;
    p.speed = 0;
    return true;
  }

  /** Переход в другую сцену через затемнение. */
  private go(to: Spawn) {
    if (this.fade >= 0) return;
    this.pending = to;
    this.fade = 0;
  }

  private place(to: Spawn) {
    this.scene = SCENES[to.scene];
    // точка появления обязана существовать: если имя не найдено, встаём в первую известную
    const sp = this.scene.spawns[to.at] ?? Object.values(this.scene.spawns)[0];
    if (!this.scene.spawns[to.at]) console.warn(`нет точки появления «${to.at}» в сцене ${to.scene}`);
    const p = this.player;
    p.dir = sp.dir;
    p.speed = 0;
    p.vy = 0;
    p.airborne = false;
    p.turning = false;
    p.turnHold = 0;
    p.stair = sp.stair ?? -1;
    if (p.stair >= 0) {
      const s = this.scene.stairs[p.stair];
      const t = sp.t ?? 0;
      p.x = s.a[0] + (s.b[0] - s.a[0]) * t;
      p.y = s.a[1] + (s.b[1] - s.a[1]) * t;
    } else {
      p.x = sp.x;
      p.y = this.scene.floorY;
    }
    this.dust = [];
    this.resize();
    this.camX = clamp(p.x - this.viewW / 2, 0, Math.max(0, this.scene.w - this.viewW));
  }

  private clock = 0; // общее время сцены — для живых объектов фона

  private update(dt: number) {
    this.clock += dt;
    const p = this.player;
    const sc = this.scene;

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
          if (p.speed === 0 && !p.airborne && !p.turning && p.stair < 0) this.dust.push({ x: p.x - move * 0.16 * MAE_H, y: p.y, dir: move > 0 ? 1 : -1, t: 0 });
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
      p.x += p.speed * dt;

      if (p.stair >= 0) {
        // на лестнице: положение вдоль отрезка по x; сошла с подножия — на полу, дошла до конца — переход
        const s = sc.stairs[p.stair];
        const t = (p.x - s.a[0]) / (s.b[0] - s.a[0]);
        if (t <= 0) {
          p.stair = -1;
          p.y = sc.floorY;
        } else if (t >= 1) {
          p.x = s.b[0];
          p.y = s.b[1];
          p.speed = 0;
          if (s.to) this.go(s.to);
        } else {
          p.y = s.a[1] + (s.b[1] - s.a[1]) * t;
        }
      } else {
        p.x = clamp(p.x, sc.left, sc.right);
      }
    } else {
      p.speed = 0;
      p.turning = false;
      p.turnHold = 0;
    }

    // гравитация
    if (p.airborne) {
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
      if (p.y >= sc.floorY) {
        p.y = sc.floorY;
        p.vy = 0;
        p.airborne = false;
      }
    }

    this.mae.update(dt, p.speed, p.dir, p.airborne, p.turning && p.turnHold > 0);

    for (const d of this.dust) d.t += dt;
    this.dust = this.dust.filter((d) => d.t < DUST_LIFE);

    if (this.fade >= 0) {
      const before = this.fade;
      this.fade += dt;
      if (before < FADE_HALF && this.fade >= FADE_HALF && this.pending) {
        this.place(this.pending);
        this.pending = null;
      }
      if (this.fade >= 2 * FADE_HALF) this.fade = -1;
    }

    // камера с упреждением по направлению взгляда
    const lookAhead = p.dir * 0.5 * MAE_H;
    const targetCam = clamp(p.x + lookAhead - this.viewW / 2, 0, Math.max(0, this.scene.w - this.viewW));
    this.camX = damp(this.camX, targetCam, 4, dt);

    // ближайшая точка взаимодействия (не на лестнице)
    let nearest: Hotspot | null = null;
    let best = Infinity;
    if (p.stair < 0) {
      for (const h of this.scene.hotspots) {
        const d = Math.abs(h.x - p.x);
        if (d < h.radius && d < best) {
          best = d;
          nearest = h;
        }
      }
    }
    this.activeHotspot = nearest;
    if (nearest) this.promptSpot = nearest;
    this.dialogue.update(dt, nearest !== null && !this.locked);
  }

  private render() {
    const { ctx } = this;
    const sc = this.scene;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    // вокруг дома — чернота, как в игре
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    const camX = this.viewW >= sc.w ? ((sc.w - this.viewW) / 2) * -1 : this.camX;

    ctx.save();
    ctx.translate(-camX, 0);
    sc.drawBack(ctx);
    sc.drawMid?.(ctx, this.clock, this.player.x);
    for (const d of this.dust) drawDust(ctx, d);
    ctx.save();
    if (sc.ceilY > 0) {
      // выше перекрытия Мэй не видно: лестница уходит сквозь потолок
      ctx.beginPath();
      ctx.rect(0, sc.ceilY, sc.w, sc.h - sc.ceilY);
      ctx.clip();
    }
    // на лестнице Мэй видна только в проёме арки
    if (this.player.stair >= 0 && sc.stairClip) ctx.clip(sc.stairClip());
    this.mae.draw(ctx, { x: this.player.x, y: this.player.y, dir: this.player.dir });

    if (this.refImg?.complete && this.refOn) {
      this.mae.drawReference(ctx, this.refImg, this.player.x, this.player.y, this.player.dir);
    }
    ctx.restore();

    if (this.player.stair >= 0) sc.drawStairs?.(ctx); // на лестнице Мэй за ступенями, перилами и часами

    sc.drawFront(ctx); // передний план — поверх Мэй

    if (this.promptSpot && sc.hotspots.includes(this.promptSpot)) {
      this.dialogue.drawPrompt(ctx, this.promptSpot.promptX, this.promptSpot.promptY);
    }
    this.dialogue.drawBubble(ctx, this.player.x, this.player.y, camX, camX + this.viewW);
    ctx.restore();

    if (this.fade >= 0) {
      const t = this.fade;
      ctx.globalAlpha = t < FADE_HALF ? t / FADE_HALF : Math.max(0, 1 - (t - FADE_HALF) / FADE_HALF);
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
