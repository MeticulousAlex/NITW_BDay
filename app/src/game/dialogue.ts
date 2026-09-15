// Диалоги 1:1 по игре (видео 12:21–12:25, кадры в scratchpad ref/dialog):
//  • подсказка — чёрный кружок с белым глазом над предметом, выпрыгивает с увеличением;
//  • по нажатию кружок раскрывается в облачко над Мэй: сначала полоска, затем полная высота (~0.17 с);
//  • облачко чёрное и «живое»: несколько неровных форм сменяются каждые 2–4 кадра;
//  • текст белый, узкий, заглавный, печатается ~50 знаков/с, последние буквы проявляются;
//  • между репликами текст гаснет, облачко плавно меняет размер; выбор — бирюзовые ◀ ▶ и точки под текстом.
// Всё в мировых единицах (пиксели эталона чердака).

import { MAE_H } from './data';

export interface DialogueOption {
  label: string;
  then?: DialogueNode[];
  action?: 'exit';
}
export type DialogueNode = { say: string } | { choose: DialogueOption[] };

const FONT_PX = 58;
const FONT = `600 ${FONT_PX}px "Yanone Kaffeesatz", "Arial Narrow", sans-serif`;
const LINE_H = FONT_PX * 1.02;
const PAD_X = 48;
const PAD_Y = 30;
const ARROW_SPACE = 44; // место под ◀ ▶ в облачке выбора
const DOTS_H = 20; // ряд точек под текстом выбора
const MAX_TEXT_W = 660;
const TAIL_W = 34;
const TAIL_H = 44;
const HEAD_GAP = 18; // от кончика хвостика до макушки
const CPS = 50;
const FADE_CHARS = 2;
const GROW_TIME = 0.17;
const TEXT_OUT = 0.1;
const CLOSE_TIME = 0.12;
const SHAPES = 3;
const JITTER = 6;
const PROMPT_R = 40;
const CYAN = '#6fd3e4';

