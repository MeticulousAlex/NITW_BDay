// Мать Мэй на конструкторе персонажей (cat.ts): те же тело, руки на разных слоях, ноги и голова,
// что у Мэй, но своими пропорциями — овальная голова с округлыми ушами, широкий корпус, сидячая поза.
// Координаты — пиксели референса refs-local/mother.png (319×465).

import { drawCat, line, shape, type CatFrame, type CatSkin, type Pt, type XY } from './cat';

const FUR = '#091125';
const TUFT = '#2e6189';
const SWEATER = '#1e3504';   // корпус — светлый тон свитера с референса
const SLEEVE = '#122b00';    // рукава — тёмный тон
const SWEAT_D = '#16290300';
const JEANS = '#1f626d';
const SHOE = '#bcb8b2';
const SHOE_BACK = '#928f86';
const LACE = '#8a8779';
const CREAM = '#fae99f';
const PUPIL = '#6d2b25';
const COLLAR = '#b86461';
const BOOK = '#7a1f07';
const PAGE = '#d9cfbd';

// голова — овал (замер контура: x 15–244, y 22–178); уши и причёска отдельными элементами
// голова — овал строго по замеру границ маски референса
const HEAD: Pt[] = [
  [32, 100], [34, 84], [41, 65], [58, 50], [85, 39], [110, 31], [140, 28], [168, 31],
  [192, 37], [214, 47], [230, 63], [236, 86], [237, 110], [233, 133], [223, 146], [206, 160],
  [165, 175], [130, 179], [93, 175], [57, 160], [44, 146], [35, 130],
];
// уши — отдельные фигуры с острым кончиком и скруглённым основанием (замер: вершины (15,34) и (244,22))
const EAR_L: Pt[] = [[15, 34, 1],[47,34], [82, 46], [62, 116], [26, 96], [16, 52]];
const EAR_R: Pt[] = [[244, 15, 1], [200, 22], [170, 36], [196, 98], [236, 88], [244, 42]];
const TORSO: Pt[] = [
  [62, 176], [42, 201], [25, 235], [16, 270], [16, 312], [100, 320], [187, 312],
  [183, 282], [175, 258], [164, 210], [147, 190], [119, 186], [100, 190],
];
const NECK: Pt[] = [[130, 190], [104, 184]];
// таз продолжает форму корпуса: его верхняя кромка совпадает с нижней кромкой тела
const HIPS: Pt[] = [[16, 270], [16, 350], [60, 372], [130, 372], [186, 350], [183, 280], [100, 318]];
// стопа: верх в (0,0), носок к −x
// стопа матери смотрит вперёд (к +x): верх голенища в (0,0)
const BOOT: Pt[] = [[-16, 0, 1], [16, 0, 1], [35, 10],[35, 17], [-16, 17], [-16, 17]];

let book: (ctx: CanvasRenderingContext2D) => void;

