// src/modules/execution/inventory.ts
// Команды инвентаря: PICKUP, DROP, USE_KEY
// Добавлена поддержка ключа от клетки (cage_key)

import { TileType, Inventory } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import { log, logInfo, logError } from './helpers';
import { TilesExecutor } from './tiles';

export class InventoryExecutor {
  private level: any;
  private player: any;
  private inventory: Inventory;
  private tilesExecutor: TilesExecutor;

  constructor(level: any, player: any, inventory: Inventory) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
    this.tilesExecutor = new TilesExecutor(level, player, inventory);
  }

  /**
   * PICKUP — подобрать предмет с текущей клетки
   */
  public executePickup(): 'ok' {
    const pos = this.player.getPosition();
    const tile = this.level.map[pos.row][pos.col];

    log('InventoryExecutor', 'executePickup', `Picking up at (${pos.col},${pos.row}), tile=${tile}`);

    switch (tile) {
      case TileType.KEY:
        this.inventory.keys.push(`key_${pos.col}_${pos.row}`);
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        logInfo('InventoryExecutor', 'executePickup', `Picked up key, total keys: ${this.inventory.keys.length}`);
        break;
      case TileType.CORN:
        this.inventory.corn++;
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        logInfo('InventoryExecutor', 'executePickup', `Picked up corn, total: ${this.inventory.corn}`);
        break;
      case TileType.CORE:
        this.inventory.cores++;
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        logInfo('InventoryExecutor', 'executePickup', `Picked up core, total: ${this.inventory.cores}`);
        break;
      case TileType.TOOL_DRILL:
        this.inventory.hasDrill = true;
        this.inventory.tools.push('drill');
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        logInfo('InventoryExecutor', 'executePickup', `Picked up drill`);
        break;
      case TileType.TOOL_HOOK:
        this.inventory.hasHook = true;
        this.inventory.tools.push('hook');
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        logInfo('InventoryExecutor', 'executePickup', `Picked up hook`);
        break;
      case TileType.TOOL_WING:
        this.inventory.hasWing = true;
        this.inventory.tools.push('wing');
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        logInfo('InventoryExecutor', 'executePickup', `Picked up wing`);
        break;
      case TileType.TOOL_BAIT:
        this.inventory.hasBait = true;
        this.inventory.tools.push('bait');
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        logInfo('InventoryExecutor', 'executePickup', `Picked up bait`);
        break;
      case TileType.CAGE_KEY:
        this.inventory.keys.push('cage_key');
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        logInfo('InventoryExecutor', 'executePickup', `Picked up cage key`);
        break;
      case TileType.GEM:
        this.inventory.cores += 5;
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        logInfo('InventoryExecutor', 'executePickup', `Picked up gem, +5 cores`);
        break;
      default:
        log('InventoryExecutor', 'executePickup', `Nothing to pick up at (${pos.col},${pos.row})`);
        return 'ok';
    }

    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    eventBus.emit('OBJECT_COLLECTED', { objectId: `${tile}_${pos.col}_${pos.row}` });
    return 'ok';
  }

  /**
   * DROP — выбросить предмет на текущую клетку
   */
  public executeDrop(): 'ok' {
    const pos = this.player.getPosition();
    const tile = this.level.map[pos.row][pos.col];

    if (tile !== TileType.PLATFORM) {
      log('InventoryExecutor', 'executeDrop', `Cannot drop item on non-platform at (${pos.col},${pos.row})`);
      return 'ok';
    }

    if (this.inventory.keys.length > 0) {
      const keyId = this.inventory.keys.pop();
      this.level.map[pos.row][pos.col] = TileType.KEY;
      logInfo('InventoryExecutor', 'executeDrop', `Dropped key at (${pos.col},${pos.row})`);
    } else if (this.inventory.corn > 0) {
      this.inventory.corn--;
      this.level.map[pos.row][pos.col] = TileType.CORN;
      logInfo('InventoryExecutor', 'executeDrop', `Dropped corn at (${pos.col},${pos.row})`);
    } else if (this.inventory.cores > 0) {
      this.inventory.cores--;
      this.level.map[pos.row][pos.col] = TileType.CORE;
      logInfo('InventoryExecutor', 'executeDrop', `Dropped core at (${pos.col},${pos.row})`);
    } else if (this.inventory.hasDrill) {
      this.inventory.hasDrill = false;
      this.inventory.tools = this.inventory.tools.filter(t => t !== 'drill');
      this.level.map[pos.row][pos.col] = TileType.TOOL_DRILL;
      logInfo('InventoryExecutor', 'executeDrop', `Dropped drill at (${pos.col},${pos.row})`);
    } else if (this.inventory.hasHook) {
      this.inventory.hasHook = false;
      this.inventory.tools = this.inventory.tools.filter(t => t !== 'hook');
      this.level.map[pos.row][pos.col] = TileType.TOOL_HOOK;
      logInfo('InventoryExecutor', 'executeDrop', `Dropped hook at (${pos.col},${pos.row})`);
    } else if (this.inventory.hasWing) {
      this.inventory.hasWing = false;
      this.inventory.tools = this.inventory.tools.filter(t => t !== 'wing');
      this.level.map[pos.row][pos.col] = TileType.TOOL_WING;
      logInfo('InventoryExecutor', 'executeDrop', `Dropped wing at (${pos.col},${pos.row})`);
    } else if (this.inventory.hasBait) {
      this.inventory.hasBait = false;
      this.inventory.tools = this.inventory.tools.filter(t => t !== 'bait');
      this.level.map[pos.row][pos.col] = TileType.TOOL_BAIT;
      logInfo('InventoryExecutor', 'executeDrop', `Dropped bait at (${pos.col},${pos.row})`);
    } else {
      log('InventoryExecutor', 'executeDrop', `Nothing to drop at (${pos.col},${pos.row})`);
      return 'ok';
    }

    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    eventBus.emit('OBJECT_DROPPED', { objectId: `${tile}_${pos.col}_${pos.row}`, pos });
    return 'ok';
  }

  /**
   * USE_KEY — использовать ключ для открытия двери или клетки перед игроком
   */
  public executeUseKey(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    let dx = 0, dy = 0;
    switch (lastDirection) {
      case 'up': dy = -1; break;
      case 'down': dy = 1; break;
      case 'left': dx = -1; break;
      case 'right': dx = 1; break;
    }

    const targetPos = {
      col: this.player.getPosition().col + dx,
      row: this.player.getPosition().row + dy,
    };
    const tile = this.level.map[targetPos.row]?.[targetPos.col];

    // Открытие двери
    if (tile === TileType.DOOR_LOCKED && this.inventory.keys.length > 0) {
      this.level.map[targetPos.row][targetPos.col] = TileType.DOOR_UNLOCKED;
      this.inventory.keys.pop();
      logInfo('InventoryExecutor', 'executeUseKey', `Door unlocked at (${targetPos.col},${targetPos.row})`);
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
      eventBus.emit('DOOR_UNLOCKED', { pos: targetPos });
      return 'ok';
    }

    // Открытие клетки
    if (tile === TileType.CAGE) {
      const opened = this.tilesExecutor.openCage(targetPos, this.inventory);
      if (opened) {
        return 'ok';
      }
    }

    log('InventoryExecutor', 'executeUseKey', `No lock at (${targetPos.col},${targetPos.row}) or no suitable key`);
    return 'ok';
  }
}
