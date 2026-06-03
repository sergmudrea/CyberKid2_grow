// src/modules/execution/conditions.ts
// ============================================================================
// ВЫЧИСЛЕНИЕ УСЛОВИЙ ДЛЯ КОМАНД IF И WHILE – ПАТЧ 2.0
// ============================================================================
// Поддерживает:
// - IF_WALL, IF_HOLE, IF_MONSTER, IF_COIN, IF_KEY, IF_NO_KEY (старые)
// - IF_ANGLE – условие по текущему углу башни
// - WHILE_NOT_FACING – цикл, пока башня не смотрит на цель (монетку или объект)
// ============================================================================

import { Command, TileType, Point, Monster } from '../../types/index';
import { getFrontPosition, isWall, isHole, log } from './helpers';

export interface ConditionContext {
  playerPos: Point;
  playerDir: 'up' | 'down' | 'left' | 'right';
  coinPos: Point;
  inventoryKeys: string[];
  map: TileType[][];
  monsters: Monster[];
  explorationMode: boolean;
  turretAngle: number;           // NEW: угол башни для IF_ANGLE
  facingTarget?: Point;          // для WHILE_NOT_FACING – цель (обычно монетка)
}

export class ConditionEvaluator {
  private context: ConditionContext;

  constructor(context: ConditionContext) {
    this.context = context;
  }

  public async evaluate(conditionCmd: Command, expectedAngle?: number): Promise<boolean> {
    const { playerPos, playerDir, coinPos, inventoryKeys, map, monsters, explorationMode, turretAngle } = this.context;
    const frontPos = getFrontPosition(playerPos, playerDir);
    const tile = map[frontPos.row]?.[frontPos.col];

    log('ConditionEvaluator', 'evaluate', `Evaluating condition: ${conditionCmd}`);

    switch (conditionCmd) {
      // Старые условия
      case Command.IF_WALL:
      case Command.WHILE_WALL:
        return isWall(tile);

      case Command.IF_HOLE:
      case Command.WHILE_HOLE:
        return tile === TileType.HOLE;

      case Command.IF_MONSTER:
      case Command.WHILE_MONSTER:
        return monsters.some(m => m.position.col === frontPos.col && m.position.row === frontPos.row);

      case Command.IF_COIN:
        return playerPos.col === coinPos.col && playerPos.row === coinPos.row;

      case Command.IF_KEY:
        return inventoryKeys.length > 0;

      case Command.IF_NO_KEY:
        return inventoryKeys.length === 0;

      // НОВЫЕ условия для патча 2.0
      case Command.IF_ANGLE:
        if (expectedAngle === undefined) {
          log('ConditionEvaluator', 'evaluate', `IF_ANGLE missing expected angle parameter`);
          return false;
        }
        // Нормализуем углы (0, 90, 180, 270)
        const normTurret = ((turretAngle % 360) + 360) % 360;
        const normExpected = ((expectedAngle % 360) + 360) % 360;
        const result = normTurret === normExpected;
        log('ConditionEvaluator', 'evaluate', `IF_ANGLE: turret=${normTurret}, expected=${normExpected}, result=${result}`);
        return result;

      case Command.WHILE_NOT_FACING:
        // Цикл, пока башня не смотрит на монетку (или другую цель)
        const target = this.context.facingTarget || coinPos;
        const dx = target.col - playerPos.col;
        const dy = target.row - playerPos.row;
        let requiredAngle = 0;
        if (dx > 0) requiredAngle = 90;
        else if (dx < 0) requiredAngle = 270;
        else if (dy > 0) requiredAngle = 180;
        else if (dy < 0) requiredAngle = 0;
        const isFacing = turretAngle === requiredAngle;
        log('ConditionEvaluator', 'evaluate', `WHILE_NOT_FACING: turret=${turretAngle}, required=${requiredAngle}, isFacing=${isFacing}`);
        return !isFacing;

      default:
        log('ConditionEvaluator', 'evaluate', `Unknown condition: ${conditionCmd}`);
        return false;
    }
  }

  public updateContext(newContext: Partial<ConditionContext>): void {
    this.context = { ...this.context, ...newContext };
  }
}
