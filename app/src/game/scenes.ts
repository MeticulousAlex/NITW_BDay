// Сцены дома: чердак и этажи. У каждой — размер мира, пол, границы, фон/передний план, точки взаимодействия,
// лестницы и точки появления. Этажи — в мировых единицах, где Мэй ростом MAE_H (разрез дома ×483/306, сверху поле 128).

import { FLOOR_Y, HOTSPOTS, MAE_H, ROOM_L, ROOM_R, WORLD_H, WORLD_W, type Hotspot } from './data';
import { drawFront as drawAtticFront, drawRoom, bakeArt, compileAll } from './room';
import { FLOOR2, FLOOR2_BACK, FLOOR2_FRONT, FLOOR2_STAIRS } from './floor2-shapes';
import { FLOOR1, FLOOR1_ARCH, FLOOR1_BACK, FLOOR1_FRONT, FLOOR1_STAIRS, FLOOR1_TABLE } from './floor1-shapes';
import { drawMom, momPose } from './mom';
import { STREET_BACK_SPRITES, STREET_FRONT_SPRITES, STREET_SIZE, type StreetSprite } from './street-scene';


export type SceneId = 'attic' | 'floor2' | 'floor1' | 'street';

/** половина ширины спрайта Мэй (с ушами и руками) в долях роста — хитбокс у стен */
const HALF_W = 0.4;

export interface Spawn {
  scene: SceneId;
  at: string;
}

/**
 * Лестница: отрезок от подножия a (на полу) до конца b. Встать — у подножия ↑ (если b выше) или ↓ (если ниже).
 * Дойти до b — переход в `to` (если задан), иначе Мэй там останавливается.
 */
export interface Stair {
  a: [number, number];
  b: [number, number];
  to?: Spawn;
}

export interface SpawnPoint {
  x: number;
  dir: 1 | -1;
  stair?: number; // появиться на лестнице
  t?: number; // положение на ней: 0 — подножие, 1 — конец
}

export interface Scene {
  id: SceneId;
  w: number;
  h: number;
  floorY: number;
  left: number;
  right: number;
  hotspots: Hotspot[];
  stairs: Stair[];
  spawns: Record<string, SpawnPoint>;
  /** потолок: выше него Мэй обрезается (лестница уходит сквозь перекрытие) */
  ceilY: number;
  drawBack: (ctx: CanvasRenderingContext2D) => void;
  drawFront: (ctx: CanvasRenderingContext2D) => void;
  /** то, что перекрывает Мэй, пока она на лестнице: ступени, перила, часы */
  drawStairs?: (ctx: CanvasRenderingContext2D) => void;
  /** область, за пределами которой Мэй на лестнице не видна (проём арки) */
  stairClip?: () => Path2D;
  /** слой между фоном и Мэй: живые объекты сцены (мать за столом) */
  drawMid?: (ctx: CanvasRenderingContext2D, t: number, playerX: number) => void;
}

const attic: Scene = {
  id: 'attic',
  w: WORLD_W,
  h: WORLD_H,
  floorY: FLOOR_Y,
  left: ROOM_L + MAE_H * HALF_W,
  right: ROOM_R - MAE_H * HALF_W,
  hotspots: HOTSPOTS,
  stairs: [],
  spawns: {
    start: { x: 900, dir: 1 },
    fromFloor2: { x: 2760, dir: -1 }, // у вешалки
  },
  ceilY: 0,
  drawBack: drawRoom,
  drawFront: drawAtticFront,
};

// ── второй этаж
const S = 483 / 306;
const T = 128;
const px = (x: number, y: number): [number, number] => [x * S, y * S + T];
const px1 = px; // первый этаж в тех же единицах разреза
let floor2Baked: HTMLCanvasElement | null = null;
let floor2Stairs: HTMLCanvasElement | null = null;
const floor2Front = compileAll(FLOOR2_FRONT);