type Phase = 'grow' | 'type' | 'out' | 'close';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// детерминированный шум формы: одинаковый для (форма, точка)
const noise = (shape: number, i: number) => {
  const s = Math.sin(i * 12.9898 + shape * 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};

export class Dialogue {
  open = false;
  onClose: (action?: 'exit') => void = () => {};

  private queue: DialogueNode[] = [];
  private node: DialogueNode | null = null;
  private phase: Phase = 'grow';
  private t = 0;
  private shown = 0;
  private choice = 0;
  private action: 'exit' | undefined;
  private fromX = 0;
  private fromY = 0;
  private boxW = 0;
  private boxH = 0;
  private shape = 0;
  private shapeT = 0;
  private promptK = 0;
  private dt = 0;

  start(nodes: DialogueNode[], fromX: number, fromY: number) {
    this.queue = [...nodes];
    this.node = this.queue.shift() ?? null;
    if (!this.node) return;
    this.open = true;
    this.phase = 'grow';
    this.t = 0;
    this.shown = 0;
    this.choice = 0;
    this.action = undefined;
    this.fromX = fromX;
    this.fromY = fromY;
    this.boxW = 0;
    this.boxH = 0;
    this.promptK = 0; // подсказка превращается в облачко
  }

  update(dt: number, promptVisible: boolean) {
    this.dt = dt;
    this.promptK = clamp01(this.promptK + (promptVisible && !this.open ? dt / 0.15 : -dt / 0.1));

    this.shapeT -= dt;
    if (this.shapeT <= 0) {
      this.shape = (this.shape + 1 + Math.floor(Math.random() * (SHAPES - 1))) % SHAPES;
      this.shapeT = (2 + Math.floor(Math.random() * 3)) / 30;
    }
    if (!this.open) return;

    this.t += dt;
    if (this.phase === 'grow' && this.t >= GROW_TIME) this.setPhase('type');
    if (this.phase === 'type') this.shown += CPS * dt;
    if (this.phase === 'out' && this.t >= TEXT_OUT) {
      this.node = this.queue.shift() ?? null;
      this.shown = 0;
      this.choice = 0;
      this.setPhase(this.node ? 'type' : 'close');
    }
    if (this.phase === 'close' && this.t >= CLOSE_TIME) {
      this.open = false;
      this.onClose(this.action);
    }
  }

  /** Клавиша во время диалога; true — обработана. */
  key(k: string): boolean {
    if (!this.open || !this.node) return false;
    const confirm = k === 'e' || k === 'enter' || k === ' ';
    const side = k === 'arrowleft' || k === 'a' ? -1 : k === 'arrowright' || k === 'd' ? 1 : 0;
    if (!confirm && !side) return false;
    if (this.phase !== 'type') return true;

    if ('choose' in this.node && side) {
      const n = this.node.choose.length;
      this.choice = (this.choice + side + n) % n;
      this.shown = 0;
      return true;
    }
    if (!confirm) return true;
    if (this.shown < this.text().length) {
      this.shown = this.text().length; // допечатать
      return true;
    }
    if ('choose' in this.node) {
      const opt = this.node.choose[this.choice];
      this.queue = [...(opt.then ?? []), ...this.queue];
      if (opt.action) this.action = opt.action;
    }
    this.setPhase('out');
    return true;
  }

  drawPrompt(ctx: CanvasRenderingContext2D, x: number, y: number) {
    if (this.promptK <= 0.01) return;
    const k = this.promptK;
    const s = 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2; // выпрыгивает с небольшим перелётом
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, 0, PROMPT_R, 0, Math.PI * 2);
    ctx.fill();
    // глаз: миндалина и радужка
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.quadraticCurveTo(0, -24, 25, 0);
    ctx.quadraticCurveTo(0, 24, -25, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** Облачко над головой Мэй; viewL/viewR — видимая область мира, чтобы облачко не уходило за край. */
  drawBubble(ctx: CanvasRenderingContext2D, maeX: number, maeY: number, viewL: number, viewR: number) {
    if (!this.open || !this.node) return;
    ctx.save();
    ctx.font = FONT;
    const choose = 'choose' in this.node;
    const lines = this.wrap(ctx, this.text().toUpperCase());
    const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const targetW = textW + 2 * PAD_X + (choose ? 2 * ARROW_SPACE : 0);
    const targetH = lines.length * LINE_H + 2 * PAD_Y + (choose ? DOTS_H : 0);
    if (this.boxW === 0) {
      this.boxW = targetW;
      this.boxH = targetH;
    } else {
      const f = 1 - Math.exp(-this.dt * 16); // плавная смена размера между репликами
      this.boxW = lerp(this.boxW, targetW, f);
      this.boxH = lerp(this.boxH, targetH, f);
    }

    const tipY = maeY - MAE_H - HEAD_GAP;
    const cx = Math.max(viewL + this.boxW / 2 + 30, Math.min(viewR - this.boxW / 2 - 30, maeX));
    const cy = tipY - TAIL_H - this.boxH / 2 + 8;

    // раскрытие из подсказки / сворачивание
    let w = this.boxW;
    let h = this.boxH;
    let x = cx;
    let y = cy;
    let textA = 1;
    let tail = 1;
    if (this.phase === 'grow') {
      const k1 = ease(clamp01(this.t / 0.1));
      const k2 = ease(clamp01((this.t - 0.05) / (GROW_TIME - 0.05)));
      x = lerp(this.fromX, cx, k1);
      y = lerp(this.fromY, cy, k1);
      w = lerp(2 * PROMPT_R, this.boxW, k1);
      h = lerp(14, this.boxH, k2);
      textA = 0;
      tail = k2;
    } else if (this.phase === 'close') {
      const k = ease(clamp01(this.t / CLOSE_TIME));
      h = lerp(this.boxH, 12, k);
      w = lerp(this.boxW, this.boxW * 0.6, k);
      textA = 0;
      tail = 1 - k;
    } else if (this.phase === 'out') {
      textA = 1 - clamp01(this.t / TEXT_OUT);
    }

    const tailX = Math.max(x - w / 2 + 50, Math.min(x + w / 2 - 50, maeX));
    ctx.fillStyle = '#000';
    this.blob(ctx, x, y, w, h);
    if (tail > 0.05) {
      const j = noise(this.shape, 99) * 3;
      ctx.beginPath();
      ctx.moveTo(tailX - TAIL_W / 2, y + h / 2 - 10);
      ctx.lineTo(tailX + TAIL_W / 2, y + h / 2 - 10);
      ctx.lineTo(tailX + j, y + h / 2 + TAIL_H * tail - 8);
      ctx.closePath();
      ctx.fill();
    }

    if (textA > 0) {
      const left = x - w / 2 + PAD_X + (choose ? ARROW_SPACE : 0);
      const top = y - h / 2 + PAD_Y;
      ctx.textBaseline = 'alphabetic';
      let i = 0;
      lines.forEach((line, li) => {
        let px = left;
        for (const ch of line) {
          const a = clamp01((this.shown - i) / FADE_CHARS);
          if (a > 0) {
            ctx.globalAlpha = a * textA;
            ctx.fillStyle = '#fff';
            ctx.fillText(ch, px, top + li * LINE_H + FONT_PX * 0.8);
          }
          px += ctx.measureText(ch).width;
          i++;
        }
        i++; // перенос строки считается знаком — пауза печати
      });
      ctx.globalAlpha = textA;
      if (choose && 'choose' in this.node) {
        const my = top + LINE_H / 2 + 2;
        ctx.fillStyle = CYAN;
        for (const dir of [-1, 1]) {
          const ax = dir < 0 ? x - w / 2 + 30 : x + w / 2 - 30;
          ctx.beginPath();
          ctx.moveTo(ax + dir * 10, my);
          ctx.lineTo(ax - dir * 8, my - 14);
          ctx.lineTo(ax - dir * 8, my + 14);
          ctx.closePath();
          ctx.fill();
        }
        const n = this.node.choose.length;
        for (let d = 0; d < n; d++) {
          ctx.globalAlpha = textA * (d === this.choice ? 1 : 0.4);
          ctx.fillStyle = '#fff';
          ctx.fillRect(x + (d - (n - 1) / 2) * 16 - 3, y + h / 2 - PAD_Y + 2, 6, 6);
        }
      }
    }
    ctx.restore();
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.t = 0;
  }

  private text(): string {
    if (!this.node) return '';
    return 'say' in this.node ? this.node.say : this.node.choose[this.choice].label;
  }

  private wrap(ctx: CanvasRenderingContext2D, text: string): string[] {
    const out: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > MAX_TEXT_W) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
    return out;
  }

  /** Неровное скруглённое облачко текущей формы. */
  private blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
    const N = 32;
    const a = w / 2;
    const b = h / 2;
    const pts: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      const th = (i / N) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const px = a * Math.sign(c) * Math.abs(c) ** 0.4;
      const py = b * Math.sign(s) * Math.abs(s) ** 0.4;
      const len = Math.hypot(px, py) || 1;
      const j = noise(this.shape, i) * JITTER;
      pts.push([cx + px + (px / len) * j, cy + py + (py / len) * j]);
    }
    ctx.beginPath();
    const mid = (p: [number, number], q: [number, number]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    ctx.moveTo(...mid(pts[N - 1], pts[0]));
    for (let i = 0; i < N; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], ...mid(pts[i], pts[(i + 1) % N]));
    ctx.closePath();
    ctx.fill();
  }
}
