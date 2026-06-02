// tools/generator/levelGenerator.ts
// ============================================================================
// ГЕНЕРАТОР УРОВНЕЙ С BFS, УЧИТЫВАЮЩИЙ ИНВЕНТАРЬ И БЭКДОРЫ
// ============================================================================
// - Генерация карты с множественными путями (Normal, Shortcut, Backdoor)
// - BFS-валидатор, моделирующий инвентарь (ключи, инструменты, корн, ядра)
// - Автоматическая классификация путей и расчёт чёрных звёзд
// ============================================================================

import seedrandom from 'seedrandom';
import { Command, TileType, Point } from '../../src/types/index';

// ----------------------------------------------------------------------------
// ТИПЫ И ИНТЕРФЕЙСЫ
// ----------------------------------------------------------------------------

export enum BackdoorType {
  DRILL = 'drill',
  HOOK = 'hook',
  WING = 'wing',
  BAIT = 'bait',
  FEED = 'feed',
  TELEPORT = 'teleport',
  CLONE = 'clone',
  BLACKBOX = 'blackbox',
  BUTTON = 'button',
  LEVER = 'lever',
}

export interface GenerationRequest {
  stage: 1 | 2 | 3 | 4;
  theme: 'meadow' | 'ocean' | 'clouds' | 'fairy' | 'volcano' | 'arcade';
  difficulty: number;
  requiredCommands?: Command[];
  forbiddenCommands?: Command[];
  targetTimeSeconds?: number;
  seed?: number;
  allowBackdoors?: boolean;
  backdoorCount?: number;
  backdoorMechanics?: BackdoorType[];
}

export interface GeneratedLevel {
  id: string;
  name: string;
  stage: number;
  difficulty: number;
  size: { width: number; height: number };
  start: { x: number; y: number; direction: 'up' | 'down' | 'left' | 'right' };
  goal: { type: 'star'; x: number; y: number };
  tiles: TileType[][];
  objects: any[];
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

// Состояние для BFS (упрощённый инвентарь)
interface SearchState {
  x: number;
  y: number;
  keys: boolean;        // есть ли обычный ключ (для упрощения – булево)
  hasDrill: boolean;
  hasHook: boolean;
  hasWing: boolean;
  hasBait: boolean;
  hasCorn: boolean;
  hasCore: boolean;
  backdoorFlags: Set<string>; // какие бэкдоры уже задействованы
}

// ----------------------------------------------------------------------------
// ОСНОВНОЙ ГЕНЕРАТОР
// ----------------------------------------------------------------------------

export class LevelGenerator {
  private rng: () => number;

  constructor(seed?: number) {
    this.rng = seedrandom(seed?.toString() || Math.random().toString());
  }

  public generate(req: GenerationRequest): GeneratedLevel {
    // 1. Размер поля
    const { width, height } = this.determineSize(req.difficulty);
    let tiles: TileType[][] = Array(height).fill(null).map(() => Array(width).fill(TileType.PLATFORM));
    
    // 2. Старт и цель
    const start = { x: 0, y: 0 };
    const goal = { x: width - 1, y: height - 1 };
    
    // 3. Генерация основного длинного пути
    const mainPath = this.generateMainPath(start, goal);
    this.markPath(tiles, mainPath, TileType.PLATFORM);
    
    // 4. Генерация коротких путей и бэкдоров
    let backdoors: BackdoorInfo[] = [];
    if (req.allowBackdoors && req.difficulty > 20) {
      const count = req.backdoorCount || Math.min(3, Math.floor(req.difficulty / 20));
      backdoors = this.generateBackdoors(start, goal, width, height, count, req.backdoorMechanics);
      for (const bd of backdoors) {
        this.markPath(tiles, bd.shortcutPath, TileType.PLATFORM);
        // Размещаем препятствие (стена, яма, монстр)
        if (bd.obstaclePos) {
          tiles[bd.obstaclePos.y][bd.obstaclePos.x] = TileType.WALL;
        }
      }
    }
    
    // 5. Размещение предметов (объектов)
    const objects = this.placeObjects(req, backdoors);
    
    // 6. Заполнение остального поля препятствиями (но не перекрывая пути)
    tiles = this.fillObstacles(tiles, mainPath, backdoors, req.difficulty, req.theme);
    
    // 7. BFS-валидация с учётом инвентаря
    const paths = this.bfsWithInventory(tiles, start, goal, objects, req);
    if (paths.length === 0) {
      // Нет решения – перегенерируем с другим seed
      return this.generate({ ...req, seed: (req.seed || 0) + 1 });
    }
    
    // 8. Классификация путей
    const normalPath = paths.find(p => !p.isBackdoor && !p.requiresItems);
    const shortcutPaths = paths.filter(p => !p.isBackdoor && p.requiresItems && p.requiresItems.length > 0);
    const backdoorPaths = paths.filter(p => p.isBackdoor);
    const optimalSteps = Math.min(...paths.map(p => p.steps));
    
    // 9. Формирование результата
    return {
      id: `gen_${Date.now()}_${Math.floor(this.rng() * 10000)}`,
      name: `${this.themeName(req.theme)} ${Math.floor(this.rng() * 1000) + 1}`,
      stage: req.stage,
      difficulty: req.difficulty,
      size: { width, height },
      start: { x: start.x, y: start.y, direction: 'right' },
      goal: { type: 'star', x: goal.x, y: goal.y },
      tiles,
      objects,
      availableCommands: this.determineAvailableCommands(req.stage, req.difficulty),
      solutionHints: {
        optimalSteps,
        expectedConcepts: this.getExpectedConcepts(req.difficulty),
        backdoorPaths: backdoorPaths.map(bp => ({
          type: bp.backdoorType!,
          steps: bp.steps,
          requiredItems: bp.requiredItems || [],
        })),
      },
      seed: req.seed || 0,
    };
  }

