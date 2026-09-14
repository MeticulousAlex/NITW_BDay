// Отрисовка чердака. Палитра и композиция восстановлены попиксельно
// из референс-скриншотов: глубокие сине-фиолетовые стены, сиреневые
// акценты, тёплый бледно-жёлтый свет лампы, холодный лунный луч.

import { WORLD_W, WORLD_H, FLOOR_Y } from './data';
import {
  fillRoundRect,
  poly,
  glow,
  colorWithAlpha,
  seeded,
  drawGrain,
  clamp,
} from './draw';

// --- палитра (извлечена из референсов) ---
const WALL_HI = '#232f58'; // верх задней стены
const WALL_LO = '#171f3c'; // низ задней стены
const CEIL = '#1a2242'; // скат потолка
const CEIL_DARK = '#121830';
const BEAM = '#0d0a18'; // балки
const FLOOR_HI = '#2e1c26'; // пол у стены
const FLOOR_LO = '#150d14'; // пол у края
const WOOD = '#4a2c1c'; // мебельное дерево
const WOOD_D = '#33201a';
const BLANKET = '#5c1a24'; // тёмно-красное одеяло
const BLANKET_D = '#421220';
const PILLOW = '#c9bda6';
const MAUVE = '#884d5e'; // сиреневый акцент (плакат)
const PINK = '#b66880'; // розовый акцент
const LAMP = '#f8f2c8'; // бледно-жёлтый свет
const LAMP_WARM = '#e8c98a';
const MOONLIGHT = '#8fa8d8';
const SKY_TOP = '#04060f';
const SKY_BOT = '#0e1830';

interface Mote {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  tw: number;
}

const motes: Mote[] = [];
{
  const rnd = seeded(1337);
  for (let i = 0; i < 80; i++) {
    motes.push({
      x: rnd() * WORLD_W,
      y: 300 + rnd() * 600,
      r: 0.8 + rnd() * 1.8,
      vx: 4 + rnd() * 10,
      vy: -3 + rnd() * 6,
      tw: rnd() * Math.PI * 2,
    });
  }
}

const stars: Array<{ x: number; y: number; r: number; tw: number }> = [];
{
  const rnd = seeded(42);
  for (let i = 0; i < 110; i++) {
    stars.push({ x: rnd(), y: rnd(), r: 0.5 + rnd() * 1.4, tw: rnd() * Math.PI * 2 });
  }
}

// геометрия крыши: конёк смещён правее центра, левый скат ниже
const RIDGE_X = 1100;
const RIDGE_Y = 120;
const EAVE_L = 470; // высота левого карниза
const EAVE_R = 360; // высота правого карниза

function slopeY(x: number) {
  if (x < RIDGE_X) {
    const t = x / RIDGE_X;
    return EAVE_L + (RIDGE_Y - EAVE_L) * t;
  }
  const t = (x - RIDGE_X) / (WORLD_W - RIDGE_X);
  return RIDGE_Y + (EAVE_R - RIDGE_Y) * t;
}

export function drawRoom(ctx: CanvasRenderingContext2D, camX: number, t: number) {
  ctx.save();
  ctx.translate(-camX, 0);

  drawWalls(ctx);
  drawWindow(ctx, t);
  drawPosters(ctx, t);
  drawShelf(ctx);
  drawFloor(ctx);
  drawRug(ctx);
  drawBed(ctx, t);
  drawNightstand(ctx, t);
  drawPizza(ctx);
  drawDresser(ctx);
  drawClutter(ctx);
  drawBassAndAmp(ctx, t);
  drawMoonbeam(ctx, t);
  drawLampLight(ctx, t);

  ctx.restore();

  drawMotes(ctx, camX, t);
}

