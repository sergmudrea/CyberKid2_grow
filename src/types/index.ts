export type Command = 
  | 'up' | 'down' | 'left' | 'right'
  | 'for_n' | 'for_loop' | 'while_monster' | 'while_wall' | 'while_hole' | 'repeat'
  | 'if_wall' | 'if_hole' | 'if_monster' | 'if_coin' | 'if_key' | 'if_no_key' | 'else'
  | 'push' | 'pickup' | 'drop' | 'use_key'
  | 'drill' | 'hook' | 'wing' | 'bait'
  | 'throw' | 'feed'
  | 'time_slow' | 'time_fast' | 'wait'
  | 'call' | 'def' | 'return' | 'param'
  | 'class' | 'new' | 'method'
  | 'clone' | 'join'
  | 'scan' | 'ride'
  | 'black_box';

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
  // Новые механики
  GLUE = 41,          // Клей (приклеивает)
  CAGE = 42,          // Клетка (ловит)
  TRAP = 43,          // Ловушка (превращает монстра в добычу)
  CAGE_KEY = 44,      // Ключ от клетки (отдельный предмет)
  PRISONER = 45,      // Пойманный субъект (временно)
  GEM = 46,           // Драгоценность (результат ловушки)
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
  objects?: {
    teleports?: any[];
    conveyors?: any[];
    springs?: any[];
    blackBoxes?: any[];
    buttons?: any[];
    levers?: any[];
    timers?: any[];
    sensors?: any[];
    sorters?: any[];
    monsters?: any[];
    cages?: any[];
    traps?: any[];
  };
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
