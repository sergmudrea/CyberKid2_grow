// src/modules/execution/parallelism.ts
// Команды параллелизма: CLONE, JOIN

import { Point, Inventory } from '../../types/index';
import { ASTNode, CloneInfo } from './types';
import { log, logInfo, logError, copyInventory } from './helpers';
import { gameEvents as eventBus } from '../../core/EventBus';

export class ParallelismExecutor {
  private level: any;
  private player: any;
  private inventory: Inventory;
  private clones: Map<string, CloneInfo> = new Map();
  private backdoorUsed: boolean;

  constructor(level: any, player: any, inventory: Inventory) {
    this.level = level;
    this.player = player;
    this.inventory = inventory;
    this.backdoorUsed = false;
  }

  /**
   * CLONE — создать клона игрока на текущей позиции
   */
  public executeClone(
    playerPos: Point,
    currentInventory: Inventory,
    currentAST: ASTNode[],
    currentNodeIndex: number
  ): 'ok' {
    const cloneId = `clone_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const cloneInventory = copyInventory(currentInventory);
    
    const clone: CloneInfo = {
      id: cloneId,
      position: { ...playerPos },
      inventory: cloneInventory,
      ast: [...currentAST],
      nodeIndex: currentNodeIndex,
    };

    this.clones.set(cloneId, clone);
    this.backdoorUsed = true;
    
    logInfo('ParallelismExecutor', 'executeClone', `Clone '${cloneId}' created at (${playerPos.col},${playerPos.row})`);
    eventBus.emit('CLONE_CREATED', { cloneId, pos: playerPos });
    
    return 'ok';
  }

  /**
   * JOIN — объединить всех клонов, суммируя их инвентарь
   */
  public executeJoin(primaryInventory: Inventory): 'ok' {
    if (this.clones.size === 0) {
      log('ParallelismExecutor', 'executeJoin', 'No clones to join');
      return 'ok';
    }

    // Суммируем инвентарь всех клонов в основной инвентарь
    for (const [cloneId, clone] of this.clones) {
      // Ключи
      for (const key of clone.inventory.keys) {
        if (!primaryInventory.keys.includes(key)) {
          primaryInventory.keys.push(key);
        }
      }
      // Кукуруза
      primaryInventory.corn += clone.inventory.corn;
      // Ядра
      primaryInventory.cores += clone.inventory.cores;
      // Инструменты
      if (clone.inventory.hasDrill) primaryInventory.hasDrill = true;
      if (clone.inventory.hasHook) primaryInventory.hasHook = true;
      if (clone.inventory.hasWing) primaryInventory.hasWing = true;
      if (clone.inventory.hasBait) primaryInventory.hasBait = true;
      // Инструменты в массиве
      for (const tool of clone.inventory.tools) {
        if (!primaryInventory.tools.includes(tool)) {
          primaryInventory.tools.push(tool);
        }
      }
      
      log('ParallelismExecutor', 'executeJoin', `Merged clone '${cloneId}' inventory`);
    }

    this.clones.clear();
    this.backdoorUsed = true;
    logInfo('ParallelismExecutor', 'executeJoin', `Joined ${this.clones.size} clones, inventory updated`);
    eventBus.emit('INVENTORY_CHANGED', { inventory: primaryInventory });
    eventBus.emit('CLONES_JOINED', { count: this.clones.size });
    
    return 'ok';
  }

  /**
   * Получить всех клонов
   */
  public getClones(): CloneInfo[] {
    return Array.from(this.clones.values());
  }

  /**
   * Получить клона по ID
   */
  public getClone(cloneId: string): CloneInfo | undefined {
    return this.clones.get(cloneId);
  }

  /**
   * Удалить клона
   */
  public removeClone(cloneId: string): void {
    this.clones.delete(cloneId);
    log('ParallelismExecutor', 'removeClone', `Clone '${cloneId}' removed`);
  }

  public isBackdoorUsed(): boolean {
    return this.backdoorUsed;
  }
}
