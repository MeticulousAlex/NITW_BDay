// Игровые данные сцены «Чердак Мэй».

import type { DialogueNode } from './dialogue';

// Мир в пикселях составного эталона чердака (refs-local/attic_ref.png, 3096×1600):
// кадр как в игре — по высоте виден весь фронтон и комната, по ширине камера доезжает до вешалки.
export const WORLD_W = 3096;
export const WORLD_H = 1600;
export const FLOOR_Y = 1367; // подошвы Мэй на скриншоте
export const ROOM_L = 116; // внутренние края комнаты
export const ROOM_R = 2956;
export const MAE_H = 483; // рост Мэй на скриншоте: от хохолка до подошв

// Бег 1:1 с игрой (замер по видео): 2.94 роста Мэй в секунду,
// разгон до максимума за 0.27 с, торможение за 0.18 с.
export const RUN_SPEED = 2.936 * MAE_H; // ед./с
export const RUN_ACCEL = RUN_SPEED / 0.27;
export const RUN_DECEL = RUN_SPEED / 0.18;
// Разворот на бегу (видео 13:32): торможение как при остановке, 2 кадра на месте, разгон в новую сторону за 4 кадра.
export const TURN_HOLD = 2 / 30;
export const TURN_ACCEL = RUN_SPEED / (4 / 30);
// Прыжок 1:1 (парабола подошв по видео, прыжок с места): 17.6 роста/с², отрыв 6.06 роста/с —
// высота 1.04 роста, 0.69 с в воздухе.
export const GRAVITY = 17.6 * MAE_H;
export const JUMP_VELOCITY = -6.06 * MAE_H;

export interface Hotspot {
  id: string;
  x: number; // центр зоны, где Мэй может взаимодействовать
  radius: number;
  promptX: number; // подсказка-глаз над предметом
  promptY: number;
  script: DialogueNode[];
}

// Тексты — черновик (пользователь потом решит, править ли).
export const HOTSPOTS: Hotspot[] = [
  {
    id: 'bass',
    x: 380,
    radius: 260,
    promptX: 520,
    promptY: 820,
    script: [
      { say: 'Может, помучить бас?' },
      { say: 'Только что сыграть?' },
      {
        choose: [
          { label: 'Не сейчас', then: [{ say: 'Ладно. В другой раз.' }] },
          { label: 'Что-нибудь громкое', then: [{ say: 'Бам. Бам-бам. БАМ.' }, { say: 'Соседи будут в восторге.' }] },
        ],
      },
    ],
  },
  {
    id: 'bed',
    x: 1500,
    radius: 330,
    promptX: 1300,
    promptY: 880,
    script: [
      { say: 'Кровать всё ещё тёплая.' },
      {
        choose: [
          { label: 'Лечь обратно', then: [{ say: 'Пять минут. Ну ладно, десять.' }, { say: '…Нет. Надо вставать.' }] },
          { label: 'Не поддаваться', then: [{ say: 'Не сегодня, кровать.' }] },
        ],
      },
    ],
  },
  {
    id: 'mirror',
    x: 2369,
    radius: 260, // зеркало x 2236–2502; Мэй часто встаёт у его левого края
    promptX: 2369,
    promptY: 540,
    script: [
      { say: 'Привет, Мэй.' },
      { say: 'Выглядишь как человек, который проспал полдня.' },
      { say: '…Потому что так и есть.' },
    ],
  },
  {
    // выход на второй этаж — у вешалки; пока этажа нет, затемнение и возврат в комнату
    id: 'exit',
    x: 2860,
    radius: 170,
    promptX: 2860,
    promptY: 700,
    script: [
      { say: 'Спуститься вниз?' },
      { choose: [{ label: 'Пошли', action: 'exit' }, { label: 'Ещё побуду тут' }] },
    ],
  },
];
