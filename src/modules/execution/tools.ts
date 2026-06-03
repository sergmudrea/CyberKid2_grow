// src/modules/execution/tools.ts
// ============================================================================
// ОБРАБОТЧИК ИНСТРУМЕНТОВ (TOOLS) – ПАТЧ 2.0
// ============================================================================
// Реализует команды:
// - DRILL – разрушить стену перед игроком (расходуется)
// - HOOK  – притянуться к стене в пределах 3 клеток (расходуется)
// - WING  – активировать крылья на 2 хода (позволяют перелетать ямы/лаву/воду)
// - BAIT  – использовать приманку (отвлекает монстров в радиусе 3, расходуется)
// ============================================================================
// Поддерживает:
// - активные крылья с отслеживанием оставшихся ходов (wingActiveTurns)
// - корректный расход предметов
// - генерацию событий INVENTORY_CHANGED и MONSTER_DISTRACTED и т.д.
// ============================================================================

import { TileType, Inventory } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import { log, logInfo, logError } from './helpers';

export class ToolsExecutor {
  private level: any;
  private player: any;
  private inventory: Inventory;
  private backdoorUsed: boolean;
  private wingActiveTurns: number = 0; // сколько ходов осталось летать

  constructor(level: any, player: any, inventory: Inventory) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
    this.backdoorUsed = false;
  }

  // --------------------------------------------------------------------------
  // 1. DRILL – разрушить стену перед игроком
  // --------------------------------------------------------------------------
  public executeDrill(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    if (!this.inventory.hasDrill) {
      log('ToolsExecutor', 'executeDrill', 'No drill available');
      return 'ok';
    }

    let dx = 0, dy = 0;
    switch (lastDirection) {
      case 'up':    dy = -1; break;
      case 'down':  dy = 1;  break;
      case 'left':  dx = -1; break;
      case 'right': dx = 1;  break;
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

  // --------------------------------------------------------------------------
  // 2. HOOK – притянуться к стене (максимум 3 клетки)
  // --------------------------------------------------------------------------
  public executeHook(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    if (!this.inventory.hasHook) {
      log('ToolsExecutor', 'executeHook', 'No hook available');
      return 'ok';
    }

    let dx = 0, dy = 0;
    switch (lastDirection) {
      case 'up':    dy = -1; break;
      case 'down':  dy = 1;  break;
      case 'left':  dx = -1; break;
      case 'right': dx = 1;  break;
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
      // Крюк притягивает игрока к стене, но не на стену, а на клетку перед ней
      const landPos = {
        col: targetPos.col - dx,
        row: targetPos.row - dy,
      };
      if (landPos.col >= 0 && landPos.col < this.level.width &&
          landPos.row >= 0 && landPos.row < this.level.height) {
        const landTile = this.level.map[landPos.row][landPos.col];
        if (landTile !== TileType.WALL && landTile !== TileType.HOLE && landTile !== TileType.BRICK) {
          this.player.teleport(landPos);
          this.inventory.hasHook = false;
          this.inventory.tools = this.inventory.tools.filter(t => t !== 'hook');
          this.backdoorUsed = true;
          logInfo('ToolsExecutor', 'executeHook', `Hooked to wall at (${targetPos.col},${targetPos.row}), landed at (${landPos.col},${landPos.row})`);
          eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
          eventBus.emit('PLAYER_TELEPORT', { from: this.player.getPosition(), to: landPos });
        } else {
          log('ToolsExecutor', 'executeHook', `Cannot land in front of wall at (${targetPos.col},${targetPos.row})`);
        }
      } else {
        log('ToolsExecutor', 'executeHook', `Land position out of bounds`);
      }
    } else {
      log('ToolsExecutor', 'executeHook', 'No wall found within 3 cells');
    }

    return 'ok';
  }

  // --------------------------------------------------------------------------
  // 3. WING – активировать крылья на 2 хода
  // --------------------------------------------------------------------------
  public executeWing(): 'ok' {
    if (!this.inventory.hasWing) {
      log('ToolsExecutor', 'executeWing', 'No wings available');
      return 'ok';
    }

    // Активируем крылья на 2 хода
    this.wingActiveTurns = 2;
    this.inventory.hasWing = false;
    this.inventory.tools = this.inventory.tools.filter(t => t !== 'wing');
    this.backdoorUsed = true;
    logInfo('ToolsExecutor', 'executeWing', `Wings activated for ${this.wingActiveTurns} turns`);
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    eventBus.emit('WINGS_ACTIVATED', { turns: this.wingActiveTurns });
    return 'ok';
  }

  // --------------------------------------------------------------------------
  // 4. BAIT – использовать приманку (отвлекает монстров в радиусе 3)
  // --------------------------------------------------------------------------
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

    const pos = this.player.getPosition();
    const monsters = this.level.objects?.monsters || [];
    for (const monster of monsters) {
      const distance = Math.abs(monster.position.col - pos.col) + Math.abs(monster.position.row - pos.row);
      if (distance <= 3) {
        monster.isDistracted = true;
        monster.distractedTurns = 3;
        log('ToolsExecutor', 'executeBait', `Monster ${monster.id} distracted`);
      }
    }
    return 'ok';
  }

  // --------------------------------------------------------------------------
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ КРЫЛЬЕВ
  // --------------------------------------------------------------------------
  /**
   * Проверяет, активны ли крылья в текущий момент.
   */
  public hasActiveWing(): boolean {
    return this.wingActiveTurns > 0;
  }

  /**
   * Уменьшает счётчик активных крыльев на 1 (вызывается после каждого шага).
   * Когда счётчик достигает 0, генерируется событие WINGS_EXPIRED.
   */
  public decrementWingTurn(): void {
    if (this.wingActiveTurns > 0) {
      this.wingActiveTurns--;
      if (this.wingActiveTurns === 0) {
        logInfo('ToolsExecutor', 'decrementWingTurn', 'Wings effect expired');
        eventBus.emit('WINGS_EXPIRED');
      }
    }
  }

  /**
   * Возвращает оставшееся количество ходов полёта (для отображения в UI).
   */
  public getWingTurnsRemaining(): number {
    return this.wingActiveTurns;
  }

  // --------------------------------------------------------------------------
  // ПРОВЕРКА ИСПОЛЬЗОВАНИЯ ЧЁРНОГО ХОДА
  // --------------------------------------------------------------------------
  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
