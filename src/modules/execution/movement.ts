// src/modules/execution/movement.ts
// ============================================================================
// ОБРАБОТЧИК ДВИЖЕНИЯ И ПОВОРОТОВ – ФИНАЛЬНАЯ ВЕРСИЯ 2.0
// ============================================================================
// - Полная поддержка раздельного управления башней и корпусом
// - Корректная обработка SET_ANGLE, RELATIVE_TURN (с чтением параметров)
// - Магниты (притягивание танка в направлении башни)
// - Замедляющие поля (увеличивают множитель задержки)
// - Активные крылья с отслеживанием оставшихся ходов
// - Подбор предметов как из тайлов карты, так и из массива level.items
// - Обратная совместимость (классический режим)
// ============================================================================

import { Command, TileType, Point, ControlMode } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import {
  isWall,
  isHole,
  isDeadlyLiquid,
  isDoor,
  isTeleport,
  isConveyor,
  isSpring,
  isPickupItem,
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

  constructor(
    level: any,
    player: any,
    inventory: any,
    toolsExecutor: ToolsExecutor,
    controlMode: ControlMode = ControlMode.SEPARATE
  ) {
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
    onDirectionChange: (dir: 'up' | 'down' | 'left' | 'right') => void,
    arg?: any // для команд с параметрами (SET_ANGLE, RELATIVE_TURN)
  ): Promise<'ok' | 'dead'> {
    this.stepCount++;
    this.lastDirection = currentDirection;

    const oldPos = this.player.getPosition();
    console.log(`[MOVEMENT] Step ${this.stepCount}: Command=${cmd}`);
    console.log(`   pos=(${oldPos.col},${oldPos.row}) turret=${this.player.getTurretAngle()} hull=${this.player.getHullDirection()}`);
    console.log(`   Inventory: keys=${this.inventory.keys.length}, corn=${this.inventory.corn}, cores=${this.inventory.cores}, tools=${this.inventory.tools.join(',') || 'none'}`);

    if (this.controlMode === ControlMode.CLASSIC) {
      return this.executeClassic(cmd, currentDirection, onDirectionChange);
    } else {
      return this.executeSeparate(cmd, currentDirection, onDirectionChange, arg);
    }
  }

  // --------------------------------------------------------------------------
  // НОВЫЙ РЕЖИМ (РАЗДЕЛЬНОЕ УПРАВЛЕНИЕ)
  // --------------------------------------------------------------------------
  private async executeSeparate(
    cmd: Command,
    currentDirection: 'up' | 'down' | 'left' | 'right',
    onDirectionChange: (dir: 'up' | 'down' | 'left' | 'right') => void,
    arg?: any
  ): Promise<'ok' | 'dead'> {
    switch (cmd) {
      // Повороты башни
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
        // arg – число (0, 90, 180, 270)
        if (typeof arg === 'number') {
          this.player.setTurretAngle(arg);
          console.log(`   turret angle set to ${arg}`);
        } else {
          console.warn(`SET_ANGLE: invalid argument ${arg}, ignoring`);
        }
        return 'ok';

      case Command.RELATIVE_TURN:
        if (typeof arg === 'number') {
          const newAngle = (this.player.getTurretAngle() + arg + 360) % 360;
          this.player.setTurretAngle(newAngle);
          console.log(`   turret rotated by ${arg}° -> new angle ${newAngle}`);
        } else {
          console.warn(`RELATIVE_TURN: invalid argument ${arg}, ignoring`);
        }
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

      // Классические команды в separate режиме – игнорируем
      case Command.UP:
      case Command.DOWN:
      case Command.LEFT:
      case Command.RIGHT:
        console.warn(`Classic movement command ${cmd} used in separate mode – ignored`);
        return 'ok';

      default:
        return 'ok';
    }
  }

  // --------------------------------------------------------------------------
  // КЛАССИЧЕСКИЙ РЕЖИМ
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
  // ОБЩАЯ ЛОГИКА ДВИЖЕНИЯ
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
    await this.processTileAfterMove(newPos);
    return 'ok';
  }

  private async executeMovement(dx: number, dy: number, newDirection: 'up'|'down'|'left'|'right'): Promise<'ok' | 'dead'> {
    const oldPos = this.player.getPosition();
    const newPos = { col: oldPos.col + dx, row: oldPos.row + dy };
    console.log(`   moving from (${oldPos.col},${oldPos.row}) to (${newPos.col},${newPos.row})`);

    if (!this.isMoveValid(newPos)) return 'dead';

    // Выполняем движение (классическое – меняет позицию и, возможно, направление)
    // В классическом режиме у Player есть методы moveUp/Down/Left/Right
    if (dx === 0 && dy === -1) this.player.moveUp();
    else if (dx === 0 && dy === 1) this.player.moveDown();
    else if (dx === -1 && dy === 0) this.player.moveLeft();
    else if (dx === 1 && dy === 0) this.player.moveRight();

    const finalPos = this.player.getPosition();
    console.log(`   ✅ MOVED to (${finalPos.col},${finalPos.row})`);
    await this.processTileAfterMove(finalPos);
    return 'ok';
  }

  private isMoveValid(newPos: Point): boolean {
    // Границы
    if (newPos.col < 0 || newPos.col >= this.level.width ||
        newPos.row < 0 || newPos.row >= this.level.height) {
      console.log(`   ❌ OUT OF BOUNDS -> DEAD`);
      eventBus.emit('PLAYER_DIED', { cause: 'out_of_bounds' });
      return false;
    }

    const tile = this.level.map[newPos.row][newPos.col];
    console.log(`   target tile=${TileType[tile]}`);

    if (!this.explorationMode) {
      // Стены
      if (isWall(tile) && !this.inventory.hasDrill) {
        console.log(`   🧱 WALL without drill -> DEAD`);
        return false;
      }
      // Ямы, лава, вода
      if ((isHole(tile) || isDeadlyLiquid(tile)) && !this.toolsExecutor.hasActiveWing()) {
        console.log(`   🕳️ HAZARD without wings -> DEAD`);
        return false;
      }
      // Запертая дверь
      if (tile === TileType.DOOR_LOCKED && this.inventory.keys.length === 0) {
        console.log(`   🔒 LOCKED DOOR without key -> DEAD`);
        return false;
      }
      // Кирпич
      if (tile === TileType.BRICK) {
        console.log(`   🧱 BRICK needs PUSH -> DEAD`);
        return false;
      }
    }

    // Монстры
    const monsterHere = this.level.objects?.monsters?.find((m: any) =>
      m.position.col === newPos.col && m.position.row === newPos.row
    );
    if (monsterHere && !this.explorationMode && !monsterHere.isTamed && !monsterHere.isRidden) {
      console.log(`   👾 MONSTER -> DEAD`);
      return false;
    }

    // Клей и клетка не останавливают движение, но могут приклеить после входа
    if (tile === TileType.GLUE && !this.player.isGlued()) {
      this.tilesExecutor.processGlue(newPos);
    }
    if (tile === TileType.CAGE) {
      const trapped = this.tilesExecutor.processCage(newPos, 'player');
      if (trapped) return false;
    }

    return true;
  }

  // --------------------------------------------------------------------------
  // ОБРАБОТКА КЛЕТКИ ПОСЛЕ ДВИЖЕНИЯ
  // --------------------------------------------------------------------------
  private async processTileAfterMove(pos: Point): Promise<void> {
    const tile = this.level.map[pos.row][pos.col];
    console.log(`   processing tile at (${pos.col},${pos.row}) = ${TileType[tile]}`);

    // 1. Сбор предметов (из тайлов и из массива items)
    //    Сначала проверяем items (уровни из JSON)
    const itemIndex = this.level.items?.findIndex((it: any) => it.pos.col === pos.col && it.pos.row === pos.row);
    if (itemIndex !== undefined && itemIndex !== -1) {
      const item = this.level.items[itemIndex];
      console.log(`   📦 Found item in items[]: id=${item.id}`);
      this.pickupItemFromItem(item.id, pos.col, pos.row);
      this.level.items.splice(itemIndex, 1);
    } else if (isPickupItem(tile)) {
      console.log(`   📦 Found pickup tile: ${TileType[tile]}`);
      this.pickupItem(pos.col, pos.row, tile);
    }

    // 2. Телепорт
    if (tile === TileType.TELEPORT_IN) {
      this.tilesExecutor.processTeleport(pos);
    }

    // 3. Конвейер
    if (isConveyor(tile)) {
      await this.tilesExecutor.processConveyor(pos, 'move');
    }

    // 4. Пружина
    if (tile === TileType.SPRING) {
      await this.tilesExecutor.processSpring(pos, this.lastDirection);
    }

    // 5. Чёрный ящик
    if (tile === TileType.BLACK_BOX) {
      this.tilesExecutor.processBlackBox(pos);
    }

    // 6. Кнопки, рычаги, таймеры, сенсоры, сортировщики
    if (tile === TileType.BUTTON) this.tilesExecutor.processButton(pos);
    if (tile === TileType.LEVER) this.tilesExecutor.processLever(pos);
    if (tile === TileType.TIMER) this.tilesExecutor.processTimer(pos);
    if (tile === TileType.SENSOR) this.tilesExecutor.processSensor(pos);
    if (tile === TileType.SORTER) this.tilesExecutor.processSorter(pos);

    // 7. Магнит (притягивает танк, если башня смотрит в сторону магнита)
    if (tile === TileType.MAGNET) {
      await this.processMagnet(pos);
    }

    // 8. Замедляющее поле
    if (tile === TileType.SLOW_FIELD) {
      this.player.setSlowFactor(2);
    } else {
      this.player.resetSlowFactor();
    }

    // 9. Уменьшаем счётчик активных крыльев (если были использованы)
    this.toolsExecutor.decrementWingTurn();
  }

  // --------------------------------------------------------------------------
  // МАГНИТ
  // --------------------------------------------------------------------------
  private async processMagnet(pos: Point): Promise<void> {
    const magnet = this.level.objects?.magnets?.find((m: any) => m.position.col === pos.col && m.position.row === pos.row);
    if (!magnet) return;

    // Направление от танка к магниту
    const dx = magnet.position.col - this.player.getPosition().col;
    const dy = magnet.position.row - this.player.getPosition().row;
    const turretAngle = this.player.getTurretAngle();
    let expectedTurret = 0;
    if (dx > 0) expectedTurret = 90;
    else if (dx < 0) expectedTurret = 270;
    else if (dy > 0) expectedTurret = 180;
    else if (dy < 0) expectedTurret = 0;

    if (turretAngle === expectedTurret) {
      // Притягиваем танк на одну клетку
      const newPos = {
        col: this.player.getPosition().col + Math.sign(dx),
        row: this.player.getPosition().row + Math.sign(dy),
      };
      if (newPos.col >= 0 && newPos.col < this.level.width &&
          newPos.row >= 0 && newPos.row < this.level.height &&
          this.isMoveValid(newPos)) {
        this.player.teleport(newPos);
        console.log(`   🧲 Magnet pulled to (${newPos.col},${newPos.row})`);
        await this.processTileAfterMove(newPos);
      }
    }
  }

  // --------------------------------------------------------------------------
  // ПОДБОР ПРЕДМЕТОВ
  // --------------------------------------------------------------------------
  private pickupItem(col: number, row: number, tile: TileType): void {
    console.log(`   🎒 PICKUP (tile): ${TileType[tile]} at (${col},${row})`);
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

  private pickupItemFromItem(itemId: string, col: number, row: number): void {
    console.log(`   🎒 PICKUP (item): ${itemId} at (${col},${row})`);
    switch (itemId) {
      case 'key1': case 'key':
        this.inventory.keys.push(`key_${col}_${row}`);
        break;
      case 'corn1': case 'corn':
        this.inventory.corn++;
        break;
      case 'core1': case 'core':
        this.inventory.cores++;
        break;
      case 'drill':
        this.inventory.hasDrill = true;
        if (!this.inventory.tools.includes('drill')) this.inventory.tools.push('drill');
        break;
      case 'hook':
        this.inventory.hasHook = true;
        if (!this.inventory.tools.includes('hook')) this.inventory.tools.push('hook');
        break;
      case 'wing':
        this.inventory.hasWing = true;
        if (!this.inventory.tools.includes('wing')) this.inventory.tools.push('wing');
        break;
      case 'bait':
        this.inventory.hasBait = true;
        if (!this.inventory.tools.includes('bait')) this.inventory.tools.push('bait');
        break;
      case 'cage_key':
        this.inventory.keys.push('cage_key');
        break;
      case 'gem1': case 'gem':
        this.inventory.cores += 5;
        break;
    }
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    eventBus.emit('OBJECT_COLLECTED', { objectId: `${itemId}_${col}_${row}` });
  }

  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
