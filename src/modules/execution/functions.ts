// src/modules/execution/functions.ts
// Полная поддержка функций: DEF, CALL, RETURN, PARAM
// С параметрами, локальными переменными и возвращаемыми значениями.

import { ASTNode, CallFrame } from './types';
import { log, logInfo, logError } from './helpers';
import { gameEvents as eventBus } from '../../core/EventBus';

export interface FunctionDef {
  nodes: ASTNode[];
  paramNames: string[];
}

export class FunctionsExecutor {
  private functionDefinitions: Map<string, FunctionDef> = new Map();
  private globalVariables: Map<string, any> = new Map();

  /**
   * DEF — определить функцию с параметрами
   */
  public defineFunction(name: string, body: ASTNode[], paramNames: string[] = []): void {
    this.functionDefinitions.set(name, { nodes: body, paramNames });
    logInfo('FunctionsExecutor', 'defineFunction', `Function '${name}' defined with params: ${paramNames.join(', ')}`);
  }

  /**
   * CALL — вызвать функцию с аргументами
   * Возвращает фрейм для помещения в callStack
   */
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

    // Создаём локальные переменные для параметров
    const localVars = new Map<string, any>();
    for (let i = 0; i < funcDef.paramNames.length; i++) {
      localVars.set(funcDef.paramNames[i], args[i] !== undefined ? args[i] : null);
    }

    const frame: CallFrame = {
      functionName: funcName,
      returnNodeIndex: currentNodeIndex,
      localVars,
      nodeStack: currentAST,
      nodeIndex: currentNodeIndex,
      parameters: new Map(),
    };

    logInfo('FunctionsExecutor', 'prepareCall', `Calling function '${funcName}' with args: ${args}`);
    eventBus.emit('FUNCTION_CALL', { name: funcName, args });
    return { frame, body: funcDef.nodes };
  }

  /**
   * RETURN — вернуться из функции с возвращаемым значением
   */
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

  /**
   * PARAM — получить значение параметра (вызывается внутри функции)
   */
  public getParamValue(paramName: string, callStack: CallFrame[]): any {
    if (callStack.length === 0) {
      log('FunctionsExecutor', 'getParamValue', 'No active function call');
      return null;
    }
    const frame = callStack[callStack.length - 1];
    return frame.localVars.get(paramName);
  }

  public getFunction(name: string): FunctionDef | undefined {
    return this.functionDefinitions.get(name);
  }
}
