// tools/generator/levelGenerator.ts
// ============================================================================
// ГЕНЕРАТОР УРОВНЕЙ – ИСПРАВЛЕННАЯ ВЕРСИЯ
// ============================================================================
// - Добавлена инициализация magnets и slowFields как пустых массивов
// - Исправлен вызов BFS (передаём всегда массивы)
// ============================================================================

import seedrandom from 'seedrandom';
import { Command, TileType, Point, ControlMode, Magnet, SlowField } from '../../src/types/index';
import { InventoryAwareBFS, FoundPath, BackdoorType } from './pathfinder';

// ----------------------------------------------------------------------------
// ИНТЕРФЕЙСЫ
// ----------------------------------------------------------------------------

export interface GenerationRequest {
  stage: 1|2|3|4;
  theme: 'meadow' | 'ocean' | 'clouds' | 'fairy' | 'volcano' | 'arcade';
  difficulty: number;
  requiredCommands?: Command[];
  forbiddenCommands?: Command[];
  targetTimeSeconds?: number;
  seed?: number;
  allowBackdoors?: boolean;
  backdoorCount?: number;
  backdoorMechanics?: BackdoorType[];
  controlMode?: ControlMode;
  magnetsEnabled?: boolean;
  slowFieldsEnabled?: boolean;
  startTurretAngle?: number;
  hullDirection?: 'up'|'down'|'left'|'right';
}

export interface GeneratedLevel {
  id: string;
  name: string;
  stage: number;
  difficulty: number;
  size: { width: number; height: number };
  start: { x: number; y: number; direction: 'up'|'down'|'left'|'right' };
  startTurretAngle: number;
  controlMode: ControlMode;
  goal: { type: 'star'; x: number; y: number };
  tiles: TileType[][];
  objects: {
    items?: { type: string; x: number; y: number }[];
    monsters?: any[];
    teleports?: any[];
    conveyors?: any[];
    springs?: any[];
    blackBoxes?: any[];
    buttons?: any[];
    levers?: any[];
    timers?: any[];
    sensors?: any[];
    sorters?: any[];
    bridges?: any[];
    cages?: any[];
    traps?: any[];
    magnets?: Magnet[];
    slowFields?: SlowField[];
  };
  availableCommands: Command[];
  solutionHints: {
    optimalSteps: number;
    expectedConcepts: string[];
    backdoorPaths?: {
      type: BackdoorType;
      steps: number;
      requiredItems: string[];
    }[];
  };
  seed: number;
}

// ----------------------------------------------------------------------------
// ОСНОВНОЙ КЛАСС ГЕНЕРАТОРА
// ----------------------------------------------------------------------------

export class LevelGenerator {
  private rng: () => number;
  private width: number;
  private height: number;

  constructor(seed?: number) {
    this.rng = seedrandom(seed?.toString() || Math.random().toString());
    this.width = 8;
    this.height = 8;
  }

