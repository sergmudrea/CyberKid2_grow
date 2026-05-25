// src/modules/execution/monsters.ts
// Взаимодействие с монстрами: приручение, верховая езда, убийство, отвлечение

import { Point, Inventory } from '../../types/index';
import { gameEvents as eventBus } from '../../core/EventBus';
import { log, logInfo, logError } from './helpers';

export class MonstersExecutor {
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
   * Приручить монстра (кормление кукурузой)
   */
  public tameMonster(monsterId: string): boolean {
    const monster = this.level.objects.monsters?.find((m: any) => m.id === monsterId);
    if (!monster) {
      log('MonstersExecutor', 'tameMonster', `Monster ${monsterId} not found`);
      return false;
    }

    if (this.inventory.corn === 0) {
      log('MonstersExecutor', 'tameMonster', `No corn to tame monster ${monsterId}`);
      return false;
    }

    if (monster.isTamed) {
      log('MonstersExecutor', 'tameMonster', `Monster ${monsterId} is already tamed`);
      return false;
    }

    monster.isTamed = true;
    this.inventory.corn--;
    this.backdoorUsed = true;
    logInfo('MonstersExecutor', 'tameMonster', `Monster ${monsterId} tamed`);
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    eventBus.emit('MONSTER_TAMED', { monsterId, pos: monster.position });
    return true;
  }

  /**
   * Убить монстра (ядром или дрелью)
   */
  public killMonster(monsterId: string, method: 'core' | 'drill'): boolean {
    const monsterIndex = this.level.objects.monsters?.findIndex((m: any) => m.id === monsterId);
    if (monsterIndex === -1 || monsterIndex === undefined) {
      log('MonstersExecutor', 'killMonster', `Monster ${monsterId} not found`);
      return false;
    }

    const monster = this.level.objects.monsters[monsterIndex];
    if (method === 'core') {
      if (this.inventory.cores === 0) {
        log('MonstersExecutor', 'killMonster', `No cores to kill monster ${monsterId}`);
        return false;
      }
      this.inventory.cores--;
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    } else if (method === 'drill') {
      if (!this.inventory.hasDrill) {
        log('MonstersExecutor', 'killMonster', `No drill to kill monster ${monsterId}`);
        return false;
      }
      this.inventory.hasDrill = false;
      this.inventory.tools = this.inventory.tools.filter(t => t !== 'drill');
      eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    }

    this.level.objects.monsters.splice(monsterIndex, 1);
    this.backdoorUsed = true;
    logInfo('MonstersExecutor', 'killMonster', `Monster ${monsterId} killed with ${method}`);
    eventBus.emit('MONSTER_KILLED', { monsterId, method, pos: monster.position });
    return true;
  }

  /**
   * Оседлать приручённого монстра
   */
  public rideMonster(monsterId: string): boolean {
    const monster = this.level.objects.monsters?.find((m: any) => m.id === monsterId);
    if (!monster) {
      log('MonstersExecutor', 'rideMonster', `Monster ${monsterId} not found`);
      return false;
    }

    if (!monster.isTamed) {
      log('MonstersExecutor', 'rideMonster', `Monster ${monsterId} is not tamed`);
      return false;
    }

    if (monster.isRidden) {
      log('MonstersExecutor', 'rideMonster', `Monster ${monsterId} is already ridden`);
      return false;
    }

    monster.isRidden = true;
    this.player.rideMonster(monster);
    this.backdoorUsed = true;
    logInfo('MonstersExecutor', 'rideMonster', `Riding monster ${monsterId}`);
    eventBus.emit('MONSTER_RIDDEN', { monsterId, pos: monster.position });
    return true;
  }

  /**
   * Отвлечь монстра (приманкой)
   */
  public distractMonster(monsterId: string, turns: number = 3): boolean {
    const monster = this.level.objects.monsters?.find((m: any) => m.id === monsterId);
    if (!monster) {
      log('MonstersExecutor', 'distractMonster', `Monster ${monsterId} not found`);
      return false;
    }

    monster.distracted = true;
    monster.distractedTurns = turns;
    this.backdoorUsed = true;
    logInfo('MonstersExecutor', 'distractMonster', `Monster ${monsterId} distracted for ${turns} turns`);
    eventBus.emit('MONSTER_DISTRACTED', { monsterId, turns });
    return true;
  }

  /**
   * Обновление состояния отвлечённых монстров (уменьшение счётчика)
   */
  public updateDistractedMonsters(): void {
    for (const monster of this.level.objects.monsters) {
      if (monster.distracted) {
        monster.distractedTurns--;
        if (monster.distractedTurns <= 0) {
          monster.distracted = false;
          delete monster.distractedTurns;
          log('MonstersExecutor', 'updateDistractedMonsters', `Monster ${monster.id} is no longer distracted`);
        }
      }
    }
  }

  /**
   * Получить монстра по позиции
   */
  public getMonsterAt(pos: Point): any | null {
    return this.level.objects.monsters?.find((m: any) => 
      m.position.col === pos.col && m.position.row === pos.row
    ) || null;
  }

  /**
   * Получить всех монстров
   */
  public getAllMonsters(): any[] {
    return [...(this.level.objects.monsters || [])];
  }

  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
