// src/modules/execution/functions.ts
// ============================================================================
// ПОДДЕРЖКА ФУНКЦИЙ: DEF, CALL, RETURN, PARAM
// ============================================================================
// Реализует:
// - определение функций с параметрами
// - вызов функций с передачей аргументов
// - возврат из функции (опционально со значением)
// - доступ к параметрам внутри тела функции
// ============================================================================
// Функции хранятся в Map, каждый вызов создаёт новый фрейм в стеке вызовов.
// ============================================================================

import { ASTNode, CallFrame } from './types';
import { log, logInfo, logError } from './helpers';
import { gameEvents as eventBus } from '../../core/EventBus';

// Описание функции: тело (AST) и имена параметров
export interface FunctionDef {
  nodes: ASTNode[];
  paramNames: string[];
}

export class FunctionsExecutor {
  private functionDefinitions: Map<string, FunctionDef> = new Map();
  private globalVariables: Map<string, any> = new Map(); // глобальные переменные (если нужны)

  // --------------------------------------------------------------------------
  // DEF – определить функцию
  // --------------------------------------------------------------------------
  public defineFunction(name: string, body: ASTNode[], paramNames: string[] = []): void {
    this.functionDefinitions.set(name, { nodes: body, paramNames });
    logInfo('FunctionsExecutor', 'defineFunction', `Function '${name}' defined with params: ${paramNames.join(', ')}`);
  }

  // --------------------------------------------------------------------------
  // ПОЛУЧИТЬ ОПРЕДЕЛЕНИЕ ФУНКЦИИ
  // --------------------------------------------------------------------------
  public getFunction(name: string): FunctionDef | undefined {
    return this.functionDefinitions.get(name);
  }

  // --------------------------------------------------------------------------
  // CALL – подготовить фрейм для вызова функции
  // Возвращает объект с новым фреймом и телом функции, либо null, если функции нет.
  // --------------------------------------------------------------------------
  public prepareCall(
    funcName: string,
    args: any[],
    currentAST: ASTNode[],
    currentNodeIndex: number
  ): { frame: CallFrame; body: ASTNode[] } | null {
    const funcDef = this.functionDefinitions.get(funcName);
    if (!funcDef) {
      logError('FunctionsExecutor', 'prepareCall', `Function '${funcName}' not defined`);
      return null;
    }

    // Создаём локальные переменные для параметров (передаём значения аргументов)
    const localVars = new Map<string, any>();
    for (let i = 0; i < funcDef.paramNames.length; i++) {
      const paramName = funcDef.paramNames[i];
      const argValue = i < args.length ? args[i] : null;
      localVars.set(paramName, argValue);
    }

    // Фрейм вызова: хранит информацию для возврата и локальные переменные
    const frame: CallFrame = {
      functionName: funcName,
      returnNodeIndex: currentNodeIndex,   // куда вернуться (индекс команды после CALL)
      localVars,
      nodeStack: currentAST,               // AST, из которого был вызван CALL
      nodeIndex: currentNodeIndex,         // индекс CALL (может пригодиться)
      parameters: new Map(),               // можно использовать как alias localVars
    };

    logInfo('FunctionsExecutor', 'prepareCall', `Calling function '${funcName}' with args: ${args}`);
    eventBus.emit('FUNCTION_CALL', { name: funcName, args });
    return { frame, body: funcDef.nodes };
  }

  // --------------------------------------------------------------------------
  // RETURN – подготовить возврат из функции
  // Возвращает новый стек вызовов и значение, которое нужно вернуть.
  // --------------------------------------------------------------------------
  public prepareReturn(callStack: CallFrame[], returnValue: any = null): { newStack: CallFrame[]; frame: CallFrame; returnValue: any } | null {
    if (callStack.length === 0) {
      log('FunctionsExecutor', 'prepareReturn', 'Return with no call stack');
      return null;
    }
    const frame = callStack[callStack.length - 1];
    const newStack = callStack.slice(0, -1);
    logInfo('FunctionsExecutor', 'prepareReturn', `Returning from function '${frame.functionName}' with value: ${returnValue}`);
    eventBus.emit('FUNCTION_RETURN', { name: frame.functionName, value: returnValue });
    return { newStack, frame, returnValue };
  }

  // --------------------------------------------------------------------------
  // PARAM – получить значение параметра (вызывается внутри тела функции)
  // --------------------------------------------------------------------------
  public getParamValue(paramName: string, callStack: CallFrame[]): any {
    if (callStack.length === 0) {
      log('FunctionsExecutor', 'getParamValue', 'No active function call');
      return null;
    }
    const frame = callStack[callStack.length - 1];
    return frame.localVars.get(paramName);
  }

  // --------------------------------------------------------------------------
  // Установить значение глобальной переменной (опционально)
  // --------------------------------------------------------------------------
  public setGlobal(name: string, value: any): void {
    this.globalVariables.set(name, value);
  }

  public getGlobal(name: string): any {
    return this.globalVariables.get(name);
  }
}
