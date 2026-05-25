// src/modules/execution/conditions_blocks.ts
// Обработка условий: IF/ELSE

import { Command } from '../../types/index';
import { ASTNode } from './types';
import { log } from './helpers';

export class ConditionsBlocksExecutor {
  /**
   * Проверка, является ли команда условием
   */
  public static isConditionCommand(cmd: Command): boolean {
    return cmd === Command.IF_WALL ||
           cmd === Command.IF_HOLE ||
           cmd === Command.IF_MONSTER ||
           cmd === Command.IF_COIN ||
           cmd === Command.IF_KEY ||
           cmd === Command.IF_NO_KEY;
  }

  /**
   * Создать AST-узел для IF
   */
  public static createIfNode(condition: Command, ifBody: ASTNode[], elseBody: ASTNode[] | null = null): ASTNode {
    log('ConditionsBlocksExecutor', 'createIfNode', `Creating IF condition ${condition}, ifBody length: ${ifBody.length}, elseBody length: ${elseBody?.length || 0}`);
    
    const ifNode: ASTNode = {
      type: 'block',
      blockType: 'if',
      condition,
      children: ifBody,
    };

    if (elseBody && elseBody.length > 0) {
      const elseNode: ASTNode = {
        type: 'block',
        blockType: 'else',
        children: elseBody,
      };
      return {
        type: 'block',
        blockType: 'if_else',
        children: [ifNode, elseNode],
      };
    }

    return ifNode;
  }

  /**
   * Проверить, нужно ли пропустить блок ELSE (если условие IF было истинно)
   */
  public static shouldSkipElse(conditionResult: boolean): boolean {
    return conditionResult;
  }
}
