// src/modules/execution/loops.ts
// Обработка циклов: FOR_N, FOR_LOOP, WHILE, REPEAT
// (основная логика выполняется в runner.ts, здесь вспомогательные функции)

import { Command } from '../../types/index';
import { ASTNode } from './types';
import { log } from './helpers';

export class LoopsExecutor {
  /**
   * Проверка, является ли команда началом цикла
   */
  public static isLoopCommand(cmd: Command): boolean {
    return cmd === Command.FOR_N ||
           cmd === Command.FOR_LOOP ||
           cmd === Command.WHILE_MONSTER ||
           cmd === Command.WHILE_WALL ||
           cmd === Command.WHILE_HOLE ||
           cmd === Command.REPEAT;
  }

  /**
   * Получить количество повторений для FOR_N
   */
  public static getForNRepeatCount(commands: Command[], startIndex: number): number {
    let repeatCount = 3;
    if (startIndex + 1 < commands.length) {
      const next = commands[startIndex + 1];
      const num = parseInt(next as unknown as string, 10);
      if (!isNaN(num)) {
        repeatCount = num;
      }
    }
    return repeatCount;
  }

  /**
   * Получить границы для FOR_LOOP
   */
  public static getForLoopBounds(commands: Command[], startIndex: number): { from: number; to: number } {
    let from = 0, to = 10;
    if (startIndex + 2 < commands.length) {
      const next1 = commands[startIndex + 1];
      const next2 = commands[startIndex + 2];
      const fromNum = parseInt(next1 as unknown as string, 10);
      const toNum = parseInt(next2 as unknown as string, 10);
      if (!isNaN(fromNum)) from = fromNum;
      if (!isNaN(toNum)) to = toNum;
    }
    return { from, to };
  }

  /**
   * Создать AST-узел для цикла FOR_N
   */
  public static createForNNode(repeatCount: number, body: ASTNode[]): ASTNode {
    log('LoopsExecutor', 'createForNNode', `Creating FOR_N loop with ${repeatCount} repetitions`);
    return {
      type: 'block',
      blockType: 'for',
      children: body,
      repeatCount,
    };
  }

  /**
   * Создать AST-узел для цикла FOR_LOOP
   */
  public static createForLoopNode(from: number, to: number, body: ASTNode[]): ASTNode {
    const repeatCount = Math.max(0, to - from);
    log('LoopsExecutor', 'createForLoopNode', `Creating FOR_LOOP from ${from} to ${to} (${repeatCount} iterations)`);
    return {
      type: 'block',
      blockType: 'for',
      children: body,
      repeatCount,
    };
  }

  /**
   * Создать AST-узел для цикла WHILE
   */
  public static createWhileNode(condition: Command, body: ASTNode[]): ASTNode {
    log('LoopsExecutor', 'createWhileNode', `Creating WHILE loop with condition ${condition}`);
    return {
      type: 'block',
      blockType: 'while',
      condition,
      children: body,
    };
  }

  /**
   * Создать AST-узел для цикла REPEAT (бесконечного)
   */
  public static createRepeatNode(body: ASTNode[]): ASTNode {
    log('LoopsExecutor', 'createRepeatNode', 'Creating infinite REPEAT loop');
    return {
      type: 'block',
      blockType: 'repeat',
      children: body,
      repeatCount: 999999,
    };
  }
}
