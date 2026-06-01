// src/types/index.ts
// ============================================================================
// ОСНОВНЫЕ ТИПЫ ДЛЯ ИГРЫ CYBERKID
// ============================================================================
// Здесь определены все перечисления (enum), интерфейсы (interface) и типы (type),
// которые используются во всём проекте: команды языка, типы тайлов, инвентарь,
// данные уровней, прогресс игрока и т.д.
// ============================================================================

// ----------------------------------------------------------------------------
// 1. КОМАНДЫ ЯЗЫКА ПРОГРАММИРОВАНИЯ (используются в CommandPanel, AST, ExecutionEngine)
// ----------------------------------------------------------------------------
// Каждая команда — это строка, но для типобезопасности используем enum.
// Значения команд совпадают с их строковым представлением, что упрощает отладку.
export enum Command {
  // Движение
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',

  // Управление инвентарём
  PICKUP = 'pickup',
  DROP = 'drop',
  USE_KEY = 'use_key',

  // Инструменты
  DRILL = 'drill',
  HOOK = 'hook',
  WING = 'wing',
  BAIT = 'bait',

  // Бой
  THROW = 'throw',
  FEED = 'feed',

  // Управление временем
  TIME_SLOW = 'time_slow',
  TIME_FAST = 'time_fast',
  WAIT = 'wait',

  // Функции
  DEF = 'def',
  CALL = 'call',
  RETURN = 'return',
  PARAM = 'param',

  // ООП
  CLASS = 'class',
  NEW = 'new',
  METHOD = 'method',

  // Параллелизм
  CLONE = 'clone',
  JOIN = 'join',

  // Взаимодействие
  PUSH = 'push',
  SCAN = 'scan',
  RIDE = 'ride',

  // Чёрный ящик
  BLACK_BOX = 'black_box',

  // Циклы (используются в AST, но могут отсутствовать в панели команд)
  FOR_N = 'for_n',
  FOR_LOOP = 'for_loop',
  WHILE_MONSTER = 'while_monster',
  WHILE_WALL = 'while_wall',
  WHILE_HOLE = 'while_hole',
  REPEAT = 'repeat',

  // Условия
  IF_WALL = 'if_wall',
  IF_HOLE = 'if_hole',
  IF_MONSTER = 'if_monster',
  IF_COIN = 'if_coin',
  IF_KEY = 'if_key',
  IF_NO_KEY = 'if_no_key',
  ELSE = 'else',

  // Служебные маркеры для парсера
  START = 'start',
  END = 'end'
}

// ----------------------------------------------------------------------------
// 2. ТИПЫ ТАЙЛОВ (клеток на карте)
// ----------------------------------------------------------------------------
// Каждый тайл имеет числовой код. Это позволяет компактно хранить карту уровня
// в виде двумерного массива чисел.
export enum TileType {
  // Базовые тайлы (0–9)
  PLATFORM = 0,        // обычная проходимая клетка
  WALL = 1,            // стена (непроходима, но разрушается дрелью)
  HOLE = 2,            // яма (смерть без крыльев)
  GOAL = 3,            // монетка (цель уровня)
  START = 4,           // стартовая позиция игрока (не отображается как тайл, просто позиция)
  BRICK = 5,           // кирпич (можно толкнуть командой PUSH)

  // Предметы и интерактивные объекты (10–18)
  KEY = 10,            // обычный ключ
  DOOR_LOCKED = 11,    // запертая дверь
  DOOR_UNLOCKED = 12,  // открытая дверь
  CORN = 13,           // кукуруза (корм для монстров)
  CORE = 14,           // ядро (оружие против монстров)
  TOOL_DRILL = 15,     // дрель
  TOOL_HOOK = 16,      // крюк
  TOOL_WING = 17,      // крылья
  TOOL_BAIT = 18,      // приманка

  // Механизмы (19–31)
  CONVEYOR_UP = 19,    // конвейер вверх
  CONVEYOR_DOWN = 20,  // конвейер вниз
  CONVEYOR_LEFT = 21,  // конвейер влево
  CONVEYOR_RIGHT = 22, // конвейер вправо
  SPRING = 23,         // пружина (подбрасывает)
  TELEPORT_IN = 24,    // вход телепорта
  TELEPORT_OUT = 25,   // выход телепорта
  BLACK_BOX = 26,      // чёрный ящик (преобразует предметы)
  SENSOR = 27,         // сенсор (реагирует на игрока)
  LEVER = 28,          // рычаг (переключает мосты)
  BUTTON = 29,         // кнопка (активирует мосты/двери)
  TIMER = 30,          // таймер (активирует через задержку)
  SORTER = 31,         // сортировщик (сортирует инвентарь)

  // Опасности (32–33)
  LAVA = 32,           // лава (смерть без крыльев)
  WATER = 33,          // вода (смерть без крыльев)

  // Мосты (34–35)
  BRIDGE = 34,         // неактивный мост
  BRIDGE_ACTIVE = 35,  // активный мост

  // Расширенные механики (36–40) – зарезервированы для будущего
  ROCKET = 36,
  MIRROR = 37,
  CLONE_POINT = 38,
  RIDE_POINT = 39,
  NEURO_STAB = 40,

  // Новые механики, добавленные позже (41–46)
  GLUE = 41,           // клей (приклеивает игрока на 3 хода)
  CAGE = 42,           // клетка (ловит игрока или монстра)
  TRAP = 43,           // ловушка (превращает монстра в драгоценность)
  CAGE_KEY = 44,       // ключ от клетки
  PRISONER = 45,       // маркер для клетки (не тайл)
  GEM = 46             // драгоценность (+5 ядер)
}

