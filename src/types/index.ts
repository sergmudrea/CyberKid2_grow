export type Command = 
  | 'up' | 'down' | 'left' | 'right'
  | 'for_n' | 'while_wall' | 'while_hole' | 'while_monster'
  | 'if_wall' | 'if_hole' | 'if_monster' | 'if_coin' | 'if_key' | 'if_no_key' | 'else'
  | 'drill' | 'pickup' | 'drop' | 'use_key'
  | 'wait' | 'time_slow' | 'time_fast'
  | 'push'
  | 'clone' | 'join'
  | 'call' | 'def' | 'return'
  | 'class' | 'new' | 'method'
  | 'throw' | 'feed' | 'hook' | 'bait' | 'scan'
  | 'wing' | 'ride';

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
  LAVA = 32,
  WATER = 33,
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
}

export interface LevelStats {
  stars: number;
  attempts: number;
  bestSteps: number;
  completed: boolean;
  lastPlayed: number;
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
