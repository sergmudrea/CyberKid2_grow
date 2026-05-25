// src/modules/execution/index.ts
// Основной класс ExecutionEngine, объединяющий все модули

import { LevelData, Command, Inventory, ExecutionResult } from '../../types/index';
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

  // Sub-executors (доступны для внешнего использования)
  public conditionEvaluator: ConditionEvaluator;
  public movementExecutor: MovementExecutor;
  public inventoryExecutor: InventoryExecutor;
  public toolsExecutor: ToolsExecutor;
  public combatExecutor: CombatExecutor;
  public timeExecutor: TimeExecutor;
  public functionsExecutor: FunctionsExecutor;
  public oopExecutor: OOPExecutor;
  public parallelismExecutor: ParallelismExecutor;
  public interactionsExecutor: InteractionsExecutor;
  public tilesExecutor: TilesExecutor;
  public monstersExecutor: MonstersExecutor;
  public blackBoxProcessor: BlackBoxProcessor;

  constructor(level: LevelData, player: any) {
    this.level = level;
    this.player = player;
    this.inventory = player.getInventory();

    // Инициализация всех подсистем
    this.conditionEvaluator = new ConditionEvaluator({
      playerPos: player.getPosition(),
      playerDir: 'right',
      coinPos: level.coinPos,
      inventoryKeys: this.inventory.keys,
      map: level.map,
      monsters: level.objects.monsters,
      explorationMode: this.explorationMode,
    });

    this.movementExecutor = new MovementExecutor(level, player, this.inventory);
    this.inventoryExecutor = new InventoryExecutor(level, player, this.inventory);
    this.toolsExecutor = new ToolsExecutor(level, player, this.inventory);
    this.combatExecutor = new CombatExecutor(level, player, this.inventory);
    this.timeExecutor = new TimeExecutor();
    this.functionsExecutor = new FunctionsExecutor();
    this.oopExecutor = new OOPExecutor();
    this.parallelismExecutor = new ParallelismExecutor(level, player, this.inventory);
    this.interactionsExecutor = new InteractionsExecutor(level, player, this.inventory);
    this.tilesExecutor = new TilesExecutor(level, player, this.inventory);
    this.monstersExecutor = new MonstersExecutor(level, player, this.inventory);
    this.blackBoxProcessor = new BlackBoxProcessor(this.inventory);

    logInfo('ExecutionEngine', 'constructor', 'ExecutionEngine initialized');
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
    if (this.movementExecutor) this.movementExecutor.setExplorationMode(enabled);
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
      monstersState: this.level.objects.monsters,
      backdoorUsed: false,
      stars,
    };
  }

  public getStatus(): string {
    return this.status;
  }
}
