import { PlayerProgress, LevelStats } from '../types/index';
import { logger } from '../core/Logger';
import { levelManager } from './LevelManager';
import { gameEvents } from '../core/EventBus';

const STORAGE_KEY = 'cyberkid_progress';

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

  public get(): PlayerProgress {
    return this.progress;
  }

  public getLevelStats(levelId: string): LevelStats | undefined {
    return this.progress.levelStats[levelId];
  }

  public completeLevel(levelId: string, stars: number, stepsUsed: number): void {
    const method = 'completeLevel';
    logger.info('ProgressManager', method, `Completing level: ${levelId} with ${stars} stars in ${stepsUsed} steps`);
    
    const existing = this.progress.levelStats[levelId];
    const stats: LevelStats = {
      stars: Math.max(stars, existing?.stars || 0),
      attempts: (existing?.attempts || 0) + 1,
      bestSteps: existing ? Math.min(stepsUsed, existing.bestSteps) : stepsUsed,
      completed: true,
      lastPlayed: Date.now(),
    };
    this.progress.levelStats[levelId] = stats;
    
    if (!this.progress.levelsCompleted.includes(levelId)) {
      this.progress.levelsCompleted.push(levelId);
      logger.debug('ProgressManager', method, `Level ${levelId} added to completed list`);
    }
    
    // Пересчёт общих звёзд
    let totalStars = 0;
    for (const st of Object.values(this.progress.levelStats)) {
      totalStars += st.stars;
    }
    this.progress.totalStars = totalStars;
    
    this.saveToLocalStorage();
    logger.info('ProgressManager', method, `Progress saved. Total stars: ${totalStars}`);
    
    // Отправляем событие обновления прогресса
    gameEvents.emit('PROGRESS_UPDATED', this.progress);
  }

  public isLevelUnlocked(levelId: string): boolean {
    const parts = levelId.split('_');
    const worldId = parts[0];
    const levelNum = parseInt(parts[1]);
    
    if (levelNum === 1) return true;
    
    const prevLevelId = `${worldId}_${(levelNum - 1).toString().padStart(3, '0')}`;
    const prevStats = this.progress.levelStats[prevLevelId];
    return prevStats?.completed || false;
  }

  public unlockWorld(worldId: string): void {
    const method = 'unlockWorld';
    if (!this.progress.unlockedWorlds.includes(worldId)) {
      this.progress.unlockedWorlds.push(worldId);
      logger.info('ProgressManager', method, `World ${worldId} unlocked`);
      this.saveToLocalStorage();
      gameEvents.emit('PROGRESS_UPDATED', this.progress);
    }
  }

  public isWorldUnlocked(worldId: string): boolean {
    if (worldId === 'meadow') return true;
    return this.progress.unlockedWorlds.includes(worldId);
  }

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
      unlockedWorlds: ['meadow'],
      lastPlayedWorld: 'meadow',
      lastPlayedLevelId: '',
      achievements: [],
      settings: {} as any,
    };
    
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        logger.debug('ProgressManager', 'loadFromLocalStorage', `Loaded progress from storage: ${Object.keys(parsed.levelStats || {}).length} levels completed`);
        return { ...defaultProgress, ...parsed, levelStats: parsed.levelStats || {} };
      }
    } catch (e) {
      logger.error('ProgressManager', 'loadFromLocalStorage', 'Failed to load progress', e);
    }
    return defaultProgress;
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
      logger.debug('ProgressManager', 'saveToLocalStorage', 'Progress saved');
    } catch (e) {
      logger.error('ProgressManager', 'saveToLocalStorage', 'Failed to save progress', e);
    }
  }

  public resetAll(): void {
    const method = 'resetAll';
    logger.warn('ProgressManager', method, 'Resetting all progress');
    localStorage.removeItem(STORAGE_KEY);
    this.progress = this.loadFromLocalStorage();
    gameEvents.emit('PROGRESS_UPDATED', this.progress);
  }
}

export const progressManager = ProgressManager.getInstance();
