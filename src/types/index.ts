export enum TileType {
  PLATFORM = 0,
  WALL = 1,
  HOLE = 2,
  GOAL = 3,
  START = 4,
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

export type Command = 'up' | 'down' | 'left' | 'right';