const MOM_SKIN: CatSkin = {
  fur: FUR,
  cream: CREAM,
  pupil: PUPIL,
  lidLine: '#050b16',
  shirt: SWEATER,
  sleeve: SLEEVE,
  pants: JEANS,
  shoe: SHOE,
  shoeBack: SHOE_BACK,
  lace: LACE,
  head: HEAD,
  torso: TORSO,
  neck: NECK,
  hips: HIPS,
  boot: BOOT,
  headPivot: [130, 120],
  torsoPivot: [100, 250],
  eyes: [
    { outer: 44, inner: 134, cy: 105, pupil: [106, 107], r: 26, half: 32 },
    { outer: 232, inner: 146, cy: 100, pupil: [196, 102], r: 26, half: 32 },
  ],
  // сдвиги и повороты частей: подгонка положения без правки координат точек
  xf: {
    head: { dx: 2, dy: 12, rot: 4, pivot: [130, 120] },
    tuft: { dx: 0, dy: 0 },
    earL: { dx: 0, dy: 0, rot: 0, pivot: [40, 60] },
    earR: { dx: 0, dy: 0, rot: 0, pivot: [220, 52] },
    eyeL: { dx: 0, dy: 0 },
    eyeR: { dx: 0, dy: 0 },
    face: { dx: 0, dy: 0 },
    torso: { dx: 0, dy: 0 },
    hips: { dx: 0, dy: 0 },
    held: { dx: 0, dy: 0, rot: 0, pivot: [250, 210] },
    frontArm: { dx: -30, dy: 10 },
    backArm: { dx: 0, dy: 0 },
    frontLeg: { dx: 5, dy: -10 },
    backLeg: { dx: 25, dy: -10 },
  },
  cuff: COLLAR,
  armWidth: [22, 22],
  forearm: 14,
  pawHalf: 22,
  fingers: [-13, 0, 13],
  fingerR: 9,
  legWidth: 32,
  sockLen: 0,
  ears: [EAR_L, EAR_R],
  behindHead: (ctx) => {
    // причёска — три шарика, наполовину перекрытые головой (замер: x 120–165, y 15–30)
    for (const [x, y] of [[126, 28], [142, 26], [158, 32]] as XY[][]) {
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fillStyle = TUFT;
      ctx.fill();
    }
  },
  crown: (ctx) => {
    for (const b of [[[92, 54], [97, 68]], [[108, 54], [111, 64]], [[155, 54], [152, 64]], [[171, 54], [166, 68]]] as XY[][]) {
      line(ctx, b, TUFT, 2.4);
    }
  },
  face: (ctx) => {
    // нос, рот «ㅅ» и усы — как у Мэй
    // нос, рот и усы — как у Мэй, только в пропорциях матери
    ctx.beginPath();
    ctx.moveTo(131, 135);
    ctx.lineTo(143, 135);
    ctx.lineTo(137, 144);
    ctx.closePath();
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();
    line(ctx, [[128, 158], [137, 145], [146, 158]], CREAM, 3);
    for (const w of [[[98, 139], [122, 137]], [[100, 151], [122, 147]], [[152, 137], [176, 139]], [[152, 147], [174, 151]]] as XY[][]) {
      line(ctx, w, CREAM, 3);
    }
  },
  chest: (ctx) => {
    shape(ctx, NECK, FUR);
    // воротник по замеру контура на референсе
    shape(ctx, [[72, 174, 1], [110, 184], [160, 182, 1], [163, 196], [148, 197], [132, 186], [120, 196], [103, 198], [84, 192], [64, 179, 1]], COLLAR);
    ctx.beginPath();
    ctx.arc(140, 286, 5, 0, Math.PI * 2);
    ctx.fillStyle = JEANS;
    ctx.fill(); // пуговица
  },
  held: (ctx) => book(ctx),
};

// книга в руках: обложка, разворот страниц и строки
book = (ctx) => {
  // книга по замеру: обложка (192,159)–(308,257) с наклоном ≈ −30°, светлый обрез страниц сверху
  shape(ctx, [[198, 232, 1], [240, 158, 1], [308, 188, 1], [264, 258, 1]], BOOK);
  shape(ctx, [[240, 158, 1], [308, 188, 1], [300, 200, 1], [236, 172, 1]], PAGE);
  ctx.save();
  ctx.translate(232, 200);
  ctx.rotate(0.42);
  for (let i = 0; i < 6; i++) line(ctx, [[-12, -20 + i * 9], [56 - (i % 2) * 14, -20 + i * 9]], '#a8563c', 2.4);
  ctx.restore();
};

/** Поза матери: сидит, наклонившись к книге. */
export const MOM_SIT: CatFrame = {
  head: [0, 0, 0],
  torso: [0, 0, 0],
  backArm: [92, 202, 162, 226, 240, 236, 0],
  frontArm: [114, 208, 154, 232, 248, 230, 4],
  backLeg: [116, 324, 154, 347, 152, 436, 16],
  frontLeg: [106, 340, 152, 376, 135, 426, 20],
};

export interface MomPose {
  lids: number[];
  look: number[];
}

export function drawMom(ctx: CanvasRenderingContext2D, pose: MomPose) {
  drawCat(ctx, MOM_SKIN, { ...MOM_SIT, lids: pose.lids, look: pose.look });
}

/** Спокойная анимация: моргание и взгляд, который тянется к Мэй. */
export function momPose(t: number, dx: number): MomPose {
  const cycle = 4.6;
  const b = t % cycle;
  const blink = b < 0.09 ? b / 0.09 : b < 0.19 ? 1 - (b - 0.09) / 0.1 : 0;
  const k = Math.max(-1, Math.min(1, dx / 700));
  return { lids: [blink, blink], look: [k * 9, Math.abs(k) * -2] };
}
