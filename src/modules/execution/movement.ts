// src/modules/execution/movement.ts
// ============================================================================
// ОБРАБОТЧИК ДВИЖЕНИЯ И ПОВОРОТОВ – ПАТЧ 2.0
// ============================================================================
// - Поддерживает раздельное управление башней и корпусом
// - Новые команды: MOVE_FORWARD, MOVE_BACKWARD, TURN_LEFT, TURN_RIGHT,
//   TURN_AROUND, SYNC_BODY, SET_ANGLE, RELATIVE_TURN, SHOW_AIM
// - Классический режим (controlMode = classic) оставляет старые команды UP/DOWN/LEFT/RIGHT
// - Обработка телепортов, конвейеров, пружин, клея, клеток, магнитов, замедляющих полей
// - Полное логирование
// ============================================================================

import { Command, TileType, ControlMode } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import {
  getFrontPosition,
  isWall,
  isHole,
  isDeadlyLiquid,
  isDoor,
  isTeleport,
  isConveyor,
  isSpring,
  isPickupItem,
  getConveyorDirection,
  log,
  logInfo,
  logError,
} from './helpers';
import { TilesExecutor } from './tiles';
import { ToolsExecutor } from './tools';

export class MovementExecutor {
  private level: any;
  private player: any;
  private inventory: any;
  private lastDirection: 'up' | 'down' | 'left' | 'right';
  private explorationMode: boolean;
  private tilesExecutor: TilesExecutor;
  private toolsExecutor: ToolsExecutor;
  private backdoorUsed: boolean;
  private stepCount: number = 0;
  private controlMode: ControlMode;

