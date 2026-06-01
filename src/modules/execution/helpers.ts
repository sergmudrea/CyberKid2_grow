// src/modules/execution/helpers.ts
// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ EXECUTION ENGINE
// ============================================================================
// Содержит утилиты, которые используются во многих модулях движка:
// - преобразование направлений
// - проверка типов тайлов (стена, яма, дверь, конвейер и т.д.)
// - расчёт звёзд
// - задержки (delay)
// - глубокое копирование инвентаря
// - логирование с указанием модуля
// ============================================================================

import { Point, TileType, Command, Inventory } from '../../types/index';
import { logger } from '../../core/Logger';

// --------------------------------------------------------------------------
// 1. ГЕОМЕТРИЧЕСКИЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// --------------------------------------------------------------------------

/**
 * Возвращает позицию клетки впереди от заданной позиции в заданном направлении.
 * Используется для проверки, что находится перед игроком или монстром.
 */
export function getFrontPosition(pos: Point, dir: 'up' | 'down' | 'left' | 'right'): Point {
  switch (dir) {
    case 'up':    return { col: pos.col, row: pos.row - 1 };
    case 'down':  return { col: pos.col, row: pos.row + 1 };
    case 'left':  return { col: pos.col - 1, row: pos.row };
    case 'right': return { col: pos.col + 1, row: pos.row };
  }
}

// --------------------------------------------------------------------------
// 2. ПРОВЕРКИ ТАЙЛОВ (по типам)
// --------------------------------------------------------------------------

/** Является ли тайл стеной (обычной или фальшивой) */
export function isWall(tile: TileType): boolean {
  return tile === TileType.WALL || tile === TileType.FAKE_WALL;
}

/** Является ли тайл ямой */
export function isHole(tile: TileType): boolean {
  return tile === TileType.HOLE;
}

/** Является ли тайл смертельной жидкостью (лава или вода) */
export function isDeadlyLiquid(tile: TileType): boolean {
  return tile === TileType.LAVA || tile === TileType.WATER;
}

/** Является ли тайл дверью (запертой или открытой) */
export function isDoor(tile: TileType): boolean {
  return tile === TileType.DOOR_LOCKED || tile === TileType.DOOR_UNLOCKED;
}

/** Является ли тайл телепортом (входом или выходом) */
export function isTeleport(tile: TileType): boolean {
  return tile === TileType.TELEPORT_IN || tile === TileType.TELEPORT_OUT;
}

/** Является ли тайл конвейером (любого направления) */
export function isConveyor(tile: TileType): boolean {
  return tile >= TileType.CONVEYOR_UP && tile <= TileType.CONVEYOR_RIGHT;
}

/** Является ли тайл пружиной */
export function isSpring(tile: TileType): boolean {
  return tile === TileType.SPRING;
}

/** Является ли тайл собираемым предметом (ключ, кукуруза, ядро, инструменты, ключ от клетки, драгоценность) */
export function isPickupItem(tile: TileType): boolean {
  return tile === TileType.KEY ||
         tile === TileType.CORN ||
         tile === TileType.CORE ||
         tile === TileType.TOOL_DRILL ||
         tile === TileType.TOOL_HOOK ||
         tile === TileType.TOOL_WING ||
         tile === TileType.TOOL_BAIT ||
         tile === TileType.CAGE_KEY ||
         tile === TileType.GEM;
}

// --------------------------------------------------------------------------
// 3. ПРЕОБРАЗОВАНИЕ КОМАНД И ТАЙЛОВ В НАПРАВЛЕНИЯ
// --------------------------------------------------------------------------

/**
 * Преобразует команду движения (Command.UP и т.д.) в строковое направление.
 * Возвращает null, если команда не является движением.
 */
export function getDirectionFromCommand(cmd: Command): 'up' | 'down' | 'left' | 'right' | null {
  switch (cmd) {
    case Command.UP:    return 'up';
    case Command.DOWN:  return 'down';
    case Command.LEFT:  return 'left';
    case Command.RIGHT: return 'right';
    default:            return null;
  }
}

