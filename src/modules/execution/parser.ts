// src/modules/execution/parser.ts
// ============================================================================
// AST-ПАРСЕР: ПРЕОБРАЗОВАНИЕ МАССИВА КОМАНД В АБСТРАКТНОЕ СИНТАКСИЧЕСКОЕ ДЕРЕВО
// ============================================================================
// Поддерживает:
// - циклы: FOR_N, FOR_LOOP, WHILE_*, REPEAT
// - условия: IF_*, ELSE
// - функции: DEF, CALL, RETURN, PARAM
// - классы и методы: CLASS, NEW, METHOD
// - обычные команды
// ============================================================================
// Результат парсинга — массив ASTNode, который затем выполняется ASTRunner.
// ============================================================================

import { Command } from '../../types/index';
import { ASTNode } from './types';
import { log, logError, logInfo } from './helpers';

export class ASTParser {
  private commands: Command[];
  private index: number = 0;

  constructor(commands: Command[]) {
    this.commands = commands;
  }

  // --------------------------------------------------------------------------
  // ОСНОВНОЙ МЕТОД: ПАРСИТ ВСЕ КОМАНДЫ В AST
  // --------------------------------------------------------------------------
  public parse(): ASTNode[] {
    logInfo('ASTParser', 'parse', `Starting parsing of ${this.commands.length} commands`);
    const nodes = this.parseBlock();
    logInfo('ASTParser', 'parse', `Parsing complete. Generated ${nodes.length} AST nodes`);
    return nodes;
  }

  // --------------------------------------------------------------------------
  // ПАРСИТ БЛОК КОМАНД ДО КОНЦА ИЛИ ДО ВСТРЕЧИ END (при вложенных блоках)
  // --------------------------------------------------------------------------
  private parseBlock(): ASTNode[] {
    const nodes: ASTNode[] = [];

    while (this.index < this.commands.length) {
      const cmd = this.commands[this.index];
      // Если встретили END, выходим (этот END будет обработан в parseBlockUntil)
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

  // --------------------------------------------------------------------------
  // ПАРСИТ ОДНУ КОМАНДУ (МОЖЕТ ВЕРНУТЬ УЗЕЛ ИЛИ NULL)
  // --------------------------------------------------------------------------
  private parseCommand(cmd: Command): ASTNode | null {
    switch (cmd) {
      // ---------- Циклы ----------
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

      // ---------- Условия ----------
      case Command.IF_WALL:
      case Command.IF_HOLE:
      case Command.IF_MONSTER:
      case Command.IF_COIN:
      case Command.IF_KEY:
      case Command.IF_NO_KEY:
        return this.parseIf(cmd);

      // ---------- Функции ----------
      case Command.DEF:
        return this.parseDef();
      case Command.CALL:
        return this.parseCall();
      case Command.RETURN:
        return { type: 'command', command: cmd };
      case Command.PARAM:
        return this.parseParam();

      // ---------- ООП ----------
      case Command.CLASS:
        return this.parseClass();
      case Command.NEW:
        return this.parseNew();
      case Command.METHOD:
        return this.parseMethod();

      // ---------- Параллелизм (простые команды) ----------
      case Command.CLONE:
      case Command.JOIN:
        return { type: 'command', command: cmd };

      // ---------- Обычные команды (движение, инвентарь, инструменты и т.д.) ----------
      default:
        return { type: 'command', command: cmd };
    }
  }

  // --------------------------------------------------------------------------
  // ПАРСИНГ FOR_N (например: FOR_N 5 ... END)
  // --------------------------------------------------------------------------
  private parseForN(): ASTNode {
    let repeatCount = 3; // значение по умолчанию
    // Если следующая команда — число, используем его как количество повторений
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      const num = parseInt(nextCmd as unknown as string, 10);
      if (!isNaN(num)) {
        repeatCount = num;
        this.index++; // пропускаем число
      }
    }
    this.index++; // пропускаем саму команду FOR_N
    const children = this.parseBlockUntil(Command.END);
    log('ASTParser', 'parseForN', `FOR_N loop with ${repeatCount} repetitions, ${children.length} children`);
    return {
      type: 'block',
      blockType: 'for',
      children,
      repeatCount,
    };
  }

  // --------------------------------------------------------------------------
  // ПАРСИНГ FOR_LOOP (например: FOR_LOOP 1 10 ... END)
  // --------------------------------------------------------------------------
  private parseForLoop(): ASTNode {
    let from = 0, to = 10;
    if (this.index + 2 < this.commands.length) {
      const nextCmd1 = this.commands[this.index + 1];
      const nextCmd2 = this.commands[this.index + 2];
      const fromNum = parseInt(nextCmd1 as unknown as string, 10);
      const toNum = parseInt(nextCmd2 as unknown as string, 10);
      if (!isNaN(fromNum)) from = fromNum;
      if (!isNaN(toNum)) to = toNum;
      this.index += 2; // пропускаем оба числа
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

  // --------------------------------------------------------------------------
  // ПАРСИНГ WHILE (например: WHILE_WALL ... END)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // ПАРСИНГ REPEAT (бесконечный цикл)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // ПАРСИНГ IF (с поддержкой ELSE)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // ПАРСИНГ DEF (определение функции)
  // --------------------------------------------------------------------------
  private parseDef(): ASTNode {
    let funcName = '';
    const paramNames: string[] = [];
    // После DEF идёт имя функции
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      funcName = nextCmd as unknown as string;
      this.index++;
    }
    this.index++; // пропускаем DEF
    // Собираем параметры: PARAM имя1 PARAM имя2 ...
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

  // --------------------------------------------------------------------------
  // ПАРСИНГ CALL (вызов функции)
  // --------------------------------------------------------------------------
  private parseCall(): ASTNode {
    let funcName = '';
    const args: any[] = [];
    if (this.index + 1 < this.commands.length) {
      const nextCmd = this.commands[this.index + 1];
      funcName = nextCmd as unknown as string;
      this.index++;
    }
    this.index++; // пропускаем CALL
    // Читаем аргументы (числа или строки) до следующей управляющей команды
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

  // --------------------------------------------------------------------------
  // ПАРСИНГ PARAM (объявление параметра)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // ПАРСИНГ CLASS (определение класса)
  // --------------------------------------------------------------------------
  private parseClass(): ASTNode {
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

  // --------------------------------------------------------------------------
  // ПАРСИНГ NEW (создание экземпляра класса)
  // --------------------------------------------------------------------------
  private parseNew(): ASTNode {
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

  // --------------------------------------------------------------------------
  // ПАРСИНГ METHOD (определение метода внутри класса)
  // --------------------------------------------------------------------------
  private parseMethod(): ASTNode {
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

  // --------------------------------------------------------------------------
  // ПАРСИТ БЛОК ДО УКАЗАННОГО МАРКЕРА (например, END)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // ПРОВЕРКА, ЯВЛЯЕТСЯ ЛИ КОМАНДА НАЧАЛОМ БЛОКА
  // --------------------------------------------------------------------------
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
