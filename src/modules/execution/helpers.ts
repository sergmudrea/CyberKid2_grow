// src/modules/execution/helpers.ts
// Вспомогательные методы для ExecutionEngine

import { Point, TileType, Command } from '../../types/index';
import { logger } from '../../core/Logger';

/**
 * Получить позицию впереди от текущей позиции в заданном направлении
 */
export function getFrontPosition(pos: Point, dir: 'up' | 'down' | 'left' | 'right'): Point {
  switch (dir) {
    case 'up':
      return { col: pos.col, row: pos.row - 1 };
    case 'down':
      return { col: pos.col, row: pos.row + 1 };
    case 'left':
      return { col: pos.col - 1, row: pos.row };
    case 'right':
      return { col: pos.col + 1, row: pos.row };
    default:
      return { col: pos.col, row: pos.row };
  }
}

/**
 * Проверка, является ли тайл стеной
 */
export function isWall(tile: TileType): boolean {
  return tile === TileType.WALL || tile === TileType.FAKE_WALL;
}

/**
 * Проверка, является ли тайл ямой
 */
export function isHole(tile: TileType): boolean {
  return tile === TileType.HOLE;
}

/**
 * Проверка, является ли тайл лавой или водой (смертельно)
 */
export function isDeadlyLiquid(tile: TileType): boolean {
  return tile === TileType.LAVA || tile === TileType.WATER;
}

/**
 * Проверка, является ли тайл дверью
 */
export function isDoor(tile: TileType): boolean {
  return tile === TileType.DOOR_LOCKED || tile === TileType.DOOR_UNLOCKED;
}

/**
 * Проверка, является ли тайл телепортом
 */
export function isTeleport(tile: TileType): boolean {
  return tile === TileType.TELEPORT_IN || tile === TileType.TELEPORT_OUT;
}

/**
 * Проверка, является ли тайл конвейером
 */
export function isConveyor(tile: TileType): boolean {
  return tile >= TileType.CONVEYOR_UP && tile <= TileType.CONVEYOR_RIGHT;
}

/**
 * Проверка, является ли тайл пружиной
 */
export function isSpring(tile: TileType): boolean {
  return tile === TileType.SPRING;
}

/**
 * Проверка, является ли тайл собираемым предметом
 */
export function isPickupItem(tile: TileType): boolean {
  return tile === TileType.KEY ||
         tile === TileType.CORN ||
         tile === TileType.CORE ||
         tile === TileType.TOOL_DRILL ||
         tile === TileType.TOOL_HOOK ||
         tile === TileType.TOOL_WING ||
         tile === TileType.TOOL_BAIT;
}

/**
 * Получить направление из команды движения
 */
export function getDirectionFromCommand(cmd: Command): 'up' | 'down' | 'left' | 'right' | null {
  switch (cmd) {
    case Command.UP: return 'up';
    case Command.DOWN: return 'down';
    case Command.LEFT: return 'left';
    case Command.RIGHT: return 'right';
    default: return null;
  }
}

/**
 * Получить направление конвейера из тайла
 */
export function getConveyorDirection(tile: TileType): 'up' | 'down' | 'left' | 'right' | null {
  switch (tile) {
    case TileType.CONVEYOR_UP: return 'up';
    case TileType.CONVEYOR_DOWN: return 'down';
    case TileType.CONVEYOR_LEFT: return 'left';
    case TileType.CONVEYOR_RIGHT: return 'right';
    default: return null;
  }
}

/**
 * Рассчитать звёзды на основе шагов
 */
export function calculateStars(stepsUsed: number, optimalSteps: number): number {
  if (stepsUsed <= optimalSteps) return 3;
  if (stepsUsed <= optimalSteps * 1.5) return 2;
  return 1;
}

/**
 * Задержка (Promise)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Глубокое копирование инвентаря
 */
export function copyInventory(inv: any): any {
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

/**
 * Проверка на блокировку движения (стена, яма, лава, вода)
 */
export function isMovementBlocked(tile: TileType, hasWing: boolean, explorationMode: boolean): boolean {
  if (explorationMode) return false;
  if (isWall(tile)) return true;
  if (isHole(tile) && !hasWing) return true;
  if (isDeadlyLiquid(tile) && !hasWing) return true;
  return false;
}

/**
 * Логирование с модулем
 */
export function log(module: string, method: string, message: string, data?: any): void {
  logger.debug(`ExecutionEngine.${module}`, method, message, data);
}

/**
 * Логирование ошибок
 */
export function logError(module: string, method: string, message: string, error?: any): void {
  logger.error(`ExecutionEngine.${module}`, method, message, error);
}

/**
 * Логирование информации
 */
export function logInfo(module: string, method: string, message: string, data?: any): void {
  logger.info(`ExecutionEngine.${module}`, method, message, data);
}
