// src/modules/execution/parser.ts
// ============================================================================
// AST ПАРСЕР – ПРЕОБРАЗОВАНИЕ КОМАНД В АБСТРАКТНОЕ ДЕРЕВО (ПАТЧ 2.0)
// ============================================================================
// - Поддерживает все новые команды: MOVE_FORWARD, MOVE_BACKWARD, TURN_LEFT, TURN_RIGHT,
//   TURN_AROUND, SYNC_BODY, SET_ANGLE, RELATIVE_TURN, SHOW_AIM, IF_ANGLE, WHILE_NOT_FACING
// - Обрабатывает числовые аргументы для SET_ANGLE, RELATIVE_TURN, IF_ANGLE
// - Полностью обратно совместим со старыми уровнями
// ============================================================================

import { Command } from '../../types/index';
import { ASTNode } from './types';
import { log, logInfo, logError } from './helpers';

export class ASTParser {
  private commands: Command[];
  private index: number = 0;

  constructor(commands: Command[]) {
    this.commands = commands;
  }

  public parse(): ASTNode[] {
    logInfo('ASTParser', 'parse', `Starting parsing of ${this.commands.length} commands`);
    const nodes = this.parseBlock();
    logInfo('ASTParser', 'parse', `Parsing complete. Generated ${nodes.length} AST nodes`);
    return nodes;
  }

  private parseBlock(): ASTNode[] {
    const nodes: ASTNode[] = [];

    while (this.index < this.commands.length) {
      const cmd = this.commands[this.index];
      if (cmd === Command.END) {
        break;
      }
      const node = this.parseCommand(cmd);
      if (node) {
        nodes.push(node);
      }
      this.index++;
    }

    return nodes;
  }

  private parseCommand(cmd: Command): ASTNode | null {
    switch (cmd) {
      // ---------- НОВЫЕ КОМАНДЫ ПАТЧА 2.0 ----------
      case Command.MOVE_FORWARD:
      case Command.MOVE_BACKWARD:
      case Command.TURN_LEFT:
      case Command.TURN_RIGHT:
      case Command.TURN_AROUND:
      case Command.SYNC_BODY:
      case Command.SHOW_AIM:
        return { type: 'command', command: cmd };

      case Command.SET_ANGLE:
        return this.parseSetAngle();

      case Command.RELATIVE_TURN:
        return this.parseRelativeTurn();

      case Command.IF_ANGLE:
        return this.parseIfAngle();

      case Command.WHILE_NOT_FACING:
        return this.parseWhileNotFacing();

      // ---------- СТАРЫЕ КОМАНДЫ (без изменений) ----------
      case Command.FOR_N:
        return this.parseForN();
      case Command.FOR_LOOP:
        return this.parseForLoop();
      case Command.WHILE_MONSTER:
      case Command.WHILE_WALL:
      case Command.WHILE_HOLE:
        return this.parseWhile(cmd);
      case Command.REPEAT:
        return this.parseRepeat();
      case Command.IF_WALL:
      case Command.IF_HOLE:
      case Command.IF_MONSTER:
      case Command.IF_COIN:
      case Command.IF_KEY:
      case Command.IF_NO_KEY:
        return this.parseIf(cmd);
      case Command.DEF:
        return this.parseDef();
      case Command.CALL:
        return this.parseCall();
      case Command.RETURN:
        return { type: 'command', command: cmd };
      case Command.PARAM:
        return this.parseParam();
      case Command.CLASS:
        return this.parseClass();
      case Command.NEW:
        return this.parseNew();
      case Command.METHOD:
        return this.parseMethod();
      case Command.CLONE:
      case Command.JOIN:
        return { type: 'command', command: cmd };
      default:
        return { type: 'command', command: cmd };
    }
  }

  // --------------------------------------------------------------------------
  // НОВЫЕ МЕТОДЫ ПАРСИНГА
  // --------------------------------------------------------------------------

