// Процедурная модель Мэй. Пропорции восстановлены по референсам:
// огромная круглая голова (~45% роста), большие овальные красные глаза,
// крошечное тело, короткие конечности, зазубренное правое ухо.
// Анимации: упругая походка, дыхание, дёрганье ухом,
// мимика и «говорящий» рот во время диалогов.

import type { Mood } from './data';
import { lerp } from './draw';

const FUR = '#0d1b34'; // тёмно-синяя шерсть
const FUR_DARK = '#081222'; // дальние части
const EYE_WHITE = '#f1eaa4'; // светлая миндалевидная основа глаза
const PUPIL = '#b8340d'; // большой тёмно-оранжевый зрачок
const SHIRT = '#a8541c'; // тёмно-оранжевая кофта
const SHIRT_DARK = '#833003';
const SLEEVE = '#55190e'; // тёмно-красные рукава
const ZERO = '#f1eaa4'; // «перечёркнутый ноль»
const JEANS = '#2a2d36';
const BOOT = '#141810';

// Рот — две палочки из нижней вершины носа. len — длина, drop — насколько
// опущен кончик, sag — прогиб дуги (плюс — провисает вниз, даёт улыбку).
const MOUTH: Record<Mood, { len: number; drop: number; sag: number }> = {
  neutral: { len: 6, drop: 2.5, sag: 0 },
  happy: { len: 11, drop: -1.5, sag: 3.5 },
  annoyed: { len: 9.5, drop: 2, sag: -1.5 },
  sleepy: { len: 7, drop: 3.5, sag: -0.8 },
  sad: { len: 9, drop: 5.5, sag: -2.5 },
  surprised: { len: 5, drop: 5, sag: 1.5 },
};

export interface MaePose {
  x: number; // мировые координаты (центр ступней)
  y: number; // уровень пола
  dir: 1 | -1;
  speed: number;
  airborne: boolean;
  mood: Mood;
  talking: boolean;
}

// ключевые высоты (origin — подошвы, ось Y вверх)
const HIP_Y = -56;
const TORSO_TOP = -102;
const HEAD_CY = -130;
const HEAD_RX = 44;
const HEAD_RY = 33;

export class Mae {
  private phase = 0;
  private earT = 5;
  private earFlick = 0;
  private talkT = 0;
  private mouthOpen = 0;
  private breathe = 0;
  // форма рта плавно перетекает между настроениями
  private mouthLen = MOUTH.neutral.len;
  private mouthDrop = MOUTH.neutral.drop;
  private mouthSag = MOUTH.neutral.sag;
  // взгляд: сглаженное смещение зрачков
  private lookX = 0;
  private lookY = 0;

  update(dt: number, walking: boolean, speed: number, talking: boolean, dir: 1 | -1, mood: Mood) {
    if (walking) this.phase += dt * (7 + speed * 0.014);
    else this.phase = lerp(this.phase, Math.round(this.phase / Math.PI) * Math.PI, Math.min(1, dt * 10));

    this.breathe += dt * 2.1;

    const mt = MOUTH[mood] ?? MOUTH.neutral;
    const k = Math.min(1, dt * 7);
    this.mouthLen = lerp(this.mouthLen, mt.len, k);
    this.mouthDrop = lerp(this.mouthDrop, mt.drop, k);
    this.mouthSag = lerp(this.mouthSag, mt.sag, k);

    // цель взгляда: в сторону движения; в разговоре — прямо; в idle — лёгкий дрейф
    let tx = 0;
    let ty = 0.4;
    if (walking) {
      tx = dir * 4.5;
      ty = 0;
    } else if (talking) {
      tx = 0;
      ty = 0.6;
    } else {
      tx = Math.sin(this.breathe * 0.35) * 2.2;
      ty = 0.4 + Math.sin(this.breathe * 0.22) * 0.8;
    }
    this.lookX = lerp(this.lookX, tx, Math.min(1, dt * 6));
    this.lookY = lerp(this.lookY, ty, Math.min(1, dt * 6));

    this.earT -= dt;
    if (this.earT <= 0) {
      this.earFlick = 1;
      this.earT = 4 + Math.random() * 6;
    }
    if (this.earFlick > 0) this.earFlick = Math.max(0, this.earFlick - dt * 5);

    if (talking) {
      this.talkT += dt * 14;
      this.mouthOpen = Math.abs(Math.sin(this.talkT)) > 0.45 ? 1 : 0;
    } else {
      this.mouthOpen = lerp(this.mouthOpen, 0, Math.min(1, dt * 12));
    }
  }

