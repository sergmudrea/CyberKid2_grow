// src/modules/execution/movement.ts
// Реализация команд движения (UP, DOWN, LEFT, RIGHT)
// Обрабатывает: движение, сбор предметов, телепорты, конвейеры, пружины, чёрный ящик, двери, смертельные тайлы

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

export class MovementExecutor {
  private level: any; // LevelData
  private player: any;
  private inventory: Inventory;
  private lastDirection: 'up' | 'down' | 'left' | 'right';
  private explorationMode: boolean;

  constructor(level: any, player: any, inventory: Inventory) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
    this.explorationMode = false;
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
    if (monsterHere && !this.explorationMode && !monsterHere.isTamed) {
      log('MovementExecutor', 'execute', `Monster at (${newPos.col},${newPos.row})`);
      return 'dead';
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
      this.handleTeleport(newPos);
    }

    // Обработка конвейера (после перемещения)
    const finalPos = this.player.getPosition();
    const finalTile = this.level.map[finalPos.row][finalPos.col];
    if (isConveyor(finalTile)) {
      await this.handleConveyor(finalTile);
    }

    // Обработка пружины
    if (finalTile === TileType.SPRING) {
      await this.handleSpring(newDirection);
    }

    // Обработка чёрного ящика
    if (finalTile === TileType.BLACK_BOX) {
      this.handleBlackBox(finalPos);
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
      default:
        return;
    }
    this.level.map[row][col] = TileType.PLATFORM;
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    eventBus.emit('OBJECT_COLLECTED', { objectId: `${tile}_${col}_${row}` });
  }

  private handleTeleport(entryPos: Point): void {
    const teleport = this.level.objects.teleports?.find((t: any) => t.entry.col === entryPos.col && t.entry.row === entryPos.row);
    if (teleport) {
      const exitTile = this.level.map[teleport.exit.row]?.[teleport.exit.col];
      const isExitBlocked = isWall(exitTile) || isHole(exitTile) || exitTile === TileType.BRICK;
      if (!isExitBlocked) {
        this.player.teleport(teleport.exit);
        logInfo('MovementExecutor', 'handleTeleport', `Teleported from (${entryPos.col},${entryPos.row}) to (${teleport.exit.col},${teleport.exit.row})`);
        eventBus.emit('PLAYER_TELEPORT', { from: entryPos, to: teleport.exit });
      } else {
        log('MovementExecutor', 'handleTeleport', `Teleport exit blocked at (${teleport.exit.col},${teleport.exit.row})`);
      }
    }
  }

  private async handleConveyor(tile: TileType): Promise<void> {
    const direction = getConveyorDirection(tile);
    if (!direction) return;

    let dx = 0, dy = 0;
    switch (direction) {
      case 'up': dy = -1; break;
      case 'down': dy = 1; break;
      case 'left': dx = -1; break;
      case 'right': dx = 1; break;
    }

    const newPos = {
      col: this.player.getPosition().col + dx,
      row: this.player.getPosition().row + dy,
    };

    if (newPos.col >= 0 && newPos.col < this.level.width &&
        newPos.row >= 0 && newPos.row < this.level.height) {
      const targetTile = this.level.map[newPos.row][newPos.col];
      if (!isWall(targetTile) && !isHole(targetTile) && targetTile !== TileType.BRICK) {
        this.player.move(direction === 'up' ? Command.UP : direction === 'down' ? Command.DOWN : direction === 'left' ? Command.LEFT : Command.RIGHT);
        log('MovementExecutor', 'handleConveyor', `Conveyor moved player to (${newPos.col},${newPos.row})`);
        // Рекурсивно применяем эффект следующего конвейера
        const nextTile = this.level.map[this.player.getPosition().row][this.player.getPosition().col];
        if (isConveyor(nextTile)) {
          await this.handleConveyor(nextTile);
        }
      }
    }
  }

  private async handleSpring(direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
    let dx = 0, dy = 0;
    const force = 3;
    switch (direction) {
      case 'up': dy = -force; break;
      case 'down': dy = force; break;
      case 'left': dx = -force; break;
      case 'right': dx = force; break;
    }

    const newPos = {
      col: Math.max(0, Math.min(this.player.getPosition().col + dx, this.level.width - 1)),
      row: Math.max(0, Math.min(this.player.getPosition().row + dy, this.level.height - 1)),
    };

    const targetTile = this.level.map[newPos.row][newPos.col];
    if (!isWall(targetTile) && !isHole(targetTile) && targetTile !== TileType.BRICK) {
      this.player.teleport(newPos);
      logInfo('MovementExecutor', 'handleSpring', `Spring launched player to (${newPos.col},${newPos.row})`);
      eventBus.emit('PLAYER_MOVED', { from: this.player.getPosition(), to: newPos });
    }
  }

  private handleBlackBox(pos: Point): void {
    const blackBox = this.level.objects.blackBoxes?.find((b: any) => b.position.col === pos.col && b.position.row === pos.row);
    if (blackBox && blackBox.mapping) {
      // Симулируем вызов чёрного ящика (преобразование инвентаря)
      // В реальности вызовем BlackBoxProcessor
      logInfo('MovementExecutor', 'handleBlackBox', `BlackBox triggered at (${pos.col},${pos.row}) mapping: ${blackBox.mapping}`);
      eventBus.emit('BLACK_BOX_ACTIVATED', { pos, mapping: blackBox.mapping });
    }
  }

  private backdoorUsed: boolean = false;
}
