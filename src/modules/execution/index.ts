// src/modules/execution/index.ts
// ============================================================================
// ГЛАВНЫЙ МОДУЛЬ EXECUTION ENGINE – ПОЛНАЯ ВЕРСИЯ ПАТЧА 2.0
// ============================================================================
// Экспортирует класс ExecutionEngine, который управляет AST-раннером
// и передаёт контекст, включая controlMode и начальный угол башни.
// ============================================================================

import { LevelData, Command, Inventory, ExecutionResult, ControlMode } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import { logger } from '../../core/Logger';
import { ASTParser } from './parser';
import { ASTRunner, RunnerContext } from './runner';
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
import { TilesExecutor } from './tiles';
import { MonstersExecutor } from './monsters';
import { BlackBoxProcessor } from './blackbox';
import { log, logInfo, logError, calculateStars } from './helpers';

export class ExecutionEngine {
  private level: LevelData;
  private player: any;
  private inventory: Inventory;
  private ast: any[];
  private runner: ASTRunner | null = null;
  private status: 'idle' | 'running' | 'paused' | 'finished' | 'error' = 'idle';
  private speedMultiplier: number = 1;
  private explorationMode: boolean = false;
  private maxSteps: number = 10000;
  private controlMode: ControlMode;
  private timeExecutor: TimeExecutor; // добавлено для совместимости с stop()

  constructor(level: LevelData, player: any, controlMode: ControlMode = ControlMode.SEPARATE) {
    this.level = level;
    this.player = player;
    this.inventory = player.getInventory();
    this.controlMode = controlMode;
    this.timeExecutor = new TimeExecutor(); // инициализируем
    logInfo('ExecutionEngine', 'constructor', `Control mode: ${controlMode}`);
  }

  public loadProgram(commands: Command[]): void {
    const parser = new ASTParser(commands);
    this.ast = parser.parse();
    logInfo('ExecutionEngine', 'loadProgram', `Program loaded, AST has ${this.ast.length} nodes`);
  }

  public reset(): void {
    this.status = 'idle';
    this.runner = null;
    this.speedMultiplier = 1;
    log('ExecutionEngine', 'reset', 'Engine reset');
  }

  public setExplorationMode(enabled: boolean): void {
    this.explorationMode = enabled;
    logInfo('ExecutionEngine', 'setExplorationMode', `Exploration mode: ${enabled}`);
  }

  public async start(): Promise<ExecutionResult> {
    if (this.status === 'running') {
      return this.buildResult(false);
    }
    if (this.status === 'paused') {
      this.status = 'running';
      eventBus.emit('EXECUTION_RESUMED');
      if (this.runner) this.runner.resume();
      return this.buildResult(false);
    }

    this.status = 'running';
    eventBus.emit('EXECUTION_START');

    const context: RunnerContext = {
      level: this.level,
      player: this.player,
      inventory: this.inventory,
      ast: this.ast,
      maxSteps: this.maxSteps,
      speedMultiplier: this.speedMultiplier,
      explorationMode: this.explorationMode,
      controlMode: this.controlMode,
    };

    this.runner = new ASTRunner(context);
    const result = await this.runner.run();
    this.status = result.success ? 'finished' : 'error';
    return result;
  }

  public pause(): void {
    if (this.status === 'running') {
      this.status = 'paused';
      if (this.runner) this.runner.pause();
      eventBus.emit('EXECUTION_PAUSED');
    }
  }

  public resume(): void {
    if (this.status === 'paused') {
      this.start();
    }
  }

  public stop(): void {
    this.status = 'finished';
    if (this.runner) this.runner.stop();
    if (this.timeExecutor) this.timeExecutor.clearTimer();
  }

  private buildResult(success: boolean): ExecutionResult {
    const stars = success ? calculateStars(0, this.level.optimalSteps || 18) : 0;
    return {
      success,
      steps: 0,
      finalInventory: this.inventory,
      monstersState: this.level.objects?.monsters || [],
      backdoorUsed: false,
      stars,
    };
  }

  public getStatus(): string {
    return this.status;
  }
}
