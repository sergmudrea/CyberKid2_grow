// src/modules/execution/movement.ts
// ============================================================================
// ОСНОВНАЯ ЛОГИКА ДВИЖЕНИЯ – ИСПРАВЛЕННАЯ
// ============================================================================
// - При входе на запертую дверь, если есть ключ, дверь открывается и ключ расходуется
// - При подборе предмета инвентарь обновляется через событие
// - Добавлена проверка на сбор предметов при движении
// ============================================================================

import { Command, TileType, Point, Inventory } from '../../types/index';
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

  public async execute(
    cmd: Command,
    currentDirection: 'up' | 'down' | 'left' | 'right',
    onDirectionChange: (dir: 'up' | 'down' | 'left' | 'right') => void
  ): Promise<'ok' | 'dead'> {
    let dx = 0, dy = 0;
    let newDirection: 'up' | 'down' | 'left' | 'right' = 'right';

    switch (cmd) {
      case Command.UP:    dy = -1; newDirection = 'up'; break;
      case Command.DOWN:  dy = 1;  newDirection = 'down'; break;
      case Command.LEFT:  dx = -1; newDirection = 'left'; break;
      case Command.RIGHT: dx = 1;  newDirection = 'right'; break;
      default: return 'ok';
    }

    onDirectionChange(newDirection);
    this.lastDirection = newDirection;

    const oldPos = this.player.getPosition();
    const newPos = { col: oldPos.col + dx, row: oldPos.row + dy };

    // Границы
    if (newPos.col < 0 || newPos.col >= this.level.width ||
        newPos.row < 0 || newPos.row >= this.level.height) {
      log('MovementExecutor', 'execute', `Out of bounds at (${newPos.col},${newPos.row})`);
      return 'dead';
    }

    const tile = this.level.map[newPos.row][newPos.col];
    log('MovementExecutor', 'execute', `Moving from (${oldPos.col},${oldPos.row}) to (${newPos.col},${newPos.row}), tile=${tile}`);

    // Проверка на смерть
    if (!this.explorationMode) {
      if (isWall(tile)) return 'dead';
      if (isHole(tile) && !this.inventory.hasWing) return 'dead';
      if (isDeadlyLiquid(tile) && !this.inventory.hasWing) return 'dead';
    }

    // Дверь без ключа – смерть
    if (tile === TileType.DOOR_LOCKED) {
      if (this.inventory.keys.length === 0) {
        log('MovementExecutor', 'execute', `Locked door at (${newPos.col},${newPos.row}) and no key`);
        return 'dead';
      } else {
        // Есть ключ – открываем дверь, расходуем ключ
        this.level.map[newPos.row][newPos.col] = TileType.DOOR_UNLOCKED;
        const removedKey = this.inventory.keys.pop();
        this.backdoorUsed = true;
        logInfo('MovementExecutor', 'execute', `Door unlocked at (${newPos.col},${newPos.row}) using key ${removedKey}`);
        eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
        eventBus.emit('DOOR_UNLOCKED', { pos: newPos });
        // После открытия двери продолжаем движение (дверь теперь проходима)
      }
    }

    // Кирпич – смерть (требуется PUSH)
    if (tile === TileType.BRICK) return 'dead';

    // Монстры
    const monsterHere = this.level.objects?.monsters?.find((m: any) =>
      m.position.col === newPos.col && m.position.row === newPos.row
    );
    if (monsterHere && !this.explorationMode && !monsterHere.isTamed && !monsterHere.isRidden) {
      log('MovementExecutor', 'execute', `Monster at (${newPos.col},${newPos.row})`);
      return 'dead';
    }

    // Клей и клетка (ловушка)
    if (tile === TileType.GLUE && !this.player.isGlued()) {
      this.tilesExecutor.processGlue(newPos);
    }
    if (tile === TileType.CAGE) {
      const trapped = this.tilesExecutor.processCage(newPos, 'player');
      if (trapped) return 'dead';
    }

    // Выполняем движение
    this.player.move(cmd);

    // СБОР ПРЕДМЕТОВ (уже после перемещения, но на клетке, на которую вошли)
    const finalPos = this.player.getPosition();
    const finalTile = this.level.map[finalPos.row][finalPos.col];
    if (isPickupItem(finalTile)) {
      this.pickupItem(finalPos.col, finalPos.row, finalTile);
    }

    // Телепорт (если наступили на вход)
    if (finalTile === TileType.TELEPORT_IN) {
      this.tilesExecutor.processTeleport(finalPos);
    }

    // Конвейер (с ограничением глубины)
    if (isConveyor(finalTile)) {
      await this.tilesExecutor.processConveyor(finalPos, cmd);
    }

    // Пружина
    if (finalTile === TileType.SPRING) {
      await this.tilesExecutor.processSpring(finalPos, newDirection);
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
        if (!this.inventory.tools.includes('drill')) this.inventory.tools.push('drill');
        logInfo('MovementExecutor', 'pickupItem', `Picked up drill at (${col},${row})`);
        break;
      case TileType.TOOL_HOOK:
        this.inventory.hasHook = true;
        if (!this.inventory.tools.includes('hook')) this.inventory.tools.push('hook');
        logInfo('MovementExecutor', 'pickupItem', `Picked up hook at (${col},${row})`);
        break;
      case TileType.TOOL_WING:
        this.inventory.hasWing = true;
        if (!this.inventory.tools.includes('wing')) this.inventory.tools.push('wing');
        logInfo('MovementExecutor', 'pickupItem', `Picked up wing at (${col},${row})`);
        break;
      case TileType.TOOL_BAIT:
        this.inventory.hasBait = true;
        if (!this.inventory.tools.includes('bait')) this.inventory.tools.push('bait');
        logInfo('MovementExecutor', 'pickupItem', `Picked up bait at (${col},${row})`);
        break;
      case TileType.CAGE_KEY:
        this.inventory.keys.push('cage_key');
        logInfo('MovementExecutor', 'pickupItem', `Picked up cage key at (${col},${row})`);
        break;
      case TileType.GEM:
        this.inventory.cores += 5;
        logInfo('MovementExecutor', 'pickupItem', `Picked up gem at (${col},${row})`);
        break;
      default:
        return;
    }
    // Очищаем клетку от предмета
    this.level.map[row][col] = TileType.PLATFORM;
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    eventBus.emit('OBJECT_COLLECTED', { objectId: `${tile}_${col}_${row}` });
  }

  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
