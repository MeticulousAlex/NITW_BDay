// Конструктор персонажей-котов: общая механика рисунка (тело, руки на разных слоях, ноги, голова,
// глаза с веками и зрачками), а конкретный персонаж задаётся «шкурой» — цветами, формами и пропорциями.
// На нём собраны Мэй (mae.ts) и мать (mom.ts); следующие персонажи добавляются своей шкурой.

export type Pt = [number, number, 1?]; // третий элемент — острый угол
export type XY = [number, number];

const DEG = Math.PI / 180;

/**
 * Кадр: head/torso — [dx, dy, поворот°] вокруг опорных точек шкуры.
 * Руки — [плечо x,y, локоть x,y, запястье x,y, добавочная длина предплечья],
 * ноги — [бедро x,y, колено x,y, лодыжка x,y, доп. поворот стопы°].
 */
export interface CatFrame {
  head: number[];
  torso: number[];
  backArm: number[];
  frontArm: number[];
  backLeg: number[];
  frontLeg: number[];
  /** веки [верхнее, нижнее]: 0 — на месте, 1 — на середине глаза */
  lids?: number[];
  /** сдвиг зрачков [dx, dy] */
  look?: number[];
}

/**
 * Сдвиг/поворот отдельной части, чтобы двигать её целиком, не трогая координаты точек.
 * `dx`/`dy` — смещение, `rot` — поворот в градусах вокруг `pivot` (по умолчанию — вокруг начала координат части).
 */
export interface PartXf {
  dx?: number;
  dy?: number;
  rot?: number;
  pivot?: XY;
  scale?: number;
}

/** Части, которым можно задать сдвиг и поворот. */
export type CatPart =
  | 'head' | 'earL' | 'earR' | 'tuft' | 'eyeL' | 'eyeR' | 'face'
  | 'torso' | 'neck' | 'chest' | 'hips' | 'held'
  | 'backArm' | 'frontArm' | 'backLeg' | 'frontLeg';

export interface EyeSpec {
  /** внешний и внутренний углы по x, линия глаза по y */
  outer: number;
  inner: number;
  cy: number;
  /** зрачок в покое и его радиус */
  pupil: XY;
  r: number;
  /** половина высоты глаза */
  half: number;
}

export interface CatSkin {
  fur: string;
  cream: string;
  pupil: string;
  lidLine: string;
  shirt: string;
  sleeve: string;
  pants: string;
  shoe: string;
  shoeBack: string;
  lace: string;
  head: Pt[];
  /** уши — отдельные фигуры, рисуются до головы */
  ears?: Pt[][];
  /** причёска и прочее позади головы (наполовину перекрывается ею) */
  behindHead?: (ctx: CanvasRenderingContext2D) => void;
  torso: Pt[];
  neck: Pt[];
  hips: Pt[];
  boot: Pt[];
  headPivot: XY;
  torsoPivot: XY;
  eyes: [EyeSpec, EyeSpec];
  /** ширина рукава: дальняя и ближняя рука */
  armWidth: [number, number];
  /** предплечье: базовая длина и половина ширины ладони */
  forearm: number;
  pawHalf: number;
  /** пальцы: смещения по x и радиус */
  fingers: number[];
  fingerR: number;
  /** манжета рукава у запястья */
  cuff?: string;
  legWidth: number;
  /** тёмная полоса носка над обувью */
  sockLen: number;
  /** шнуровка ботинка в системе координат обуви */
  laces?: XY[][];
  /** чёлка и всё, что рисуется поверх головы до глаз */
  crown?: (ctx: CanvasRenderingContext2D) => void;
  /** нос, рот, усы — поверх глаз */
  face?: (ctx: CanvasRenderingContext2D) => void;
  /** рисунок на груди */
  chest?: (ctx: CanvasRenderingContext2D) => void;
  /** сдвиг/поворот отдельных частей — удобно двигать их, не пересчитывая точки */
  xf?: Partial<Record<CatPart, PartXf>>;
  /** предмет в руках: рисуется после корпуса, но до ближней руки */
  held?: (ctx: CanvasRenderingContext2D) => void;
}

