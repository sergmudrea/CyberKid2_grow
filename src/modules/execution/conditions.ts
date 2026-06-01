// src/modules/execution/conditions.ts
// ============================================================================
// ВЫЧИСЛЕНИЕ УСЛОВИЙ ДЛЯ КОМАНД IF И WHILE
// ============================================================================
// Этот модуль отвечает за проверку условий:
// - IF_WALL / WHILE_WALL
// - IF_HOLE / WHILE_HOLE
// - IF_MONSTER / WHILE_MONSTER
// - IF_COIN
// - IF_KEY / IF_NO_KEY
// ============================================================================
// Используется в ASTRunner при выполнении блоков if и while.
// ============================================================================

import { Command, TileType, Point, Monster } from '../../types/index';
import { getFrontPosition, isWall, isHole, log } from './helpers';

// ----------------------------------------------------------------------------
// КОНТЕКСТ ДЛЯ ВЫЧИСЛЕНИЯ УСЛОВИЙ
// ----------------------------------------------------------------------------
export interface ConditionContext {
  playerPos: Point;
  playerDir: 'up' | 'down' | 'left' | 'right';
  coinPos: Point;
  inventoryKeys: string[];
  map: TileType[][];
  monsters: Monster[];
  explorationMode: boolean;
}

export class ConditionEvaluator {
  private context: ConditionContext;

  constructor(context: ConditionContext) {
    this.context = context;
  }

  // --------------------------------------------------------------------------
  // ОСНОВНОЙ МЕТОД: ВЫЧИСЛИТЬ ЗНАЧЕНИЕ УСЛОВИЯ ПО КОМАНДЕ
  // --------------------------------------------------------------------------
  public async evaluate(conditionCmd: Command): Promise<boolean> {
    const { playerPos, playerDir, coinPos, inventoryKeys, map, monsters, explorationMode } = this.context;
    const frontPos = getFrontPosition(playerPos, playerDir);
    const tile = map[frontPos.row]?.[frontPos.col];

    log('ConditionEvaluator', 'evaluate', `Evaluating condition: ${conditionCmd}`);

    switch (conditionCmd) {
      // Стена впереди (обычная или фальшивая)
      case Command.IF_WALL:
      case Command.WHILE_WALL:
        return isWall(tile);

      // Яма впереди
      case Command.IF_HOLE:
      case Command.WHILE_HOLE:
        return tile === TileType.HOLE;

      // Монстр впереди (неважно, приручен или нет, но обычно проверяется наличие)
      case Command.IF_MONSTER:
      case Command.WHILE_MONSTER:
        return monsters.some(m => m.position.col === frontPos.col && m.position.row === frontPos.row);

      // Игрок стоит на монетке (цель достигнута)
      case Command.IF_COIN:
        return playerPos.col === coinPos.col && playerPos.row === coinPos.row;

      // Есть хотя бы один ключ в инвентаре
      case Command.IF_KEY:
        return inventoryKeys.length > 0;

      // Нет ключей
      case Command.IF_NO_KEY:
        return inventoryKeys.length === 0;

      default:
        log('ConditionEvaluator', 'evaluate', `Unknown condition: ${conditionCmd}`);
        return false;
    }
  }

  // --------------------------------------------------------------------------
  // ОБНОВЛЕНИЕ КОНТЕКСТА (вызывается перед выполнением каждого шага)
  // --------------------------------------------------------------------------
  public updateContext(newContext: Partial<ConditionContext>): void {
    this.context = { ...this.context, ...newContext };
  }
}
