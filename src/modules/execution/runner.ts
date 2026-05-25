// src/modules/execution/runner.ts
// Основной цикл выполнения AST

import { ASTNode, CallFrame, ExecutionResult } from './types';
import { ConditionEvaluator } from './conditions';
import { MovementExecutor } from './movement';
import { InventoryExecutor } from './inventory';
import { ToolsExecutor } from './tools';
import { CombatExecutor } from './combat';
import { TimeExecutor } from './time';
import { FunctionsExecutor } from './functions';
import { OOPExecutor } from './oop';
import { ParallelismExecutor } from './parallelism';
import { InteractionsExecutor } from './interactions';
import { BlackBoxProcessor } from './blackbox';
import { TilesExecutor } from './tiles';
import { MonstersExecutor } from './monsters';
import { delay, log, logError, logInfo, calculateStars } from './helpers';
import { gameEvents as eventBus } from '../../core/EventBus';
import { LevelData, Point, Inventory, Monster, Command } from '../../types/index';
import { logger } from '../../core/Logger';

export interface RunnerContext {
  level: LevelData;
  player: any;
  inventory: Inventory;
  ast: ASTNode[];
  maxSteps: number;
  speedMultiplier: number;
  explorationMode: boolean;
}

export class ASTRunner {
  private context: RunnerContext;
  private currentAST: ASTNode[];
  private currentNodeIndex: number;
  private callStack: CallFrame[];
  private stepCount: number;
  private backdoorUsed: boolean;
  private status: 'idle' | 'running' | 'paused' | 'finished' | 'error';
  private waitTimer: number | null;
  private lastDirection: 'up' | 'down' | 'left' | 'right';

  // Sub-executors
  private conditionEvaluator: ConditionEvaluator;
  private movementExecutor: MovementExecutor;
  private inventoryExecutor: InventoryExecutor;
  private toolsExecutor: ToolsExecutor;
  private combatExecutor: CombatExecutor;
  private timeExecutor: TimeExecutor;
  private functionsExecutor: FunctionsExecutor;
  private oopExecutor: OOPExecutor;
  private parallelismExecutor: ParallelismExecutor;
  private interactionsExecutor: InteractionsExecutor;
  private blackBoxProcessor: BlackBoxProcessor;
  private tilesExecutor: TilesExecutor;
  private monstersExecutor: MonstersExecutor;

  constructor(context: RunnerContext) {
    this.context = context;
    this.currentAST = [...context.ast];
    this.currentNodeIndex = 0;
    this.callStack = [];
    this.stepCount = 0;
    this.backdoorUsed = false;
    this.status = 'idle';
    this.waitTimer = null;
    this.lastDirection = 'right';

    // Инициализация под-executors
    this.conditionEvaluator = new ConditionEvaluator({
      playerPos: context.player.getPosition(),
      playerDir: 'right',
      coinPos: context.level.coinPos,
      inventoryKeys: context.inventory.keys,
      map: context.level.map,
      monsters: context.level.objects.monsters,
      explorationMode: context.explorationMode,
    });

    this.movementExecutor = new MovementExecutor(context.level, context.player, context.inventory);
    this.inventoryExecutor = new InventoryExecutor(context.level, context.player, context.inventory);
    this.toolsExecutor = new ToolsExecutor(context.level, context.player, context.inventory);
    this.combatExecutor = new CombatExecutor(context.level, context.player, context.inventory);
    this.timeExecutor = new TimeExecutor();
    this.functionsExecutor = new FunctionsExecutor();
    this.oopExecutor = new OOPExecutor();
    this.parallelismExecutor = new ParallelismExecutor(context.level, context.player, context.inventory);
    this.interactionsExecutor = new InteractionsExecutor(context.level, context.player, context.inventory);
    this.blackBoxProcessor = new BlackBoxProcessor(context.inventory);
    this.tilesExecutor = new TilesExecutor(context.level, context.player, context.inventory);
    this.monstersExecutor = new MonstersExecutor(context.level, context.player, context.inventory);

    logInfo('ASTRunner', 'constructor', 'ASTRunner initialized');
  }

  public async run(): Promise<ExecutionResult> {
    this.status = 'running';
    eventBus.emit('EXECUTION_START');

    while (this.status === 'running') {
      if (this.stepCount >= this.context.maxSteps) {
        logError('ASTRunner', 'run', 'Max steps exceeded');
        this.status = 'error';
        break;
      }

      const result = await this.executeCurrentNode();

      if (result === 'dead') {
        this.status = 'error';
        break;
      }
      if (result === 'wait') {
        return this.buildResult(false);
      }
      if (result === 'finished') {
        this.status = 'finished';
        break;
      }
    }

    const success = this.status === 'finished';
    const isWin = this.checkVictory();
    const result = this.buildResult(success && isWin);

    eventBus.emit('EXECUTION_FINISHED', { success: success && isWin, result });
    return result;
  }

