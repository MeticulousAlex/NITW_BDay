// Мэй Боровски 1:1 по внутриигровому спрайту (refs-local/mae.png, 234×361).
// Все координаты — в пикселях спрайта относительно точки между подошвами;
// сам спрайт смотрит влево, вправо модель отражается целиком.

import { RUN_FRAMES } from './mae-run';
import { JUMP_FRAMES } from './mae-jump';
import { TURN_BRAKE, TURN_START, TURN_RUN_FROM } from './mae-turn';
import { GRAVITY, JUMP_VELOCITY, MAE_H } from './data';
import { drawCat, line, shape, type CatFrame, type CatSkin, type Pt } from './cat';

const SPRITE_H = 357; // рост спрайта, px
const K = MAE_H / SPRITE_H;

const FUR = '#0a1e2e';
const SHIRT = '#91410a';
const BROWN = '#471a05'; // рукава и «перечёркнутый ноль»
const PUPIL = '#aa2512';
const CREAM = '#faf9b8'; // белки, нос, рот, усы
const PANTS = '#2a2a2a';
const SHOE = '#1b3135';
const SHOE_BACK = '#122125';
const LACE = '#7d6d3a';
const FOREHEAD = '#27394a';
const LID_LINE = '#040d15'; // закрытый глаз

type XY = [number, number];

/** Кадр Мэй — тот же формат, что у любого персонажа конструктора. */
export type MaeFrame = CatFrame;

export interface MaePose {
  x: number;
  y: number; // уровень подошв
  dir: 1 | -1;
}

export const IDLE_FRAME: MaeFrame = {
  head: [0, 0, 0],
  torso: [0, 0, 0],
  backArm: [-30.5, -179.5, -40, -141, -40, -107, 2],
  frontArm: [30, -179, 47, -142, 44.5, -104.5, 10],
  backLeg: [-16, -100, -16, -72, -16, -44, 0],
  frontLeg: [17, -100, 17.5, -71, 18, -42, 0],
};

const HEAD: Pt[] = [
  [102, -348, 1], [104, -308], [100, -285], [95, -275], [95, -259], [91, -242], [82, -226],
  [63, -210], [41, -201], [20, -196], [-10, -194], [-34, -198], [-51, -202], [-73, -212],
  [-93, -231], [-101, -248], [-103, -273], [-112, -296, 1], [-108, -307, 1], [-114, -311, 1],
  [-114, -319, 1], [-121, -323, 1], [-126, -339, 1], [-90, -333, 1], [-68, -324], [-48, -333],
  [-18, -338], [10, -335], [47, -331], [60, -326, 1],
];
const TUFT: Pt[] = [
  [-1, -333, 1], [3, -349, 1], [11, -343, 1], [15, -356, 1], [22, -343, 1], [38, -354, 1],
  [33, -341, 1], [48, -344, 1], [42, -333, 1],
];
const TORSO: Pt[] = [
  [-31, -201, 1], [-38, -179], [-41, -164], [-43, -139], [-46, -113, 1], [-10, -108],
  [53, -106, 1], [56, -135], [52, -156], [45, -184], [38, -202, 1],
];
const NECK: Pt[] = [[-31, -201, 1], [-30, -188], [-26, -182], [-16, -179], [-5, -179], [4, -181], [19, -190], [23, -197], [39, -201, 1]];
const HIPS: Pt[] = [
  [-38, -113, 1], [-36, -104], [-21, -90], [-6, -84], [9, -85], [26, -89], [33, -97], [35, -113, 1],
];
// ботинок: верх голенища в (0,0), носок к −x
const BOOT: Pt[] = [[-10, 0, 1], [10, 0, 1], [9, 20], [8, 26], [3, 28], [-24, 27], [-25, 23], [-18, 19], [-10, 14]];