  constructor(level: any, player: any, inventory: any, toolsExecutor: ToolsExecutor, controlMode: ControlMode = ControlMode.SEPARATE) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
    this.toolsExecutor = toolsExecutor;
    this.controlMode = controlMode;
    this.explorationMode = false;
    this.tilesExecutor = new TilesExecutor(level, player, inventory);
    this.backdoorUsed = false;
    this.lastDirection = 'right';
  }

  public setExplorationMode(enabled: boolean): void {
    this.explorationMode = enabled;
  }

  public setControlMode(mode: ControlMode): void {
    this.controlMode = mode;
  }

  public async execute(
    cmd: Command,
    currentDirection: 'up' | 'down' | 'left' | 'right',
    onDirectionChange: (dir: 'up' | 'down' | 'left' | 'right') => void
  ): Promise<'ok' | 'dead'> {
    this.stepCount++;

    // Логирование начала шага
    const oldPos = this.player.getPosition();
    console.log(`[MOVEMENT] Step ${this.stepCount}: Command=${cmd}`);
    console.log(`   pos=(${oldPos.col},${oldPos.row}) turret=${this.player.getTurretAngle()} hull=${this.player.getHullDirection()}`);
    console.log(`   Inventory: keys=${this.inventory.keys.length}, corn=${this.inventory.corn}, cores=${this.inventory.cores}, tools=${this.inventory.tools.join(',') || 'none'}`);

    // Обработка команд в зависимости от режима управления
    if (this.controlMode === ControlMode.CLASSIC) {
      return this.executeClassic(cmd, currentDirection, onDirectionChange);
    } else {
      return this.executeSeparate(cmd, currentDirection, onDirectionChange);
    }
  }

  // --------------------------------------------------------------------------
  // НОВЫЙ РЕЖИМ (РАЗДЕЛЬНОЕ УПРАВЛЕНИЕ)
  // --------------------------------------------------------------------------
  private async executeSeparate(
    cmd: Command,
    currentDirection: 'up' | 'down' | 'left' | 'right',
    onDirectionChange: (dir: 'up' | 'down' | 'left' | 'right') => void
  ): Promise<'ok' | 'dead'> {
    switch (cmd) {
      // Повороты башни (без движения)
      case Command.TURN_LEFT:
        this.player.turnTurretLeft();
        console.log(`   turret turned left -> angle=${this.player.getTurretAngle()}`);
        return 'ok';

      case Command.TURN_RIGHT:
        this.player.turnTurretRight();
        console.log(`   turret turned right -> angle=${this.player.getTurretAngle()}`);
        return 'ok';

      case Command.TURN_AROUND:
        this.player.turnTurretAround();
        console.log(`   turret turned around -> angle=${this.player.getTurretAngle()}`);
        return 'ok';

      case Command.SYNC_BODY:
        this.player.syncBodyWithTurret();
        console.log(`   body synced to turret -> hull=${this.player.getHullDirection()}`);
        return 'ok';

      case Command.SET_ANGLE:
        // Ожидается следующий параметр – число (угол)
        // В реальном выполнении нужно прочитать аргумент, упрощённо: поворот до 0
        // Для полноты: считываем параметр из команды (в AST).
        // Здесь заглушка – реальный параметр будет передан через runner.
        // Пока оставим просто поворот на 0.
        this.player.setTurretAngle(0);
        console.log(`   turret angle set to 0`);
        return 'ok';

      case Command.RELATIVE_TURN:
        // Аналогично, требуется параметр. Заглушка.
        console.log(`   relative turn (not fully implemented)`);
        return 'ok';

      case Command.SHOW_AIM:
        eventBus.emit('SHOW_AIM', { pos: this.player.getPosition(), angle: this.player.getTurretAngle() });
        console.log(`   showing aim line`);
        return 'ok';

      // Движение
      case Command.MOVE_FORWARD:
        return this.executeMove(() => this.player.moveForward(), 'forward');

      case Command.MOVE_BACKWARD:
        return this.executeMove(() => this.player.moveBackward(), 'backward');

      // Классические команды в separate режиме – могут быть запрещены или преобразованы
      case Command.UP:
      case Command.DOWN:
      case Command.LEFT:
      case Command.RIGHT:
        console.warn(`Classic movement command ${cmd} used in separate mode – ignored`);
        return 'ok';

      default:
        // Остальные команды (инвентарь, инструменты, бой) обрабатываются в runner
        return 'ok';
    }
  }

  // --------------------------------------------------------------------------
  // КЛАССИЧЕСКИЙ РЕЖИМ (ДЛЯ СТАРЫХ УРОВНЕЙ)
  // --------------------------------------------------------------------------
  private async executeClassic(
    cmd: Command,
    currentDirection: 'up' | 'down' | 'left' | 'right',
    onDirectionChange: (dir: 'up' | 'down' | 'left' | 'right') => void
  ): Promise<'ok' | 'dead'> {
    let dx = 0, dy = 0;
    let newDirection: 'up' | 'down' | 'left' | 'right' = currentDirection;

    switch (cmd) {
      case Command.UP:
        dy = -1;
        newDirection = 'up';
        break;
      case Command.DOWN:
        dy = 1;
        newDirection = 'down';
        break;
      case Command.LEFT:
        dx = -1;
        newDirection = 'left';
        break;
      case Command.RIGHT:
        dx = 1;
        newDirection = 'right';
        break;
      default:
        return 'ok';
    }

    onDirectionChange(newDirection);
    this.lastDirection = newDirection;
    return this.executeMovement(dx, dy, newDirection);
  }

  // --------------------------------------------------------------------------
  // ОБЩАЯ ЛОГИКА ДВИЖЕНИЯ (ДЛЯ ОБОИХ РЕЖИМОВ)
  // --------------------------------------------------------------------------
  private async executeMove(moveFunc: () => boolean, moveType: string): Promise<'ok' | 'dead'> {
    const oldPos = this.player.getPosition();
    const success = moveFunc();
    if (!success) {
      console.log(`   ❌ ${moveType} movement failed (blocked)`);
      return 'dead';
    }
    const newPos = this.player.getPosition();
    console.log(`   ✅ MOVED ${moveType} to (${newPos.col},${newPos.row})`);

    // Обработка клетки после движения
    const finalPos = this.player.getPosition();
    const finalTile = this.level.map[finalPos.row][finalPos.col];
    await this.processTileAfterMove(finalPos, finalTile);
    return 'ok';
  }

  private async executeMovement(dx: number, dy: number, newDirection: 'up'|'down'|'left'|'right'): Promise<'ok' | 'dead'> {
    const oldPos = this.player.getPosition();
    const newPos = { col: oldPos.col + dx, row: oldPos.row + dy };
    console.log(`   moving from (${oldPos.col},${oldPos.row}) to (${newPos.col},${newPos.row})`);

    // Проверка границ
    if (newPos.col < 0 || newPos.col >= this.level.width ||
        newPos.row < 0 || newPos.row >= this.level.height) {
      console.log(`   ❌ OUT OF BOUNDS -> DEAD`);
      eventBus.emit('PLAYER_DIED', { cause: 'out_of_bounds' });
      return 'dead';
    }

    const tile = this.level.map[newPos.row][newPos.col];
    console.log(`   target tile=${TileType[tile]}`);

    // Проверка проходимости (с учётом инвентаря и инструментов)
    if (!this.explorationMode) {
      if (isWall(tile) && !this.inventory.hasDrill) {
        console.log(`   🧱 WALL without drill -> DEAD`);
        return 'dead';
      }
      if ((isHole(tile) || isDeadlyLiquid(tile)) && !this.toolsExecutor.hasActiveWing()) {
        console.log(`   🕳️ HAZARD without wings -> DEAD`);
        return 'dead';
      }
      if (tile === TileType.DOOR_LOCKED && this.inventory.keys.length === 0) {
        console.log(`   🔒 LOCKED DOOR without key -> DEAD`);
        return 'dead';
      }
      if (tile === TileType.BRICK) {
        console.log(`   🧱 BRICK needs PUSH -> DEAD`);
        return 'dead';
      }
    }

    // Монстры
    const monsterHere = this.level.objects?.monsters?.find((m: any) =>
      m.position.col === newPos.col && m.position.row === newPos.row
    );
    if (monsterHere && !this.explorationMode && !monsterHere.isTamed && !monsterHere.isRidden) {
      console.log(`   👾 MONSTER -> DEAD`);
      return 'dead';
    }

    // Клей, клетка
    if (tile === TileType.GLUE && !this.player.isGlued()) {
      this.tilesExecutor.processGlue(newPos);
    }
    if (tile === TileType.CAGE) {
      const trapped = this.tilesExecutor.processCage(newPos, 'player');
      if (trapped) return 'dead';
    }

    // Выполняем движение
    this.player.moveClassic?.(dx, dy);
    const finalPos = this.player.getPosition();
    console.log(`   ✅ MOVED to (${finalPos.col},${finalPos.row})`);

    // Обработка клетки после движения
    const finalTile = this.level.map[finalPos.row][finalPos.col];
    await this.processTileAfterMove(finalPos, finalTile);
    return 'ok';
  }

  // --------------------------------------------------------------------------
  // ОБРАБОТКА ТАЙЛА ПОСЛЕ ДВИЖЕНИЯ
  // --------------------------------------------------------------------------
  private async processTileAfterMove(pos: Point, tile: TileType): Promise<void> {
    // Сбор предметов
    if (isPickupItem(tile)) {
      this.pickupItem(pos.col, pos.row, tile);
    }

    // Телепорт
    if (tile === TileType.TELEPORT_IN) {
      this.tilesExecutor.processTeleport(pos);
    }

    // Конвейер
    if (isConveyor(tile)) {
      await this.tilesExecutor.processConveyor(pos, 'move');
    }

    // Пружина
    if (tile === TileType.SPRING) {
      await this.tilesExecutor.processSpring(pos, this.lastDirection);
    }

    // Чёрный ящик
    if (tile === TileType.BLACK_BOX) {
      this.tilesExecutor.processBlackBox(pos);
    }

    // Кнопки, рычаги, таймеры, сенсоры, сортировщики
    if (tile === TileType.BUTTON) this.tilesExecutor.processButton(pos);
    if (tile === TileType.LEVER) this.tilesExecutor.processLever(pos);
    if (tile === TileType.TIMER) this.tilesExecutor.processTimer(pos);
    if (tile === TileType.SENSOR) this.tilesExecutor.processSensor(pos);
    if (tile === TileType.SORTER) this.tilesExecutor.processSorter(pos);
  }

  // --------------------------------------------------------------------------
  // ПОДБОР ПРЕДМЕТОВ
  // --------------------------------------------------------------------------
  private pickupItem(col: number, row: number, tile: TileType): void {
    console.log(`   🎒 PICKUP: ${TileType[tile]} at (${col},${row})`);
    switch (tile) {
      case TileType.KEY:
        this.inventory.keys.push(`key_${col}_${row}`);
        break;
      case TileType.CORN:
        this.inventory.corn++;
        break;
      case TileType.CORE:
        this.inventory.cores++;
        break;
      case TileType.TOOL_DRILL:
        this.inventory.hasDrill = true;
        if (!this.inventory.tools.includes('drill')) this.inventory.tools.push('drill');
        break;
      case TileType.TOOL_HOOK:
        this.inventory.hasHook = true;
        if (!this.inventory.tools.includes('hook')) this.inventory.tools.push('hook');
        break;
      case TileType.TOOL_WING:
        this.inventory.hasWing = true;
        if (!this.inventory.tools.includes('wing')) this.inventory.tools.push('wing');
        break;
      case TileType.TOOL_BAIT:
        this.inventory.hasBait = true;
        if (!this.inventory.tools.includes('bait')) this.inventory.tools.push('bait');
        break;
      case TileType.CAGE_KEY:
        this.inventory.keys.push('cage_key');
        break;
      case TileType.GEM:
        this.inventory.cores += 5;
        break;
      default:
        return;
    }
    this.level.map[row][col] = TileType.PLATFORM;
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    eventBus.emit('OBJECT_COLLECTED', { objectId: `${tile}_${col}_${row}` });
  }

  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
