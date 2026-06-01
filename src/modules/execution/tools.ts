// src/modules/execution/tools.ts
// ============================================================================
// ОБРАБОТЧИК КОМАНД ИНСТРУМЕНТОВ
// ============================================================================
// Реализует команды:
// - DRILL  – разрушить стену перед игроком (расходует дрель)
// - HOOK   – притянуться к стене в пределах 3 клеток (расходует крюк)
// - WING   – активировать крылья (позволяет летать над ямами/лавой/водой, расходует)
// - BAIT   – использовать приманку (отвлекает монстров в радиусе 3, расходует)
// ============================================================================
// Все инструменты одноразовые (исчезают после использования).
// При изменении инвентаря генерируется событие INVENTORY_CHANGED.
// ============================================================================

import { TileType, Inventory } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import { log, logInfo, logError } from './helpers';

export class ToolsExecutor {
  private level: any;           // уровень (карта и объекты)
  private player: any;          // игрок (для позиции и телепортации)
  private inventory: Inventory; // инвентарь (будет мутироваться)
  private backdoorUsed: boolean; // флаг чёрного хода (если инструмент даёт преимущество)

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

    // Определяем клетку впереди игрока
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

    // Можно разрушить обычную стену или фальшивую стену
    if (tile === TileType.WALL || tile === TileType.FAKE_WALL) {
      // Превращаем стену в платформу
      this.level.map[wallPos.row][wallPos.col] = TileType.PLATFORM;
      // Расходуем дрель
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
    // Ищем стену в пределах 3 клеток
    for (let i = 1; i <= 3; i++) {
      const checkPos = {
        col: this.player.getPosition().col + dx * i,
        row: this.player.getPosition().row + dy * i,
      };
      // Проверка границ
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
      // Телепортируем игрока на клетку со стеной (или перед стеной? – в оригинале на стену)
      // Но на стену вставать нельзя. Лучше телепортировать на клетку ПЕРЕД стеной.
      // Упростим: телепортируем на позицию стены, но затем стену разрушаем? Нет, так нечестно.
      // Реализуем классический крюк: игрок притягивается к стене и останавливается перед ней.
      // Для этого targetPos – это позиция стены, а мы перемещаем игрока на клетку перед ней.
      const landPos = {
        col: targetPos.col - dx,
        row: targetPos.row - dy,
      };
      // Проверяем, что клетка перед стеной существует и проходима
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
          return 'ok';
        }
      }
      // Если не получилось приземлиться – просто не используем крюк
      log('ToolsExecutor', 'executeHook', `Cannot land in front of wall at (${targetPos.col},${targetPos.row})`);
    } else {
      log('ToolsExecutor', 'executeHook', 'No wall found within 3 cells');
    }

    return 'ok';
  }

  // --------------------------------------------------------------------------
  // 3. WING – активировать крылья (даёт способность перелетать ямы/лаву/воду)
  // --------------------------------------------------------------------------
  public executeWing(): 'ok' {
    if (!this.inventory.hasWing) {
      log('ToolsExecutor', 'executeWing', 'No wings available');
      return 'ok';
    }

    // Крылья активируются мгновенно, и игрок теперь может перелетать опасные тайлы.
    // Эффект уже учтён в MovementExecutor (проверка hasWing при входе на яму/лаву/воду).
    this.inventory.hasWing = false;
    this.inventory.tools = this.inventory.tools.filter(t => t !== 'wing');
    logInfo('ToolsExecutor', 'executeWing', 'Wings activated (can fly over holes/lava/water)');
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
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

    // Отвлечение монстров: все монстры в радиусе 3 клеток становятся отвлечёнными на 3 хода
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
  // ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ ПРОВЕРКИ ЧЁРНОГО ХОДА
  // --------------------------------------------------------------------------
  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
