// src/modules/execution/movement.ts
// Реализация команд движения (UP, DOWN, LEFT, RIGHT)
// Обрабатывает: движение, сбор предметов, телепорты, конвейеры, пружины, чёрный ящик, двери,
// смертельные тайлы, а также новые механики: клей, клетка (ловушка для игрока)

import { Command, TileType, Point, Inventory } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import { logger } from '../../core/Logger';
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

export class MovementExecutor {
  private level: any;
  private player: any;
  private inventory: Inventory;
  private lastDirection: 'up' | 'down' | 'left' | 'right';
  private explorationMode: boolean;
  private tilesExecutor: TilesExecutor;
  private backdoorUsed: boolean;

  constructor(level: any, player: any, inventory: Inventory) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
    this.explorationMode = false;
    this.tilesExecutor = new TilesExecutor(level, player, inventory);
    this.backdoorUsed = false;
  }

  public setExplorationMode(enabled: boolean): void {
    this.explorationMode = enabled;
  }

  public async execute(cmd: Command, currentDirection: 'up' | 'down' | 'left' | 'right', onDirectionChange: (dir: 'up' | 'down' | 'left' | 'right') => void): Promise<'ok' | 'dead'> {
    let dx = 0, dy = 0;
    let newDirection: 'up' | 'down' | 'left' | 'right' = 'right';

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

    const oldPos = this.player.getPosition();
    const newPos = {
      col: oldPos.col + dx,
      row: oldPos.row + dy,
    };

    // Проверка границ
    if (newPos.col < 0 || newPos.col >= this.level.width ||
        newPos.row < 0 || newPos.row >= this.level.height) {
      log('MovementExecutor', 'execute', `Out of bounds at (${newPos.col},${newPos.row})`);
      return 'dead';
    }

    const tile = this.level.map[newPos.row][newPos.col];
    log('MovementExecutor', 'execute', `Moving from (${oldPos.col},${oldPos.row}) to (${newPos.col},${newPos.row}), tile=${tile}`);

    // Проверка на смертельные тайлы
    if (!this.explorationMode) {
      if (isWall(tile)) {
        log('MovementExecutor', 'execute', `Wall at (${newPos.col},${newPos.row})`);
        return 'dead';
      }
      if (isHole(tile) && !this.inventory.hasWing) {
        log('MovementExecutor', 'execute', `Hole at (${newPos.col},${newPos.row})`);
        return 'dead';
      }
      if (isDeadlyLiquid(tile) && !this.inventory.hasWing) {
        log('MovementExecutor', 'execute', `Lava/Water at (${newPos.col},${newPos.row})`);
        return 'dead';
      }
    }

    // Проверка на закрытую дверь
    if (tile === TileType.DOOR_LOCKED && this.inventory.keys.length === 0) {
      log('MovementExecutor', 'execute', `Locked door at (${newPos.col},${newPos.row})`);
      return 'dead';
    }

    // Проверка на кирпич (требуется команда PUSH)
    if (tile === TileType.BRICK) {
      log('MovementExecutor', 'execute', `Brick at (${newPos.col},${newPos.row}) - use PUSH`);
      return 'dead';
    }

    // Проверка на монстра
    const monsterHere = this.level.objects.monsters?.find((m: any) => m.position.col === newPos.col && m.position.row === newPos.row);
    if (monsterHere && !this.explorationMode && !monsterHere.isTamed && !monsterHere.isRidden) {
      log('MovementExecutor', 'execute', `Monster at (${newPos.col},${newPos.row})`);
      return 'dead';
    }

    // Новая механика: клей (приклеивание)
    if (tile === TileType.GLUE && !this.player.isGlued) {
      this.tilesExecutor.processGlue(newPos);
      // Движение разрешено, но игрок приклеится после входа
    }

    // Новая механика: клетка (ловушка для игрока)
    if (tile === TileType.CAGE) {
      const cage = this.level.objects?.cages?.find((c: any) => c.position.col === newPos.col && c.position.row === newPos.row);
      if (cage && !cage.isClosed) {
        const trapped = this.tilesExecutor.processCage(newPos, 'player');
        if (trapped) {
          // Игрок пойман, движение не завершается успешно, но и не смерть (особый статус)
          // Возвращаем 'dead', чтобы остановить выполнение программы
          return 'dead';
        }
      }
    }

    // Выполняем движение
    this.player.move(cmd);

    // Открываем дверь, если есть ключ (при движении)
    if (tile === TileType.DOOR_LOCKED && this.inventory.keys.length > 0) {
      this.level.map[newPos.row][newPos.col] = TileType.DOOR_UNLOCKED;
      this.inventory.keys.pop();
      this.backdoorUsed = true;
      logInfo('MovementExecutor', 'execute', `Door unlocked at (${newPos.col},${newPos.row})`);
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    }

    // Сбор предметов при движении
    if (isPickupItem(tile)) {
      this.pickupItem(newPos.col, newPos.row, tile);
    }

    // Обработка телепорта
    if (tile === TileType.TELEPORT_IN) {
      this.tilesExecutor.processTeleport(newPos);
    }

    // Обработка конвейера (после перемещения)
    const finalPos = this.player.getPosition();
    const finalTile = this.level.map[finalPos.row][finalPos.col];
    if (isConveyor(finalTile)) {
      await this.tilesExecutor.processConveyor(finalPos, cmd);
    }

    // Обработка пружины
    if (finalTile === TileType.SPRING) {
      await this.tilesExecutor.processSpring(finalPos, newDirection);
    }

    // Обработка чёрного ящика
    if (finalTile === TileType.BLACK_BOX) {
      this.tilesExecutor.processBlackBox(finalPos);
    }

    // Обработка кнопки, рычага, таймера, сенсора, сортировщика
    if (finalTile === TileType.BUTTON) {
      this.tilesExecutor.processButton(finalPos);
    }
    if (finalTile === TileType.LEVER) {
      this.tilesExecutor.processLever(finalPos);
    }
    if (finalTile === TileType.TIMER) {
      this.tilesExecutor.processTimer(finalPos);
    }
    if (finalTile === TileType.SENSOR) {
      this.tilesExecutor.processSensor(finalPos);
    }
    if (finalTile === TileType.SORTER) {
      this.tilesExecutor.processSorter(finalPos);
    }

    return 'ok';
  }

  private pickupItem(col: number, row: number, tile: TileType): void {
    switch (tile) {
      case TileType.KEY:
        this.inventory.keys.push(`key_${col}_${row}`);
        logInfo('MovementExecutor', 'pickupItem', `Picked up key at (${col},${row})`);
        break;
      case TileType.CORN:
        this.inventory.corn++;
        logInfo('MovementExecutor', 'pickupItem', `Picked up corn at (${col},${row})`);
        break;
      case TileType.CORE:
        this.inventory.cores++;
        logInfo('MovementExecutor', 'pickupItem', `Picked up core at (${col},${row})`);
        break;
      case TileType.TOOL_DRILL:
        this.inventory.hasDrill = true;
        this.inventory.tools.push('drill');
        logInfo('MovementExecutor', 'pickupItem', `Picked up drill at (${col},${row})`);
        break;
      case TileType.TOOL_HOOK:
        this.inventory.hasHook = true;
        this.inventory.tools.push('hook');
        logInfo('MovementExecutor', 'pickupItem', `Picked up hook at (${col},${row})`);
        break;
      case TileType.TOOL_WING:
        this.inventory.hasWing = true;
        this.inventory.tools.push('wing');
        logInfo('MovementExecutor', 'pickupItem', `Picked up wing at (${col},${row})`);
        break;
      case TileType.TOOL_BAIT:
        this.inventory.hasBait = true;
        this.inventory.tools.push('bait');
        logInfo('MovementExecutor', 'pickupItem', `Picked up bait at (${col},${row})`);
        break;
      case TileType.CAGE_KEY:
        this.inventory.keys.push('cage_key');
        logInfo('MovementExecutor', 'pickupItem', `Picked up cage key at (${col},${row})`);
        break;
      case TileType.GEM:
        this.inventory.cores += 5; // драгоценность даёт много ядер
        logInfo('MovementExecutor', 'pickupItem', `Picked up gem at (${col},${row})`);
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
