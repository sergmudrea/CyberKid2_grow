// src/modules/execution/runner.ts
// ============================================================================
// ОСНОВНОЙ ЦИКЛ ВЫПОЛНЕНИЯ ПРОГРАММЫ (AST RUNNER)
// ============================================================================
// Этот класс обходит абстрактное синтаксическое дерево (AST), выполняет команды,
// управляет блоками (циклы, условия), обрабатывает вызовы функций, возвраты,
// параллелизм и т.д. Работает асинхронно с возможностью паузы.
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
  private callStack: CallFrame[];           // стек вызовов функций
  private stepCount: number;
  private backdoorUsed: boolean;
  private status: 'idle' | 'running' | 'paused' | 'finished' | 'error';
  private waitTimer: number | null;
  private lastDirection: 'up' | 'down' | 'left' | 'right';

  // Подсистемы (делегируют выполнение конкретных команд)
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

    // Инициализация подсистем (некоторые переиспользуют уже созданные в ExecutionEngine, но для автономности создаём свои)
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

    logInfo('ASTRunner', 'constructor', 'Runner initialized');
  }

  // --------------------------------------------------------------------------
  // ЗАГРУЗКА ПРОГРАММЫ (если нужно переопределить)
  // --------------------------------------------------------------------------
  public loadProgram(commands: Command[]): void {
    const parser = new ASTParser(commands);
    this.context.ast = parser.parse();
    this.currentAST = [...this.context.ast];
    this.currentNodeIndex = 0;
    this.callStack = [];
    this.stepCount = 0;
    this.backdoorUsed = false;
    this.status = 'idle';
  }

  // --------------------------------------------------------------------------
  // ЗАПУСК ВЫПОЛНЕНИЯ
  // --------------------------------------------------------------------------
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
        // Выполнение приостановлено командой WAIT, но цикл продолжит после таймера
        // (метод executeCurrentNode уже сделал delay)
        continue;
      }
      if (result === 'finished') {
        this.status = 'finished';
        break;
      }
    }

    const success = this.status === 'finished' && this.checkVictory();
    const finalResult = this.buildResult(success);
    eventBus.emit('EXECUTION_FINISHED', { success, result: finalResult });
    return finalResult;
  }

  // --------------------------------------------------------------------------
  // ВЫПОЛНЕНИЕ ТЕКУЩЕГО УЗЛА AST
  // --------------------------------------------------------------------------
  private async executeCurrentNode(): Promise<'ok' | 'dead' | 'wait' | 'finished'> {
    if (this.currentNodeIndex >= this.currentAST.length) {
      // Если есть вызовы в стеке – возвращаемся из функции
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

  // --------------------------------------------------------------------------
  // ВЫПОЛНЕНИЕ ОДНОГО УЗЛА (команда или блок)
  // --------------------------------------------------------------------------
  private async executeNode(node: ASTNode): Promise<'ok' | 'dead' | 'wait' | 'finished'> {
    // Отправляем событие о шаге (для подсветки в UI)
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
        this.functionsExecutor.defineFunction(node.functionName, node.children || []);
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
      // Методы обрабатываются внутри определения класса, здесь игнорируем
      return 'ok';
    }

    return 'ok';
  }

  // --------------------------------------------------------------------------
  // ВЫПОЛНЕНИЕ БЛОКА (циклы, условия)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // ЗАПУСК ВЛОЖЕННОГО AST (для блоков)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // ВЫПОЛНЕНИЕ ОТДЕЛЬНОЙ КОМАНДЫ
  // --------------------------------------------------------------------------
  private async executeCommand(cmd: Command): Promise<'ok' | 'dead' | 'wait' | 'finished'> {
    this.stepCount++;

    // Обновляем контекст для условных выражений
    this.conditionEvaluator.updateContext({
      playerPos: this.context.player.getPosition(),
      playerDir: this.lastDirection,
      inventoryKeys: this.context.inventory.keys,
    });

    // Делегируем выполнение соответствующим подсистемам
    switch (cmd) {
      // ---------- Движение ----------
      case Command.UP:
      case Command.DOWN:
      case Command.LEFT:
      case Command.RIGHT:
        return this.movementExecutor.execute(cmd, this.lastDirection, (dir) => { this.lastDirection = dir; });

      // ---------- Инвентарь ----------
      case Command.PICKUP:
        return this.inventoryExecutor.executePickup();
      case Command.DROP:
        return this.inventoryExecutor.executeDrop();
      case Command.USE_KEY:
        return this.inventoryExecutor.executeUseKey(this.lastDirection);

      // ---------- Инструменты ----------
      case Command.DRILL:
        return this.toolsExecutor.executeDrill(this.lastDirection);
      case Command.HOOK:
        return this.toolsExecutor.executeHook(this.lastDirection);
      case Command.WING:
        return this.toolsExecutor.executeWing();
      case Command.BAIT:
        return this.toolsExecutor.executeBait();

      // ---------- Бой ----------
      case Command.THROW:
        return this.combatExecutor.executeThrow(this.lastDirection);
      case Command.FEED:
        return this.combatExecutor.executeFeed(this.lastDirection);

      // ---------- Время ----------
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

      // ---------- Функции (упрощённо) ----------
      case Command.CALL:
        // Здесь нужна полноценная реализация, но для краткости пропускаем
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

      // ---------- ООП (упрощённо) ----------
      case Command.NEW:
        // Не реализовано в полной мере
        return 'ok';
      case Command.METHOD:
        return 'ok';

      // ---------- Параллелизм ----------
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

      // ---------- Взаимодействие ----------
      case Command.PUSH:
        return this.interactionsExecutor.executePush(this.lastDirection);
      case Command.SCAN:
        return this.interactionsExecutor.executeScan(this.context.player.getPosition());
      case Command.RIDE:
        return this.interactionsExecutor.executeRide(this.lastDirection);

      // ---------- Чёрный ящик (не команда, а тайл) ----------
      case Command.BLACK_BOX:
        return 'ok';

      // ---------- Блоковые команды не должны сюда попадать ----------
      default:
        log('ASTRunner', 'executeCommand', `Ignoring block-level command: ${cmd}`);
        return 'ok';
    }
  }

  // --------------------------------------------------------------------------
  // ПРОВЕРКА ПОБЕДЫ (достигнута ли монетка)
  // --------------------------------------------------------------------------
  private checkVictory(): boolean {
    const pos = this.context.player.getPosition();
    return pos.col === this.context.level.coinPos.col && pos.row === this.context.level.coinPos.row;
  }

  // --------------------------------------------------------------------------
  // ФОРМИРОВАНИЕ РЕЗУЛЬТАТА
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // УПРАВЛЕНИЕ ВЫПОЛНЕНИЕМ (пауза, возобновление, остановка)
  // --------------------------------------------------------------------------
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
      this.run();   // продолжим цикл
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