/**
 * Получает направление конвейера из числового кода тайла.
 * Возвращает null, если тайл не является конвейером.
 */
export function getConveyorDirection(tile: TileType): 'up' | 'down' | 'left' | 'right' | null {
  switch (tile) {
    case TileType.CONVEYOR_UP:    return 'up';
    case TileType.CONVEYOR_DOWN:  return 'down';
    case TileType.CONVEYOR_LEFT:  return 'left';
    case TileType.CONVEYOR_RIGHT: return 'right';
    default:                      return null;
  }
}

// --------------------------------------------------------------------------
// 4. РАСЧЁТ ЗВЁЗД (на основе шагов и оптимального количества)
// --------------------------------------------------------------------------

/**
 * Рассчитывает количество звёзд (0-3) по числу использованных шагов и оптимальному.
 * Правила:
 * - 3 звезды: stepsUsed <= optimalSteps
 * - 2 звезды: stepsUsed <= optimalSteps * 1.5
 * - 1 звезда: иначе (но при условии победы)
 * - 0 звёзд: проигрыш или недопустимое значение
 */
export function calculateStars(stepsUsed: number, optimalSteps: number): number {
  if (stepsUsed <= optimalSteps) return 3;
  if (stepsUsed <= optimalSteps * 1.5) return 2;
  return 1;
}

// --------------------------------------------------------------------------
// 5. АСИНХРОННАЯ ЗАДЕРЖКА (для команды WAIT)
// --------------------------------------------------------------------------

/**
 * Возвращает Promise, который разрешается через указанное количество миллисекунд.
 * Используется в команде WAIT, а также для анимаций.
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --------------------------------------------------------------------------
// 6. ГЛУБОКОЕ КОПИРОВАНИЕ ИНВЕНТАРЯ (для клонов и сохранений)
// --------------------------------------------------------------------------

/**
 * Создаёт полную независимую копию объекта инвентаря.
 * Нужно для клонирования, чтобы клоны имели свой собственный инвентарь.
 */
export function copyInventory(inv: Inventory): Inventory {
  return {
    keys: [...inv.keys],
    corn: inv.corn,
    cores: inv.cores,
    hasDrill: inv.hasDrill,
    hasHook: inv.hasHook,
    hasWing: inv.hasWing,
    hasBait: inv.hasBait,
    tools: [...inv.tools],
  };
}

// --------------------------------------------------------------------------
// 7. ПРОВЕРКА, ЗАБЛОКИРОВАНО ЛИ ДВИЖЕНИЕ НА КЛЕТКУ
// --------------------------------------------------------------------------

/**
 * Определяет, может ли игрок войти на клетку с учётом его текущих возможностей.
 * Используется в MovementExecutor.
 */
export function isMovementBlocked(tile: TileType, hasWing: boolean, explorationMode: boolean): boolean {
  if (explorationMode) return false;                     // в режиме исследования всё проходимо
  if (isWall(tile)) return true;                         // стены всегда блокируют
  if (isHole(tile) && !hasWing) return true;             // яма требует крыльев
  if (isDeadlyLiquid(tile) && !hasWing) return true;     // лава/вода требует крыльев
  return false;
}

// --------------------------------------------------------------------------
// 8. ЛОГИРОВАНИЕ С УКАЗАНИЕМ МОДУЛЯ (используется внутри execution)
// --------------------------------------------------------------------------

// Для удобства создаём обёртки над глобальным логгером с фиксированным префиксом "ExecutionEngine."

export function log(module: string, method: string, message: string, data?: any): void {
  logger.debug(`ExecutionEngine.${module}`, method, message, data);
}

export function logError(module: string, method: string, message: string, error?: any): void {
  logger.error(`ExecutionEngine.${module}`, method, message, error);
}

export function logInfo(module: string, method: string, message: string, data?: any): void {
  logger.info(`ExecutionEngine.${module}`, method, message, data);
}
