// src/managers/UnlockManager.ts
// ============================================================================
// МЕНЕДЖЕР РАЗБЛОКИРОВОК (UNLOCK MANAGER)
// ============================================================================
// Каталог премиум-миров с симуляцией покупки.
// Данные хранятся в localStorage под ключом 'cyberkid_purchases'.
// ============================================================================

import { logger } from '../core/Logger';
import { progressManager } from './ProgressManager';

const STORAGE_KEY = 'cyberkid_purchases';

interface WorldCatalogEntry {
  worldId: string;
  name: string;
  price: string;
}

const PREMIUM_WORLDS: WorldCatalogEntry[] = [
  { worldId: 'ocean',     name: 'Ocean',     price: '$2.99' },
  { worldId: 'clouds',    name: 'Clouds',    price: '$2.99' },
  { worldId: 'fairytale', name: 'Fairytale', price: '$3.99' },
  { worldId: 'volcano',   name: 'Volcano',   price: '$4.99' },
  { worldId: 'bonus',     name: 'Bonus',     price: '$9.99' },
];

export class UnlockManager {
  private static instance: UnlockManager;
  private purchased: Set<string>;

  private constructor() {
    this.purchased = this.loadFromStorage();
  }

  public static getInstance(): UnlockManager {
    if (!UnlockManager.instance) {
      UnlockManager.instance = new UnlockManager();
    }
    return UnlockManager.instance;
  }

  /** Проверить, куплен ли мир */
  public isPurchased(worldId: string): boolean {
    return this.purchased.has(worldId);
  }

  /** Симуляция покупки — сразу успех */
  public purchase(worldId: string): boolean {
    logger.info('UnlockManager', 'purchase', `Purchasing world: ${worldId}`);
    this.purchased.add(worldId);
    this.saveToStorage();
    progressManager.unlockWorld(worldId);
    logger.info('UnlockManager', 'purchase', `World ${worldId} purchased and unlocked`);
    return true;
  }

  /** Восстановить покупки (разблокировать все купленные миры) */
  public restorePurchases(): void {
    logger.info('UnlockManager', 'restorePurchases', `Restoring ${this.purchased.size} purchases`);
    for (const worldId of this.purchased) {
      progressManager.unlockWorld(worldId);
    }
  }

  /** Получить цену мира */
  public getPrice(worldId: string): string {
    const entry = PREMIUM_WORLDS.find(w => w.worldId === worldId);
    return entry?.price ?? '$?.??';
  }

  /** Получить имя мира */
  public getWorldName(worldId: string): string {
    const entry = PREMIUM_WORLDS.find(w => w.worldId === worldId);
    return entry?.name ?? worldId;
  }

  /** Список всех премиум-миров */
  public getCatalog(): WorldCatalogEntry[] {
    return [...PREMIUM_WORLDS];
  }

  private loadFromStorage(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        return new Set(arr);
      }
    } catch (e) {
      logger.error('UnlockManager', 'loadFromStorage', 'Failed to load', e);
    }
    return new Set();
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.purchased)));
    } catch (e) {
      logger.error('UnlockManager', 'saveToStorage', 'Failed to save', e);
    }
  }
}

export const unlockManager = UnlockManager.getInstance();