  public generate(req: GenerationRequest): GeneratedLevel {
    const size = this.determineSize(req.difficulty);
    this.width = size.width;
    this.height = size.height;

    const controlMode = req.controlMode || (req.difficulty > 30 ? ControlMode.SEPARATE : ControlMode.CLASSIC);
    const startPos = { x: 0, y: 0 };
    const startDir: 'up'|'down'|'left'|'right' = 'right';
    const startTurretAngle = req.startTurretAngle !== undefined ? req.startTurretAngle : (this.rng() < 0.3 ? 90 : 0);
    const hullDirection = req.hullDirection || startDir;
    const goalPos = { x: this.width - 1, y: this.height - 1 };

    let tiles: TileType[][] = Array(this.height).fill(null).map(() => Array(this.width).fill(TileType.PLATFORM));
    const mainPath = this.generateMainPath(startPos, goalPos);
    this.markPath(tiles, mainPath, TileType.PLATFORM);

    let backdoors: BackdoorInfo[] = [];
    if (req.allowBackdoors && req.difficulty > 20) {
      const count = req.backdoorCount || Math.min(3, Math.floor(req.difficulty / 20));
      backdoors = this.generateBackdoors(startPos, goalPos, this.width, this.height, count, req.backdoorMechanics);
      for (const bd of backdoors) {
        this.markPath(tiles, bd.shortcutPath, TileType.PLATFORM);
        if (bd.obstaclePos) {
          tiles[bd.obstaclePos.y][bd.obstaclePos.x] = TileType.WALL;
        }
      }
    }

    const items = this.placeItems(req, backdoors);
    const monsters = this.placeMonsters(req.difficulty);
    const magnets = req.magnetsEnabled && req.difficulty > 30 ? this.placeMagnets(1) : [];
    const slowFields = req.slowFieldsEnabled && req.difficulty > 40 ? this.placeSlowFields(1) : [];

    const objects = {
      items,
      monsters,
      magnets,
      slowFields,
      // остальные объекты – пустые массивы
      teleports: [],
      conveyors: [],
      springs: [],
      blackBoxes: [],
      buttons: [],
      levers: [],
      timers: [],
      sensors: [],
      sorters: [],
      bridges: [],
      cages: [],
      traps: [],
    };

    tiles = this.fillObstacles(tiles, mainPath, backdoors, req.difficulty, req.theme);

    // ИСПРАВЛЕНИЕ: передаём массивы, даже если они пустые
    const bfs = new InventoryAwareBFS(
      tiles,
      items,
      monsters,
      objects.teleports,
      objects.conveyors,
      objects.springs,
      [],
      [],
      [],
      [],
      magnets,
      slowFields,
      { maxDepth: 500, maxPaths: 5, allowBackdoors: req.allowBackdoors ?? false, debug: false }
    );

    const paths = bfs.findPaths(startPos, goalPos, startDir, startTurretAngle);
    if (paths.length === 0) {
      return this.generate({ ...req, seed: (req.seed || 0) + 1 });
    }

    const optimalSteps = Math.min(...paths.map(p => p.steps));
    const backdoorPaths = paths.filter(p => p.isBackdoor).map(p => ({
      type: (p.usedBackdoors?.[0] as BackdoorType) || BackdoorType.DRILL,
      steps: p.steps,
      requiredItems: p.requiredItems || [],
    }));

    const levelId = `${req.theme}_${Math.floor(Date.now() / 1000)}_${Math.floor(this.rng() * 10000)}`;
    const level: GeneratedLevel = {
      id: levelId,
      name: `${this.themeName(req.theme)} #${Math.floor(this.rng() * 1000) + 1}`,
      stage: req.stage,
      difficulty: req.difficulty,
      size: { width: this.width, height: this.height },
      start: { x: startPos.x, y: startPos.y, direction: startDir },
      startTurretAngle,
      controlMode,
      goal: { type: 'star', x: goalPos.x, y: goalPos.y },
      tiles,
      objects,
      availableCommands: this.determineAvailableCommands(req.stage, req.difficulty, controlMode),
      solutionHints: {
        optimalSteps,
        expectedConcepts: this.getExpectedConcepts(req.difficulty),
        backdoorPaths: backdoorPaths.length ? backdoorPaths : undefined,
      },
      seed: req.seed || 0,
    };
    return level;
  }

  // --------------------------------------------------------------------------
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // --------------------------------------------------------------------------
  private determineSize(difficulty: number): { width: number; height: number } {
    if (difficulty <= 20) return { width: 8, height: 8 };
    if (difficulty <= 50) return { width: 12, height: 12 };
    if (difficulty <= 80) return { width: 16, height: 16 };
    return { width: 20, height: 20 };
  }

  private generateMainPath(start: Point, goal: Point): Point[] {
    const path: Point[] = [];
    let x = start.x, y = start.y;
    while (x !== goal.x || y !== goal.y) {
      if (x < goal.x) x++;
      else if (x > goal.x) x--;
      else if (y < goal.y) y++;
      else if (y > goal.y) y--;
      path.push({ x, y });
    }
    return path;
  }

