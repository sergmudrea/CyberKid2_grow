// src/modules/execution/movement.ts
// ============================================================================
// ОБРАБОТЧИК ДВИЖЕНИЯ И ПОВОРОТОВ – ПАТЧ 2.0
// ============================================================================
// Реализует команды:
// - MOVE_FORWARD, MOVE_BACKWARD – движение вперёд/назад
// - TURN_LEFT, TURN_RIGHT, TURN_AROUND, SYNC_BODY – управление башней и корпусом
// - SET_ANGLE, RELATIVE_TURN, SHOW_AIM – работа с углами и прицелом
// - UP, DOWN, LEFT, RIGHT – классическое движение (для обратной совместимости)
// ============================================================================
// Учитывает режим управления (controlMode: separate / classic)
// Генерирует события для визуализации и UI
// ============================================================================

import { Command, TileType, Point, Inventory, ControlMode } from '../../types/index';
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
  private inventory: Inventory;
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
    inventory: Inventory,
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
    this.lastDirection = currentDirection;

    // Логирование шага
    console.log(`[MOVEMENT] Step ${this.stepCount}: Command=${cmd}, dir=${currentDirection}`);
    console.log(`   Inventory: keys=${this.inventory.keys.length}, corn=${this.inventory.corn}, cores=${this.inventory.cores}`);

    // Обработка команд в зависимости от режима управления
    switch (cmd) {
      // ---------- НОВЫЕ КОМАНДЫ (всегда доступны в separate) ----------
      case Command.MOVE_FORWARD:
        return this.moveForward(currentDirection, onDirectionChange);
      case Command.MOVE_BACKWARD:
        return this.moveBackward(currentDirection, onDirectionChange);
      case Command.TURN_LEFT:
        return this.turnLeft();
      case Command.TURN_RIGHT:
        return this.turnRight();
      case Command.TURN_AROUND:
        return this.turnAround();
      case Command.SYNC_BODY:
        return this.syncBody();
      case Command.SET_ANGLE:
        return this.setAngle(currentDirection);
      case Command.RELATIVE_TURN:
        return this.relativeTurn(currentDirection);
      case Command.SHOW_AIM:
        return this.showAim();

      // ---------- КЛАССИЧЕСКИЕ КОМАНДЫ (зависят от controlMode) ----------
      case Command.UP:
        if (this.controlMode === ControlMode.CLASSIC) {
          // В классическом режиме UP – движение вверх
          return this.moveClassic(0, -1, currentDirection, onDirectionChange);
        } else {
          // В separate – можно интерпретировать как движение вперёд? Нет, лучше игнорировать или эмулировать.
          // По умолчанию игнорируем.
          return 'ok';
        }
      case Command.DOWN:
        if (this.controlMode === ControlMode.CLASSIC) {
          return this.moveClassic(0, 1, currentDirection, onDirectionChange);
        }
        return 'ok';
      case Command.LEFT:
        if (this.controlMode === ControlMode.CLASSIC) {
          // LEFT = поворот влево + движение влево
          this.turnLeft();
          return this.moveClassic(-1, 0, currentDirection, onDirectionChange);
        }
        return 'ok';
      case Command.RIGHT:
        if (this.controlMode === ControlMode.CLASSIC) {
          this.turnRight();
          return this.moveClassic(1, 0, currentDirection, onDirectionChange);
        }
        return 'ok';

      // ---------- ОСТАЛЬНЫЕ КОМАНДЫ (без изменений) ----------
      default:
        log('MovementExecutor', 'execute', `Ignored command: ${cmd}`);
        return 'ok';
    }
  }

  // --------------------------------------------------------------------------
  // НОВЫЕ КОМАНДЫ (раздельное управление)
  // --------------------------------------------------------------------------

  private async moveForward(dir: string, onDirectionChange: (dir: string) => void): Promise<'ok' | 'dead'> {
    const angle = this.player.getTurretAngle();
    const delta = this.angleToDelta(angle);
    if (!delta) return 'ok';
    return this.performMove(delta.dx, delta.dy, dir, onDirectionChange);
  }

  private async moveBackward(dir: string, onDirectionChange: (dir: string) => void): Promise<'ok' | 'dead'> {
    const hullDir = this.player.getHullDirection();
    const delta = this.directionToDelta(hullDir, -1);
    if (!delta) return 'ok';
    return this.performMove(delta.dx, delta.dy, dir, onDirectionChange);
  }

  private turnLeft(): 'ok' {
    this.player.turnTurretLeft();
    return 'ok';
  }

  private turnRight(): 'ok' {
    this.player.turnTurretRight();
    return 'ok';
  }

  private turnAround(): 'ok' {
    this.player.turnTurretAround();
    return 'ok';
  }

  private syncBody(): 'ok' {
    this.player.syncBodyWithTurret();
    return 'ok';
  }

  private async setAngle(cmd: Command): Promise<'ok'> {
    // Парсим следующий параметр (угол)
    // В реальной команде SET_ANGLE идёт с числовым аргументом
    // Для упрощения используем eventBus, чтобы получить значение из программы
    // В этой заглушке не обрабатываем, но в реальном движке нужно получать аргумент.
    // Пока просто логируем.
    console.log('[Movement] SET_ANGLE not fully implemented');
    return 'ok';
  }

  private async relativeTurn(cmd: Command): Promise<'ok'> {
    console.log('[Movement] RELATIVE_TURN not fully implemented');
    return 'ok';
  }

  private async showAim(): Promise<'ok'> {
    eventBus.emit('SHOW_AIM_LINE', { pos: this.player.getPosition(), angle: this.player.getTurretAngle() });
    console.log('[Movement] SHOW_AIM emitted');
    return 'ok';
  }

  // --------------------------------------------------------------------------
  // КЛАССИЧЕСКОЕ ДВИЖЕНИЕ (для обратной совместимости)
  // --------------------------------------------------------------------------
  private async moveClassic(dx: number, dy: number, dir: string, onDirectionChange: (dir: string) => void): Promise<'ok' | 'dead'> {
    // В классическом режиме движение не зависит от башни
    return this.performMove(dx, dy, dir, onDirectionChange);
  }

  // --------------------------------------------------------------------------
  // ОБЩАЯ ЛОГИКА ПЕРЕМЕЩЕНИЯ
  // --------------------------------------------------------------------------
  private async performMove(dx: number, dy: number, dir: string, onDirectionChange: (dir: string) => void): Promise<'ok' | 'dead'> {
    const oldPos = this.player.getPosition();
    const newPos = { col: oldPos.col + dx, row: oldPos.row + dy };

    // Определяем новое направление (если команда изменила направление корпуса? В separate команды движения не меняют направление)
    // Для классических команд LEFT/RIGHT направление уже изменено до вызова.
    onDirectionChange(dir);

    // Границы
    if (newPos.col < 0 || newPos.col >= this.level.width ||
        newPos.row < 0 || newPos.row >= this.level.height) {
      console.log(`   ❌ OUT OF BOUNDS -> DEAD`);
      eventBus.emit('PLAYER_DIED', { cause: 'out_of_bounds', pos: newPos });
      return 'dead';
    }

    const tile = this.level.map[newPos.row][newPos.col];
    console.log(`   target tile code=${tile} (${TileType[tile] || 'UNKNOWN'})`);

    // Проверка на смерть
    if (!this.explorationMode) {
      if (isWall(tile)) {
        console.log(`   🧱 WALL -> DEAD`);
        eventBus.emit('PLAYER_DIED', { cause: 'wall', pos: newPos });
        return 'dead';
      }
      if (isHole(tile) && !this.toolsExecutor.hasActiveWing()) {
        console.log(`   🕳️ HOLE without active wings -> DEAD`);
        eventBus.emit('PLAYER_DIED', { cause: 'hole', pos: newPos });
        return 'dead';
      }
      if (isDeadlyLiquid(tile) && !this.toolsExecutor.hasActiveWing()) {
        console.log(`   🌊 LAVA/WATER without active wings -> DEAD`);
        eventBus.emit('PLAYER_DIED', { cause: 'liquid', pos: newPos });
        return 'dead';
      }
    }

    // Дверь без ключа
    if (tile === TileType.DOOR_LOCKED) {
      if (this.inventory.keys.length === 0) {
        console.log(`   🔒 LOCKED DOOR and no key -> DEAD`);
        eventBus.emit('PLAYER_DIED', { cause: 'locked_door', pos: newPos });
        return 'dead';
      } else {
        this.level.map[newPos.row][newPos.col] = TileType.DOOR_UNLOCKED;
        this.inventory.keys.pop();
        this.backdoorUsed = true;
        console.log(`   🔑 DOOR unlocked using key, remaining keys=${this.inventory.keys.length}`);
        eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
        eventBus.emit('DOOR_UNLOCKED', { pos: newPos });
      }
    }

    if (tile === TileType.BRICK) {
      console.log(`   🧱 BRICK (needs PUSH) -> DEAD`);
      eventBus.emit('PLAYER_DIED', { cause: 'brick', pos: newPos });
      return 'dead';
    }

    const monsterHere = this.level.objects?.monsters?.find((m: any) =>
      m.position.col === newPos.col && m.position.row === newPos.row
    );
    if (monsterHere && !this.explorationMode && !monsterHere.isTamed && !monsterHere.isRidden) {
      console.log(`   👾 MONSTER at (${newPos.col},${newPos.row}) -> DEAD`);
      eventBus.emit('PLAYER_DIED', { cause: 'monster', pos: newPos, monsterId: monsterHere.id });
      return 'dead';
    }

    // Клей
    if (tile === TileType.GLUE && !this.player.isGlued()) {
      this.tilesExecutor.processGlue(newPos);
    }

    // Клетка
    if (tile === TileType.CAGE) {
      const trapped = this.tilesExecutor.processCage(newPos, 'player');
      if (trapped) {
        eventBus.emit('PLAYER_DIED', { cause: 'cage', pos: newPos });
        return 'dead';
      }
    }

    // Перемещение
    this.player.moveClassic?.(dx, dy); // В Player нужно добавить метод moveClassic или использовать общий
    // Для совместимости: вызываем нужные методы Player
    // В новой версии Player есть методы moveForward/moveBackward, а также moveUp/Down/Left/Right для классики.
    // Здесь мы уже определили, что команда движения, поэтому вызываем соответствующий метод.
    if (dx === 0 && dy === -1) this.player.moveUp();
    else if (dx === 0 && dy === 1) this.player.moveDown();
    else if (dx === -1 && dy === 0) this.player.moveLeft();
    else if (dx === 1 && dy === 0) this.player.moveRight();

    const finalPos = this.player.getPosition();
    console.log(`   ✅ MOVED to (${finalPos.col},${finalPos.row})`);

    // Сбор предметов
    const finalTile = this.level.map[finalPos.row][finalPos.col];
    const itemIndex = this.level.items?.findIndex((it: any) => it.pos.col === finalPos.col && it.pos.row === finalPos.row);
    if (itemIndex !== undefined && itemIndex !== -1) {
      const item = this.level.items[itemIndex];
      console.log(`   📦 Found item in items[]: id=${item.id}`);
      this.pickupItemFromItem(item.id, finalPos.col, finalPos.row);
      this.level.items.splice(itemIndex, 1);
    } else if (isPickupItem(finalTile)) {
      console.log(`   📦 Found pickup tile: ${TileType[finalTile]}`);
      this.pickupItem(finalPos.col, finalPos.row, finalTile);
    }

    // Телепорт
    if (finalTile === TileType.TELEPORT_IN) {
      this.tilesExecutor.processTeleport(finalPos);
    }

    // Конвейер
    if (isConveyor(finalTile)) {
      await this.tilesExecutor.processConveyor(finalPos, '');
    }

    // Пружина
    if (finalTile === TileType.SPRING) {
      // Направление для пружины – текущее направление игрока (корпуса)
      await this.tilesExecutor.processSpring(finalPos, this.player.getHullDirection());
    }

    // Чёрный ящик
    if (finalTile === TileType.BLACK_BOX) {
      this.tilesExecutor.processBlackBox(finalPos);
    }

    // Механизмы
    if (finalTile === TileType.BUTTON) this.tilesExecutor.processButton(finalPos);
    if (finalTile === TileType.LEVER) this.tilesExecutor.processLever(finalPos);
    if (finalTile === TileType.TIMER) this.tilesExecutor.processTimer(finalPos);
    if (finalTile === TileType.SENSOR) this.tilesExecutor.processSensor(finalPos);
    if (finalTile === TileType.SORTER) this.tilesExecutor.processSorter(finalPos);

    // Магнит – обрабатывается отдельно в TilesExecutor
    if (finalTile === TileType.MAGNET) {
      // Можно вызвать специальный метод, но для простоты оставим
    }

    // Замедляющее поле – сообщаем игроку
    if (finalTile === TileType.SLOW_FIELD) {
      this.player.setSlowFactor(2);
    } else {
      this.player.resetSlowFactor();
    }

    return 'ok';
  }

  // --------------------------------------------------------------------------
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // --------------------------------------------------------------------------
  private angleToDelta(angle: number): { dx: number; dy: number } | null {
    switch (angle) {
      case 0:   return { dx: 0, dy: -1 };
      case 90:  return { dx: 1, dy: 0 };
      case 180: return { dx: 0, dy: 1 };
      case 270: return { dx: -1, dy: 0 };
      default:  return null;
    }
  }

  private directionToDelta(dir: 'up'|'down'|'left'|'right', multiplier: number = 1): { dx: number; dy: number } | null {
    switch (dir) {
      case 'up':    return { dx: 0, dy: -1 * multiplier };
      case 'down':  return { dx: 0, dy: 1 * multiplier };
      case 'left':  return { dx: -1 * multiplier, dy: 0 };
      case 'right': return { dx: 1 * multiplier, dy: 0 };
      default:      return null;
    }
  }

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
  }

  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
