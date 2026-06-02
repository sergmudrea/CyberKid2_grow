// src/modules/execution/inventory.ts
// ============================================================================
// ОБРАБОТЧИК КОМАНД ИНВЕНТАРЯ – ИСПРАВЛЕННЫЙ
// ============================================================================
// - USE_KEY теперь правильно определяет клетку перед игроком
// - Открывает дверь или клетку, расходует ключ
// ============================================================================

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

  // PICKUP – без изменений (уже был)
  public executePickup(): 'ok' {
    const pos = this.player.getPosition();
    const tile = this.level.map[pos.row][pos.col];
    log('InventoryExecutor', 'executePickup', `Picking up at (${pos.col},${pos.row}), tile=${tile}`);

    switch (tile) {
      case TileType.KEY:
        this.inventory.keys.push(`key_${pos.col}_${pos.row}`);
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        logInfo('InventoryExecutor', 'executePickup', `Picked up key, total: ${this.inventory.keys.length}`);
        break;
      case TileType.CORN:
        this.inventory.corn++;
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        break;
      case TileType.CORE:
        this.inventory.cores++;
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        break;
      case TileType.TOOL_DRILL:
        this.inventory.hasDrill = true;
        if (!this.inventory.tools.includes('drill')) this.inventory.tools.push('drill');
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        break;
      case TileType.TOOL_HOOK:
        this.inventory.hasHook = true;
        if (!this.inventory.tools.includes('hook')) this.inventory.tools.push('hook');
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        break;
      case TileType.TOOL_WING:
        this.inventory.hasWing = true;
        if (!this.inventory.tools.includes('wing')) this.inventory.tools.push('wing');
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        break;
      case TileType.TOOL_BAIT:
        this.inventory.hasBait = true;
        if (!this.inventory.tools.includes('bait')) this.inventory.tools.push('bait');
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        break;
      case TileType.CAGE_KEY:
        this.inventory.keys.push('cage_key');
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        break;
      case TileType.GEM:
        this.inventory.cores += 5;
        this.level.map[pos.row][pos.col] = TileType.PLATFORM;
        break;
      default:
        return 'ok';
    }
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    return 'ok';
  }

  // DROP – без изменений
  public executeDrop(): 'ok' {
    const pos = this.player.getPosition();
    const tile = this.level.map[pos.row][pos.col];
    if (tile !== TileType.PLATFORM) return 'ok';

    if (this.inventory.keys.length > 0) {
      const keyId = this.inventory.keys.pop()!;
      this.level.map[pos.row][pos.col] = TileType.KEY;
      logInfo('InventoryExecutor', 'executeDrop', `Dropped key ${keyId}`);
    } else if (this.inventory.corn > 0) {
      this.inventory.corn--;
      this.level.map[pos.row][pos.col] = TileType.CORN;
    } else if (this.inventory.cores > 0) {
      this.inventory.cores--;
      this.level.map[pos.row][pos.col] = TileType.CORE;
    } else if (this.inventory.hasDrill) {
      this.inventory.hasDrill = false;
      this.inventory.tools = this.inventory.tools.filter(t => t !== 'drill');
      this.level.map[pos.row][pos.col] = TileType.TOOL_DRILL;
    } else if (this.inventory.hasHook) {
      this.inventory.hasHook = false;
      this.inventory.tools = this.inventory.tools.filter(t => t !== 'hook');
      this.level.map[pos.row][pos.col] = TileType.TOOL_HOOK;
    } else if (this.inventory.hasWing) {
      this.inventory.hasWing = false;
      this.inventory.tools = this.inventory.tools.filter(t => t !== 'wing');
      this.level.map[pos.row][pos.col] = TileType.TOOL_WING;
    } else if (this.inventory.hasBait) {
      this.inventory.hasBait = false;
      this.inventory.tools = this.inventory.tools.filter(t => t !== 'bait');
      this.level.map[pos.row][pos.col] = TileType.TOOL_BAIT;
    } else {
      return 'ok';
    }
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    return 'ok';
  }

  // USE_KEY – ИСПРАВЛЕННЫЙ
  public executeUseKey(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    let dx = 0, dy = 0;
    switch (lastDirection) {
      case 'up':    dy = -1; break;
      case 'down':  dy = 1;  break;
      case 'left':  dx = -1; break;
      case 'right': dx = 1;  break;
    }
    const targetPos = {
      col: this.player.getPosition().col + dx,
      row: this.player.getPosition().row + dy,
    };
    const tile = this.level.map[targetPos.row]?.[targetPos.col];

    // Дверь
    if (tile === TileType.DOOR_LOCKED && this.inventory.keys.length > 0) {
      this.level.map[targetPos.row][targetPos.col] = TileType.DOOR_UNLOCKED;
      this.inventory.keys.pop();
      logInfo('InventoryExecutor', 'executeUseKey', `Door unlocked at (${targetPos.col},${targetPos.row})`);
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
      eventBus.emit('DOOR_UNLOCKED', { pos: targetPos });
      return 'ok';
    }

    // Клетка
    if (tile === TileType.CAGE) {
      const opened = this.tilesExecutor.openCage(targetPos, this.inventory);
      if (opened) {
        eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
        return 'ok';
      }
    }

    log('InventoryExecutor', 'executeUseKey', `No lock/cage at (${targetPos.col},${targetPos.row})`);
    return 'ok';
  }
}