  private markPath(tiles: TileType[][], path: Point[], tileType: TileType): void {
    for (const p of path) {
      if (p.y >= 0 && p.y < tiles.length && p.x >= 0 && p.x < tiles[0].length) {
        tiles[p.y][p.x] = tileType;
      }
    }
  }

  private generateBackdoors(start: Point, goal: Point, width: number, height: number, count: number, mechanics?: BackdoorType[]): BackdoorInfo[] {
    const backdoors: BackdoorInfo[] = [];
    const usedPositions = new Set<string>();
    for (let i = 0; i < count; i++) {
      const type = mechanics ? mechanics[i % mechanics.length] : BackdoorType.DRILL;
      const shortcut = this.createShortcut(start, goal, i);
      let obstaclePos = this.findFreePosition(width, height, Array.from(usedPositions).map(pos => {
        const [x,y] = pos.split(',').map(Number);
        return { x, y };
      }));
      usedPositions.add(`${obstaclePos.x},${obstaclePos.y}`);
      let requiredItemPos = this.findFreePosition(width, height, [{ x: obstaclePos.x, y: obstaclePos.y }]);
      usedPositions.add(`${requiredItemPos.x},${requiredItemPos.y}`);
      backdoors.push({ type, shortcutPath: shortcut, requiredItemPos, obstaclePos });
    }
    return backdoors;
  }

  private createShortcut(start: Point, goal: Point, variant: number): Point[] {
    const path: Point[] = [];
    const steps = Math.min(goal.x - start.x, goal.y - start.y) - variant;
    for (let i = 1; i <= steps && i < 10; i++) {
      path.push({ x: start.x + i, y: start.y + i });
    }
    return path;
  }

  private findFreePosition(width: number, height: number, occupied: Point[]): Point {
    let x: number, y: number;
    do {
      x = Math.floor(this.rng() * width);
      y = Math.floor(this.rng() * height);
    } while (occupied.some(p => p.x === x && p.y === y));
    return { x, y };
  }

  private placeItems(req: GenerationRequest, backdoors: BackdoorInfo[]): { type: string; x: number; y: number }[] {
    const items: { type: string; x: number; y: number }[] = [];
    for (const bd of backdoors) {
      switch (bd.type) {
        case BackdoorType.DRILL:
          items.push({ type: 'drill', x: bd.requiredItemPos.x, y: bd.requiredItemPos.y });
          break;
        case BackdoorType.HOOK:
          items.push({ type: 'hook', x: bd.requiredItemPos.x, y: bd.requiredItemPos.y });
          break;
        case BackdoorType.WING:
          items.push({ type: 'wing', x: bd.requiredItemPos.x, y: bd.requiredItemPos.y });
          break;
        case BackdoorType.BAIT:
          items.push({ type: 'bait', x: bd.requiredItemPos.x, y: bd.requiredItemPos.y });
          break;
        case BackdoorType.FEED:
          items.push({ type: 'corn', x: bd.requiredItemPos.x, y: bd.requiredItemPos.y });
          break;
        default:
          items.push({ type: 'key', x: bd.requiredItemPos.x, y: bd.requiredItemPos.y });
      }
    }
    if (req.difficulty > 30 && this.rng() < 0.5) {
      items.push({ type: 'key', x: Math.floor(this.rng() * this.width), y: Math.floor(this.rng() * this.height) });
    }
    return items;
  }

  private placeMonsters(difficulty: number): any[] {
    const count = difficulty > 70 ? 3 : difficulty > 40 ? 2 : difficulty > 20 ? 1 : 0;
    const monsters = [];
    for (let i = 0; i < count; i++) {
      const type = difficulty > 80 ? 'chase' : (difficulty > 60 ? 'tameable' : 'patrol');
      monsters.push({
        id: `mon_${i}`,
        type,
        position: { x: Math.floor(this.rng() * this.width), y: Math.floor(this.rng() * this.height) },
        direction: 'right',
        isTamed: false,
        isRidden: false,
      });
    }
    return monsters;
  }

