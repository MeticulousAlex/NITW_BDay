// Игровые данные сцены «Чердак Мэй» — ночь, Поссум-Спрингс.
// Все тексты оригинальные: атмосферная homage-сцена по мотивам NITW.

export const WORLD_W = 1920;
export const WORLD_H = 1080;
export const FLOOR_Y = 930;

export const PLAYER_SPEED = 270; // units / s
export const GRAVITY = 2600;
export const JUMP_VELOCITY = -920;

export const HERO_NAME = 'МЭЙ';

export type Mood =
  | 'neutral'
  | 'happy'
  | 'annoyed'
  | 'sleepy'
  | 'sad'
  | 'surprised';

export interface DialogueLine {
  text: string;
  mood?: Mood;
}

export const INTRO_LINES: DialogueLine[] = [
  { text: 'Три часа ночи. Сна нет. Опять.', mood: 'annoyed' },
  { text: 'Чердак гудит тишиной, как старый радиоприёмник.', mood: 'neutral' },
  { text: 'Дом спит. Город спит. А я опять считаю балки на потолке.', mood: 'sleepy' },
  { text: 'Ладно. Пойду потревожу вещи.', mood: 'happy' },
];

export interface Hotspot {
  id: string;
  x: number; // центр зоны в мировых единицах
  radius: number; // радиус взаимодействия
  markerY: number; // высота подсказки «...»
  label: string;
  lines: DialogueLine[];
  action?: 'riff';
}

export const HOTSPOTS: Hotspot[] = [
  {
    id: 'bed',
    x: 300,
    radius: 130,
    markerY: 700,
    label: 'Кровать',
    lines: [
      { text: 'Кровать. Мы с ней сегодня поссорились. Она хотела спать, а я — нет.', mood: 'annoyed' },
      { text: 'Одеяло всё ещё хранит форму меня. Как слепок с места преступления.', mood: 'neutral' },
      { text: 'Если перевернуть подушку холодной стороной вверх — это уже считается за подвиг?', mood: 'happy' },
      { text: 'Ладно, кровать. Ты победила. Но только сегодня.', mood: 'sleepy' },
    ],
  },
  {
    id: 'laptop',
    x: 430,
    radius: 90,
    markerY: 700,
    label: 'Ноутбук',
    lines: [
      { text: 'Ноутбук греется и урчит. Он старше некоторых моих жизненных решений.', mood: 'neutral' },
      { text: 'Три непрочитанных сообщения. Половина — «ты жива?». Формально — да.', mood: 'sad' },
      { text: 'Ещё одна башня, ещё один демон. Уровень не пройдёт сам себя... но пусть попробует.', mood: 'happy' },
      { text: 'Закрою крышку — и все мои проблемы станут спящим режимом.', mood: 'annoyed' },
    ],
  },
  {
    id: 'pizza',
    x: 640,
    radius: 80,
    markerY: 800,
    label: 'Пицца',
    lines: [
      { text: 'Коробка из-под пиццы. Внутри — археологический слой вчерашнего дня.', mood: 'neutral' },
      { text: 'Холодная пицца в три ночи — это завтрак чемпионов. Наверное. Я не чемпион.', mood: 'happy' },
      { text: 'Стаканчик допит до состояния «архитектурный элемент».', mood: 'annoyed' },
    ],
  },
  {
    id: 'window',
    x: 830,
    radius: 110,
    markerY: 420,
    label: 'Окно',
    lines: [
      { text: 'Поссум-Спрингс внизу светится, будто кто-то рассыпал тёплые монетки по чёрному бархату.', mood: 'neutral' },
      { text: 'Луна сегодня как недоеденный пельмень. Красиво.', mood: 'happy' },
      { text: 'Интересно, кто-нибудь ещё не спит и смотрит в окно? Привет, если да. Машу лапой.', mood: 'sad' },
      { text: '*машет лапой собственному отражению*', mood: 'happy' },
    ],
  },
  {
    id: 'posters',
    x: 1150,
    radius: 110,
    markerY: 480,
    label: 'Плакаты',
    lines: [
      { text: 'Плакат группы, которая распалась до того, как я успела купить их футболку.', mood: 'neutral' },
      { text: 'Уголок отклеился. Как и всё в этом городе.', mood: 'sad' },
      { text: 'Когда-нибудь на таком плакате будет наша группа. Шрифт покрупнее, чем у этих ребят.', mood: 'happy' },
    ],
  },
  {
    id: 'bass',
    x: 1470,
    radius: 100,
    markerY: 640,
    label: 'Бас-гитара',
    action: 'riff',
    lines: [
      { text: '*ты берёшь бас и бренчишь что-то ночное и тихое*', mood: 'happy' },
      { text: 'Соседи простят. Наверное. Это всего лишь четвёртая ночь подряд.', mood: 'neutral' },
      { text: 'Комбик чуть фонит. Он тоже не спит. Мы с ним на одной волне. Буквально.', mood: 'happy' },
      { text: 'Когда-нибудь я сыграю это на настоящей сцене. Или хотя бы коту под дверью.', mood: 'sad' },
    ],
  },
  {
    id: 'shelf',
    x: 1760,
    radius: 110,
    markerY: 560,
    label: 'Полка',
    lines: [
      { text: 'Коробки с надписью «ХРУПКОЕ!!». Надпись сделана год назад. Очень гордая надпись.', mood: 'neutral' },
      { text: 'Фигурки мышей. Целая мышиная семья. Они тут живут дольше, чем некоторые мои планы.', mood: 'happy' },
      { text: 'Разберу завтра. Или послезавтра. Или это теперь просто мебель?', mood: 'annoyed' },
    ],
  },
];
