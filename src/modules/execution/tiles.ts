// src/modules/execution/tiles.ts
// Взаимодействие с тайлами: телепорты, конвейеры, пружины, чёрный ящик, двери, сбор предметов

import { TileType, Point, Inventory } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import { log, logInfo, logError, getConveyorDirection, isWall, isHole } from './helpers';

export class TilesExecutor {
  private level: any;
  private player: any;
  private inventory: Inventory;

  constructor(level: any, player: any, inventory: Inventory) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
  }

  /**
   * Обработка телепорта
   */
  public handleTeleport(entryPos: Point): boolean {
    const teleport = this.level.objects.teleports?.find((t: any) => 
      t.entry.col === entryPos.col && t.entry.row === entryPos.row
    );
    if (!teleport) return false;

    const exitTile = this.level.map[teleport.exit.row]?.[teleport.exit.col];
    const isExitBlocked = isWall(exitTile) || isHole(exitTile) || exitTile === TileType.BRICK || exitTile === TileType.DOOR_LOCKED;
    
    if (!isExitBlocked) {
      this.player.teleport(teleport.exit);
      logInfo('TilesExecutor', 'handleTeleport', `Teleported from (${entryPos.col},${entryPos.row}) to (${teleport.exit.col},${teleport.exit.row})`);
      eventBus.emit('PLAYER_TELEPORT', { from: entryPos, to: teleport.exit });
      return true;
    } else {
      log('TilesExecutor', 'handleTeleport', `Teleport exit blocked at (${teleport.exit.col},${teleport.exit.row})`);
      return false;
    }
  }

  /**
   * Обработка конвейера (многократное перемещение)
   */
  public async handleConveyor(tile: TileType, currentPos: Point): Promise<Point> {
    const direction = getConveyorDirection(tile);
    if (!direction) return currentPos;

    let dx = 0, dy = 0;
    switch (direction) {
      case 'up': dy = -1; break;
      case 'down': dy = 1; break;
      case 'left': dx = -1; break;
      case 'right': dx = 1; break;
    }

    const newPos = {
      col: currentPos.col + dx,
      row: currentPos.row + dy,
    };

    if (newPos.col < 0 || newPos.col >= this.level.width ||
        newPos.row < 0 || newPos.row >= this.level.height) {
      return currentPos;
    }

    const targetTile = this.level.map[newPos.row][newPos.col];
    if (!isWall(targetTile) && !isHole(targetTile) && targetTile !== TileType.BRICK) {
      this.player.teleport(newPos);
      log('TilesExecutor', 'handleConveyor', `Conveyor moved player to (${newPos.col},${newPos.row})`);
      eventBus.emit('PLAYER_MOVED', { from: currentPos, to: newPos });
      // Рекурсивно применяем эффект следующего конвейера
      const nextTile = this.level.map[newPos.row][newPos.col];
      if (nextTile >= TileType.CONVEYOR_UP && nextTile <= TileType.CONVEYOR_RIGHT) {
        return this.handleConveyor(nextTile, newPos);
      }
      return newPos;
    }

    return currentPos;
  }

  /**
   * Обработка пружины (выбрасывание)
   */
  public handleSpring(direction: 'up' | 'down' | 'left' | 'right', force: number = 3): Point {
    let dx = 0, dy = 0;
    switch (direction) {
      case 'up': dy = -force; break;
      case 'down': dy = force; break;
      case 'left': dx = -force; break;
      case 'right': dx = force; break;
    }

    const currentPos = this.player.getPosition();
    const newPos = {
      col: Math.max(0, Math.min(currentPos.col + dx, this.level.width - 1)),
      row: Math.max(0, Math.min(currentPos.row + dy, this.level.height - 1)),
    };

    const targetTile = this.level.map[newPos.row][newPos.col];
    if (!isWall(targetTile) && !isHole(targetTile) && targetTile !== TileType.BRICK) {
      this.player.teleport(newPos);
      logInfo('TilesExecutor', 'handleSpring', `Spring launched player to (${newPos.col},${newPos.row})`);
      eventBus.emit('PLAYER_MOVED', { from: currentPos, to: newPos });
      return newPos;
    }

    return currentPos;
  }

  /**
   * Обработка чёрного ящика (преобразование инвентаря)
   */
  public handleBlackBox(pos: Point, mappingId: string, processor: any): void {
    const blackBox = this.level.objects.blackBoxes?.find((b: any) => 
      b.position.col === pos.col && b.position.row === pos.row
    );
    if (!blackBox) return;

    logInfo('TilesExecutor', 'handleBlackBox', `BlackBox triggered at (${pos.col},${pos.row}) mapping: ${mappingId}`);
    eventBus.emit('BLACK_BOX_ACTIVATED', { pos, mapping: mappingId });

    // Используем BlackBoxProcessor для трансформации
    if (processor && processor.processSISO) {
      // Пример: преобразуем кукурузу в ядро
      if (mappingId === 'corn_to_core' && this.inventory.corn > 0) {
        this.inventory.corn--;
        this.inventory.cores++;
        logInfo('TilesExecutor', 'handleBlackBox', `Corn converted to core`);
        eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
      } else if (mappingId === 'core_to_corn' && this.inventory.cores > 0) {
        this.inventory.cores--;
        this.inventory.corn++;
        logInfo('TilesExecutor', 'handleBlackBox', `Core converted to corn`);
        eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
      }
    }
  }

  /**
   * Обработка открытия двери при движении (если есть ключ)
   */
  public tryOpenDoor(pos: Point): boolean {
    const tile = this.level.map[pos.row][pos.col];
    if (tile === TileType.DOOR_LOCKED && this.inventory.keys.length > 0) {
      this.level.map[pos.row][pos.col] = TileType.DOOR_UNLOCKED;
      this.inventory.keys.pop();
      logInfo('TilesExecutor', 'tryOpenDoor', `Door unlocked at (${pos.col},${pos.row})`);
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
      eventBus.emit('DOOR_UNLOCKED', { pos });
      return true;
    }
    return false;
  }

  /**
   * Сбор предмета с клетки
   */
  public pickupItem(pos: Point, tile: TileType): boolean {
    switch (tile) {
      case TileType.KEY:
        this.inventory.keys.push(`key_${pos.col}_${pos.row}`);
        break;
      case TileType.CORN:
        this.inventory.corn++;
        break;
      case TileType.CORE:
        this.inventory.cores++;
        break;
      case TileType.TOOL_DRILL:
        this.inventory.hasDrill = true;
        this.inventory.tools.push('drill');
        break;
      case TileType.TOOL_HOOK:
        this.inventory.hasHook = true;
        this.inventory.tools.push('hook');
        break;
      case TileType.TOOL_WING:
        this.inventory.hasWing = true;
        this.inventory.tools.push('wing');
        break;
      case TileType.TOOL_BAIT:
        this.inventory.hasBait = true;
        this.inventory.tools.push('bait');
        break;
      default:
        return false;
    }
    this.level.map[pos.row][pos.col] = TileType.PLATFORM;
    logInfo('TilesExecutor', 'pickupItem', `Picked up ${TileType[tile]} at (${pos.col},${pos.row})`);
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    eventBus.emit('OBJECT_COLLECTED', { objectId: `${tile}_${pos.col}_${pos.row}` });
    return true;
  }
}