export function shape(ctx: CanvasRenderingContext2D, pts: Pt[], fill: string | CanvasGradient) {
  const n = pts.length;
  const mid = (a: Pt, b: Pt): XY => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = pts[0][2] ? pts[0] : mid(pts[n - 1], pts[0]);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const next = pts[(i + 1) % n];
    if (p[2]) {
      ctx.lineTo(p[0], p[1]);
      if (!next[2]) ctx.lineTo(...mid(p, next));
    } else {
      ctx.quadraticCurveTo(p[0], p[1], ...mid(p, next));
    }
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function line(ctx: CanvasRenderingContext2D, pts: XY[], color: string, width: number) {
  ctx.beginPath();
  ctx.moveTo(...pts[0]);
  for (const p of pts.slice(1)) ctx.lineTo(...p);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Кривая через три сустава: контрольная точка подобрана так, чтобы средний сустав лежал на кривой. */
export function limb(ctx: CanvasRenderingContext2D, j: number[], color: string, width: number) {
  const [ax, ay, bx, by, cx, cy] = j;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(2 * bx - (ax + cx) / 2, 2 * by - (ay + cy) / 2, cx, cy);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Поворот продолжения конечности (кисть, носок) вдоль отрезка средний сустав → конец. */
export function along(ctx: CanvasRenderingContext2D, j: number[]) {
  ctx.translate(j[4], j[5]);
  ctx.rotate(Math.atan2(j[5] - j[3], j[4] - j[2]) - Math.PI / 2);
}

export function group(ctx: CanvasRenderingContext2D, t: number[], pivot: XY, draw: () => void) {
  ctx.save();
  ctx.translate(pivot[0] + t[0], pivot[1] + t[1]);
  ctx.rotate(t[2] * DEG);
  ctx.translate(-pivot[0], -pivot[1]);
  draw();
  ctx.restore();
}

/** Выполняет рисование части с её сдвигом, поворотом и масштабом. */
export function withXf(ctx: CanvasRenderingContext2D, xf: PartXf | undefined, draw: () => void) {
  if (!xf) {
    draw();
    return;
  }
  const [px, py] = xf.pivot ?? [0, 0];
  ctx.save();
  ctx.translate((xf.dx ?? 0) + px, (xf.dy ?? 0) + py);
  if (xf.rot) ctx.rotate(xf.rot * DEG);
  if (xf.scale && xf.scale !== 1) ctx.scale(xf.scale, xf.scale);
  ctx.translate(-px, -py);
  draw();
  ctx.restore();
}

function eyePath(ctx: CanvasRenderingContext2D, outer: number, inner: number, cy: number, top: number, bottom: number) {
  const w = inner - outer;
  const a = outer + w * 0.2;
  const b = inner - w * 0.06;
  ctx.beginPath();
  ctx.moveTo(outer, cy);
  ctx.bezierCurveTo(a, cy - top, b, cy - top, inner, cy);
  ctx.bezierCurveTo(b, cy + bottom, a, cy + bottom, outer, cy);
}

/** Глаз: веки — высоты дуг вверх и вниз от линии глаза, зрачок обрезается формой глаза. */
export function eye(ctx: CanvasRenderingContext2D, skin: CatSkin, e: EyeSpec, lids: number[], look: number[]) {
  const top = e.half * (1 - lids[0]);
  const bottom = e.half * (1 - lids[1]);
  if (top + bottom < 1) {
    const w = e.inner - e.outer;
    ctx.beginPath();
    ctx.moveTo(e.outer, e.cy);
    ctx.bezierCurveTo(e.outer + w * 0.2, e.cy - top * 0.75, e.inner - w * 0.06, e.cy - top * 0.75, e.inner, e.cy);
    ctx.strokeStyle = skin.lidLine;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
    return;
  }
  eyePath(ctx, e.outer, e.inner, e.cy, top, bottom);
  ctx.fillStyle = skin.cream;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.arc(e.pupil[0] + look[0], e.pupil[1] + look[1], e.r, 0, Math.PI * 2);
  ctx.fillStyle = skin.pupil;
  ctx.fill();
  ctx.restore();
}

/** Рука: рукав → тёмное предплечье ровно в ширину рукава по касательной → ладонь с пальцами. */
export function arm(ctx: CanvasRenderingContext2D, skin: CatSkin, j: number[], width: number) {
  const [ax, ay, bx, by, cx, cy] = j;
  limb(ctx, j, skin.sleeve, width);
  const qx = 2 * bx - (ax + cx) / 2;
  const qy = 2 * by - (ay + cy) / 2;
  const len = skin.forearm + j[6];
  const h = skin.pawHalf;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.atan2(cy - qy, cx - qx) - Math.PI / 2);
  if (skin.cuff) {
    ctx.fillStyle = skin.cuff;
    ctx.fillRect(-width / 2 - 1, -8, width + 2, 12);
  }
  ctx.fillStyle = skin.fur;
  ctx.fillRect(-width / 2, -1, width, len + 2);
  ctx.translate(0, len);
  shape(ctx, [[-width / 2, -2, 1], [width / 2, -2, 1], [h, 6], [h, 12], [-h, 12], [-h, 6]], skin.fur);
  for (const x of skin.fingers) {
    ctx.beginPath();
    ctx.arc(x, x === 0 ? 16 : 14, skin.fingerR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function leg(ctx: CanvasRenderingContext2D, skin: CatSkin, j: number[], boot: string) {
  limb(ctx, j, skin.pants, skin.legWidth);
  ctx.save();
  along(ctx, j);
  ctx.fillStyle = skin.fur;
  ctx.fillRect(-skin.legWidth / 2, 0, skin.legWidth, skin.sockLen);
  ctx.translate(0, skin.sockLen);
  ctx.rotate(j[6] * DEG);
  shape(ctx, skin.boot, boot);
  for (const l of skin.laces ?? []) line(ctx, l, skin.lace, 2);
  ctx.restore();
}

export function head(ctx: CanvasRenderingContext2D, skin: CatSkin, lids: number[], look: number[]) {
  const xf = skin.xf ?? {};
  withXf(ctx, xf.tuft, () => skin.behindHead?.(ctx)); // причёска за головой
  const ears = skin.ears ?? [];
  if (ears[0]) withXf(ctx, xf.earL, () => shape(ctx, ears[0], skin.fur)); // уши — отдельные элементы
  if (ears[1]) withXf(ctx, xf.earR, () => shape(ctx, ears[1], skin.fur));
  for (const e of ears.slice(2)) shape(ctx, e, skin.fur);
  shape(ctx, skin.head, skin.fur);
  skin.crown?.(ctx);
  withXf(ctx, xf.eyeL, () => eye(ctx, skin, skin.eyes[0], lids, look));
  withXf(ctx, xf.eyeR, () => eye(ctx, skin, skin.eyes[1], lids, look));
  withXf(ctx, xf.face, () => skin.face?.(ctx));
}

/**
 * Персонаж собирается из четырёх элементов: НОГИ → ТЕЛО → РУКИ (на разных слоях) → ГОЛОВА.
 * Внутри каждого — свои части: у ног штанина, носок и обувь; у головы уши, причёска, глаза и морда.
 */
export function drawCat(ctx: CanvasRenderingContext2D, skin: CatSkin, f: CatFrame) {
  const xf = skin.xf ?? {};
  // 1. ноги
  withXf(ctx, xf.backLeg, () => leg(ctx, skin, f.backLeg, skin.shoeBack));
  withXf(ctx, xf.frontLeg, () => leg(ctx, skin, f.frontLeg, skin.shoe));
  // 2. тело: таз — продолжение корпуса, обе части в одной группе
  group(ctx, f.torso, skin.torsoPivot, () => withXf(ctx, xf.hips, () => shape(ctx, skin.hips, skin.pants)));
  withXf(ctx, xf.backArm, () => arm(ctx, skin, f.backArm, skin.armWidth[0])); // 3а. дальняя рука — за корпусом
  group(ctx, f.torso, skin.torsoPivot, () => {
    withXf(ctx, xf.torso, () => shape(ctx, skin.torso, skin.shirt));
    withXf(ctx, xf.neck, () => shape(ctx, skin.neck, skin.fur));
    withXf(ctx, xf.chest, () => skin.chest?.(ctx));
  });
  withXf(ctx, xf.held, () => skin.held?.(ctx));
  withXf(ctx, xf.frontArm, () => arm(ctx, skin, f.frontArm, skin.armWidth[1])); // 3б. ближняя рука — перед корпусом
  // 4. голова
  group(ctx, f.head, skin.headPivot, () =>
    withXf(ctx, xf.head, () => head(ctx, skin, f.lids ?? [0, 0], f.look ?? [0, 0])),
  );
}
