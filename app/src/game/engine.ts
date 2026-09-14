// Игровой движок: цикл, ввод, физика, камера, хотспоты.

import {
  WORLD_W,
  WORLD_H,
  FLOOR_Y,
  PLAYER_SPEED,
  GRAVITY,
  JUMP_VELOCITY,
  HOTSPOTS,
  type Hotspot,
  type Mood,
} from './data';
import { clamp, damp } from './draw';
import { drawRoom, drawForeground } from './room';
import { Mae } from './mae';
import { footstep } from './audio';

export interface EngineEvents {
  onInteract: (h: Hotspot) => void;
  onHotspot: (h: Hotspot | null) => void;
}

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private events: EngineEvents;
  private mae = new Mae();

  private raf = 0;
  private lastT = 0;
  private time = 0;
  private running = false;

  private keys = new Set<string>();
  private player = {
    x: 900,
    y: FLOOR_Y,
    vy: 0,
    dir: 1 as 1 | -1,
    speed: 0,
    airborne: false,
  };
  private camX = 0;
  private viewW = WORLD_W;
  private viewH = WORLD_H;
  private scale = 1;

  private dialogueActive = false;
  private mood: Mood = 'neutral';
  private talking = false;
  private activeHotspot: Hotspot | null = null;
  private lastStepPhase = 0;

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', ' ', 'a', 'd', 'w', 'e'].includes(k)) {
      e.preventDefault();
    }
    this.keys.add(k);
    if ((k === 'e' || k === 'enter') && !this.dialogueActive && this.activeHotspot) {
      this.events.onInteract(this.activeHotspot);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onResize = () => {
    this.resize();
  };

  constructor(canvas: HTMLCanvasElement, events: EngineEvents) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.events = events;
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
      this.time += dt;
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

  setDialogueActive(active: boolean) {
    this.dialogueActive = active;
    if (active) this.player.speed = 0;
  }

  setMood(mood: Mood) {
    this.mood = mood;
  }

  setTalking(talking: boolean) {
    this.talking = talking;
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

    if (!this.dialogueActive) {
      let move = 0;
      if (this.keys.has('arrowleft') || this.keys.has('a')) move -= 1;
      if (this.keys.has('arrowright') || this.keys.has('d')) move += 1;

      p.speed = move * PLAYER_SPEED;
      if (move !== 0) p.dir = move > 0 ? 1 : -1;
      p.x = clamp(p.x + p.speed * dt, 60, WORLD_W - 60);

      // прыжок
      if ((this.keys.has(' ') || this.keys.has('arrowup') || this.keys.has('w')) && !p.airborne) {
        p.vy = JUMP_VELOCITY;
        p.airborne = true;
      }
    } else {
      p.speed = 0;
    }

    // гравитация
    if (p.airborne) {
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
      if (p.y >= FLOOR_Y) {
        p.y = FLOOR_Y;
        p.vy = 0;
        p.airborne = false;
        footstep();
      }
    }

    const walking = Math.abs(p.speed) > 8 && !p.airborne;
    this.mae.update(dt, walking, Math.abs(p.speed), this.talking, p.dir, this.mood);

    // шаги в такт анимации
    if (walking) {
      const stepPhase = Math.floor(this.time * 7);
      if (stepPhase !== this.lastStepPhase) {
        this.lastStepPhase = stepPhase;
        footstep();
      }
    }

    // камера с упреждением по направлению взгляда
    const lookAhead = p.dir * 120;
    const targetCam = clamp(
      p.x + lookAhead - this.viewW / 2,
      0,
      Math.max(0, WORLD_W - this.viewW),
    );
    this.camX = damp(this.camX, targetCam, 4, dt);

    // ближайший хотспот
    let nearest: Hotspot | null = null;
    let best = Infinity;
    for (const h of HOTSPOTS) {
      const d = Math.abs(h.x - p.x);
      if (d < h.radius && d < best) {
        best = d;
        nearest = h;
      }
    }
    if (this.dialogueActive) nearest = null;
    if (nearest !== this.activeHotspot) {
      this.activeHotspot = nearest;
      this.events.onHotspot(nearest);
    }
  }

  private render() {
    const { ctx } = this;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    // фон за пределами мира
    ctx.fillStyle = '#05060c';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    const camX = this.viewW >= WORLD_W ? (WORLD_W - this.viewW) / 2 * -1 : this.camX;

    drawRoom(ctx, camX, this.time);

    // Мэй
    ctx.save();
    ctx.translate(-camX, 0);
    this.mae.draw(
      ctx,
      {
        x: this.player.x,
        y: this.player.y,
        dir: this.player.dir,
        speed: this.player.speed,
        airborne: this.player.airborne,
        mood: this.mood,
        talking: this.talking,
      },
      this.time,
    );

    // маркер «...» над активным хотспотом
    if (this.activeHotspot && !this.dialogueActive) {
      this.drawMarker(ctx, this.activeHotspot);
    }
    ctx.restore();

    drawForeground(ctx, this.time, this.viewW, this.viewH);
  }

  private drawMarker(ctx: CanvasRenderingContext2D, h: Hotspot) {
    const bounce = Math.sin(this.time * 3.2) * 6;
    const x = h.x;
    const y = h.markerY + bounce;

    ctx.save();
    ctx.globalAlpha = 0.92;
    // пузырь
    ctx.fillStyle = '#f1eaa4';
    ctx.beginPath();
    ctx.ellipse(x, y, 26, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // хвостик
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 14);
    ctx.lineTo(x + 6, y + 14);
    ctx.lineTo(x, y + 26);
    ctx.closePath();
    ctx.fill();
    // три точки
    ctx.fillStyle = '#1c1420';
    for (let i = -1; i <= 1; i++) {
      const dotBounce = Math.sin(this.time * 3.2 + i * 0.9) * 2.4;
      ctx.beginPath();
      ctx.arc(x + i * 10, y - dotBounce, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
