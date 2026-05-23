// src/types/index.ts
// Базовые типы для игры

export type Command = 
  | 'up' | 'down' | 'left' | 'right'
  | 'for_n' | 'while_wall'
  | 'if_wall' | 'else'
  | 'drill' | 'pickup' | 'wait';

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
}

export interface PlayerProgress {
  totalStars: number;
  levelsCompleted: string[];
}

export interface UserSettings {
  language: 'ru' | 'en';
  soundEnabled: boolean;
  musicEnabled: boolean;
}