  private async executeCurrentNode(): Promise<'ok' | 'dead' | 'wait' | 'finished'> {
    if (this.currentNodeIndex >= this.currentAST.length) {
      if (this.callStack.length > 0) {
        const frame = this.callStack.pop()!;
        this.currentAST = frame.nodeStack;
        this.currentNodeIndex = frame.returnNodeIndex + 1;
        return 'ok';
      }
      return 'finished';
    }

    const node = this.currentAST[this.currentNodeIndex];
    const result = await this.executeNode(node);

    if (result === 'ok') {
      this.currentNodeIndex++;
    }

    return result;
  }

  private async executeNode(node: ASTNode): Promise<'ok' | 'dead' | 'wait' | 'finished'> {
    eventBus.emit('EXECUTION_STEP', {
      stepIndex: this.stepCount,
      command: node.command,
      pos: this.context.player.getPosition(),
    });

    if (node.type === 'command') {
      return await this.executeCommand(node.command!);
    }

    if (node.type === 'block') {
      return await this.executeBlock(node);
    }

    if (node.type === 'function') {
      // Определение функции — сохраняем в FunctionsExecutor
      if (node.functionName) {
        this.functionsExecutor.defineFunction(node.functionName, node.children || []);
      }
      return 'ok';
    }

    if (node.type === 'class') {
      // Определение класса — сохраняем в OOPExecutor
      if (node.className) {
        this.oopExecutor.defineClass(node.className, node.children || []);
      }
      return 'ok';
    }

    if (node.type === 'method') {
      return 'ok';
    }

    return 'ok';
  }

  private async executeBlock(node: ASTNode): Promise<'ok' | 'dead' | 'wait' | 'finished'> {
    if (node.blockType === 'for') {
      for (let i = 0; i < (node.repeatCount || 1); i++) {
        const savedAST = this.currentAST;
        const savedIndex = this.currentNodeIndex;
        this.currentAST = node.children || [];
        this.currentNodeIndex = 0;
        const result = await this.runSubAST();
        this.currentAST = savedAST;
        this.currentNodeIndex = savedIndex;
        if (result !== 'ok') return result;
        if (this.stepCount >= this.context.maxSteps) return 'dead';
      }
      return 'ok';
    }

    if (node.blockType === 'while') {
      let condition = true;
      while (condition && this.status === 'running') {
        condition = await this.conditionEvaluator.evaluate(node.condition!);
        if (!condition) break;
        const savedAST = this.currentAST;
        const savedIndex = this.currentNodeIndex;
        this.currentAST = node.children || [];
        this.currentNodeIndex = 0;
        const result = await this.runSubAST();
        this.currentAST = savedAST;
        this.currentNodeIndex = savedIndex;
        if (result !== 'ok') return result;
        if (this.stepCount >= this.context.maxSteps) return 'dead';
      }
      return 'ok';
    }

    if (node.blockType === 'repeat') {
      while (this.status === 'running') {
        const savedAST = this.currentAST;
        const savedIndex = this.currentNodeIndex;
        this.currentAST = node.children || [];
        this.currentNodeIndex = 0;
        const result = await this.runSubAST();
        this.currentAST = savedAST;
        this.currentNodeIndex = savedIndex;
        if (result !== 'ok') return result;
        if (this.stepCount >= this.context.maxSteps) return 'dead';
      }
      return 'ok';
    }

    if (node.blockType === 'if') {
      const condition = await this.conditionEvaluator.evaluate(node.condition!);
      if (condition) {
        const savedAST = this.currentAST;
        const savedIndex = this.currentNodeIndex;
        this.currentAST = node.children || [];
        this.currentNodeIndex = 0;
        const result = await this.runSubAST();
        this.currentAST = savedAST;
        this.currentNodeIndex = savedIndex;
        return result;
      }
      return 'ok';
    }

    if (node.blockType === 'else') {
      const savedAST = this.currentAST;
        const savedIndex = this.currentNodeIndex;
        this.currentAST = node.children || [];
        this.currentNodeIndex = 0;
        const result = await this.runSubAST();
        this.currentAST = savedAST;
        this.currentNodeIndex = savedIndex;
        return result;
    }

    if (node.blockType === 'if_else' && node.children) {
      const ifNode = node.children[0];
      const elseNode = node.children[1];
      const condition = await this.conditionEvaluator.evaluate(ifNode.condition!);
      if (condition) {
        const savedAST = this.currentAST;
        const savedIndex = this.currentNodeIndex;
        this.currentAST = ifNode.children || [];
        this.currentNodeIndex = 0;
        const result = await this.runSubAST();
        this.currentAST = savedAST;
        this.currentNodeIndex = savedIndex;
        return result;
      } else if (elseNode) {
        const savedAST = this.currentAST;
        const savedIndex = this.currentNodeIndex;
        this.currentAST = elseNode.children || [];
        this.currentNodeIndex = 0;
        const result = await this.runSubAST();
        this.currentAST = savedAST;
        this.currentNodeIndex = savedIndex;
        return result;
      }
      return 'ok';
    }

    return 'ok';
  }

