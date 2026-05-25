// src/modules/execution/conditions.ts
// Вычисление условий для IF и WHILE команд

import { Command, TileType, Point, Monster } from '../../types/index';
import { getFrontPosition, isWall, isHole } from './helpers';
import { log } from './helpers';

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

  public async evaluate(conditionCmd: Command): Promise<boolean> {
    const { playerPos, playerDir, coinPos, inventoryKeys, map, monsters, explorationMode } = this.context;
    const frontPos = getFrontPosition(playerPos, playerDir);
    const tile = map[frontPos.row]?.[frontPos.col];

    log('ConditionEvaluator', 'evaluate', `Evaluating condition: ${conditionCmd}`);

    switch (conditionCmd) {
      case Command.IF_WALL:
      case Command.WHILE_WALL:
        return isWall(tile);

      case Command.IF_HOLE:
      case Command.WHILE_HOLE:
        return isHole(tile);

      case Command.IF_MONSTER:
      case Command.WHILE_MONSTER:
        return monsters.some(m => m.position.col === frontPos.col && m.position.row === frontPos.row);

      case Command.IF_COIN:
        return playerPos.col === coinPos.col && playerPos.row === coinPos.row;

      case Command.IF_KEY:
        return inventoryKeys.length > 0;

      case Command.IF_NO_KEY:
        return inventoryKeys.length === 0;

      default:
        log('ConditionEvaluator', 'evaluate', `Unknown condition: ${conditionCmd}`);
        return false;
    }
  }

  public updateContext(context: Partial<ConditionContext>): void {
    this.context = { ...this.context, ...context };
  }
}
