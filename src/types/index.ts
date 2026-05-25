// src/types/index.ts
// Все типы данных для игры

export enum Command {
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',
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
  CALL = 'call',
  DEF = 'def',
  RETURN = 'return',
  PARAM = 'param',
  CLASS = 'class',
  NEW = 'new',
  METHOD = 'method',
  CLONE = 'clone',
  JOIN = 'join',
  PUSH = 'push',
  THROW = 'throw',
  FEED = 'feed',
  HOOK = 'hook',
  DRILL = 'drill',
  BAIT = 'bait',
  SCAN = 'scan',
  PICKUP = 'pickup',
  DROP = 'drop',
  USE_KEY = 'use_key',
  TIME_SLOW = 'time_slow',
  TIME_FAST = 'time_fast',
  WAIT = 'wait',
  WING = 'wing',
  RIDE = 'ride',
  BLACK_BOX = 'black_box',
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