// ----------------------------------------------------------------------------
// 3. ВСПОМОГАТЕЛЬНЫЕ ТИПЫ
// ----------------------------------------------------------------------------

// Точка на карте (колонка, ряд)
export interface Point {
  col: number;   // колонка (x)
  row: number;   // ряд (y)
}

// Инвентарь игрока
export interface Inventory {
  keys: string[];        // массив идентификаторов ключей (например, "key_1_2", "cage_key")
  corn: number;          // количество кукурузы
  cores: number;         // количество ядер
  hasDrill: boolean;     // есть ли дрель?
  hasHook: boolean;      // есть ли крюк?
  hasWing: boolean;      // есть ли крылья?
  hasBait: boolean;      // есть ли приманка?
  tools: string[];       // массив названий инструментов (для удобства)
}

// Данные уровня (загружаются из JSON или генерируются)
export interface LevelData {
  id: string;            // уникальный идентификатор (например, "meadow_001")
  name: string;          // отображаемое имя
  worldId: string;       // идентификатор мира (meadow, ocean, clouds...)
  width: number;         // ширина карты (количество колонок)
  height: number;        // высота карты (количество рядов)
  map: TileType[][];     // двумерный массив тайлов
  startPos: Point;       // начальная позиция игрока
  coinPos: Point;        // позиция монетки (цели)
  optimalSteps?: number; // оптимальное количество шагов для получения 3 звёзд
  initialCode?: Command[]; // (опционально) стартовая программа для уровня
  items?: { id: string; pos: Point }[]; // (устаревший формат, лучше использовать объекты)
  objects?: any;         // динамические объекты (монстры, телепорты, конвейеры, кнопки и т.д.)
}

// Статистика по одному уровню (сохраняется в прогресс)
export interface LevelStats {
  stars: number;         // получено звёзд (0–3)
  attempts: number;      // количество попыток
  bestSteps: number;     // лучшее число шагов
  completed: boolean;    // пройден ли уровень
  lastPlayed: number;    // timestamp последней игры
  blackStar?: boolean;   // (опционально) чёрная звезда за прохождение без чёрных ходов
  explorationUsed?: boolean; // использовался ли режим исследования
  backdoorUsed?: boolean;    // использовался ли чёрный ход
}

// Полный прогресс игрока (хранится в localStorage)
export interface PlayerProgress {
  totalStars: number;                    // общее количество звёзд
  totalBlackStars: number;               // чёрные звёзды (пока не используется)
  levelsCompleted: string[];             // массив ID пройденных уровней
  perfectLevels: string[];               // уровни, пройденные с 3 звёздами
  levelStats: Record<string, LevelStats>; // статистика по каждому уровню
  totalAttempts: number;                 // общее число попыток
  totalDeaths: number;                   // общее количество смертей
  deathsByType: Record<string, number>;  // смертей по типам (монстр, яма, лава...)
  totalPlayTimeSec: number;              // общее время игры в секундах
  explorationUsedCount: number;          // сколько раз включался режим исследования
  backdoorsFound: number;                // сколько раз использованы чёрные ходы
  unlockedWorlds: string[];              // открытые миры
  lastPlayedWorld: string;               // последний выбранный мир
  lastPlayedLevelId: string;             // последний выбранный уровень
  achievements: any[];                   // достижения (пока не реализованы)
  settings: any;                         // настройки (дублируются из SettingsManager)
}

// Настройки пользователя
export interface UserSettings {
  language: string;        // код языка (en, ru и т.д.)
  soundEnabled: boolean;   // включены ли звуки
  musicEnabled: boolean;   // включена ли музыка
}

// ----------------------------------------------------------------------------
// 4. ТИПЫ ДЛЯ ДВИЖКА ВЫПОЛНЕНИЯ (ExecutionEngine)
// ----------------------------------------------------------------------------

// Результат выполнения программы
export interface ExecutionResult {
  success: boolean;                // успешно ли завершилась программа (достигнута монетка)
  steps: number;                   // количество сделанных шагов
  finalInventory: Inventory;       // инвентарь после выполнения
  monstersState: any;              // состояние монстров (массив)
  backdoorUsed: boolean;           // использовался ли хотя бы один чёрный ход
  stars: number;                   // количество звёзд, рассчитанное на основе шагов
}

// Состояние выполнения (для внешнего UI)
export interface ExecutionStatus {
  state: 'idle' | 'running' | 'paused' | 'finished' | 'error';
  currentCommandIndex: number;     // индекс выполняемой команды
  totalCommands: number;           // общее количество команд в программе
  stepCount: number;               // количество выполненных шагов
  lastError?: string;              // последняя ошибка
}

// ----------------------------------------------------------------------------
// 5. ТИПЫ ДЛЯ МОНСТРОВ
// ----------------------------------------------------------------------------
export interface Monster {
  id: string;
  type: 'patrol' | 'chase' | 'tameable' | 'phased' | 'zombie' | 'boss';
  position: Point;
  direction: 'up' | 'down' | 'left' | 'right';
  patrolPath?: Point[];
  patrolIndex?: number;
  isTamed: boolean;
  isRidden: boolean;
  isDistracted?: boolean;
  distractedTurns?: number;
  isGlued?: boolean;
  gluedTurns?: number;
  isTrapped?: boolean;
  health?: number;
  phaseState?: 'visible' | 'invisible';
}

// ----------------------------------------------------------------------------
// 6. ТИПЫ ДЛЯ СОБЫТИЙ (EventBus)
// ----------------------------------------------------------------------------
// Это обобщённый тип для любых событий игры. Используется для строгой типизации eventBus.emit/on.
export interface GameEvent {
  type: string;
  payload?: any;
}

// (Можно расширять конкретными событиями, но для простоты оставляем any в payload)
