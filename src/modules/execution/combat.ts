// src/modules/execution/combat.ts
// Команды боя: THROW (бросить ядро), FEED (накормить монстра)

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

  /**
   * THROW — бросить ядро в монстра перед игроком
   */
  public executeThrow(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    if (this.inventory.cores === 0) {
      log('CombatExecutor', 'executeThrow', 'No cores available');
      return 'ok';
    }

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

    const monsterIndex = this.level.objects.monsters?.findIndex((m: any) =>
      m.position.col === targetPos.col && m.position.row === targetPos.row
    );

    if (monsterIndex !== -1 && monsterIndex !== undefined) {
      const monster = this.level.objects.monsters[monsterIndex];
      this.level.objects.monsters.splice(monsterIndex, 1);
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

  /**
   * FEED — накормить монстра кукурузой (приручить)
   */
  public executeFeed(lastDirection: 'up' | 'down' | 'left' | 'right'): 'ok' {
    if (this.inventory.corn === 0) {
      log('CombatExecutor', 'executeFeed', 'No corn available');
      return 'ok';
    }

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

    const monster = this.level.objects.monsters?.find((m: any) =>
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

  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