/** Шкура Мэй для конструктора персонажей. */
const MAE_SKIN: CatSkin = {
  fur: FUR,
  cream: CREAM,
  pupil: PUPIL,
  lidLine: LID_LINE,
  shirt: SHIRT,
  sleeve: BROWN,
  pants: PANTS,
  shoe: SHOE,
  shoeBack: SHOE_BACK,
  lace: LACE,
  head: HEAD,
  torso: TORSO,
  neck: NECK,
  hips: HIPS,
  boot: BOOT,
  headPivot: [-3, -274],
  torsoPivot: [0, -148],
  eyes: [
    { outer: -99, inner: -18, cy: -267, pupil: [-81.5, -264.5], r: 30.5, half: 35 },
    { outer: 78, inner: -4, cy: -267, pupil: [8, -267], r: 30.5, half: 35 },
  ],
  armWidth: [12, 16],
  forearm: 24,
  pawHalf: 11,
  fingers: [-7, 0, 7],
  fingerR: 5.5,
  legWidth: 17,
  sockLen: 14,
  laces: [[[-4, 5], [3, 5], [-4, 11], [3, 11]]],
  crown: (ctx) => {
    const tuft = ctx.createLinearGradient(0, -332, 0, -354);
    tuft.addColorStop(0, '#1c2532');
    tuft.addColorStop(1, '#7d474b');
    shape(ctx, TUFT, tuft);
    for (const s of [[[-20, -315], [-15, -303]], [[-6, -326], [-8, -312]], [[0, -308], [-7, -297]]] as XY[][]) {
      line(ctx, s, FOREHEAD, 3);
    }
  },
  face: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-22, -237);
    ctx.lineTo(-12, -237);
    ctx.lineTo(-17, -228);
    ctx.closePath();
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 2.8;
    ctx.lineJoin = 'round';
    ctx.stroke();
    line(ctx, [[-26, -214], [-17, -227], [-5, -214]], CREAM, 2.8);
    for (const w of [[[-53, -231], [-35, -230]], [[-51, -218], [-36, -221]], [[6, -230], [23, -231]], [[8, -222], [21, -218]]] as XY[][]) {
      line(ctx, w, CREAM, 2.8);
    }
  },
  chest: (ctx) => {
    ctx.beginPath();
    ctx.ellipse(-22, -155, 12, 15, 0, 0, Math.PI * 2);
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 4.5;
    ctx.stroke();
    line(ctx, [[-33, -168], [-10, -140]], BROWN, 4.5);
  },
};

/** Кадр в пикселях спрайта (без масштаба и отражения). */
export function drawFrame(ctx: CanvasRenderingContext2D, f: MaeFrame) {
  drawCat(ctx, MAE_SKIN, f);
}

const RUN_FPS = 25; // кадры бега сменяются ступенчато, как в webp из игры
const RUN_START = 7; // по видео бег из стойки начинается с позы переноса (колено вверх)
const TURN_FPS = 30; // позы разворота — каждый кадр видео (13:32), между кадрами плавный переход
const TURN_LOOK = 55; // зрачки за торможение переезжают к стороне нового направления
const TURN_BLEND = 2 / 30; // вход в торможение из текущей позы бега
const TURN_LOOK_BACK = 0.25; // старт из стойки в другую сторону: зрачки плавно переезжают к новому направлению, с
const HEAD_DROP = 5; // на бегу и при развороте голова ниже на пару пикселей — не отрывается от тела

/** Та же поза с головой, опущенной на HEAD_DROP (для бега и разворота). */
function lowered(f: MaeFrame): MaeFrame {
  return { ...f, head: [f.head[0], f.head[1] + HEAD_DROP, f.head[2]] };
}
const JUMP_FPS = 30; // позы прыжка — каждый кадр видео, между кадрами плавный переход
const T_APEX = -JUMP_VELOCITY / GRAVITY; // подъём до пика, с
const LOWER_LID_PEAK = 1.28; // нижнее веко к пику — выше середины глаза
const LOOK_PEAK = [6, -10]; // зрачки к пику — вверх и к вертикальной оси глаза (в стойке они у края по ходу движения)
const LAND_TIME = 0.3; // приземление: просадка и возврат в стойку
const LAND_SQUASH = 0.07; // до нижней точки просадки
const LID_CLOSE = 0.04; // веки смыкаются посередине…
const LID_OPEN = 0.2; // …и держатся сомкнутыми ≈0.2 с