  private placeMagnets(count: number): Magnet[] {
    const magnets: Magnet[] = [];
    for (let i = 0; i < count; i++) {
      magnets.push({
        id: `magnet_${i}`,
        position: { x: Math.floor(this.rng() * this.width), y: Math.floor(this.rng() * this.height) },
        strength: 1,
      });
    }
    return magnets;
  }

  private placeSlowFields(count: number): SlowField[] {
    const fields: SlowField[] = [];
    for (let i = 0; i < count; i++) {
      fields.push({
        id: `slow_${i}`,
        position: { x: Math.floor(this.rng() * this.width), y: Math.floor(this.rng() * this.height) },
        factor: 2,
      });
    }
    return fields;
  }

  private fillObstacles(tiles: TileType[][], mainPath: Point[], backdoors: BackdoorInfo[], difficulty: number, theme: string): TileType[][] {
    const density = 0.05 + (difficulty / 100) * 0.2;
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[0].length; x++) {
        const isProtected = this.isOnAnyPath({ x, y }, mainPath, backdoors);
        if (!isProtected && this.rng() < density) {
          if (theme === 'meadow') tiles[y][x] = TileType.HOLE;
          else if (theme === 'ocean') tiles[y][x] = TileType.WATER;
          else if (theme === 'volcano') tiles[y][x] = TileType.LAVA;
          else tiles[y][x] = TileType.WALL;
        }
      }
    }
    return tiles;
  }

  private isOnAnyPath(p: Point, mainPath: Point[], backdoors: BackdoorInfo[]): boolean {
    if (mainPath.some(m => m.x === p.x && m.y === p.y)) return true;
    for (const bd of backdoors) {
      if (bd.shortcutPath.some(s => s.x === p.x && s.y === p.y)) return true;
    }
    return false;
  }

  private determineAvailableCommands(stage: number, difficulty: number, controlMode: ControlMode): Command[] {
    const base: Command[] = [];
    if (controlMode === ControlMode.SEPARATE) {
      base.push(Command.MOVE_FORWARD, Command.MOVE_BACKWARD, Command.TURN_LEFT, Command.TURN_RIGHT);
    } else {
      base.push(Command.UP, Command.DOWN, Command.LEFT, Command.RIGHT);
    }
    if (stage >= 2) base.push(Command.IF_WALL, Command.IF_HOLE);
    if (stage >= 3) base.push(Command.WHILE_WALL, Command.DEF, Command.CALL);
    if (stage >= 4) base.push(Command.CLASS, Command.NEW, Command.METHOD);
    if (difficulty > 30) base.push(Command.PICKUP, Command.DROP, Command.USE_KEY);
    if (difficulty > 50) base.push(Command.DRILL, Command.HOOK);
    if (difficulty > 70) base.push(Command.CLONE, Command.JOIN);
    if (difficulty > 40 && controlMode === ControlMode.SEPARATE) {
      base.push(Command.SET_ANGLE, Command.IF_ANGLE, Command.WHILE_NOT_FACING);
    }
    return base;
  }

  private getExpectedConcepts(difficulty: number): string[] {
    if (difficulty <= 20) return ['movement', 'loops'];
    if (difficulty <= 50) return ['conditions', 'functions', 'inventory'];
    if (difficulty <= 80) return ['recursion', 'tools', 'backdoors'];
    return ['OOP', 'parallelism', 'turret control', 'magnets'];
  }

  private themeName(theme: string): string {
    const names: Record<string, string> = {
      meadow: '🌾 Meadow',
      ocean: '🌊 Ocean',
      clouds: '☁️ Clouds',
      fairy: '🏰 Fairytale',
      volcano: '🌋 Volcano',
      arcade: '🎮 Arcade',
    };
    return names[theme] || 'Unknown';
  }
}

interface BackdoorInfo {
  type: BackdoorType;
  shortcutPath: Point[];
  requiredItemPos: Point;
  obstaclePos: Point;
}
