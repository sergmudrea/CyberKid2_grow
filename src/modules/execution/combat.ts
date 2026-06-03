// src/modules/execution/combat.ts
// ============================================================================
// БОЕВЫЕ КОМАНДЫ – ПОЛНАЯ ВЕРСИЯ ПАТЧА 2.0
// ============================================================================
// Реализует команды:
// - THROW – бросить ядро в монстра перед игроком (в направлении башни)
// - FEED  – накормить монстра кукурузой в направлении башни
// ============================================================================
// Все действия выполняются по направлению башни (не корпуса).
// ============================================================================

import { TileType, Inventory } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import { log, logInfo, logError } from './helpers';

export class CombatExecutor {
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

  // --------------------------------------------------------------------------
  // 1. THROW – бросить ядро в монстра перед игроком (по направлению башни)
  // --------------------------------------------------------------------------
  public executeThrow(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    if (this.inventory.cores === 0) {
      log('CombatExecutor', 'executeThrow', 'No cores available');
      return 'ok';
    }

    // Используем угол башни для определения направления броска
    const turretAngle = this.player.getTurretAngle();
    let dx = 0, dy = 0;
    switch (turretAngle) {
      case 0:   dy = -1; break;
      case 90:  dx = 1;  break;
      case 180: dy = 1;  break;
      case 270: dx = -1; break;
      default:
        log('CombatExecutor', 'executeThrow', `Invalid turret angle ${turretAngle}`);
        return 'ok';
    }

    const targetPos = {
      col: this.player.getPosition().col + dx,
      row: this.player.getPosition().row + dy,
    };

    const monsters = this.level.objects?.monsters || [];
    const monsterIndex = monsters.findIndex((m: any) =>
      m.position.col === targetPos.col && m.position.row === targetPos.row
    );

    if (monsterIndex !== -1) {
      const monster = monsters[monsterIndex];
      monsters.splice(monsterIndex, 1);
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
  // 2. FEED – накормить монстра кукурузой (приручить) по направлению башни
  // --------------------------------------------------------------------------
  public executeFeed(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    if (this.inventory.corn === 0) {
      log('CombatExecutor', 'executeFeed', 'No corn available');
      return 'ok';
    }

    const turretAngle = this.player.getTurretAngle();
    let dx = 0, dy = 0;
    switch (turretAngle) {
      case 0:   dy = -1; break;
      case 90:  dx = 1;  break;
      case 180: dy = 1;  break;
      case 270: dx = -1; break;
      default:
        log('CombatExecutor', 'executeFeed', `Invalid turret angle ${turretAngle}`);
        return 'ok';
    }

    const targetPos = {
      col: this.player.getPosition().col + dx,
      row: this.player.getPosition().row + dy,
    };

    const monsters = this.level.objects?.monsters || [];
    const monster = monsters.find((m: any) =>
      m.position.col === targetPos.col && m.position.row === targetPos.row
    );

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
  // ПРОВЕРКА ЧЁРНОГО ХОДА
  // --------------------------------------------------------------------------
  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