/** Просадка при приземлении: голова и корпус ниже, колени чуть в стороны. */
const SQUASH_FRAME: MaeFrame = {
  head: [0, 22, 0],
  torso: [0, 18, 0],
  backArm: [-30.5, -161.5, -42, -125, -42, -93, 2],
  frontArm: [30, -161, 49, -126, 46.5, -90.5, 10],
  backLeg: [-16, -82, -25, -60, -16, -44, 0],
  frontLeg: [17, -82, 26, -59, 18, -42, 0],
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => t * t * (3 - 2 * t);

function lerpFrame(a: MaeFrame, b: MaeFrame, t: number): MaeFrame {
  const mix = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] - v) * t);
  return {
    head: mix(a.head, b.head),
    torso: mix(a.torso, b.torso),
    backArm: mix(a.backArm, b.backArm),
    frontArm: mix(a.frontArm, b.frontArm),
    backLeg: mix(a.backLeg, b.backLeg),
    frontLeg: mix(a.frontLeg, b.frontLeg),
    lids: mix(a.lids ?? [0, 0], b.lids ?? [0, 0]),
    look: mix(a.look ?? [0, 0], b.look ?? [0, 0]),
  };
}

/** Позы по времени с плавным переходом между кадрами видео. */
function sequence(frames: MaeFrame[], t: number): MaeFrame {
  const f = Math.min(frames.length - 1, t * TURN_FPS);
  const i = Math.floor(f);
  return lerpFrame(frames[i], frames[Math.min(i + 1, frames.length - 1)], f - i);
}

export class Mae {
  private runTime = 0;
  private speed = 0;
  private dir: 1 | -1 = 1;
  private air = -1; // время в воздухе, −1 — на земле
  private land = -1; // время после касания пола, −1 — приземление закончилось
  private lastAir: MaeFrame = IDLE_FRAME; // поза в момент касания
  private brake = -1; // разворот: время с начала торможения (вместе с паузой на месте), −1 — нет
  private brakeFrom: MaeFrame = IDLE_FRAME; // поза бега в момент начала торможения
  private start = -1; // время с момента смены направления (наклон головы на старте), −1 — нет
  private brakeLook = 0; // сдвиг зрачков к новой стороне, набранный за торможение
  private startLook = 0; // сдвиг зрачков в начале старта (сколько ещё осталось переехать)

  /** braking — разворот на бегу: торможение и пауза на месте перед сменой направления. */
  update(dt: number, speed: number, dir: 1 | -1, airborne: boolean, braking: boolean) {
    if (airborne) {
      this.air = this.air < 0 ? 0 : this.air + dt;
      this.land = -1;
    } else if (this.air >= 0) {
      this.lastAir = this.airFrame();
      this.air = -1;
      this.land = 0;
    } else if (this.land >= 0) {
      this.land += dt;
      if (this.land >= LAND_TIME) this.land = -1;
    }

    if (braking && !airborne && TURN_BRAKE.length) {
      if (this.brake < 0) {
        this.brakeFrom = this.groundFrame();
        this.brake = 0;
      } else {
        this.brake += dt;
      }
    } else {
      this.brake = -1;
    }
    if (this.brake >= 0) this.brakeLook = TURN_LOOK * ease(clamp01((this.brake * TURN_FPS) / TURN_BRAKE.length));

    if (dir !== this.dir && !airborne && TURN_START.length) {
      this.start = 0; // и после разворота на бегу, и при старте из стойки в другую сторону
      // после торможения зрачки уже у новой стороны; из стойки — переезжают на старте
      this.startLook = TURN_LOOK - this.brakeLook;
      this.brakeLook = 0;
    } else if (this.start >= 0) {
      this.start += dt;
      if (this.start * TURN_FPS >= TURN_START.length) {
        // последняя поза старта уже совпадает с позой бега — переход без рывка
        this.start = -1;
        // бег продолжается с фазы, совпадающей с последней позой старта
        const n = RUN_FRAMES.length;
        this.runTime = ((((TURN_RUN_FROM - RUN_START) % n) + n) % n + 0.5) / RUN_FPS;
      }
    }

    if (this.start < 0 && this.brake < 0) {
      this.brakeLook = 0; // торможение отменено без смены направления
      if (speed === 0) this.runTime = 0;
      else this.runTime += dt;
    }
    this.speed = speed;
    this.dir = dir;
  }

