// src/modules/execution/tools.ts
// ============================================================================
// ИНСТРУМЕНТЫ С ВРЕМЕННЫМИ ЭФФЕКТАМИ
// ============================================================================
// - WING активирует полёт на 2 хода, затем отключается
// - DRILL/HOOK/BAIT остаются одноразовыми
// ============================================================================

import { TileType, Inventory } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import { log, logInfo } from './helpers';

export class ToolsExecutor {
  private level: any;
  private player: any;
  private inventory: Inventory;
  private backdoorUsed: boolean;
  private wingRemainingTurns: number = 0; // сколько ходов осталось летать

  constructor(level: any, player: any, inventory: Inventory) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
    this.backdoorUsed = false;
  }

  // DRILL – разрушить стену
  public executeDrill(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    if (!this.inventory.hasDrill) return 'ok';
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
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    }
    return 'ok';
  }

  // HOOK – притянуться к стене
  public executeHook(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    if (!this.inventory.hasHook) return 'ok';
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
      if (checkPos.col < 0 || checkPos.col >= this.level.width || checkPos.row < 0 || checkPos.row >= this.level.height) break;
      const t = this.level.map[checkPos.row][checkPos.col];
      if (t === TileType.WALL || t === TileType.FAKE_WALL) {
        targetPos = checkPos;
        break;
      }
    }
    if (targetPos) {
      const landPos = { col: targetPos.col - dx, row: targetPos.row - dy };
      if (landPos.col >= 0 && landPos.col < this.level.width && landPos.row >= 0 && landPos.row < this.level.height) {
        const landTile = this.level.map[landPos.row][landPos.col];
        if (landTile !== TileType.WALL && landTile !== TileType.HOLE && landTile !== TileType.BRICK) {
          this.player.teleport(landPos);
          this.inventory.hasHook = false;
          this.inventory.tools = this.inventory.tools.filter(t => t !== 'hook');
          this.backdoorUsed = true;
          eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
        }
      }
    }
    return 'ok';
  }

  // WING – активировать крылья на 2 хода
  public executeWing(): 'ok' {
    if (!this.inventory.hasWing) return 'ok';
    this.wingRemainingTurns = 2;
    this.inventory.hasWing = false; // сам инструмент расходуется
    this.inventory.tools = this.inventory.tools.filter(t => t !== 'wing');
    logInfo('ToolsExecutor', 'executeWing', `Wings activated for 2 turns`);
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    return 'ok';
  }

  // BAIT – отвлечь монстров (без изменений)
  public executeBait(): 'ok' {
    if (!this.inventory.hasBait) return 'ok';
    this.inventory.hasBait = false;
    this.inventory.tools = this.inventory.tools.filter(t => t !== 'bait');
    this.backdoorUsed = true;
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    const pos = this.player.getPosition();
    const monsters = this.level.objects?.monsters || [];
    for (const monster of monsters) {
      const dist = Math.abs(monster.position.col - pos.col) + Math.abs(monster.position.row - pos.row);
      if (dist <= 3) {
        monster.isDistracted = true;
        monster.distractedTurns = 3;
      }
    }
    return 'ok';
  }

  // Проверка, активны ли крылья (вызывается из MovementExecutor)
  public hasActiveWing(): boolean {
    return this.wingRemainingTurns > 0;
  }

  // Уменьшить счётчик крыльев после каждого хода (вызывается из ASTRunner)
  public decrementWingTurn(): void {
    if (this.wingRemainingTurns > 0) {
      this.wingRemainingTurns--;
      if (this.wingRemainingTurns === 0) {
        logInfo('ToolsExecutor', 'decrementWingTurn', 'Wings effect expired');
        eventBus.emit('WINGS_EXPIRED');
      }
    }
  }

  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
