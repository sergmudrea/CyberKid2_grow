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
// ============================================================================

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

  // Циклы и условия (используются в AST)
  FOR_N = 'for_n',
  FOR_LOOP = 'for_loop',
  WHILE_MONSTER = 'while_monster',
  WHILE_WALL = 'while_wall',
  WHILE_HOLE = 'while_hole',
  REPEAT = 'repeat',
  IF_WALL = 'if_wall',
  IF_HOLE = 'if_hole',
  IF_MONSTER = 'if_monster',
  IF_COIN = 'if_coin',
  IF_KEY = 'if_key',
  IF_NO_KEY = 'if_no_key',
  ELSE = 'else',

  // Служебные
  START = 'start',
  END = 'end'
}

export enum TileType {
  PLATFORM = 0,
  WALL = 1,
  HOLE = 2,
  GOAL = 3,
  START = 4,
  BRICK = 5,
  KEY = 10,
  DOOR_LOCKED = 11,
  DOOR_UNLOCKED = 12,
  CORN = 13,
  CORE = 14,
  TOOL_DRILL = 15,
  TOOL_HOOK = 16,
  TOOL_WING = 17,
  TOOL_BAIT = 18,
  CONVEYOR_UP = 19,
  CONVEYOR_DOWN = 20,
  CONVEYOR_LEFT = 21,
  CONVEYOR_RIGHT = 22,
  SPRING = 23,
  TELEPORT_IN = 24,
  TELEPORT_OUT = 25,
  BLACK_BOX = 26,
  SENSOR = 27,
  LEVER = 28,
  BUTTON = 29,
  TIMER = 30,
  SORTER = 31,
  LAVA = 32,
  WATER = 33,
  BRIDGE = 34,
  BRIDGE_ACTIVE = 35,
  ROCKET = 36,
  MIRROR = 37,
  CLONE_POINT = 38,
  RIDE_POINT = 39,
  NEURO_STAB = 40,
  GLUE = 41,
  CAGE = 42,
  TRAP = 43,
  CAGE_KEY = 44,
  PRISONER = 45,
  GEM = 46
}

export interface Point {
  col: number;
  row: number;
}

export interface Inventory {
  keys: string[];
  corn: number;
  cores: number;
  hasDrill: boolean;
  hasHook: boolean;
  hasWing: boolean;
  hasBait: boolean;
  tools: string[];
}

export interface LevelData {
  id: string;
  name: string;
  worldId: string;
  width: number;
  height: number;
  map: TileType[][];
  startPos: Point;
  coinPos: Point;
  optimalSteps?: number;
  initialCode?: Command[];
  items?: { id: string; pos: Point }[];
  objects?: any;
  // НОВОЕ ПОЛЕ: список разрешённых команд для этого уровня
  // Если не указано или пустой массив – показывать все команды (для совместимости)
  allowedCommands?: Command[];
}

export interface LevelStats {
  stars: number;
  attempts: number;
  bestSteps: number;
  completed: boolean;
  lastPlayed: number;
  blackStar?: boolean;
  explorationUsed?: boolean;
  backdoorUsed?: boolean;
}

export interface PlayerProgress {
  totalStars: number;
  totalBlackStars: number;
  levelsCompleted: string[];
  perfectLevels: string[];
  levelStats: Record<string, LevelStats>;
  totalAttempts: number;
  totalDeaths: number;
  deathsByType: Record<string, number>;
  totalPlayTimeSec: number;
  explorationUsedCount: number;
  backdoorsFound: number;
  unlockedWorlds: string[];
  lastPlayedWorld: string;
  lastPlayedLevelId: string;
  achievements: any[];
  settings: any;
}

export interface UserSettings {
  language: string;
  soundEnabled: boolean;
  musicEnabled: boolean;
}

export interface ExecutionResult {
  success: boolean;
  steps: number;
  finalInventory: Inventory;
  monstersState: any;
  backdoorUsed: boolean;
  stars: number;
}

export interface ExecutionStatus {
  state: 'idle' | 'running' | 'paused' | 'finished' | 'error';
  currentCommandIndex: number;
  totalCommands: number;
  stepCount: number;
  lastError?: string;
}

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

export interface GameEvent {
  type: string;
  payload?: any;
}