/** Лестница поверх Мэй — вырезка из уже освещённого фона по силуэту её фигур (без швов по свету). */
function bakeStairs(): HTMLCanvasElement {
  const c = bakeArt(FLOOR2_BACK, FLOOR2.w, FLOOR2.h);
  const ctx = c.getContext('2d')!;
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(bakeArt(FLOOR2_STAIRS, FLOOR2.w, FLOOR2.h), 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

const floor2: Scene = {
  id: 'floor2',
  w: FLOOR2.w,
  h: FLOOR2.h,
  floorY: FLOOR2.floorY,
  left: MAE_H * HALF_W,
  right: FLOOR2.w - MAE_H * HALF_W,
  hotspots: [
    {
      id: 'portrait',
      x: 1602 * S,
      radius: 300,
      promptX: 1602 * S,
      promptY: 120 * S + T,
      script: [{ say: 'Мы тут все такие милые.' }, { say: 'Что с нами потом случилось?' }],
    },
    {
      id: 'clock',
      x: 678 * S,
      radius: 260,
      promptX: 678 * S,
      promptY: 118 * S + T,
      script: [{ say: 'Эти часы старше меня.' }, { say: 'И до сих пор тикают громче всех в доме.' }],
    },
    {
      id: 'cage',
      x: 2395 * S,
      radius: 260,
      promptX: 2395 * S,
      promptY: 222 * S + T,
      script: [{ say: 'Привет, птичка.' }, { say: 'Ты тоже никуда отсюда не делась, да?' }],
    },
    {
      id: 'bookshelf',
      x: 3532 * S,
      radius: 280,
      promptX: 3532 * S,
      promptY: 370 * S + T,
      script: [{ say: 'Мамины книги.' }, { say: 'Половина — о том, как пережить подростка.' }],
    },
  ],
  stairs: [
    // наверх, на чердак: линия по серединам ступеней (шаг 88.1×63.1), подножие у пола справа
    { a: px(1428, 813), b: px(0, -210), to: { scene: 'attic', at: 'fromFloor2' } },
    // вниз, на первый этаж: параллельно нижним перилам
    { a: px(1840, 813), b: px(2046, 960), to: { scene: 'floor1', at: 'fromFloor2' } },
  ],
  spawns: {
    fromAttic: { x: 0, dir: 1, stair: 0, t: 0.5 }, // спускается из люка: выше — обрезается потолком
    fromFloor1: { x: 0, dir: -1, stair: 1, t: 0.85 }, // поднялась с первого этажа
  },
  ceilY: T,
  drawBack: (ctx) => {
    floor2Baked ??= bakeArt(FLOOR2_BACK, FLOOR2.w, FLOOR2.h);
    ctx.drawImage(floor2Baked, 0, 0);
  },
  drawFront: (ctx) => {
    for (const draw of floor2Front) draw(ctx);
  },
  drawStairs: (ctx) => {
    floor2Stairs ??= bakeStairs();
    ctx.drawImage(floor2Stairs, 0, 0);
  },
};

// ── первый этаж
let floor1Baked: HTMLCanvasElement | null = null;
let floor1Stairs: HTMLCanvasElement | null = null;
let floor1Arch: Path2D | null = null;
const floor1Front = compileAll(FLOOR1_FRONT);
const floor1Table = compileAll(FLOOR1_TABLE);
// мать: модель в пикселях референса (319×465) ставится масштабом 0.909 макушкой на y=360 разреза
const MOM_S = 0.909;
const MOM_X = 344 - 15 * MOM_S;
const MOM_Y = 360 - 15 * MOM_S;
/** макушка сидящей матери — над ней висят её реплики */
const MOM_HEAD: [number, number] = [457 * S, 344 * S + T];

const floor1: Scene = {
  id: 'floor1',
  w: FLOOR1.w,
  h: FLOOR1.h,
  floorY: FLOOR1.floorY,
  left: MAE_H * HALF_W,
  right: FLOOR1.w - MAE_H * HALF_W,
  ceilY: T,
  hotspots: [
    {
      id: 'mom',
      x: 1000 * S,
      radius: 420,
      promptX: 457 * S,
      promptY: 330 * S + T,
      script: [
        { say: 'Привет, мам.' },
        { say: 'Привет, малышка. Как спалось?', at: MOM_HEAD },
        {
          choose: [
            {
              label: 'Нормально',
              then: [
                { say: 'Врёшь ведь.', at: MOM_HEAD },
                { say: 'В холодильнике есть еда. Поешь.', at: MOM_HEAD },
              ],
            },
            {
              label: 'Странные сны',
              then: [
                { say: 'Опять?', at: MOM_HEAD },
                { say: 'Ты всегда видела странные сны.', at: MOM_HEAD },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'sofa',
      x: 1950 * S,
      radius: 400,
      promptX: 1950 * S,
      promptY: 400 * S + T,
      script: [{ say: 'Диван, на котором я провела половину детства.' }, { say: 'И половину прошлой недели.' }],
    },
    {
      // выход на улицу — у вешалки, как выход с чердака
      id: 'exit',
      x: 3476 * S,
      radius: 260,
      promptX: 3476 * S,
      promptY: 380 * S + T,
      exit: { scene: 'street', at: 'fromHouse' },
      script: [],
    },
    {
      id: 'bless',
      x: 3190 * S,
      radius: 280,
      promptX: 3192 * S,
      promptY: 240 * S + T,
      script: [{ say: '«Благослови этот бардак».' }, { say: 'Бабушкина работа. Она знала, о чём говорит.' }],
    },
  ],
  stairs: [
    // наверх, на второй этаж: линия хода проходит на ~10 px ниже поверхности ступеней,
    // чтобы Мэй не висела в воздухе на стыках
    { a: px1(3142, 797), b: px1(2440, 300), to: { scene: 'floor2', at: 'fromFloor1' } },
  ],
  spawns: {
    fromFloor2: { x: 0, dir: 1, stair: 0, t: 0.92 }, // спустилась со второго этажа
    kitchen: { x: 1200, dir: -1 }, // рабочая точка старта: у стола на кухне
    fromStreet: { x: 3400 * S, dir: -1 }, // вернулась с улицы — у вешалки
  },
  drawBack: (ctx) => {
    floor1Baked ??= bakeArt(FLOOR1_BACK, FLOOR1.w, FLOOR1.h);
    ctx.drawImage(floor1Baked, 0, 0);
  },
  drawFront: (ctx) => {
    for (const draw of floor1Front) draw(ctx);
  },
  stairClip: () => {
    floor1Arch ??= (() => {
      const a = FLOOR1_ARCH[0][2] as number[];
      const path = new Path2D();
      path.moveTo(a[0], a[1]);
      for (let i = 2; i < a.length; i += 2) path.lineTo(a[i], a[i + 1]);
      path.closePath();
      return path;
    })();
    return floor1Arch;
  },
  drawMid: (ctx, t, playerX) => {
    ctx.save();
    ctx.translate(MOM_X * S, MOM_Y * S + T);
    ctx.scale(MOM_S * S, MOM_S * S);
    drawMom(ctx, momPose(t, playerX - 457 * S));
    ctx.restore();
    for (const draw of floor1Table) draw(ctx); // стол — перед матерью
  },
  drawStairs: (ctx) => {
    floor1Stairs ??= (() => {
      const c = bakeArt(FLOOR1_BACK, FLOOR1.w, FLOOR1.h);
      const g = c.getContext('2d')!;
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(bakeArt(FLOOR1_STAIRS, FLOOR1.w, FLOOR1.h), 0, 0);
      g.globalCompositeOperation = 'source-over';
      return c;
    })();
    ctx.drawImage(floor1Stairs, 0, 0);
  },
};

// ── улица: сцена MaeStreet, собранная из оригинальных спрайтов игры (см. scratchpad/street_export.py).
// Каждый элемент — отдельная картинка со своим местом и слоем; back рисуется за Мэй, front перед ней.
const streetImgs = new Map<string, HTMLImageElement>();
function streetSprite(name: string): HTMLImageElement {
  let img = streetImgs.get(name);
  if (!img) {
    img = new Image();
    img.src = `/street/sprites/${name}.png`;
    streetImgs.set(name, img);
  }
  return img;
}
function drawSprites(ctx: CanvasRenderingContext2D, list: StreetSprite[]) {
  for (const sp of list) {
    const img = streetSprite(sp.s);
    if (!img.complete || !img.naturalWidth) continue;
    if (sp.fx || sp.fy) {
      ctx.save();
      ctx.translate(sp.x + (sp.fx ? sp.w : 0), sp.y + (sp.fy ? sp.h : 0));
      ctx.scale(sp.fx ? -1 : 1, sp.fy ? -1 : 1);
      ctx.drawImage(img, 0, 0, sp.w, sp.h);
      ctx.restore();
    } else {
      ctx.drawImage(img, sp.x, sp.y, sp.w, sp.h);
    }
  }
}
const DOOR_X = 12800; // крыльцо дома Мэй, уточняется по сцене

const street: Scene = {
  id: 'street',
  w: STREET_SIZE.w,
  h: STREET_SIZE.h,
  floorY: STREET_SIZE.floorY,
  left: MAE_H * HALF_W,
  right: STREET_SIZE.w - MAE_H * HALF_W,
  ceilY: 0,
  hotspots: [
    {
      id: 'home',
      x: DOOR_X,
      radius: 420,
      promptX: DOOR_X,
      promptY: STREET_SIZE.floorY - 620,
      exit: { scene: 'floor1', at: 'fromStreet' },
      script: [],
    },
  ],
  stairs: [],
  spawns: { fromHouse: { x: DOOR_X, dir: 1 } },
  drawBack: (ctx) => drawSprites(ctx, STREET_BACK_SPRITES),
  drawFront: (ctx) => drawSprites(ctx, STREET_FRONT_SPRITES),
};

export const SCENES: Record<SceneId, Scene> = { attic, floor2, floor1, street };