  draw(ctx: CanvasRenderingContext2D, pose: MaePose, t: number) {
    const walking = Math.abs(pose.speed) > 8 && !pose.airborne;
    const p = this.phase;
    // упругий подскок: тело приподнимается на каждом шаге
    const bob = walking ? Math.abs(Math.sin(p)) * 7 : Math.sin(this.breathe) * 1.4;
    const squash = walking ? 1 + Math.sin(p * 2) * 0.03 : 1 + Math.sin(this.breathe) * 0.008;

    ctx.save();
    ctx.translate(pose.x, pose.y);

    // мягкая тень
    ctx.save();
    ctx.scale(1, 0.3);
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.restore();

    ctx.scale(pose.dir, 1);
    ctx.translate(0, -bob);
    ctx.scale(2 - squash, squash); // squash & stretch по вертикали

    this.drawLegs(ctx, pose, p, walking);
    this.drawArm(ctx, p, walking, false); // дальняя рука — за корпусом
    this.drawBody(ctx, walking, p);
    this.drawHead(ctx, t, pose);
    this.drawArm(ctx, p, walking, true); // ближняя — перед корпусом

    ctx.restore();
  }

  private drawLegs(ctx: CanvasRenderingContext2D, pose: MaePose, p: number, walking: boolean) {
    const legLen = 40;
    const swing = walking ? 0.7 : 0;

    for (let i = 0; i < 2; i++) {
      const front = i === 0;
      const ph = p + (front ? 0 : Math.PI);
      let angle = Math.sin(ph) * swing;
      let lift = walking ? Math.max(0, Math.sin(ph + Math.PI / 2)) * 10 : 0;
      if (pose.airborne) {
        angle = front ? 0.55 : -0.4;
        lift = front ? 12 : 5;
      }
      const hx = front ? 6 : -6;
      const footX = hx + Math.sin(angle) * legLen;
      const footY = HIP_Y + Math.cos(angle) * legLen - lift;

      // короткая штанина
      ctx.strokeStyle = front ? JEANS : '#1e2129';
      ctx.lineWidth = 13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, HIP_Y);
      ctx.lineTo(footX, footY - 6);
      ctx.stroke();

      // ботинок — округлый, чуть выступает вперёд
      ctx.save();
      ctx.translate(footX, footY);
      ctx.rotate(angle * 0.3);
      ctx.fillStyle = BOOT;
      ctx.beginPath();
      ctx.ellipse(3, -3, 13, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-7, -8, 12, 7);
      ctx.fillStyle = '#232a1e';
      ctx.beginPath();
      ctx.ellipse(4, 2, 12, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBody(ctx: CanvasRenderingContext2D, walking: boolean, p: number) {
    // крошечный торс — тёмно-оранжевая кофта, почти скрыт головой
    const lean = walking ? Math.sin(p) * 0.02 : 0;
    ctx.save();
    ctx.rotate(lean);
    ctx.fillStyle = SHIRT;
    ctx.beginPath();
    ctx.moveTo(-19, HIP_Y + 4);
    ctx.quadraticCurveTo(-23, TORSO_TOP + 10, -13, TORSO_TOP);
    ctx.lineTo(13, TORSO_TOP);
    ctx.quadraticCurveTo(23, TORSO_TOP + 10, 19, HIP_Y + 4);
    ctx.quadraticCurveTo(0, HIP_Y + 10, -19, HIP_Y + 4);
    ctx.fill();

    // Вырез горловины: асимметричный — уходит чуть дальше в сторону движения
    // (весь персонаж рисуется в системе, где +x — направление взгляда).
    ctx.fillStyle = FUR_DARK;
    ctx.beginPath();
    ctx.moveTo(-10, TORSO_TOP - 2);
    ctx.bezierCurveTo(-8, TORSO_TOP + 18, 8, TORSO_TOP + 21, 13, TORSO_TOP - 2);
    ctx.closePath();
    ctx.fill();

    // подол
    ctx.fillStyle = SHIRT_DARK;
    ctx.beginPath();
    ctx.moveTo(-19, HIP_Y - 2);
    ctx.quadraticCurveTo(0, HIP_Y + 4, 19, HIP_Y - 2);
    ctx.lineTo(19, HIP_Y + 4);
    ctx.quadraticCurveTo(0, HIP_Y + 10, -19, HIP_Y + 4);
    ctx.closePath();
    ctx.fill();

    // «перечёркнутый ноль»
    ctx.save();
    ctx.translate(0, TORSO_TOP + 27);
    ctx.strokeStyle = ZERO;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 9.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, 7);
    ctx.lineTo(6, -7);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  private drawArm(ctx: CanvasRenderingContext2D, p: number, walking: boolean, front: boolean) {
    const sx = front ? 17 : -17;
    const sy = TORSO_TOP + 6;
    const phase = p + (front ? Math.PI : 0);
    const swing = walking ? Math.sin(phase) * 0.55 : 0.05;
    const armLen = 30;
    const hx = sx + Math.sin(swing) * armLen;
    const hy = sy + Math.cos(swing) * armLen;

    // Локоть уводит в сторону, обратную замаху: кисть ведёт, предплечье
    // отстаёт, и рука идёт дугой, а не прямой палкой. В покое — лёгкий
    // прогиб наружу от корпуса.
    const bow = walking ? Math.cos(phase) * 8 : front ? -5 : 5;
    const dx = hx - sx;
    const dy = hy - sy;
    const d = Math.hypot(dx, dy) || 1;
    const cx = (sx + hx) / 2 + (-dy / d) * bow;
    const cy = (sy + hy) / 2 + (dx / d) * bow;

    // Кривую ведём короткими отрезками с убывающей толщиной — получается
    // сужение от плеча к запястью.
    const N = 10;
    const sleeveEnd = 4; // докуда идёт короткий рукав
    const sleeve = front ? SLEEVE : '#3f1209';
    const skin = front ? FUR : FUR_DARK;
    ctx.lineCap = 'round';
    let px = sx;
    let py = sy;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const mt = 1 - t;
      const qx = mt * mt * sx + 2 * mt * t * cx + t * t * hx;
      const qy = mt * mt * sy + 2 * mt * t * cy + t * t * hy;
      ctx.strokeStyle = i <= sleeveEnd ? sleeve : skin;
      ctx.lineWidth = 11 - t * 4.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(qx, qy);
      ctx.stroke();
      px = qx;
      py = qy;
    }

    // лапа
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(px, py + 1, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHead(ctx: CanvasRenderingContext2D, t: number, pose: MaePose) {
    const walking = Math.abs(pose.speed) > 8 && !pose.airborne;
    // голова слегка наклоняется вперёд при ходьбе
    const tilt = walking ? 0.05 : Math.sin(this.breathe * 0.5) * 0.012;

    ctx.save();
    ctx.translate(0, HEAD_CY);
    ctx.rotate(tilt);

    // уши — высокие треугольники; правое зазубрено и дёргается
    const flick = Math.sin(this.earFlick * Math.PI) * 0.45;
    this.drawEar(ctx, -30, -HEAD_RY + 8, -0.3, false);
    this.drawEar(ctx, 29, -HEAD_RY + 8, 0.26 + flick, true);

    // огромная круглая голова
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.ellipse(0, 0, HEAD_RX, HEAD_RY, 0, 0, Math.PI * 2);
    ctx.fill();


    this.drawFace(ctx, pose, t);
    ctx.restore();
  }

  private drawEar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rot: number,
    notched: boolean,
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = FUR;
    ctx.beginPath();
    if (notched) {
      // зазубренное ухо — след старой стычки с собакой
      ctx.moveTo(-15, 5);
      ctx.lineTo(-6, -32);
      ctx.lineTo(1, -21);
      ctx.lineTo(8, -34);
      ctx.lineTo(16, 5);
    } else {
      ctx.moveTo(-15, 5);
      ctx.lineTo(0, -36);
      ctx.lineTo(16, 5);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a1530';
    ctx.beginPath();
    ctx.moveTo(-7, 3);
    ctx.lineTo(0, -21);
    ctx.lineTo(8, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // процент смыкания верхнего века по эмоциям (0 — открыто, 1 — закрыто)
  private lidForMood(mood: Mood, t: number): number {
    switch (mood) {
      case 'annoyed':
        return 0.42;
      case 'sleepy':
        return 0.55 + Math.sin(t * 1.2) * 0.07;
      case 'sad':
        return 0.3;
      case 'surprised':
        return -0.12; // приподнято выше обычного
      default:
        return 0.08;
    }
  }

  // миндалевидный глаз: светлая основа, большой подвижный зрачок, веко в процентах
  private drawEye(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    lid: number,
    lookX: number,
    lookY: number,
  ) {
    ctx.save();
    ctx.translate(x, y);

    // миндалевидный контур — заострённые углы
    const almond = () => {
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.quadraticCurveTo(0, -h * 0.5, w / 2.1, 0);
      ctx.quadraticCurveTo(0, h * 0.52, -w / 2.1, 0);
      ctx.closePath();
    };

    // светлая основа
    almond();
    ctx.fillStyle = EYE_WHITE;
    ctx.fill();

    // всё внутри глаза клиппуется по миндалине
    ctx.save();
    almond();
    ctx.clip();

    // большой тёмно-оранжевый зрачок, подвижный
    const pr = h * 0.25;
    ctx.fillStyle = PUPIL;
    ctx.beginPath();
    ctx.ellipse(lookX, lookY, pr, pr, 0, 0, Math.PI * 2);
    ctx.fill();

    // верхнее веко — закрывает сверху на lid-процент, нижняя граница дугой
    const lidH = lid * h * 1.1;
    if (lidH > 0) {
      const edgeY = -h * 0.62 + lidH;
      ctx.fillStyle = FUR;
      ctx.beginPath();
      ctx.moveTo(-w / 2 - 2, -h * 0.62 - 2);
      ctx.lineTo(w / 2 + 2, -h * 0.62 - 2);
      ctx.lineTo(w / 2 + 2, edgeY - 2);
      ctx.quadraticCurveTo(0, edgeY + h * 0.16, -w / 2 - 2, edgeY - 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }

  private drawFace(ctx: CanvasRenderingContext2D, pose: MaePose, t: number) {
    const mood = pose.mood;
    const lid = this.lidForMood(mood, t);

    // взгляд: грусть и сонливость тянут зрачки вниз
    let lookX = this.lookX;
    let lookY = this.lookY;
    if (mood === 'sad') {
      lookY += 2.2;
      lookX *= 0.4;
    } else if (mood === 'sleepy') {
      lookY += 1.4;
    } else if (mood === 'surprised') {
      lookX *= 0.2;
      lookY = 0;
    }

    // Два миндалевидных глаза: широко расставлены и равноудалены от краёв
    // головы — внешний край каждого отступает от силуэта одинаково.
    const eyes: Array<{ x: number; w: number; h: number }> = [
      { x: -23, w: 30, h: 40 },
      { x: 23, w: 30, h: 40 },
    ];

    for (const e of eyes) {
      if (mood === 'happy' && lid < 0.9) {
        // счастливые закрытые дуги
        ctx.save();
        ctx.translate(e.x, -4);
        ctx.strokeStyle = PUPIL;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 3, e.w * 0.36, Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      this.drawEye(ctx, e.x, -2, e.w, e.h, lid, lookX, lookY);
    }

    // нос — маленький полый треугольник по центру морды, сразу под глазами
    ctx.strokeStyle = '#f1eee2';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-3.5, 11);
    ctx.lineTo(3.5, 11);
    ctx.lineTo(0, 16.5);
    ctx.closePath();
    ctx.stroke();

    this.drawMouth(ctx);
  }

  // Две палочки из нижней вершины носа: нейтрально — короткие прямые,
  // с настроением удлиняются и выгибаются дугой.
  private drawMouth(ctx: CanvasRenderingContext2D) {
    const nx = 0;
    const ny = 16.5; // нижняя вершина треугольника-носа
    const { mouthLen: len, mouthDrop: drop, mouthSag: sag } = this;

    ctx.strokeStyle = '#f1eee2';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.quadraticCurveTo(nx + (side * len) / 2, ny + drop / 2 + sag, nx + side * len, ny + drop);
      ctx.stroke();
    }
  }
}
