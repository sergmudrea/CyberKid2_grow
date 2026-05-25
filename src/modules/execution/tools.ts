// src/modules/execution/tools.ts
// Команды инструментов: DRILL, HOOK, WING, BAIT

import { TileType, Inventory } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import { log, logInfo, logError } from './helpers';

export class ToolsExecutor {
  private level: any;
  private player: any;
  private inventory: Inventory;
  private backdoorUsed: boolean;

  constructor(level: any, player: any, inventory: Inventory) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
    this.backdoorUsed = false;
  }

  /**
   * DRILL — разрушить стену перед игроком
   */
  public executeDrill(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    if (!this.inventory.hasDrill) {
      log('ToolsExecutor', 'executeDrill', 'No drill available');
      return 'ok';
    }

    let dx = 0, dy = 0;
    switch (lastDirection) {
      case 'up': dy = -1; break;
      case 'down': dy = 1; break;
      case 'left': dx = -1; break;
      case 'right': dx = 1; break;
    }

    const wallPos = {
      col: this.player.getPosition().col + dx,
      row: this.player.getPosition().row + dy,
    };
    const tile = this.level.map[wallPos.row]?.[wallPos.col];

    if (tile === TileType.WALL || tile === TileType.FAKE_WALL) {
      this.level.map[wallPos.row][wallPos.col] = TileType.PLATFORM;
      this.inventory.hasDrill = false;
      this.inventory.tools = this.inventory.tools.filter(t => t !== 'drill');
      this.backdoorUsed = true;
      logInfo('ToolsExecutor', 'executeDrill', `Wall destroyed at (${wallPos.col},${wallPos.row})`);
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
      eventBus.emit('WALL_DESTROYED', { pos: wallPos });
    } else {
      log('ToolsExecutor', 'executeDrill', `No wall at (${wallPos.col},${wallPos.row})`);
    }

    return 'ok';
  }

  /**
   * HOOK — притянуться к стене в направлении взгляда (максимум 3 клетки)
   */
  public executeHook(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    if (!this.inventory.hasHook) {
      log('ToolsExecutor', 'executeHook', 'No hook available');
      return 'ok';
    }

    let dx = 0, dy = 0;
    switch (lastDirection) {
      case 'up': dy = -1; break;
      case 'down': dy = 1; break;
      case 'left': dx = -1; break;
      case 'right': dx = 1; break;
    }

    let targetPos = null;
    for (let i = 1; i <= 3; i++) {
      const checkPos = {
        col: this.player.getPosition().col + dx * i,
        row: this.player.getPosition().row + dy * i,
      };
      if (checkPos.col < 0 || checkPos.col >= this.level.width ||
          checkPos.row < 0 || checkPos.row >= this.level.height) {
        break;
      }
      const tile = this.level.map[checkPos.row][checkPos.col];
      if (tile === TileType.WALL || tile === TileType.FAKE_WALL) {
        targetPos = checkPos;
        break;
      }
    }

    if (targetPos) {
      this.player.teleport(targetPos);
      this.inventory.hasHook = false;
      this.inventory.tools = this.inventory.tools.filter(t => t !== 'hook');
      this.backdoorUsed = true;
      logInfo('ToolsExecutor', 'executeHook', `Hooked to wall at (${targetPos.col},${targetPos.row})`);
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
      eventBus.emit('PLAYER_TELEPORT', { from: this.player.getPosition(), to: targetPos });
    } else {
      log('ToolsExecutor', 'executeHook', 'No wall found within 3 cells');
    }

    return 'ok';
  }

  /**
   * WING — активировать крылья (позволяет перелетать ямы и лаву/воду)
   */
  public executeWing(): 'ok' {
    if (!this.inventory.hasWing) {
      log('ToolsExecutor', 'executeWing', 'No wings available');
      return 'ok';
    }

    this.inventory.hasWing = false;
    this.inventory.tools = this.inventory.tools.filter(t => t !== 'wing');
    logInfo('ToolsExecutor', 'executeWing', 'Wings activated (can fly over holes/lava/water)');
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    // Эффект крыльев уже учтён в MovementExecutor (проверка hasWing)
    return 'ok';
  }

  /**
   * BAIT — использовать приманку (отвлекает монстров)
   */
  public executeBait(): 'ok' {
    if (!this.inventory.hasBait) {
      log('ToolsExecutor', 'executeBait', 'No bait available');
      return 'ok';
    }

    this.inventory.hasBait = false;
    this.inventory.tools = this.inventory.tools.filter(t => t !== 'bait');
    this.backdoorUsed = true;
    logInfo('ToolsExecutor', 'executeBait', 'Bait used (monsters distracted)');
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    eventBus.emit('BAIT_USED', { pos: this.player.getPosition() });

    // Отвлечение монстров: все монстры в радиусе 3 клеток становятся отвлечёнными на 3 хода
    const pos = this.player.getPosition();
    for (const monster of this.level.objects.monsters) {
      const distance = Math.abs(monster.position.col - pos.col) + Math.abs(monster.position.row - pos.row);
      if (distance <= 3) {
        monster.distracted = true;
        monster.distractedTurns = 3;
        log('ToolsExecutor', 'executeBait', `Monster ${monster.id} distracted`);
      }
    }

    return 'ok';
  }

  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
