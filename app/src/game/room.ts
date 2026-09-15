// Чердак Мэй днём, 1:1 по кадрам игры. Всё в пикселях эталона (= мировые единицы).
// Порядок: плоская стена с полосами → предметы из простых фигур → слой света → (Мэй) → передний план.

import { COLORS, FRONT, GLOW_CUT, LIGHT, LIGHT_HOLES, OBJECTS, ROOM, STRIPES, type Prim } from './attic-shapes';

type Ctx = CanvasRenderingContext2D;

function splineClosed(path: Path2D, a: number[]) {
  const n = a.length / 2;
  const pt = (i: number) => [a[((i + n) % n) * 2], a[((i + n) % n) * 2 + 1]];
  path.moveTo(a[0], a[1]);
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pt(i - 1);
    const [x1, y1] = pt(i);
    const [x2, y2] = pt(i + 1);
    const [x3, y3] = pt(i + 2);
    path.bezierCurveTo(x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6, x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6, x2, y2);
  }
  path.closePath();
}

/** Открытый сплайн через точки (Катмулл-Ром). */
function splineOpen(path: Path2D, a: number[]) {
  const n = a.length / 2;
  const pt = (i: number) => [a[Math.max(0, Math.min(n - 1, i)) * 2], a[Math.max(0, Math.min(n - 1, i)) * 2 + 1]];
  path.moveTo(a[0], a[1]);
  if (n === 2) {
    path.lineTo(a[2], a[3]);
    return;
  }
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pt(i - 1);
    const [x1, y1] = pt(i);
    const [x2, y2] = pt(i + 1);
    const [x3, y3] = pt(i + 2);
    path.bezierCurveTo(x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6, x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6, x2, y2);
  }
}

function polyPath(path: Path2D, a: number[]) {
  path.moveTo(a[0], a[1]);
  for (let i = 2; i < a.length; i += 2) path.lineTo(a[i], a[i + 1]);
  path.closePath();
}

/** Фигура → путь и способ отрисовки. */
function compile([type, color, raw]: Prim): (ctx: Ctx) => void {
  const a = raw as number[];
  const path = new Path2D();
  let rule: CanvasFillRule = 'nonzero';
  let strokeWidth = 0;
  switch (type) {
    case 'rect':
      path.rect(a[0], a[1], a[2], a[3]);
      break;
    case 'rrect':
      path.roundRect(a[0], a[1], a[2], a[3], Math.max(0, Math.min(a[4], a[2] / 2, a[3] / 2)));
      break;
    case 'quad':
    case 'poly':
      polyPath(path, a);
      break;
    case 'spline':
      splineClosed(path, a);
      break;
    case 'circle':
      path.arc(a[0], a[1], a[2], 0, Math.PI * 2);
      break;
    case 'ring':
      path.arc(a[0], a[1], a[2], 0, Math.PI * 2);
      path.moveTo(a[0] + a[3], a[1]);
      path.arc(a[0], a[1], a[3], 0, Math.PI * 2);
      rule = 'evenodd';
      break;
    case 'line':
      path.moveTo(a[0], a[1]);
      path.lineTo(a[2], a[3]);
      strokeWidth = a[4];
      break;
    case 'curve':
      path.moveTo(a[0], a[1]);
      path.quadraticCurveTo(a[2], a[3], a[4], a[5]);
      strokeWidth = a[6];
      break;
    case 'path':
      splineOpen(path, a.slice(1));
      strokeWidth = a[0];
      break;
    case 'semi':
      path.ellipse(a[0], a[1], a[2], a[3], 0, 0, Math.PI);
      path.closePath();
      break;
    case 'shape':
      for (const r of raw as number[][]) polyPath(path, r);
      rule = 'evenodd';
      break;
  }
  // 'lg x0 x1 #c0 #c1 …' — горизонтальный градиент, остановки равномерно от x0 до x1
  const paint = (ctx: Ctx): string | CanvasGradient => {
    if (!color.startsWith('lg ')) return color;
    const [, x0, x1, ...stops] = color.split(' ');
    const grad = ctx.createLinearGradient(+x0, 0, +x1, 0);
    stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
    return grad;
  };
  if (strokeWidth) {
    return (ctx) => {
      ctx.strokeStyle = paint(ctx);
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(path);
    };
  }
  return (ctx) => {
    ctx.fillStyle = paint(ctx);
    ctx.fill(path, rule);
  };
}

type Draw = (ctx: Ctx) => void;
let cache: { behind: Draw[]; back: Draw[]; front: Draw[]; stripes: Path2D } | null = null;

function get() {
  if (cache) return cache;
  const stripes = new Path2D();
  const first = ROOM.x0 + ((((STRIPES.phase - ROOM.x0) % STRIPES.period) + STRIPES.period) % STRIPES.period);
  for (let x = first; x < ROOM.x1; x += STRIPES.period) stripes.rect(x, ROOM.wallTop, STRIPES.width, ROOM.boardTop - ROOM.wallTop);
  const cut = OBJECTS.findIndex((o) => o.name === GLOW_CUT) + 1;
  cache = {
    behind: OBJECTS.slice(0, cut).flatMap((o) => o.prims.map(compile)),
    back: OBJECTS.slice(cut).flatMap((o) => o.prims.map(compile)),
    front: FRONT.map(compile),
    stripes,
  };
  return cache;
}

