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

export type Command = 'up' | 'down' | 'left' | 'right';
