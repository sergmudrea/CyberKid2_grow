// src/modules/execution/parser.ts
// AST-парсер: преобразование массива команд в абстрактное синтаксическое дерево
// Поддерживает: циклы, условия, функции с параметрами, классы с методами, параллелизм.

import { Command } from '../../types/index';
import { ASTNode } from './types';
import { log, logError, logInfo } from './helpers';

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
      // Циклы
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

      // Условия
      case Command.IF_WALL:
      case Command.IF_HOLE:
      case Command.IF_MONSTER:
      case Command.IF_COIN:
      case Command.IF_KEY:
      case Command.IF_NO_KEY:
        return this.parseIf(cmd);

      // Функции
      case Command.DEF:
        return this.parseDef();
      case Command.CALL:
        return this.parseCall();
      case Command.RETURN:
        return { type: 'command', command: cmd };
      case Command.PARAM:
        return this.parseParam();

      // ООП
      case Command.CLASS:
        return this.parseClass();
      case Command.NEW:
        return this.parseNew();
      case Command.METHOD:
        return this.parseMethod();

      // Параллелизм
      case Command.CLONE:
        return { type: 'command', command: cmd };
      case Command.JOIN:
        return { type: 'command', command: cmd };

      // Обычные команды
      default:
        return { type: 'command', command: cmd };
    }
  }

  private parseForN(): ASTNode {
    // FOR_N [число] ... END
    let repeatCount = 3;
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      const num = parseInt(nextCmd as unknown as string, 10);
      if (!isNaN(num)) {
        repeatCount = num;
        this.index++; // пропускаем число
      }
    }
    this.index++; // пропускаем FOR_N
    const children = this.parseBlockUntil(Command.END);
    log('ASTParser', 'parseForN', `FOR_N loop with ${repeatCount} repetitions, ${children.length} children`);
    return {
      type: 'block',
      blockType: 'for',
      children,
      repeatCount,
    };
  }

  private parseForLoop(): ASTNode {
    // FOR_LOOP [from] [to] ... END
    let from = 0, to = 10;
    if (this.index + 2 < this.commands.length) {
      const nextCmd1 = this.commands[this.index + 1];
      const nextCmd2 = this.commands[this.index + 2];
      const fromNum = parseInt(nextCmd1 as unknown as string, 10);
      const toNum = parseInt(nextCmd2 as unknown as string, 10);
      if (!isNaN(fromNum)) from = fromNum;
      if (!isNaN(toNum)) to = toNum;
      this.index += 2;
    }
    this.index++; // пропускаем FOR_LOOP
    const children = this.parseBlockUntil(Command.END);
    log('ASTParser', 'parseForLoop', `FOR_LOOP from ${from} to ${to}, ${children.length} children`);
    return {
      type: 'block',
      blockType: 'for',
      children,
      repeatCount: Math.max(0, to - from),
    };
  }

  private parseWhile(condition: Command): ASTNode {
    this.index++; // пропускаем WHILE_*
    const children = this.parseBlockUntil(Command.END);
    log('ASTParser', 'parseWhile', `WHILE loop with condition ${condition}, ${children.length} children`);
    return {
      type: 'block',
      blockType: 'while',
      condition,
      children,
    };
  }

  private parseRepeat(): ASTNode {
    this.index++; // пропускаем REPEAT
    const children = this.parseBlockUntil(Command.END);
    log('ASTParser', 'parseRepeat', `REPEAT infinite loop, ${children.length} children`);
    return {
      type: 'block',
      blockType: 'repeat',
      children,
      repeatCount: 999999,
    };
  }

  private parseIf(condition: Command): ASTNode {
    this.index++; // пропускаем IF_*
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
        if (depth === 0) {
          break;
        }
      }
      if (depth > 0 && (!hasElse || depth > 1)) {
        const node = this.parseCommand(cmd);
        if (node) ifChildren.push(node);
      }
      this.index++;
    }

    log('ASTParser', 'parseIf', `IF condition ${condition}, ${ifChildren.length} if-children, ${elseChildren.length} else-children`);

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
    // DEF имя_функции [PARAM имя1] [PARAM имя2] ... END
    let funcName = '';
    const paramNames: string[] = [];
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      funcName = nextCmd as unknown as string;
      this.index++;
    }
    this.index++; // пропускаем DEF
    // Читаем параметры (PARAM)
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
    logInfo('ASTParser', 'parseDef', `Function definition: ${funcName} with params ${paramNames.join(', ')} and ${children.length} children`);
    return {
      type: 'function',
      functionName: funcName,
      parameters: paramNames,
      children,
    };
  }

  private parseCall(): ASTNode {
    // CALL имя_функции [arg1] [arg2] ...
    let funcName = '';
    const args: any[] = [];
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      funcName = nextCmd as unknown as string;
      this.index++;
    }
    this.index++; // пропускаем CALL
    // Читаем аргументы (простые числа или строки)
    while (this.index < this.commands.length) {
      const cmd = this.commands[this.index];
      if (cmd === Command.PARAM || cmd === Command.END) break;
      const num = parseFloat(cmd as unknown as string);
      args.push(isNaN(num) ? (cmd as string) : num);
      this.index++;
    }
    log('ASTParser', 'parseCall', `Function call: ${funcName} with args ${args.join(', ')}`);
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
    log('ASTParser', 'parseParam', `Parameter: ${paramName}`);
    return {
      type: 'command',
      command: Command.PARAM,
      functionName: paramName,
    };
  }

  private parseClass(): ASTNode {
    // CLASS имя_класса ... END
    let className = '';
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      className = nextCmd as unknown as string;
      this.index++;
    }
    this.index++; // пропускаем CLASS
    const children = this.parseBlockUntil(Command.END);
    logInfo('ASTParser', 'parseClass', `Class definition: ${className} with ${children.length} children`);
    return {
      type: 'class',
      className,
      children,
    };
  }

  private parseNew(): ASTNode {
    // NEW имя_класса [arg1] [arg2] ...
    let className = '';
    const args: any[] = [];
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      className = nextCmd as unknown as string;
      this.index++;
    }
    this.index++; // пропускаем NEW
    while (this.index < this.commands.length) {
      const cmd = this.commands[this.index];
      if (cmd === Command.PARAM || cmd === Command.END) break;
      const num = parseFloat(cmd as unknown as string);
      args.push(isNaN(num) ? (cmd as string) : num);
      this.index++;
    }
    log('ASTParser', 'parseNew', `Create new instance of class: ${className} with args ${args.join(', ')}`);
    return {
      type: 'command',
      command: Command.NEW,
      className,
      parameters: args.map(String),
    };
  }

  private parseMethod(): ASTNode {
    // METHOD имя_метода [PARAM имя1] ... END
    let methodName = '';
    const paramNames: string[] = [];
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      methodName = nextCmd as unknown as string;
      this.index++;
    }
    this.index++; // пропускаем METHOD
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
    log('ASTParser', 'parseMethod', `Method definition: ${methodName} with params ${paramNames.join(', ')} and ${children.length} children`);
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
        if (depth === 0) {
          break;
        }
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
           cmd === Command.DEF ||
           cmd === Command.CLASS;
  }
}
