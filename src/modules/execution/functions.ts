// src/modules/execution/functions.ts
// Команды функций: CALL, DEF, RETURN, PARAM

import { ASTNode, CallFrame } from './types';
import { log, logInfo, logError } from './helpers';
import { gameEvents as eventBus } from '../../core/EventBus';

export class FunctionsExecutor {
  private functionDefinitions: Map<string, ASTNode[]> = new Map();
  private localVariables: Map<string, any> = new Map();

  /**
   * DEF — определить функцию (сохранить тело функции)
   */
  public defineFunction(name: string, body: ASTNode[]): void {
    this.functionDefinitions.set(name, body);
    logInfo('FunctionsExecutor', 'defineFunction', `Function '${name}' defined with ${body.length} nodes`);
  }

  /**
   * CALL — вызвать функцию
   */
  public executeCall(
    currentAST: ASTNode[],
    currentNodeIndex: number,
    onCall: (newAST: ASTNode[], newIndex: number, frame: CallFrame) => void
  ): 'ok' {
    const node = currentAST[currentNodeIndex];
    const funcName = node.functionName;
    if (!funcName) {
      log('FunctionsExecutor', 'executeCall', 'No function name provided');
      return 'ok';
    }

    const funcBody = this.functionDefinitions.get(funcName);
    if (!funcBody) {
      logError('FunctionsExecutor', 'executeCall', `Function '${funcName}' not defined`);
      return 'ok';
    }

    // Сохраняем текущий стек вызовов (будет в раннере)
    const frame: CallFrame = {
      functionName: funcName,
      returnNodeIndex: currentNodeIndex,
      localVars: new Map(this.localVariables),
      nodeStack: currentAST,
      nodeIndex: currentNodeIndex,
      parameters: new Map(),
    };

    logInfo('FunctionsExecutor', 'executeCall', `Calling function '${funcName}'`);
    eventBus.emit('FUNCTION_CALL', { name: funcName });

    onCall(funcBody, -1, frame);
    return 'ok';
  }

  /**
   * RETURN — вернуться из функции
   */
  public executeReturn(
    callStack: CallFrame[],
    onReturn: (newStack: CallFrame[], newAST: ASTNode[], newIndex: number) => void
  ): 'ok' {
    if (callStack.length === 0) {
      log('FunctionsExecutor', 'executeReturn', 'Return with no call stack');
      return 'ok';
    }

    const frame = callStack[callStack.length - 1];
    this.localVariables = frame.localVars;
    const newStack = callStack.slice(0, -1);
    
    logInfo('FunctionsExecutor', 'executeReturn', `Returning from function '${frame.functionName}'`);
    eventBus.emit('FUNCTION_RETURN', { name: frame.functionName });

    onReturn(newStack, frame.nodeStack, frame.returnNodeIndex);
    return 'ok';
  }

  /**
   * PARAM — определить параметр функции (сохранить в локальные переменные)
   */
  public executeParam(paramName: string, paramValue: any): 'ok' {
    if (paramName) {
      this.localVariables.set(paramName, paramValue);
      log('FunctionsExecutor', 'executeParam', `Parameter '${paramName}' set to ${paramValue}`);
    }
    return 'ok';
  }

  public getFunction(name: string): ASTNode[] | undefined {
    return this.functionDefinitions.get(name);
  }

  public getLocalVariable(name: string): any {
    return this.localVariables.get(name);
  }

  public setLocalVariable(name: string, value: any): void {
    this.localVariables.set(name, value);
  }
}
