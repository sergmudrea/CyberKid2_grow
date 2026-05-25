// src/modules/execution/parallelism.ts
// Полная поддержка параллелизма: CLONE, JOIN
// Клоны выполняются параллельно (чередование шагов), обновляют позиции, суммируют инвентарь при JOIN.

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
   * CLONE — создать клона
   */
  public createClone(
    playerPos: Point,
    currentInventory: Inventory,
    currentAST: ASTNode[],
    currentNodeIndex: number
  ): string {
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
    
    logInfo('ParallelismExecutor', 'createClone', `Clone '${cloneId}' created at (${playerPos.col},${playerPos.row})`);
    eventBus.emit('CLONE_CREATED', { cloneId, pos: playerPos });
    return cloneId;
  }

  /**
   * Обновить позицию клона
   */
  public updateClonePosition(cloneId: string, newPos: Point): void {
    const clone = this.clones.get(cloneId);
    if (clone) {
      clone.position = newPos;
      log('ParallelismExecutor', 'updateClonePosition', `Clone ${cloneId} moved to (${newPos.col},${newPos.row})`);
    }
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
   * JOIN — объединить всех клонов в основного игрока
   */
  public joinClones(): void {
    if (this.clones.size === 0) {
      log('ParallelismExecutor', 'joinClones', 'No clones to join');
      return;
    }

    for (const [cloneId, clone] of this.clones) {
      // Суммируем инвентарь
      for (const key of clone.inventory.keys) {
        if (!this.inventory.keys.includes(key)) {
          this.inventory.keys.push(key);
        }
      }
      this.inventory.corn += clone.inventory.corn;
      this.inventory.cores += clone.inventory.cores;
      if (clone.inventory.hasDrill) this.inventory.hasDrill = true;
      if (clone.inventory.hasHook) this.inventory.hasHook = true;
      if (clone.inventory.hasWing) this.inventory.hasWing = true;
      if (clone.inventory.hasBait) this.inventory.hasBait = true;
      for (const tool of clone.inventory.tools) {
        if (!this.inventory.tools.includes(tool)) {
          this.inventory.tools.push(tool);
        }
      }
      log('ParallelismExecutor', 'joinClones', `Merged clone '${cloneId}' inventory`);
    }

    this.clones.clear();
    this.backdoorUsed = true;
    logInfo('ParallelismExecutor', 'joinClones', `All clones joined, inventory updated`);
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.inventory });
    eventBus.emit('CLONES_JOINED');
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