  private groundFrame(): MaeFrame {
    if (this.start >= 0) {
      const pose = lowered(sequence(TURN_START, this.start));
      pose.look = [this.startLook * (1 - ease(clamp01(this.start / TURN_LOOK_BACK))), 0];
      return pose;
    }
    if (this.brake >= 0) {
      const pose = lerpFrame(this.brakeFrom, lowered(sequence(TURN_BRAKE, this.brake)), ease(clamp01(this.brake / TURN_BLEND)));
      pose.look = [this.brakeLook, 0];
      return pose;
    }
    return this.speed === 0 ? IDLE_FRAME : lowered(RUN_FRAMES[(RUN_START + Math.floor(this.runTime * RUN_FPS)) % RUN_FRAMES.length]);
  }

  /** В воздухе: позы по времени полёта с переходом между кадрами; нижнее веко и зрачки — к пику и обратно. */
  private airFrame(): MaeFrame {
    const f = Math.min(JUMP_FRAMES.length - 1, this.air * JUMP_FPS);
    const i = Math.floor(f);
    const pose = lerpFrame(JUMP_FRAMES[i], JUMP_FRAMES[Math.min(i + 1, JUMP_FRAMES.length - 1)], f - i);
    const k = this.air < T_APEX ? ease(this.air / T_APEX) : 1 - ease(clamp01((this.air - T_APEX) / T_APEX));
    pose.lids = [0, LOWER_LID_PEAK * k];
    pose.look = [LOOK_PEAK[0] * k, LOOK_PEAK[1] * k];
    return pose;
  }

  /** Приземление: мягкая просадка, затем плавно в стойку или бег; веки смыкаются посередине на ≈0.2 с. */
  private landFrame(): MaeFrame {
    const t = this.land;
    const pose =
      t < LAND_SQUASH
        ? lerpFrame(this.lastAir, SQUASH_FRAME, ease(t / LAND_SQUASH))
        : lerpFrame(SQUASH_FRAME, this.groundFrame(), ease((t - LAND_SQUASH) / (LAND_TIME - LAND_SQUASH)));
    const c = t < LID_OPEN ? ease(clamp01(t / LID_CLOSE)) : 1 - ease(clamp01((t - LID_OPEN) / (LAND_TIME - LID_OPEN)));
    pose.lids = [c, c];
    pose.look = [0, 0];
    return pose;
  }

  draw(ctx: CanvasRenderingContext2D, pose: MaePose) {
    const frame = this.air >= 0 ? this.airFrame() : this.land >= 0 ? this.landFrame() : this.groundFrame();
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.scale(pose.dir === 1 ? -K : K, K);
    drawFrame(ctx, frame);
    ctx.restore();
  }

  /** dev: эталонный кадр поверх модели в той же системе координат. */
  drawReference(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, dir: 1 | -1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir === 1 ? -K : K, K);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(img, -128, -358);
    ctx.restore();
  }
}
