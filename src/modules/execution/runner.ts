// src/modules/execution/runner.ts
// ============================================================================
// ОСНОВНОЙ ЦИКЛ ВЫПОЛНЕНИЯ ПРОГРАММЫ – С ПРОВЕРКОЙ ПОБЕДЫ ПОСЛЕ КАЖДОГО ШАГА
// ============================================================================
// - После каждого успешного выполнения команды проверяется, достиг ли игрок монетки
// - Если монетка достигнута, программа немедленно завершается с победой
// - Исправлена обработка USE_KEY (передаётся в InventoryExecutor)
// ============================================================================

import { Command } from '../../types/index';
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
import { ASTParser } from './parser';
import { delay, log, logError, logInfo, calculateStars } from './helpers';
import { gameEvents as eventBus } from '../../core/EventBus';
import { LevelData, Point, Inventory } from '../../types/index';

// ----------------------------------------------------------------------------
// КОНТЕКСТ ЗАПУСКА (передаётся из ExecutionEngine)
// ----------------------------------------------------------------------------
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

  // Подсистемы
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

    // Инициализация подсистем
    this.conditionEvaluator = new ConditionEvaluator({
      playerPos: context.player.getPosition(),
      playerDir: 'right',
      coinPos: context.level.coinPos,
      inventoryKeys: context.inventory.keys,
      map: context.level.map,
      monsters: context.level.objects?.monsters || [],
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

    logInfo('ASTRunner', 'constructor', 'Runner initialized');
  }

  public loadProgram(commands: Command[]): void {
    const parser = new ASTParser(commands);
    this.context.ast = parser.parse();
    this.currentAST = [...this.context.ast];
    this.currentNodeIndex = 0;
    this.callStack = [];
    this.stepCount = 0;
    this.backdoorUsed = false;
    this.status = 'idle';
    logInfo('ASTRunner', 'loadProgram', `Program loaded, AST has ${this.context.ast.length} nodes`);
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

      // Проверка, жив ли игрок
      if (!this.context.player.isPlayerAlive()) {
        this.status = 'error';
        eventBus.emit('EXECUTION_ERROR', { stepIndex: this.currentNodeIndex, cause: 'player_died' });
        break;
      }

      const result = await this.executeCurrentNode();

      // Если команда вернула 'dead' – смерть
      if (result === 'dead') {
        this.status = 'error';
        break;
      }
      if (result === 'wait') {
        continue;
      }
      if (result === 'finished') {
        this.status = 'finished';
        break;
      }
      // Если команда вернула 'victory' или после выполнения проверки победы
      if (result === 'victory') {
        this.status = 'finished';
        break;
      }

      // После каждого шага проверяем победу
      if (this.checkVictory()) {
        logInfo('ASTRunner', 'run', 'Victory achieved, stopping program');
        this.status = 'finished';
        break;
      }
    }

    const success = this.status === 'finished' && this.checkVictory();
    const finalResult = this.buildResult(success);
    eventBus.emit('EXECUTION_FINISHED', { success, result: finalResult });
    return finalResult;
  }

  private async executeCurrentNode(): Promise<'ok' | 'dead' | 'wait' | 'finished' | 'victory'> {
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
      // Задержка для визуализации (только для команд движения)
      if (node.type === 'command' && this.isMovementCommand(node.command!)) {
        const delayMs = 100 / this.context.speedMultiplier;
        await delay(delayMs);
      }
    } else if (result === 'dead') {
      eventBus.emit('EXECUTION_ERROR', { stepIndex: this.stepCount, command: node.command });
    } else if (result === 'victory') {
      return 'victory';
    }

    return result;
  }

  private isMovementCommand(cmd: Command): boolean {
    return cmd === Command.UP || cmd === Command.DOWN || cmd === Command.LEFT || cmd === Command.RIGHT;
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
      if (node.functionName) {
        this.functionsExecutor.defineFunction(node.functionName, node.children || [], node.parameters || []);
      }
      return 'ok';
    }

    if (node.type === 'class') {
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
      const repeatCount = node.repeatCount || 1;
      for (let i = 0; i < repeatCount; i++) {
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

    // Обновляем контекст для условий
    this.conditionEvaluator.updateContext({
      playerPos: this.context.player.getPosition(),
      playerDir: this.lastDirection,
      inventoryKeys: this.context.inventory.keys,
    });

    switch (cmd) {
      case Command.UP:
      case Command.DOWN:
      case Command.LEFT:
      case Command.RIGHT:
        return this.movementExecutor.execute(cmd, this.lastDirection, (dir) => { this.lastDirection = dir; });

      case Command.PICKUP:
        return this.inventoryExecutor.executePickup();
      case Command.DROP:
        return this.inventoryExecutor.executeDrop();
      case Command.USE_KEY:
        return this.inventoryExecutor.executeUseKey(this.lastDirection);

      case Command.DRILL:
        return this.toolsExecutor.executeDrill(this.lastDirection);
      case Command.HOOK:
        return this.toolsExecutor.executeHook(this.lastDirection);
      case Command.WING:
        return this.toolsExecutor.executeWing();
      case Command.BAIT:
        return this.toolsExecutor.executeBait();

      case Command.THROW:
        return this.combatExecutor.executeThrow(this.lastDirection);
      case Command.FEED:
        return this.combatExecutor.executeFeed(this.lastDirection);

      case Command.TIME_SLOW:
        this.context.speedMultiplier = 0.5;
        this.timeExecutor.setSlow();
        return 'ok';
      case Command.TIME_FAST:
        this.context.speedMultiplier = 2;
        this.timeExecutor.setFast();
        return 'ok';
      case Command.WAIT:
        return await this.timeExecutor.executeWait(this.context.speedMultiplier);

      case Command.CALL:
        log('ASTRunner', 'executeCommand', 'CALL not fully implemented');
        return 'ok';
      case Command.RETURN:
        if (this.callStack.length === 0) return 'ok';
        const frame = this.callStack.pop()!;
        this.currentAST = frame.nodeStack;
        this.currentNodeIndex = frame.returnNodeIndex;
        return 'ok';
      case Command.PARAM:
        return 'ok';

      case Command.NEW:
        return 'ok';
      case Command.METHOD:
        return 'ok';

      case Command.CLONE:
        this.parallelismExecutor.createClone(
          this.context.player.getPosition(),
          this.context.inventory,
          this.currentAST,
          this.currentNodeIndex
        );
        return 'ok';
      case Command.JOIN:
        this.parallelismExecutor.joinClones();
        return 'ok';

      case Command.PUSH:
        return this.interactionsExecutor.executePush(this.lastDirection);
      case Command.SCAN:
        return this.interactionsExecutor.executeScan(this.context.player.getPosition());
      case Command.RIDE:
        return this.interactionsExecutor.executeRide(this.lastDirection);

      case Command.BLACK_BOX:
        return 'ok';

      default:
        log('ASTRunner', 'executeCommand', `Ignoring block-level command: ${cmd}`);
        return 'ok';
    }
  }

  private checkVictory(): boolean {
    const pos = this.context.player.getPosition();
    return pos.col === this.context.level.coinPos.col && pos.row === this.context.level.coinPos.row;
  }

  private buildResult(success: boolean): ExecutionResult {
    const optimalSteps = this.context.level.optimalSteps || 18;
    const stars = success ? calculateStars(this.stepCount, optimalSteps) : 0;
    return {
      success,
      steps: this.stepCount,
      finalInventory: this.context.inventory,
      monstersState: this.context.level.objects?.monsters || [],
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