  // --------------------------------------------------------------------------
  // ГЕОМЕТРИЧЕСКИЕ ВСПОМОГАТЕЛЬНЫЕ
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
    const allMech = mechanics || Object.values(BackdoorType);
    for (let i = 0; i < count && i < allMech.length; i++) {
      const type = allMech[i];
      const shortcut = this.createShortcut(start, goal, i);
      const obstaclePos = this.findFreePosition(width, height, []);
      const requiredItemPos = this.findFreePosition(width, height, [obstaclePos]);
      backdoors.push({
        type,
        shortcutPath: shortcut,
        requiredItemPos,
        obstaclePos,
      });
    }
    return backdoors;
  }

  private createShortcut(start: Point, goal: Point, variant: number): Point[] {
    // Диагональный путь, слегка искривлённый
    const path: Point[] = [];
    const steps = Math.min(goal.x - start.x, goal.y - start.y) - variant;
    for (let i = 1; i <= steps; i++) {
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

  private placeObjects(req: GenerationRequest, backdoors: BackdoorInfo[]): any[] {
    const objects: any[] = [];
    for (const bd of backdoors) {
      switch (bd.type) {
        case BackdoorType.DRILL:
          objects.push({ type: 'drill', x: bd.requiredItemPos.x, y: bd.requiredItemPos.y });
          break;
        case BackdoorType.HOOK:
          objects.push({ type: 'hook', x: bd.requiredItemPos.x, y: bd.requiredItemPos.y });
          break;
        case BackdoorType.WING:
          objects.push({ type: 'wing', x: bd.requiredItemPos.x, y: bd.requiredItemPos.y });
          break;
        case BackdoorType.BAIT:
          objects.push({ type: 'bait', x: bd.requiredItemPos.x, y: bd.requiredItemPos.y });
          break;
        case BackdoorType.FEED:
          objects.push({ type: 'corn', x: bd.requiredItemPos.x, y: bd.requiredItemPos.y });
          break;
        default:
          objects.push({ type: 'key', x: bd.requiredItemPos.x, y: bd.requiredItemPos.y });
      }
    }
    // Добавляем пару случайных ключей для обычных путей
    if (req.difficulty > 30) {
      objects.push({ type: 'key', x: Math.floor(this.rng() * 10), y: Math.floor(this.rng() * 10) });
    }
    return objects;
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

  // --------------------------------------------------------------------------
  // BFS С УЧЁТОМ ИНВЕНТАРЯ
  // --------------------------------------------------------------------------
  private bfsWithInventory(tiles: TileType[][], start: Point, goal: Point, objects: any[], req: GenerationRequest): PathInfo[] {
    // Преобразуем массив объектов в карту (item → координаты)
    const itemPositions = new Map<string, Point>();
    for (const obj of objects) {
      itemPositions.set(obj.type, { x: obj.x, y: obj.y });
    }
    
    // Начальное состояние
    const initialState: SearchState = {
      x: start.x,
      y: start.y,
      keys: false,
      hasDrill: false,
      hasHook: false,
      hasWing: false,
      hasBait: false,
      hasCorn: false,
      hasCore: false,
      backdoorFlags: new Set(),
    };
    
    // Очередь для BFS
    const queue: { state: SearchState; path: Point[]; steps: number }[] = [{ state: initialState, path: [start], steps: 0 }];
    const visited = new Set<string>();
    const results: PathInfo[] = [];
    
    while (queue.length > 0) {
      const { state, path, steps } = queue.shift()!;
      const key = `${state.x},${state.y},${state.keys},${state.hasDrill},${state.hasHook},${state.hasWing},${state.hasBait},${state.hasCorn},${state.hasCore},${Array.from(state.backdoorFlags).sort().join(',')}`;
      if (visited.has(key)) continue;
      visited.add(key);
      
      // Проверка цели
      if (state.x === goal.x && state.y === goal.y) {
        // Классифицируем путь
        const isBackdoor = state.backdoorFlags.size > 0;
        const requiredItems = this.deriveRequiredItems(state);
        results.push({
          steps,
          isBackdoor,
          backdoorType: isBackdoor ? Array.from(state.backdoorFlags)[0] as BackdoorType : undefined,
          requiredItems,
        });
        if (results.length >= 5) break; // не ищем больше 5 путей
        continue;
      }
      
      // Генерация соседей (4 направления)
      const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
      for (const [dx, dy] of dirs) {
        const nx = state.x + dx;
        const ny = state.y + dy;
        if (nx < 0 || nx >= tiles[0].length || ny < 0 || ny >= tiles.length) continue;
        const tile = tiles[ny][nx];
        
        // Проверка проходимости с учётом инвентаря
        let passable = true;
        if (tile === TileType.WALL && !state.hasDrill) passable = false;
        if (tile === TileType.HOLE && !state.hasWing) passable = false;
        if (tile === TileType.LAVA && !state.hasWing) passable = false;
        if (tile === TileType.WATER && !state.hasWing) passable = false;
        if (tile === TileType.DOOR_LOCKED && !state.keys) passable = false;
        if (!passable) continue;
        
        // Новое состояние
        const newState = { ...state, x: nx, y: ny };
        // Подбор предметов
        for (const [item, pos] of itemPositions.entries()) {
          if (pos.x === nx && pos.y === ny) {
            switch (item) {
              case 'key': newState.keys = true; break;
              case 'drill': newState.hasDrill = true; break;
              case 'hook': newState.hasHook = true; break;
              case 'wing': newState.hasWing = true; break;
              case 'bait': newState.hasBait = true; break;
              case 'corn': newState.hasCorn = true; break;
              case 'core': newState.hasCore = true; break;
            }
            // Если предмет – бэкдорная механика, отмечаем флаг
            if (this.isBackdoorItem(item)) {
              newState.backdoorFlags.add(item as BackdoorType);
            }
          }
        }
        // Использование предметов для преодоления препятствий (дрель, ключ и т.д.)
        if (tile === TileType.WALL && state.hasDrill) {
          newState.hasDrill = false; // расходуется
          newState.backdoorFlags.add(BackdoorType.DRILL);
        }
        if (tile === TileType.DOOR_LOCKED && state.keys) {
          newState.keys = false; // расходуется
        }
        
        queue.push({ state: newState, path: [...path, { x: nx, y: ny }], steps: steps + 1 });
      }
    }
    return results;
  }

  private isBackdoorItem(item: string): boolean {
    return ['drill', 'hook', 'wing', 'bait', 'corn', 'core'].includes(item);
  }

  private deriveRequiredItems(state: SearchState): string[] {
    const items: string[] = [];
    if (state.hasDrill) items.push('drill');
    if (state.hasHook) items.push('hook');
    if (state.hasWing) items.push('wing');
    if (state.hasBait) items.push('bait');
    if (state.hasCorn) items.push('corn');
    if (state.hasCore) items.push('core');
    if (state.keys) items.push('key');
    return items;
  }

  // --------------------------------------------------------------------------
  // ОПРЕДЕЛЕНИЕ КОМАНД И КОНЦЕПЦИЙ
  // --------------------------------------------------------------------------
  private determineAvailableCommands(stage: number, difficulty: number): Command[] {
    const base: Command[] = [Command.UP, Command.DOWN, Command.LEFT, Command.RIGHT];
    if (stage >= 2) base.push(Command.IF_WALL, Command.IF_HOLE);
    if (stage >= 3) base.push(Command.WHILE_WALL, Command.DEF, Command.CALL);
    if (stage >= 4) base.push(Command.CLASS, Command.NEW, Command.METHOD);
    if (difficulty > 30) base.push(Command.PICKUP, Command.DROP, Command.USE_KEY);
    if (difficulty > 50) base.push(Command.DRILL, Command.HOOK);
    if (difficulty > 70) base.push(Command.CLONE, Command.JOIN);
    return base;
  }

  private getExpectedConcepts(difficulty: number): string[] {
    if (difficulty <= 20) return ['movement', 'loops'];
    if (difficulty <= 50) return ['conditions', 'functions', 'inventory'];
    if (difficulty <= 80) return ['recursion', 'tools', 'backdoors'];
    return ['OOP', 'parallelism', 'complex backdoors'];
  }

  private themeName(theme: string): string {
    const map: Record<string, string> = {
      meadow: '🌾 Meadow',
      ocean: '🌊 Ocean',
      clouds: '☁️ Clouds',
      fairy: '🏰 Fairytale',
      volcano: '🌋 Volcano',
      arcade: '🎮 Arcade',
    };
    return map[theme] || 'Unknown';
  }
}

// ----------------------------------------------------------------------------
// ВСПОМОГАТЕЛЬНЫЕ ТИПЫ
// ----------------------------------------------------------------------------
interface BackdoorInfo {
  type: BackdoorType;
  shortcutPath: Point[];
  requiredItemPos: Point;
  obstaclePos: Point;
}

interface PathInfo {
  steps: number;
  isBackdoor: boolean;
  backdoorType?: BackdoorType;
  requiredItems?: string[];
}