  private parseSetAngle(): ASTNode {
    // SET_ANGLE <число>
    let angle = 0;
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      const num = parseFloat(nextCmd as unknown as string);
      if (!isNaN(num)) {
        angle = num;
        this.index++; // пропускаем число
      }
    }
    this.index++; // пропускаем SET_ANGLE
    log('ASTParser', 'parseSetAngle', `SET_ANGLE ${angle}`);
    return {
      type: 'command',
      command: Command.SET_ANGLE,
      parameters: [angle.toString()],
    };
  }

  private parseRelativeTurn(): ASTNode {
    // RELATIVE_TURN <число>
    let delta = 0;
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      const num = parseFloat(nextCmd as unknown as string);
      if (!isNaN(num)) {
        delta = num;
        this.index++;
      }
    }
    this.index++;
    log('ASTParser', 'parseRelativeTurn', `RELATIVE_TURN ${delta}`);
    return {
      type: 'command',
      command: Command.RELATIVE_TURN,
      parameters: [delta.toString()],
    };
  }

  private parseIfAngle(): ASTNode {
    // IF_ANGLE <число> ... END
    let angle = 0;
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      const num = parseFloat(nextCmd as unknown as string);
      if (!isNaN(num)) {
        angle = num;
        this.index++;
      }
    }
    this.index++; // пропускаем IF_ANGLE
    const children = this.parseBlockUntil(Command.END);
    log('ASTParser', 'parseIfAngle', `IF_ANGLE ${angle}, ${children.length} children`);
    return {
      type: 'block',
      blockType: 'if',
      condition: Command.IF_ANGLE,
      conditionValue: angle,
      children,
    };
  }

  private parseWhileNotFacing(): ASTNode {
    // WHILE_NOT_FACING ... END
    this.index++; // пропускаем WHILE_NOT_FACING
    const children = this.parseBlockUntil(Command.END);
    log('ASTParser', 'parseWhileNotFacing', `WHILE_NOT_FACING, ${children.length} children`);
    return {
      type: 'block',
      blockType: 'while',
      condition: Command.WHILE_NOT_FACING,
      children,
    };
  }

  // --------------------------------------------------------------------------
  // СТАРЫЕ МЕТОДЫ (без изменений, только для полноты)
  // --------------------------------------------------------------------------
  private parseForN(): ASTNode {
    let repeatCount = 3;
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      const num = parseInt(nextCmd as unknown as string, 10);
      if (!isNaN(num)) {
        repeatCount = num;
        this.index++;
      }
    }
    this.index++;
    const children = this.parseBlockUntil(Command.END);
    return {
      type: 'block',
      blockType: 'for',
      children,
      repeatCount,
    };
  }

  private parseForLoop(): ASTNode {
    let from = 0, to = 10;
    if (this.index + 2 < this.commands.length) {
      const next1 = this.commands[this.index + 1];
      const next2 = this.commands[this.index + 2];
      const fromNum = parseInt(next1 as unknown as string, 10);
      const toNum = parseInt(next2 as unknown as string, 10);
      if (!isNaN(fromNum)) from = fromNum;
      if (!isNaN(toNum)) to = toNum;
      this.index += 2;
    }
    this.index++;
    const children = this.parseBlockUntil(Command.END);
    return {
      type: 'block',
      blockType: 'for',
      children,
      repeatCount: Math.max(0, to - from),
    };
  }

  private parseWhile(condition: Command): ASTNode {
    this.index++;
    const children = this.parseBlockUntil(Command.END);
    return {
      type: 'block',
      blockType: 'while',
      condition,
      children,
    };
  }

  private parseRepeat(): ASTNode {
    this.index++;
    const children = this.parseBlockUntil(Command.END);
    return {
      type: 'block',
      blockType: 'repeat',
      children,
      repeatCount: 999999,
    };
  }

  private parseIf(condition: Command): ASTNode {
    this.index++;
    const ifChildren: ASTNode[] = [];
    let elseChildren: ASTNode[] = [];

    let depth = 1;
    let hasElse = false;

    while (this.index < this.commands.length && depth > 0) {
      const cmd = this.commands[this.index];
      if (this.isBlockStart(cmd)) {
        depth++;
      } else if (cmd === Command.ELSE && depth === 1) {
        hasElse = true;
        this.index++;
        elseChildren = this.parseBlockUntil(Command.END);
        break;
      } else if (cmd === Command.END) {
        depth--;
        if (depth === 0) break;
      }
      if (depth > 0 && (!hasElse || depth > 1)) {
        const node = this.parseCommand(cmd);
        if (node) ifChildren.push(node);
      }
      this.index++;
    }

    const ifNode: ASTNode = {
      type: 'block',
      blockType: 'if',
      condition,
      children: ifChildren,
    };

    if (hasElse && elseChildren.length > 0) {
      const elseNode: ASTNode = {
        type: 'block',
        blockType: 'else',
        children: elseChildren,
      };
      return {
        type: 'block',
        blockType: 'if_else',
        children: [ifNode, elseNode],
      };
    }

    return ifNode;
  }

  private parseDef(): ASTNode {
    let funcName = '';
    const paramNames: string[] = [];
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      funcName = nextCmd as unknown as string;
      this.index++;
    }
    this.index++;
    while (this.index < this.commands.length) {
      const cmd = this.commands[this.index];
      if (cmd === Command.PARAM && this.index + 1 < this.commands.length) {
        const paramName = this.commands[this.index + 1] as unknown as string;
        paramNames.push(paramName);
        this.index += 2;
      } else {
        break;
      }
    }
    const children = this.parseBlockUntil(Command.END);
    return {
      type: 'function',
      functionName: funcName,
      parameters: paramNames,
      children,
    };
  }

  private parseCall(): ASTNode {
    let funcName = '';
    const args: any[] = [];
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      funcName = nextCmd as unknown as string;
      this.index++;
    }
    this.index++;
    while (this.index < this.commands.length) {
      const cmd = this.commands[this.index];
      if (cmd === Command.PARAM || cmd === Command.END) break;
      const num = parseFloat(cmd as unknown as string);
      args.push(isNaN(num) ? (cmd as string) : num);
      this.index++;
    }
    return {
      type: 'command',
      command: Command.CALL,
      functionName: funcName,
      parameters: args.map(String),
    };
  }

  private parseParam(): ASTNode {
    let paramName = '';
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      paramName = nextCmd as unknown as string;
      this.index++;
    }
    return {
      type: 'command',
      command: Command.PARAM,
      functionName: paramName,
    };
  }

  private parseClass(): ASTNode {
    let className = '';
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      className = nextCmd as unknown as string;
      this.index++;
    }
    this.index++;
    const children = this.parseBlockUntil(Command.END);
    return {
      type: 'class',
      className,
      children,
    };
  }

  private parseNew(): ASTNode {
    let className = '';
    const args: any[] = [];
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      className = nextCmd as unknown as string;
      this.index++;
    }
    this.index++;
    while (this.index < this.commands.length) {
      const cmd = this.commands[this.index];
      if (cmd === Command.PARAM || cmd === Command.END) break;
      const num = parseFloat(cmd as unknown as string);
      args.push(isNaN(num) ? (cmd as string) : num);
      this.index++;
    }
    return {
      type: 'command',
      command: Command.NEW,
      className,
      parameters: args.map(String),
    };
  }

  private parseMethod(): ASTNode {
    let methodName = '';
    const paramNames: string[] = [];
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      methodName = nextCmd as unknown as string;
      this.index++;
    }
    this.index++;
    while (this.index < this.commands.length) {
      const cmd = this.commands[this.index];
      if (cmd === Command.PARAM && this.index + 1 < this.commands.length) {
        const paramName = this.commands[this.index + 1] as unknown as string;
        paramNames.push(paramName);
        this.index += 2;
      } else {
        break;
      }
    }
    const children = this.parseBlockUntil(Command.END);
    return {
      type: 'method',
      methodName,
      parameters: paramNames,
      children,
    };
  }

  private parseBlockUntil(endMarker: Command): ASTNode[] {
    const nodes: ASTNode[] = [];
    let depth = 1;

    while (this.index < this.commands.length && depth > 0) {
      const cmd = this.commands[this.index];
      if (this.isBlockStart(cmd)) {
        depth++;
      } else if (cmd === endMarker) {
        depth--;
        if (depth === 0) break;
      }
      if (depth > 0 && cmd !== endMarker) {
        const node = this.parseCommand(cmd);
        if (node) nodes.push(node);
      }
      this.index++;
    }

    return nodes;
  }

  private isBlockStart(cmd: Command): boolean {
    return cmd === Command.FOR_N ||
           cmd === Command.FOR_LOOP ||
           cmd === Command.WHILE_MONSTER ||
           cmd === Command.WHILE_WALL ||
           cmd === Command.WHILE_HOLE ||
           cmd === Command.REPEAT ||
           cmd === Command.IF_WALL ||
           cmd === Command.IF_HOLE ||
           cmd === Command.IF_MONSTER ||
           cmd === Command.IF_COIN ||
           cmd === Command.IF_KEY ||
           cmd === Command.IF_NO_KEY ||
           cmd === Command.IF_ANGLE ||
           cmd === Command.WHILE_NOT_FACING ||
           cmd === Command.DEF ||
           cmd === Command.CLASS;
  }
}