function drawWalls(ctx: CanvasRenderingContext2D) {
  // задняя стена — вертикальный градиент синего
  const wall = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  wall.addColorStop(0, WALL_HI);
  wall.addColorStop(1, WALL_LO);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, WORLD_W, FLOOR_Y);

  // скошенный потолок
  poly(ctx, [
    [0, EAVE_L],
    [RIDGE_X, RIDGE_Y],
    [WORLD_W, EAVE_R],
    [WORLD_W, 0],
    [0, 0],
  ]);
  const ceil = ctx.createLinearGradient(0, 0, 0, EAVE_L);
  ceil.addColorStop(0, CEIL_DARK);
  ceil.addColorStop(1, CEIL);
  ctx.fillStyle = ceil;
  ctx.fill();

  // доски ската — швы вдоль наклона
  ctx.strokeStyle = 'rgba(6,8,18,0.5)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 16; i++) {
    const x = (WORLD_W / 16) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, slopeY(x));
    ctx.stroke();
  }

  // несущие балки — тёмные, почти чёрные с фиолетовым
  ctx.fillStyle = BEAM;
  const beamXs = [200, 580, 960, 1340, 1700];
  for (const bx of beamXs) {
    const top = slopeY(bx);
    ctx.fillRect(bx - 10, top - 4, 20, FLOOR_Y - top + 4);
    // кромка балки, подсвеченная стеной
    ctx.fillStyle = '#181026';
    ctx.fillRect(bx + 8, top - 4, 3, FLOOR_Y - top + 4);
    ctx.fillStyle = BEAM;
  }
  // коньковый брус
  ctx.fillRect(RIDGE_X - 16, RIDGE_Y - 20, 32, 44);

  // горизонтальный прогон вдоль скатов
  ctx.strokeStyle = BEAM;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(0, EAVE_L - 70);
  ctx.lineTo(RIDGE_X, RIDGE_Y + 4);
  ctx.lineTo(WORLD_W, EAVE_R - 50);
  ctx.stroke();

  // плинтус
  ctx.fillStyle = '#0a0710';
  ctx.fillRect(0, FLOOR_Y - 14, WORLD_W, 14);

  // обшивка нижней части стены — горизонтальные панели
  ctx.strokeStyle = 'rgba(8,10,22,0.55)';
  ctx.lineWidth = 2;
  for (let y = FLOOR_Y - 60; y > FLOOR_Y - 200; y -= 34) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_W, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(10,12,26,0.35)';
  ctx.fillRect(0, FLOOR_Y - 200, WORLD_W, 4);

  // свисающий провод с лампочкой под коньком (не горит)
  ctx.strokeStyle = '#0a0712';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(RIDGE_X + 60, RIDGE_Y + 10);
  ctx.quadraticCurveTo(RIDGE_X + 64, 260, RIDGE_X + 58, 330);
  ctx.stroke();
  ctx.fillStyle = '#241c30';
  ctx.beginPath();
  ctx.ellipse(RIDGE_X + 58, 342, 9, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0d0a18';
  ctx.fillRect(RIDGE_X + 53, 326, 10, 8);
}

