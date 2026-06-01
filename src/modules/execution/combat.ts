// src/modules/execution/combat.ts
// ============================================================================
// ОБРАБОТЧИК БОЕВЫХ КОМАНД
// ============================================================================
// Реализует команды:
// - THROW – бросить ядро в монстра перед игроком (уничтожает монстра, расходует ядро)
// - FEED  – накормить монстра кукурузой (приручает, расходует кукурузу)
// ============================================================================
// Обе команды требуют, чтобы перед игроком (в направлении взгляда) находился монстр.
// THROW уничтожает любого монстра, FEED работает только на tameable и patrol.
// ============================================================================

import { TileType, Inventory } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import { log, logInfo, logError } from './helpers';

export class CombatExecutor {
  private level: any;           // уровень (объекты, монстры)
  private player: any;          // игрок (для позиции и направления)
  private inventory: Inventory; // инвентарь (расходуем ядра/кукурузу)
  private backdoorUsed: boolean;

  constructor(level: any, player: any, inventory: Inventory) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
    this.backdoorUsed = false;
  }

  // --------------------------------------------------------------------------
  // 1. THROW – бросить ядро в монстра перед игроком
  // --------------------------------------------------------------------------
  public executeThrow(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    if (this.inventory.cores === 0) {
      log('CombatExecutor', 'executeThrow', 'No cores available');
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
    const targetPos = {
      col: this.player.getPosition().col + dx,
      row: this.player.getPosition().row + dy,
    };

    // Ищем монстра на этой позиции
    const monsters = this.level.objects?.monsters || [];
    const monsterIndex = monsters.findIndex((m: any) =>
      m.position.col === targetPos.col && m.position.row === targetPos.row
    );

    if (monsterIndex !== -1) {
      const monster = monsters[monsterIndex];
      // Удаляем монстра
      monsters.splice(monsterIndex, 1);
      // Расходуем одно ядро
      this.inventory.cores--;
      this.backdoorUsed = true;
      logInfo('CombatExecutor', 'executeThrow', `Core thrown at monster at (${targetPos.col},${targetPos.row}), monster destroyed`);
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
      eventBus.emit('MONSTER_KILLED', { monsterId: monster.id, pos: targetPos });
    } else {
      log('CombatExecutor', 'executeThrow', `No monster at (${targetPos.col},${targetPos.row})`);
    }

    return 'ok';
  }

  // --------------------------------------------------------------------------
  // 2. FEED – накормить монстра кукурузой (приручить)
  // --------------------------------------------------------------------------
  public executeFeed(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    if (this.inventory.corn === 0) {
      log('CombatExecutor', 'executeFeed', 'No corn available');
      return 'ok';
    }

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

    const monsters = this.level.objects?.monsters || [];
    const monster = monsters.find((m: any) =>
      m.position.col === targetPos.col && m.position.row === targetPos.row
    );

    // Приручить можно tameable или patrol монстра
    if (monster && (monster.type === 'tameable' || monster.type === 'patrol')) {
      monster.isTamed = true;
      this.inventory.corn--;
      this.backdoorUsed = true;
      logInfo('CombatExecutor', 'executeFeed', `Monster tamed at (${targetPos.col},${targetPos.row})`);
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
      eventBus.emit('MONSTER_TAMED', { monsterId: monster.id, pos: targetPos });
    } else {
      log('CombatExecutor', 'executeFeed', `No tameable monster at (${targetPos.col},${targetPos.row})`);
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