  private async runSubAST(): Promise<'ok' | 'dead' | 'wait' | 'finished'> {
    while (this.currentNodeIndex < this.currentAST.length && this.status === 'running') {
      const node = this.currentAST[this.currentNodeIndex];
      const result = await this.executeNode(node);
      if (result !== 'ok') return result;
      this.currentNodeIndex++;
      if (this.stepCount >= this.context.maxSteps) return 'dead';
    }
    return 'ok';
  }

  private async executeCommand(cmd: Command): Promise<'ok' | 'dead' | 'wait' | 'finished'> {
    this.stepCount++;

    // Обновляем контекст для ConditionEvaluator
    this.conditionEvaluator.updateContext({
      playerPos: this.context.player.getPosition(),
      playerDir: this.lastDirection,
      inventoryKeys: this.context.inventory.keys,
    });

    switch (cmd) {
      // Движение
      case Command.UP:
      case Command.DOWN:
      case Command.LEFT:
      case Command.RIGHT:
        return this.movementExecutor.execute(cmd, this.lastDirection, (dir) => { this.lastDirection = dir; });

      // Инвентарь
      case Command.PICKUP:
        return this.inventoryExecutor.executePickup();
      case Command.DROP:
        return this.inventoryExecutor.executeDrop();
      case Command.USE_KEY:
        return this.inventoryExecutor.executeUseKey(this.lastDirection);

      // Инструменты
      case Command.DRILL:
        return this.toolsExecutor.executeDrill(this.lastDirection);
      case Command.HOOK:
        return this.toolsExecutor.executeHook(this.lastDirection);
      case Command.WING:
        return this.toolsExecutor.executeWing();
      case Command.BAIT:
        return this.toolsExecutor.executeBait();

      // Бой
      case Command.THROW:
        return this.combatExecutor.executeThrow(this.lastDirection);
      case Command.FEED:
        return this.combatExecutor.executeFeed(this.lastDirection);

      // Время
      case Command.TIME_SLOW:
        this.context.speedMultiplier = 0.5;
        return 'ok';
      case Command.TIME_FAST:
        this.context.speedMultiplier = 2;
        return 'ok';
      case Command.WAIT:
        return await this.timeExecutor.executeWait(this.context.speedMultiplier);

      // Функции
      case Command.CALL:
        return this.functionsExecutor.executeCall(this.currentAST, this.currentNodeIndex, (ast, index) => {
          this.callStack.push({
            functionName: '',
            returnNodeIndex: this.currentNodeIndex,
            localVars: new Map(),
            nodeStack: this.currentAST,
            nodeIndex: this.currentNodeIndex,
            parameters: new Map(),
          });
          this.currentAST = ast;
          this.currentNodeIndex = index;
        });
      case Command.RETURN:
        return this.functionsExecutor.executeReturn(this.callStack, (stack, ast, index) => {
          this.callStack = stack;
          this.currentAST = ast;
          this.currentNodeIndex = index;
        });

      // ООП
      case Command.NEW:
        return this.oopExecutor.executeNew(this.currentAST[this.currentNodeIndex]?.className);
      case Command.METHOD:
        return this.oopExecutor.executeMethod();

      // Параллелизм
      case Command.CLONE:
        return this.parallelismExecutor.executeClone(
          this.context.player.getPosition(),
          this.context.inventory,
          this.currentAST,
          this.currentNodeIndex
        );
      case Command.JOIN:
        return this.parallelismExecutor.executeJoin(this.context.inventory);

      // Взаимодействие
      case Command.PUSH:
        return this.interactionsExecutor.executePush(this.lastDirection);
      case Command.SCAN:
        return this.interactionsExecutor.executeScan(this.context.player.getPosition());
      case Command.RIDE:
        return this.interactionsExecutor.executeRide(this.lastDirection);

      // Чёрный ящик (обрабатывается при движении на клетку)
      case Command.BLACK_BOX:
        return this.blackBoxProcessor.process('identity', null) ? 'ok' : 'ok';

      default:
        log('ASTRunner', 'executeCommand', `Unknown command: ${cmd}`);
        return 'ok';
    }
  }

  private checkVictory(): boolean {
    const pos = this.context.player.getPosition();
    return pos.col === this.context.level.coinPos.col && pos.row === this.context.level.coinPos.row;
  }

  private buildResult(success: boolean): ExecutionResult {
    const stars = success ? calculateStars(this.stepCount, this.context.level.optimalSteps || 18) : 0;
    return {
      success,
      steps: this.stepCount,
      finalInventory: this.context.inventory,
      monstersState: this.context.level.objects.monsters,
      backdoorUsed: this.backdoorUsed,
      stars,
    };
  }

  public pause(): void {
    if (this.status === 'running') {
      this.status = 'paused';
      if (this.waitTimer) {
        clearTimeout(this.waitTimer);
        this.waitTimer = null;
      }
      eventBus.emit('EXECUTION_PAUSED');
    }
  }

  public resume(): void {
    if (this.status === 'paused') {
      this.status = 'running';
      eventBus.emit('EXECUTION_RESUMED');
      this.run();
    }
  }

  public stop(): void {
    this.status = 'finished';
    if (this.waitTimer) {
      clearTimeout(this.waitTimer);
      this.waitTimer = null;
    }
  }
}