function drawWindow(ctx: CanvasRenderingContext2D, t: number) {
  const wx = 640;
  const wy = 420;
  const ww = 250;
  const wh = 300;

  // ниша окна — слегка светлее стены
  ctx.fillStyle = '#1a2340';
  ctx.fillRect(wx - 22, wy - 22, ww + 44, wh + 36);

  // ночное небо
  const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(1, SKY_BOT);
  ctx.fillStyle = sky;
  ctx.fillRect(wx, wy, ww, wh);

  ctx.save();
  ctx.beginPath();
  ctx.rect(wx, wy, ww, wh);
  ctx.clip();

  // звёзды
  for (const s of stars) {
    const a = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.7 + s.tw));
    ctx.fillStyle = `rgba(215,226,255,${a * 0.75})`;
    ctx.beginPath();
    ctx.arc(wx + s.x * ww, wy + s.y * wh * 0.72, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // луна — бледно-жёлтая, с тёплым ореолом
  const mx = wx + ww * 0.66;
  const my = wy + wh * 0.28;
  glow(ctx, mx, my, 100, LAMP, 0.3);
  ctx.fillStyle = LAMP;
  ctx.beginPath();
  ctx.arc(mx, my, 27, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = SKY_TOP;
  ctx.beginPath();
  ctx.arc(mx - 12, my - 7, 23, 0, Math.PI * 2);
  ctx.fill();

  // силуэт городка с тёплыми огоньками
  ctx.fillStyle = '#070a14';
  const rnd = seeded(7);
  let bx = wx - 10;
  while (bx < wx + ww + 10) {
    const bw = 22 + rnd() * 38;
    const bh = 34 + rnd() * 74;
    ctx.fillRect(bx, wy + wh - bh, bw, bh);
    for (let k = 0; k < bw * bh * 0.005; k++) {
      const lx = bx + 4 + rnd() * (bw - 8);
      const ly = wy + wh - bh + 4 + rnd() * (bh - 10);
      const flick = 0.55 + 0.45 * Math.sin(t * 2 + lx);
      ctx.fillStyle = `rgba(248,226,160,${0.55 * flick})`;
      ctx.fillRect(lx, ly, 2.4, 3.2);
      ctx.fillStyle = '#070a14';
    }
    bx += bw + 4;
  }
  ctx.restore();

  // рама
  ctx.strokeStyle = '#0e0a16';
  ctx.lineWidth = 12;
  ctx.strokeRect(wx, wy, ww, wh);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(wx + ww / 2, wy);
  ctx.lineTo(wx + ww / 2, wy + wh);
  ctx.moveTo(wx, wy + wh / 2);
  ctx.lineTo(wx + ww, wy + wh / 2);
  ctx.stroke();

  // подоконник
  ctx.fillStyle = '#0e0a16';
  ctx.fillRect(wx - 14, wy + wh, ww + 28, 14);
}

function drawPosters(ctx: CanvasRenderingContext2D, t: number) {
  // большой сиренево-розовый плакат — главное цветовое пятно стены
  const px = 1030;
  const py = 460;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-0.015);
  ctx.fillStyle = MAUVE;
  ctx.fillRect(0, 0, 150, 200);
  ctx.fillStyle = PINK;
  ctx.fillRect(10, 10, 130, 180);
  // абстрактная композиция: луна и холмы
  ctx.fillStyle = '#5c3049';
  ctx.beginPath();
  ctx.arc(75, 70, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3d1f38';
  ctx.beginPath();
  ctx.moveTo(10, 150);
  ctx.quadraticCurveTo(50, 110, 80, 150);
  ctx.quadraticCurveTo(110, 180, 140, 150);
  ctx.lineTo(140, 190);
  ctx.lineTo(10, 190);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8dcc0';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ЗВЕЗДОПАД', 75, 178);
  ctx.restore();

  // отклеившийся уголок
  const peel = 4 + Math.sin(t * 0.8) * 1.5;
  poly(ctx, [
    [px + 150, py + 200],
    [px + 150 - peel, py + 200 - 26 - peel],
    [px + 150, py + 200 - 30],
  ]);
  ctx.fillStyle = '#5c3049';
  ctx.fill();

  // маленький плакат — тёмная планета
  ctx.save();
  ctx.translate(1220, 500);
  ctx.rotate(0.03);
  ctx.fillStyle = '#2b2340';
  ctx.fillRect(0, 0, 96, 130);
  ctx.fillStyle = '#171226';
  ctx.fillRect(6, 6, 84, 118);
  ctx.strokeStyle = '#c46a4a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(48, 58, 26, 10, -0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#c46a4a';
  ctx.beginPath();
  ctx.arc(48, 58, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // открытка
  ctx.save();
  ctx.translate(1340, 540);
  ctx.rotate(-0.05);
  ctx.fillStyle = '#d8cdb4';
  ctx.fillRect(0, 0, 54, 70);
  ctx.fillStyle = '#8a7f68';
  ctx.fillRect(6, 8, 42, 4);
  ctx.fillRect(6, 18, 42, 4);
  ctx.fillRect(6, 28, 30, 4);
  ctx.restore();
}

function drawShelf(ctx: CanvasRenderingContext2D) {
  const sx = 1640;
  const sy = 560;
  const sw = 250;

  ctx.fillStyle = WOOD_D;
  ctx.fillRect(sx, sy, sw, 14);
  ctx.fillStyle = '#241610';
  ctx.fillRect(sx + 12, sy + 14, 10, 26);
  ctx.fillRect(sx + sw - 22, sy + 14, 10, 26);

  // коробки «ХРУПКОЕ!!»
  const boxes: Array<[number, number, number, number]> = [
    [sx + 16, sy - 74, 92, 74],
    [sx + 116, sy - 60, 78, 60],
    [sx + 46, sy - 122, 70, 48],
  ];
  for (const [bx, by, bw, bh] of boxes) {
    ctx.fillStyle = '#54402c';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#3a2a1c';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.beginPath();
    ctx.moveTo(bx, by + bh * 0.3);
    ctx.lineTo(bx + bw, by + bh * 0.3);
    ctx.stroke();
    ctx.fillStyle = '#d8cdb4';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ХРУПКОЕ!!', bx + bw / 2, by + bh * 0.62);
  }

  // фигурки мышей
  for (let i = 0; i < 3; i++) {
    const mx = sx + 208 + i * 16;
    const my = sy - 4;
    ctx.fillStyle = '#6a5a70';
    ctx.beginPath();
    ctx.ellipse(mx, my - 8, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx - 3, my - 16, 2.6, 0, Math.PI * 2);
    ctx.arc(mx + 3, my - 16, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFloor(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, FLOOR_Y, 0, WORLD_H);
  g.addColorStop(0, FLOOR_HI);
  g.addColorStop(1, FLOOR_LO);
  ctx.fillStyle = g;
  ctx.fillRect(0, FLOOR_Y, WORLD_W, WORLD_H - FLOOR_Y);

  // доски пола
  ctx.strokeStyle = '#0d0810';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 24; i++) {
    const x = (WORLD_W / 24) * i;
    ctx.beginPath();
    ctx.moveTo(x, FLOOR_Y);
    ctx.lineTo(x + 30, WORLD_H);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, FLOOR_Y + 46);
  ctx.lineTo(WORLD_W, FLOOR_Y + 46);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, FLOOR_Y + 100);
  ctx.lineTo(WORLD_W, FLOOR_Y + 100);
  ctx.stroke();
}

function drawRug(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.translate(900, FLOOR_Y + 62);
  ctx.scale(1, 0.3);
  ctx.fillStyle = '#3a1f33';
  ctx.beginPath();
  ctx.arc(0, 0, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#57284a';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(0, 0, 160, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#6e3a5c';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 120, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBed(ctx: CanvasRenderingContext2D, t: number) {
  const bx = 110;
  const bw = 360;
  const bedY = FLOOR_Y - 130;

  // спинка
  fillRoundRect(ctx, bx - 16, bedY - 120, 26, 260, 8, WOOD_D);
  fillRoundRect(ctx, bx - 12, bedY - 112, 18, 60, 6, WOOD);

  // ножки
  ctx.fillStyle = WOOD_D;
  ctx.fillRect(bx + 6, bedY + 96, 18, 34);
  ctx.fillRect(bx + bw - 24, bedY + 96, 18, 34);

  // каркас и матрас
  fillRoundRect(ctx, bx, bedY + 40, bw, 60, 10, WOOD_D);
  fillRoundRect(ctx, bx + 4, bedY + 6, bw - 8, 44, 12, '#8f8672');

  // подушка
  fillRoundRect(ctx, bx + 18, bedY - 12, 92, 34, 14, PILLOW);

  // одеяло — тёмно-красное, со складками
  ctx.fillStyle = BLANKET;
  ctx.beginPath();
  ctx.moveTo(bx + 90, bedY + 2);
  ctx.quadraticCurveTo(bx + 170, bedY - 22, bx + 240, bedY - 4);
  ctx.quadraticCurveTo(bx + 320, bedY - 14, bx + bw - 6, bedY + 4);
  ctx.lineTo(bx + bw - 6, bedY + 66);
  ctx.quadraticCurveTo(bx + bw / 2, bedY + 84, bx + 90, bedY + 66);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = BLANKET_D;
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(bx + 120 + i * 60, bedY + 4);
    ctx.quadraticCurveTo(bx + 130 + i * 60, bedY + 34, bx + 118 + i * 60, bedY + 64);
    ctx.stroke();
  }

  // открытый ноутбук, экран мерцает
  const lx = bx + 250;
  const ly = bedY - 2;
  const flicker = 0.75 + 0.25 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(-0.06);
  fillRoundRect(ctx, -6, -52, 66, 50, 4, '#0a0f1c');
  ctx.fillStyle = colorWithAlpha('#9fd8ff', 0.85 * flicker);
  ctx.fillRect(-2, -48, 58, 42);
  ctx.fillStyle = colorWithAlpha('#1c2f4a', 0.9);
  ctx.fillRect(2, -44, 30, 16);
  ctx.fillRect(2, -24, 50, 4);
  ctx.fillRect(2, -18, 44, 4);
  ctx.fillStyle = colorWithAlpha('#ff9a5e', 0.9 * flicker);
  ctx.fillRect(36, -44, 16, 16);
  poly(ctx, [
    [-6, -2],
    [60, -2],
    [74, 10],
    [-14, 10],
  ]);
  ctx.fillStyle = '#141a26';
  ctx.fill();
  ctx.restore();

  glow(ctx, lx + 20, ly - 20, 90, '#9fd8ff', 0.1 * flicker);
}

function drawNightstand(ctx: CanvasRenderingContext2D, t: number) {
  const nx = 500;
  const ny = FLOOR_Y - 150;

  // тумба
  fillRoundRect(ctx, nx, ny + 40, 90, 110, 6, WOOD_D);
  ctx.fillStyle = '#241610';
  ctx.fillRect(nx + 8, ny + 56, 74, 2);
  ctx.fillRect(nx + 8, ny + 96, 74, 2);
  ctx.fillStyle = WOOD;
  ctx.beginPath();
  ctx.arc(nx + 45, ny + 76, 4, 0, Math.PI * 2);
  ctx.arc(nx + 45, ny + 116, 4, 0, Math.PI * 2);
  ctx.fill();

  // лампа
  const lampX = nx + 45;
  const lampY = ny + 40;
  ctx.fillStyle = WOOD;
  ctx.fillRect(lampX - 3, lampY - 34, 6, 34);
  ctx.beginPath();
  ctx.ellipse(lampX, lampY, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  poly(ctx, [
    [lampX - 26, lampY - 34],
    [lampX + 26, lampY - 34],
    [lampX + 16, lampY - 68],
    [lampX - 16, lampY - 68],
  ]);
  ctx.fillStyle = '#c47a3a';
  ctx.fill();
  ctx.fillStyle = colorWithAlpha(LAMP, 0.95);
  ctx.fillRect(lampX - 24, lampY - 38, 48, 4);

  // тёплый бледно-жёлтый свет
  const warm = 0.34 + 0.02 * Math.sin(t * 9) + 0.015 * Math.sin(t * 23);
  glow(ctx, lampX, lampY - 40, 280, LAMP, warm);
}

function drawPizza(ctx: CanvasRenderingContext2D) {
  const px = 600;
  const py = FLOOR_Y - 8;

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(0.02);
  fillRoundRect(ctx, -50, -18, 110, 18, 3, '#6a4e30');
  ctx.rotate(-0.05);
  fillRoundRect(ctx, -46, -34, 104, 17, 3, '#7a5a38');
  ctx.fillStyle = '#4a3520';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ПИЦЦА', 6, -22);
  ctx.restore();

  // открытая коробка
  ctx.save();
  ctx.translate(px + 96, py - 2);
  fillRoundRect(ctx, -8, -14, 96, 14, 3, '#7a5a38');
  poly(ctx, [
    [-8, -14],
    [88, -14],
    [70, -52],
    [-26, -52],
  ]);
  ctx.fillStyle = '#5c4226';
  ctx.fill();
  poly(ctx, [
    [20, -12],
    [52, -12],
    [36, -34],
  ]);
  ctx.fillStyle = '#d8a04a';
  ctx.fill();
  ctx.fillStyle = '#a83232';
  ctx.beginPath();
  ctx.arc(34, -18, 3, 0, Math.PI * 2);
  ctx.arc(40, -14, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // стаканчик
  ctx.save();
  ctx.translate(px - 66, py);
  poly(ctx, [
    [-10, 0],
    [10, 0],
    [7, -34],
    [-7, -34],
  ]);
  ctx.fillStyle = '#a8442a';
  ctx.fill();
  ctx.fillStyle = '#d8cdb4';
  ctx.fillRect(-8, -40, 16, 6);
  ctx.strokeStyle = '#d8cdb4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, -40);
  ctx.lineTo(8, -58);
  ctx.stroke();
  ctx.restore();
}

function drawDresser(ctx: CanvasRenderingContext2D) {
  const dx = 1240;
  const dy = FLOOR_Y - 190;

  // корпус комода
  fillRoundRect(ctx, dx, dy, 150, 190, 6, WOOD_D);
  ctx.fillStyle = WOOD;
  ctx.fillRect(dx + 8, dy + 10, 134, 50);
  ctx.fillRect(dx + 8, dy + 70, 134, 50);
  ctx.fillRect(dx + 8, dy + 130, 134, 50);
  // ручки
  ctx.fillStyle = '#1d120c';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(dx + 75, dy + 35 + i * 60, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // верхний ящик приоткрыт, оттуда футболка
  ctx.fillStyle = '#241610';
  ctx.fillRect(dx + 8, dy + 10, 134, 12);
  poly(ctx, [
    [dx + 40, dy + 12],
    [dx + 70, dy + 12],
    [dx + 64, dy - 14],
    [dx + 46, dy - 14],
  ]);
  ctx.fillStyle = '#3c4a6a';
  ctx.fill();

  // на комоде: стопка книг и будильник
  ctx.fillStyle = '#5c3a28';
  ctx.fillRect(dx + 16, dy - 14, 46, 14);
  ctx.fillStyle = '#6a4a5c';
  ctx.fillRect(dx + 20, dy - 26, 38, 12);
  ctx.fillStyle = '#3c4a6a';
  ctx.fillRect(dx + 24, dy - 36, 30, 10);
  fillRoundRect(ctx, dx + 96, dy - 30, 34, 30, 6, '#1a1420');
  ctx.fillStyle = '#d8cdb4';
  ctx.beginPath();
  ctx.arc(dx + 113, dy - 15, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a1420';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(dx + 113, dy - 15);
  ctx.lineTo(dx + 113, dy - 21);
  ctx.moveTo(dx + 113, dy - 15);
  ctx.lineTo(dx + 117, dy - 13);
  ctx.stroke();
}

function drawClutter(ctx: CanvasRenderingContext2D) {
  // груда одежды у кровати
  ctx.fillStyle = '#2c2136';
  ctx.beginPath();
  ctx.ellipse(520, FLOOR_Y - 6, 46, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3c4a6a';
  ctx.beginPath();
  ctx.ellipse(508, FLOOR_Y - 16, 26, 12, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5c2a3a';
  ctx.beginPath();
  ctx.ellipse(536, FLOOR_Y - 14, 20, 10, 0.25, 0, Math.PI * 2);
  ctx.fill();

  // книги и журналы на полу у окна
  ctx.fillStyle = '#4a3a5c';
  ctx.fillRect(920, FLOOR_Y - 12, 40, 12);
  ctx.fillStyle = '#6a4a3a';
  ctx.fillRect(924, FLOOR_Y - 22, 34, 10);
  ctx.save();
  ctx.translate(972, FLOOR_Y - 4);
  ctx.rotate(-0.3);
  ctx.fillStyle = '#7a6a4a';
  ctx.fillRect(0, -8, 36, 8);
  ctx.restore();

  // кроссовок, потерянный в вечности
  ctx.save();
  ctx.translate(1060, FLOOR_Y - 2);
  ctx.fillStyle = '#3a3f4a';
  ctx.beginPath();
  ctx.ellipse(0, -6, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d8cdb4';
  ctx.fillRect(-20, -4, 40, 3);
  ctx.restore();
}

function drawBassAndAmp(ctx: CanvasRenderingContext2D, t: number) {
  const ax = 1520;
  const ay = FLOOR_Y;

  // комбик
  fillRoundRect(ctx, ax, ay - 150, 130, 150, 8, '#16101c');
  fillRoundRect(ctx, ax + 10, ay - 138, 110, 100, 4, '#1e1624');
  ctx.strokeStyle = '#0c0810';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.moveTo(ax + 14, ay - 132 + i * 11);
    ctx.lineTo(ax + 116, ay - 132 + i * 11);
    ctx.stroke();
  }
  ctx.fillStyle = '#0c0810';
  ctx.beginPath();
  ctx.arc(ax + 65, ay - 88, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a1f2e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ax + 65, ay - 88, 34, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#342634';
    ctx.beginPath();
    ctx.arc(ax + 24 + i * 24, ay - 26, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  const pilot = 0.6 + 0.4 * Math.sin(t * 4);
  ctx.fillStyle = colorWithAlpha('#ff5a3a', pilot);
  ctx.beginPath();
  ctx.arc(ax + 116, ay - 26, 3.4, 0, Math.PI * 2);
  ctx.fill();

  // бас-гитара — бирюзовая, прислонена к комбику
  ctx.save();
  ctx.translate(ax - 26, ay);
  ctx.rotate(-0.2);
  fillRoundRect(ctx, -5, -260, 12, 190, 5, '#3a2418');
  ctx.fillStyle = '#c9c9d0';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(-9, -252 + i * 12, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(220,220,230,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-2 + i * 3, -258);
    ctx.lineTo(-2 + i * 3, -80);
    ctx.stroke();
  }
  ctx.fillStyle = '#2e8a8a';
  ctx.beginPath();
  ctx.ellipse(2, -52, 34, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-8, -84, 20, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e4da';
  ctx.beginPath();
  ctx.ellipse(6, -56, 20, 24, 0.2, 0, Math.PI * 2);
  ctx.fill();
  fillRoundRect(ctx, -4, -70, 22, 8, 3, '#16161c');
  fillRoundRect(ctx, -2, -48, 22, 8, 3, '#16161c');
  ctx.restore();

  // кабель
  ctx.strokeStyle = '#0c0810';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ax - 20, ay - 6);
  ctx.quadraticCurveTo(ax + 20, ay + 16, ax + 60, ay - 2);
  ctx.stroke();
}

function drawMoonbeam(ctx: CanvasRenderingContext2D, t: number) {
  const wx = 640 + 250 / 2;
  const wy = 420 + 300 / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const a = 0.055 + 0.012 * Math.sin(t * 0.6);
  poly(ctx, [
    [wx - 105, wy - 130],
    [wx + 105, wy - 130],
    [wx + 310, FLOOR_Y + 90],
    [wx - 60, FLOOR_Y + 90],
  ]);
  ctx.fillStyle = colorWithAlpha(MOONLIGHT, a);
  ctx.fill();
  // пятно света на полу
  ctx.save();
  ctx.translate(wx + 125, FLOOR_Y + 60);
  ctx.scale(1, 0.28);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 210);
  g.addColorStop(0, colorWithAlpha(MOONLIGHT, 0.15));
  g.addColorStop(1, colorWithAlpha(MOONLIGHT, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 210, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawLampLight(ctx: CanvasRenderingContext2D, t: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const warm = 0.1 + 0.01 * Math.sin(t * 9);
  const g = ctx.createRadialGradient(545, 730, 40, 545, 730, 540);
  g.addColorStop(0, colorWithAlpha(LAMP_WARM, warm + 0.07));
  g.addColorStop(1, colorWithAlpha(LAMP_WARM, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 200, 1120, WORLD_H - 200);
  ctx.restore();
}

function drawMotes(ctx: CanvasRenderingContext2D, camX: number, t: number) {
  ctx.save();
  ctx.translate(-camX, 0);
  for (const m of motes) {
    m.x += m.vx * 0.016;
    m.y += m.vy * 0.016 + Math.sin(t + m.tw) * 0.15;
    if (m.x > WORLD_W + 20) m.x = -20;
    if (m.y > FLOOR_Y + 60) m.y = 300;
    if (m.y < 280) m.y = FLOOR_Y;
    const inMoon = clamp(1 - Math.abs(m.x - 890) / 380, 0, 1);
    const inLamp = clamp(1 - Math.hypot(m.x - 545, m.y - 730) / 420, 0, 1);
    const base = Math.max(inMoon * 0.5, inLamp * 0.6, 0.05);
    const a = base * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + m.tw)));
    ctx.fillStyle = `rgba(220,225,240,${a})`;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// передний план: кинематографичные полосы, виньетка, зернистость
export function drawForeground(
  ctx: CanvasRenderingContext2D,
  t: number,
  viewW: number,
  viewH: number,
) {
  const g = ctx.createRadialGradient(
    viewW / 2,
    viewH * 0.55,
    viewH * 0.34,
    viewW / 2,
    viewH * 0.55,
    viewH * 0.95,
  );
  g.addColorStop(0, 'rgba(3,4,10,0)');
  g.addColorStop(1, 'rgba(3,4,10,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);

  const top = ctx.createLinearGradient(0, 0, 0, viewH * 0.4);
  top.addColorStop(0, 'rgba(5,6,16,0.4)');
  top.addColorStop(1, 'rgba(5,6,16,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, viewW, viewH * 0.4);

  drawGrain(ctx, viewW, viewH, t);

  // letterbox-полосы как в оригинальных кадрах
  const bar = viewH * 0.07;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, viewW, bar);
  ctx.fillRect(0, viewH - bar, viewW, bar);
}