/**
 * Свет запекается в буфер комнаты — та же формула, что в скриптах сверки:
 *  1) круги от окна (стена/плинтус): цвет += прибавка × clamp((L − L0)/(L1 − L0)), L — средняя яркость фона;
 *  2) тёплое свечение под окном: цвет ×= усиление, плавно к краю эллипса;
 *  3) полоса света на полу и тень у потолка: цвет ×= множитель.
 * Стекло окна и зеркала — дыры в слое света.
 */
function bakeLight(img: ImageData, phase: 'floor' | 'glow' | 'light') {
  const L = LIGHT;
  const [wx, wy, wr, wyb] = LIGHT_HOLES.window; // wyb: ниже — перила кровати поверх стекла, их свет не пропускаем
  const [mx, my, mrx, mry] = LIGHT_HOLES.mirror;
  const { data, width } = img;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const soft = (d: number, w: number) => clamp(d / w + 0.5);
  const top = phase === 'floor' ? ROOM.floorTop : ROOM.wallTop;
  const bottom = phase === 'floor' ? ROOM.floorBottom : ROOM.floorTop;
  for (let y = top; y < bottom; y++) {
    const shade = 1 - (1 - L.tg) * clamp((L.ty1 - y) / (L.ty1 - ROOM.wallTop));
    for (let x = ROOM.x0; x < ROOM.x1; x++) {
      if ((y < wyb && Math.hypot(x - wx, y - wy) < wr) || Math.hypot((x - mx) / mrx, (y - my) / mry) < 1) continue;
      const o = (y * width + x) * 4;
      let r = data[o];
      let g = data[o + 1];
      let b = data[o + 2];
      const k2 = (w: number) => soft(L.r2 - Math.hypot(x - L.c2x, y - L.c2y), w);
      if (phase === 'floor') {
        // пятно узкого круга на полу — до предметов, чтобы ножки и коробки не окрашивались
        const k = k2(L.floorSoft);
        if (k <= 0) continue;
        data[o] = Math.min(255, r * (1 + (L.floorGain[0] - 1) * k));
        data[o + 1] = Math.min(255, g * (1 + (L.floorGain[1] - 1) * k));
        data[o + 2] = Math.min(255, b * (1 + (L.floorGain[2] - 1) * k));
        continue;
      }
      if (phase === 'glow') {
        const kw = clamp((1 - Math.hypot((x - L.wcx) / L.wrx, (y - L.wcy) / L.wry)) / (1 - L.winner));
        if (kw <= 0) continue;
        data[o] = Math.min(255, r * (1 + (L.wg[0] - 1) * kw));
        data[o + 1] = Math.min(255, g * (1 + (L.wg[1] - 1) * kw));
        data[o + 2] = Math.min(255, b * (1 + (L.wg[2] - 1) * kw));
        continue;
      }
      const k1 = soft(L.r1 - Math.hypot(x - L.c1x, y - L.c1y), L.soft);
      const k = k2(L.soft);
      if (k1 > 0 || k > 0) {
        const lum = (r + g + b) / 3;
        const a1 = k1 * clamp((lum - L.maskL0) / (L.maskL1 - L.maskL0));
        const a2 = k * clamp((lum - L.mask2L0) / (L.mask2L1 - L.mask2L0));
        r += L.c1add[0] * a1 + L.c2add[0] * a2;
        g += L.c1add[1] * a1 + L.c2add[1] * a2;
        b += L.c1add[2] * a1 + L.c2add[2] * a2;
      }
      data[o] = Math.min(255, r * shade);
      data[o + 1] = Math.min(255, g * shade);
      data[o + 2] = Math.min(255, b * shade);
    }
  }
}

let baked: HTMLCanvasElement | null = null;

/** Комната за Мэй: стена, предметы и свет — один раз в буфер, дальше готовая картинка. */
export function drawRoom(ctx: Ctx) {
  if (!baked) {
    const c = get();
    baked = document.createElement('canvas');
    baked.width = ROOM.x1 + 140;
    baked.height = 1600;
    const b = baked.getContext('2d', { willReadFrequently: true })!;
    const w = ROOM.x1 - ROOM.x0;
    b.fillStyle = COLORS.wall;
    b.fillRect(ROOM.x0, ROOM.wallTop, w, ROOM.boardTop - ROOM.wallTop);
    b.save();
    b.clip(c.stripes);
    b.filter = `brightness(${STRIPES.gain})`;
    b.fillRect(ROOM.x0, ROOM.wallTop, w, ROOM.boardTop - ROOM.wallTop);
    b.restore();
    b.fillStyle = COLORS.board;
    b.fillRect(ROOM.x0, ROOM.boardTop, w, ROOM.floorTop - ROOM.boardTop);
    b.fillStyle = COLORS.floor;
    b.fillRect(ROOM.x0, ROOM.floorTop, w, ROOM.floorBottom - ROOM.floorTop);
    // пол со светом → стена и всё до спинки кровати → тёплое свечение → остальные предметы → круги от окна и тени
    let img = b.getImageData(0, 0, baked.width, baked.height);
    bakeLight(img, 'floor');
    b.putImageData(img, 0, 0);
    for (const draw of c.behind) draw(b);
    img = b.getImageData(0, 0, baked.width, baked.height);
    bakeLight(img, 'glow');
    b.putImageData(img, 0, 0);
    for (const draw of c.back) draw(b);
    img = b.getImageData(0, 0, baked.width, baked.height);
    bakeLight(img, 'light');
    b.putImageData(img, 0, 0);
  }
  ctx.drawImage(baked, 0, 0);
}

/** Коробки переднего плана — поверх Мэй. */
export function drawFront(ctx: Ctx) {
  for (const draw of get().front) draw(ctx);
}
