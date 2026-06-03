// src/modules/execution/helpers.ts
// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ EXECUTION ENGINE – ПАТЧ 2.0
// ============================================================================
// Содержит утилиты для:
// - преобразования направлений и углов
// - проверки типов тайлов
// - расчёта звёзд
// - задержек (delay)
// - глубокого копирования инвентаря
// - логирования
// ============================================================================

import { Point, TileType, Command, Inventory, ControlMode } from '../../types/index';
import { logger } from '../../core/Logger';

// --------------------------------------------------------------------------
// 1. ГЕОМЕТРИЧЕСКИЕ ФУНКЦИИ
// --------------------------------------------------------------------------
export function getFrontPosition(pos: Point, dir: 'up' | 'down' | 'left' | 'right'): Point {
  switch (dir) {
    case 'up':    return { col: pos.col, row: pos.row - 1 };
    case 'down':  return { col: pos.col, row: pos.row + 1 };
    case 'left':  return { col: pos.col - 1, row: pos.row };
    case 'right': return { col: pos.col + 1, row: pos.row };
  }
}

// Преобразование угла башни в дельту движения
export function angleToDelta(angle: number): { dx: number; dy: number } | null {
  switch (angle) {
    case 0:   return { dx: 0, dy: -1 };
    case 90:  return { dx: 1, dy: 0 };
    case 180: return { dx: 0, dy: 1 };
    case 270: return { dx: -1, dy: 0 };
    default:  return null;
  }
}

// Преобразование направления корпуса в дельту (с множителем)
export function directionToDelta(dir: 'up' | 'down' | 'left' | 'right', multiplier: number = 1): { dx: number; dy: number } | null {
  switch (dir) {
    case 'up':    return { dx: 0, dy: -1 * multiplier };
    case 'down':  return { dx: 0, dy: 1 * multiplier };
    case 'left':  return { dx: -1 * multiplier, dy: 0 };
    case 'right': return { dx: 1 * multiplier, dy: 0 };
    default:      return null;
  }
}

// Преобразование угла в строковое направление (для UI)
export function angleToDirection(angle: number): 'up' | 'down' | 'left' | 'right' | null {
  switch (angle) {
    case 0:   return 'up';
    case 90:  return 'right';
    case 180: return 'down';
    case 270: return 'left';
    default:  return null;
  }
}

// --------------------------------------------------------------------------
// 2. ПРОВЕРКИ ТАЙЛОВ
// --------------------------------------------------------------------------
export function isWall(tile: TileType): boolean {
  return tile === TileType.WALL || tile === TileType.FAKE_WALL;
}

export function isHole(tile: TileType): boolean {
  return tile === TileType.HOLE;
}

export function isDeadlyLiquid(tile: TileType): boolean {
  return tile === TileType.LAVA || tile === TileType.WATER;
}

export function isDoor(tile: TileType): boolean {
  return tile === TileType.DOOR_LOCKED || tile === TileType.DOOR_UNLOCKED;
}

export function isTeleport(tile: TileType): boolean {
  return tile === TileType.TELEPORT_IN || tile === TileType.TELEPORT_OUT;
}

export function isConveyor(tile: TileType): boolean {
  return tile >= TileType.CONVEYOR_UP && tile <= TileType.CONVEYOR_RIGHT;
}

export function isSpring(tile: TileType): boolean {
  return tile === TileType.SPRING;
}

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

export function isMagnet(tile: TileType): boolean {
  return tile === TileType.MAGNET;
}

export function isSlowField(tile: TileType): boolean {
  return tile === TileType.SLOW_FIELD;
}

// --------------------------------------------------------------------------
// 3. ПРЕОБРАЗОВАНИЕ КОМАНД В НАПРАВЛЕНИЯ
// --------------------------------------------------------------------------
export function getDirectionFromCommand(cmd: Command): 'up' | 'down' | 'left' | 'right' | null {
  switch (cmd) {
    case Command.UP:          return 'up';
    case Command.DOWN:        return 'down';
    case Command.LEFT:        return 'left';
    case Command.RIGHT:       return 'right';
    case Command.MOVE_FORWARD: // зависит от угла башни, не даём здесь
    default: return null;
  }
}

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
// 4. РАСЧЁТ ЗВЁЗД
// --------------------------------------------------------------------------
export function calculateStars(stepsUsed: number, optimalSteps: number): number {
  if (stepsUsed <= optimalSteps) return 3;
  if (stepsUsed <= optimalSteps * 1.5) return 2;
  return 1;
}

// --------------------------------------------------------------------------
// 5. АСИНХРОННАЯ ЗАДЕРЖКА
// --------------------------------------------------------------------------
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --------------------------------------------------------------------------
// 6. ГЛУБОКОЕ КОПИРОВАНИЕ ИНВЕНТАРЯ
// --------------------------------------------------------------------------
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
// 7. ПРОВЕРКА БЛОКИРОВКИ ДВИЖЕНИЯ (С УЧЁТОМ КРЫЛЬЕВ И РЕЖИМА ИССЛЕДОВАНИЯ)
// --------------------------------------------------------------------------
export function isMovementBlocked(tile: TileType, hasWing: boolean, explorationMode: boolean): boolean {
  if (explorationMode) return false;
  if (isWall(tile)) return true;
  if (isHole(tile) && !hasWing) return true;
  if (isDeadlyLiquid(tile) && !hasWing) return true;
  return false;
}

// --------------------------------------------------------------------------
// 8. ЛОГИРОВАНИЕ (обёртки над глобальным логгером)
// --------------------------------------------------------------------------
export function log(module: string, method: string, message: string, data?: any): void {
  logger.debug(`ExecutionEngine.${module}`, method, message, data);
}

export function logError(module: string, method: string, message: string, error?: any): void {
  logger.error(`ExecutionEngine.${module}`, method, message, error);
}

export function logInfo(module: string, method: string, message: string, data?: any): void {
  logger.info(`ExecutionEngine.${module}`, method, message, data);
}
