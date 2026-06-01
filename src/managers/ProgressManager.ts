// src/managers/ProgressManager.ts
// ============================================================================
// МЕНЕДЖЕР ПРОГРЕССА (PROGRESS MANAGER)
// ============================================================================
// Отвечает за сохранение и загрузку прогресса игрока:
// - количество звёзд за уровни
// - лучшие шаги
// - количество попыток
// - разблокированные миры
// - общая статистика (смерти, время, чёрные ходы и т.д.)
// ============================================================================
// Данные хранятся в localStorage под ключом 'cyberkid_progress'.
// ============================================================================

import { PlayerProgress, LevelStats } from '../types/index';
import { logger } from '../core/Logger';
import { levelManager } from './LevelManager';
import { gameEvents } from '../core/EventBus';

const STORAGE_KEY = 'cyberkid_progress';   // ключ в localStorage

export class ProgressManager {
  private static instance: ProgressManager;
  private progress: PlayerProgress;

  private constructor() {
    this.progress = this.loadFromLocalStorage();
  }

  public static getInstance(): ProgressManager {
    if (!ProgressManager.instance) {
      ProgressManager.instance = new ProgressManager();
    }
    return ProgressManager.instance;
  }

  // --------------------------------------------------------------------------
  // Получить весь объект прогресса (для чтения)
  // --------------------------------------------------------------------------
  public get(): PlayerProgress {
    return this.progress;
  }

  // --------------------------------------------------------------------------
  // Получить статистику по конкретному уровню (или undefined)
  // --------------------------------------------------------------------------
  public getLevelStats(levelId: string): LevelStats | undefined {
    return this.progress.levelStats[levelId];
  }

  // --------------------------------------------------------------------------
  // Завершить уровень (вызывается при победе)
  // - stars: количество звёзд (0-3)
  // - stepsUsed: количество шагов, потраченных игроком
  // Обновляет лучшие показатели, увеличивает счётчик попыток,
  // пересчитывает общее количество звёзд, сохраняет в localStorage.
  // --------------------------------------------------------------------------
  public completeLevel(levelId: string, stars: number, stepsUsed: number): void {
    const method = 'completeLevel';
    logger.info('ProgressManager', method, `Completing ${levelId}: ${stars}★ in ${stepsUsed} steps`);

    const existing = this.progress.levelStats[levelId];
    const stats: LevelStats = {
      stars: Math.max(stars, existing?.stars || 0),
      attempts: (existing?.attempts || 0) + 1,
      bestSteps: existing ? Math.min(stepsUsed, existing.bestSteps) : stepsUsed,
      completed: true,
      lastPlayed: Date.now(),
    };
    this.progress.levelStats[levelId] = stats;

    // Добавляем в список пройденных, если ещё не было
    if (!this.progress.levelsCompleted.includes(levelId)) {
      this.progress.levelsCompleted.push(levelId);
    }

    // Пересчитываем общее количество звёзд
    let totalStars = 0;
    for (const st of Object.values(this.progress.levelStats)) {
      totalStars += st.stars;
    }
    this.progress.totalStars = totalStars;

    this.saveToLocalStorage();

    // Оповещаем остальные части игры (например, LevelSelect, WorldMap) об обновлении прогресса
    gameEvents.emit('PROGRESS_UPDATED', this.progress);
  }

  // --------------------------------------------------------------------------
  // Проверить, разблокирован ли уровень (исходя из прогресса)
  // Правила: первый уровень мира всегда открыт; следующие – только если предыдущий пройден.
  // Для Arcade мира действует другое правило: уровень открыт, если он уже пройден (completed).
  // --------------------------------------------------------------------------
  public isLevelUnlocked(levelId: string): boolean {
    const parts = levelId.split('_');
    const worldId = parts[0];
    const levelNum = parseInt(parts[1], 10);
    const world = worldId;

    // Для Arcade: уровень открыт только если он уже пройден
    if (world === 'arcade') {
      const stats = this.progress.levelStats[levelId];
      return stats?.completed === true;
    }

    // Первый уровень всегда открыт
    if (levelNum === 1) return true;

    // Иначе смотрим предыдущий уровень в том же мире
    const prevLevelId = `${world}_${(levelNum - 1).toString().padStart(3, '0')}`;
    const prevStats = this.progress.levelStats[prevLevelId];
    return prevStats?.completed || false;
  }

  // --------------------------------------------------------------------------
  // Разблокировать мир (добавить в unlockedWorlds, если ещё не добавлен)
  // --------------------------------------------------------------------------
  public unlockWorld(worldId: string): void {
    if (!this.progress.unlockedWorlds.includes(worldId)) {
      this.progress.unlockedWorlds.push(worldId);
      logger.info('ProgressManager', 'unlockWorld', `World ${worldId} unlocked`);
      this.saveToLocalStorage();
      gameEvents.emit('PROGRESS_UPDATED', this.progress);
    }
  }

  // --------------------------------------------------------------------------
  // Проверить, разблокирован ли мир (Meadow всегда открыт)
  // --------------------------------------------------------------------------
  public isWorldUnlocked(worldId: string): boolean {
    if (worldId === 'meadow') return true;
    return this.progress.unlockedWorlds.includes(worldId);
  }

  // --------------------------------------------------------------------------
  // Загрузка прогресса из localStorage (или создание нового, если ничего нет)
  // --------------------------------------------------------------------------
  private loadFromLocalStorage(): PlayerProgress {
    const defaultProgress: PlayerProgress = {
      totalStars: 0,
      totalBlackStars: 0,
      levelsCompleted: [],
      perfectLevels: [],
      levelStats: {},
      totalAttempts: 0,
      totalDeaths: 0,
      deathsByType: {},
      totalPlayTimeSec: 0,
      explorationUsedCount: 0,
      backdoorsFound: 0,
      unlockedWorlds: ['meadow'],   // Meadow всегда открыт
      lastPlayedWorld: 'meadow',
      lastPlayedLevelId: '',
      achievements: [],
      settings: {} as any,
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Мержим с default, чтобы избежать отсутствия полей при обновлении игры
        const merged = { ...defaultProgress, ...parsed, levelStats: parsed.levelStats || {} };
        logger.debug('ProgressManager', 'loadFromLocalStorage', `Loaded progress: ${Object.keys(merged.levelStats).length} levels completed`);
        return merged;
      }
    } catch (e) {
      logger.error('ProgressManager', 'loadFromLocalStorage', 'Failed to load', e);
    }
    return defaultProgress;
  }

  // --------------------------------------------------------------------------
  // Сохранить текущий прогресс в localStorage
  // --------------------------------------------------------------------------
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
      logger.debug('ProgressManager', 'saveToLocalStorage', 'Saved');
    } catch (e) {
      logger.error('ProgressManager', 'saveToLocalStorage', 'Failed to save', e);
    }
  }

  // --------------------------------------------------------------------------
  // Полный сброс прогресса (удаляет данные, создаёт новый)
  // --------------------------------------------------------------------------
  public resetAll(): void {
    logger.warn('ProgressManager', 'resetAll', 'Resetting all progress');
    localStorage.removeItem(STORAGE_KEY);
    this.progress = this.loadFromLocalStorage();
    gameEvents.emit('PROGRESS_UPDATED', this.progress);
  }
}

// Экспортируем синглтон
export const progressManager = ProgressManager.getInstance();
